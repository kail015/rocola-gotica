import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { generateNequiPayment, checkPaymentStatus } from './nequi-payment.js';
import { WompiPayment } from './wompi-payment.js';
import { ConfigLoader } from './config-loader.js';
import multer from 'multer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Permite conexiones desde cualquier origen
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const HOST = '0.0.0.0'; // Permite acceso desde internet

// Asegurar que existe la carpeta data
const dataDir = join(__dirname, 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Crear carpeta para anuncios
const adsDir = join(__dirname, 'ads');
if (!existsSync(adsDir)) {
  mkdirSync(adsDir, { recursive: true });
}
app.use('/ads', express.static(adsDir));

// Archivos de datos
const QUEUE_FILE = join(dataDir, 'queue.json');
const CHAT_FILE = join(dataDir, 'chat.json');
const MENU_FILE = join(dataDir, 'menu.json');

// Funciones para leer/escribir datos
const readData = (file, defaultValue = []) => {
  try {
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, 'utf-8'));
    }
    writeFileSync(file, JSON.stringify(defaultValue, null, 2));
    return defaultValue;
  } catch (error) {
    console.error(`Error reading ${file}:`, error);
    return defaultValue;
  }
};

const writeData = (file, data) => {
  try {
    writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing ${file}:`, error);
  }
};

// Estado inicial
let queue = readData(QUEUE_FILE, []);
console.log(`📦 Cola cargada desde archivo: ${queue.length} canciones`);

// Asegurar que todas las canciones en la cola tengan el array likedBy
queue = queue.map(song => ({
  ...song,
  likedBy: song.likedBy || [],
  likes: song.likes || 0
}));

let chatMessages = readData(CHAT_FILE, []);
let menu = readData(MENU_FILE, []);

let currentSong = null;
let connectedUsers = 0;
let pendingPayments = {}; // { reference: { songId, amount, timestamp } }
let currentAdvertisement = null; // { filename, uploadedAt, uploadedBy }
let songsPlayedSinceAd = 0; // Contador de canciones desde último anuncio

// Caché de búsquedas de YouTube (reduce consumo de API)
const searchCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos
let apiCallsToday = 0;

// Limpiar caché expirado cada 10 minutos
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp >= CACHE_DURATION) {
      searchCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Caché limpiado: ${cleaned} entradas eliminadas. Quedan: ${searchCache.size}`);
  }
}, 10 * 60 * 1000);

// Log de inicio del servidor
console.log('🚀 Servidor iniciando...');
console.log(`📁 Directorio de datos: ${dataDir}`);
console.log(`📝 Archivo de cola: ${QUEUE_FILE}`);

// Función para ordenar la cola correctamente
function sortQueue(queue) {
  return queue.sort((a, b) => {
    // 1. Canciones con prioridad pagada van primero (ordenadas por timestamp)
    if (a.paidPriority && b.paidPriority) {
      return a.paymentTimestamp - b.paymentTimestamp; // Primera en pagar = primera en cola
    }
    if (a.paidPriority) return -1; // a va antes
    if (b.paidPriority) return 1;  // b va antes
    
    // 2. Canciones con priority (likes) van después (ordenadas por likes)
    if (a.priority && b.priority) {
      return b.likes - a.likes; // Más likes primero
    }
    if (a.priority) return -1;
    if (b.priority) return 1;
    
    // 3. Canciones normales al final (ordenadas por likes)
    return b.likes - a.likes;
  });
}

// API Routes

// Iniciar pago de prioridad para una canción
app.post('/api/payment/priority', async (req, res) => {
  const { songId } = req.body;
  
  const song = queue.find(s => s.id === songId);
  if (!song) {
    return res.status(404).json({ error: 'Canción no encontrada' });
  }
  
  // Generar referencia única
  const reference = `PRIORITY-${uuidv4().slice(0, 8).toUpperCase()}`;
  const amount = 1000; // $1,000 COP
  
  // Guardar pago pendiente
  pendingPayments[reference] = {
    songId,
    amount,
    timestamp: Date.now(),
    songTitle: song.title
  };
  
  // Nota: Por ahora devolvemos un código de pago simulado
  // En producción, aquí se llamaría a generateNequiPayment()
  res.json({
    success: true,
    reference,
    amount,
    paymentUrl: `nequi://payment/${reference}`,
    qrData: JSON.stringify({
      type: 'nequi_payment',
      reference,
      amount,
      phone: process.env.NEQUI_BUSINESS_PHONE || '3001234567'
    })
  });
});

// Confirmar pago y dar prioridad a la canción
app.post('/api/payment/confirm', async (req, res) => {
  const { reference } = req.body;
  
  const payment = pendingPayments[reference];
  if (!payment) {
    return res.status(404).json({ error: 'Pago no encontrado' });
  }
  
  // Buscar la canción en la cola
  const songIndex = queue.findIndex(s => s.id === payment.songId);
  if (songIndex === -1) {
    return res.status(404).json({ error: 'Canción no encontrada en la cola' });
  }
  
  // Mover la canción al inicio de la cola
  const [song] = queue.splice(songIndex, 1);
  song.priority = true;
  song.paidPriority = true;
  queue.unshift(song);
  
  writeData(QUEUE_FILE, queue);
  io.emit('queue-update', queue);
  
  // Eliminar pago pendiente
  delete pendingPayments[reference];
  
  console.log(`✅ Pago confirmado: ${song.title} movida al inicio de la cola`);
  
  res.json({
    success: true,
    message: 'Tu canción ahora es la primera en la cola',
    song: song
  });
});

// Verificar estado de pago (polling endpoint)
app.get('/api/payment/status/:reference', async (req, res) => {
  const { reference } = req.params;
  
  const payment = pendingPayments[reference];
  if (!payment) {
    return res.status(404).json({ 
      error: 'Pago no encontrado',
      paid: false 
    });
  }
  
  try {
    // Verificar pago con Nequi API
    const paymentStatus = await checkPaymentStatus(reference);
    
    if (paymentStatus.paid) {
      // Buscar la canción en la cola
      const songIndex = queue.findIndex(s => s.id === payment.songId);
      if (songIndex === -1) {
        delete pendingPayments[reference];
        return res.status(404).json({ 
          error: 'Canción no encontrada en la cola',
          paid: false 
        });
      }
      
      // Remover canción de su posición actual
      const [song] = queue.splice(songIndex, 1);
      
      // Marcar como pago prioritario con timestamp
      song.priority = true;
      song.paidPriority = true;
      song.paymentTimestamp = Date.now();
      song.paymentReference = reference;
      
      // Insertar en la cola ordenada por prioridad
      // Las canciones con paidPriority van primero, ordenadas por paymentTimestamp
      const firstNonPriorityIndex = queue.findIndex(s => !s.paidPriority);
      
      if (firstNonPriorityIndex === -1) {
        // No hay canciones prioritarias, agregar al inicio
        queue.unshift(song);
      } else {
        // Encontrar posición correcta entre canciones prioritarias
        let insertIndex = 0;
        for (let i = 0; i < firstNonPriorityIndex; i++) {
          if (queue[i].paymentTimestamp && song.paymentTimestamp > queue[i].paymentTimestamp) {
            insertIndex = i + 1;
          } else {
            break;
          }
        }
        queue.splice(insertIndex, 0, song);
      }
      
      writeData(QUEUE_FILE, queue);
      io.emit('queue-update', queue);
      
      // Eliminar pago pendiente
      delete pendingPayments[reference];
      
      console.log(`✅ Pago confirmado: ${song.title} (ref: ${reference}) - Posición en cola de prioridad`);
      
      return res.json({
        paid: true,
        success: true,
        message: 'Pago confirmado. Tu canción tiene prioridad',
        song: song,
        position: queue.indexOf(song) + 1
      });
    } else {
      // Pago aún pendiente
      return res.json({
        paid: false,
        message: 'Esperando confirmación de pago',
        reference: reference
      });
    }
  } catch (error) {
    console.error('Error verificando pago:', error);
    return res.status(500).json({ 
      error: 'Error verificando estado del pago',
      paid: false 
    });
  }
});

// Simular pago (solo para desarrollo/testing)
app.post('/api/payment/simulate', async (req, res) => {
  const { reference } = req.body;
  
  const payment = pendingPayments[reference];
  if (!payment) {
    return res.status(404).json({ error: 'Pago no encontrado' });
  }
  
  // Buscar la canción en la cola
  const songIndex = queue.findIndex(s => s.id === payment.songId);
  if (songIndex === -1) {
    return res.status(404).json({ error: 'Canción no encontrada en la cola' });
  }
  
  // Remover canción de su posición actual
  const [song] = queue.splice(songIndex, 1);
  
  // Marcar como pago prioritario con timestamp
  song.priority = true;
  song.paidPriority = true;
  song.paymentTimestamp = Date.now();
  song.paymentReference = reference;
  
  // Insertar en la cola ordenada por prioridad
  const firstNonPriorityIndex = queue.findIndex(s => !s.paidPriority);
  
  if (firstNonPriorityIndex === -1) {
    queue.unshift(song);
  } else {
    let insertIndex = 0;
    for (let i = 0; i < firstNonPriorityIndex; i++) {
      if (queue[i].paymentTimestamp && song.paymentTimestamp > queue[i].paymentTimestamp) {
        insertIndex = i + 1;
      } else {
        break;
      }
    }
    queue.splice(insertIndex, 0, song);
  }
  
  writeData(QUEUE_FILE, queue);
  io.emit('queue-update', queue);
  
  // Eliminar pago pendiente
  delete pendingPayments[reference];
  
  console.log(`✅ Pago SIMULADO confirmado: ${song.title} - Posición ${queue.indexOf(song) + 1}`);
  
  res.json({
    success: true,
    message: 'Tu canción tiene prioridad (PAGO SIMULADO)',
    song: song,
    position: queue.indexOf(song) + 1
  });
});

// Webhook de Nequi (recibe notificaciones de pago en tiempo real)
app.post('/api/payment/webhook', async (req, res) => {
  try {
    // Validar firma del webhook (seguridad)
    const signature = req.headers['x-nequi-signature'];
    const webhookSecret = process.env.NEQUI_WEBHOOK_SECRET || '';
    
    // Si hay secret configurado, validar firma
    if (webhookSecret && signature) {
      const { validateNequiWebhook } = await import('./nequi-payment.js');
      const isValid = validateNequiWebhook(signature, req.body, webhookSecret);
      if (!isValid) {
        console.error('❌ Webhook Nequi: Firma inválida');
        return res.status(401).json({ error: 'Firma inválida' });
      }
    }
    
    const { status, reference1, value } = req.body;
    
    console.log('📩 Webhook Nequi recibido:', { status, reference: reference1, value });
    
    // Solo procesar pagos aprobados
    if (status === 'APPROVED') {
      const reference = reference1;
      const payment = pendingPayments[reference];
      
      if (payment) {
        // Buscar la canción en la cola
        const songIndex = queue.findIndex(s => s.id === payment.songId);
        
        if (songIndex !== -1) {
          // Remover canción de su posición actual
          const [song] = queue.splice(songIndex, 1);
          
          // Marcar como pago prioritario con timestamp
          song.priority = true;
          song.paidPriority = true;
          song.paymentTimestamp = Date.now();
          song.paymentReference = reference;
          
          // Insertar en la cola ordenada por prioridad
          const firstNonPriorityIndex = queue.findIndex(s => !s.paidPriority);
          
          if (firstNonPriorityIndex === -1) {
            queue.unshift(song);
          } else {
            let insertIndex = 0;
            for (let i = 0; i < firstNonPriorityIndex; i++) {
              if (queue[i].paymentTimestamp && song.paymentTimestamp > queue[i].paymentTimestamp) {
                insertIndex = i + 1;
              } else {
                break;
              }
            }
            queue.splice(insertIndex, 0, song);
          }
          
          writeData(QUEUE_FILE, queue);
          io.emit('queue-update', queue);
          
          // Eliminar pago pendiente
          delete pendingPayments[reference];
          
          console.log(`✅ Webhook: Pago confirmado para ${song.title} (ref: ${reference})`);
        }
      }
    }
    
    // Responder OK a Nequi
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error procesando webhook Nequi:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ============= WOMPI PAYMENT ENDPOINTS =============

// Crear pago prioritario con Wompi
app.post('/api/payment/wompi/create', async (req, res) => {
  try {
    const { songId, songTitle, customerName, amount } = req.body;
    
    // Validar datos
    if (!songId || !songTitle || !customerName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan datos requeridos' 
      });
    }

    // Crear instancia de Wompi con configuración de Ciudad Gótica
    const configLoader = ConfigLoader.getInstance();
    const clientConfig = configLoader.getClientById('ciudad-gotica');
    
    if (!clientConfig || !clientConfig.payments.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Pagos no disponibles'
      });
    }

    const wompi = new WompiPayment(clientConfig);
    
    // Generar referencia única
    const reference = `priority-${songId}-${Date.now()}`;
    
    // Crear pago en Wompi
    const paymentResult = await wompi.createPriorityPayment({
      amount: amount || 1000,
      reference,
      customerEmail: `${customerName.replace(/\s+/g, '')}@rockola.local`,
      description: `Prioridad: ${songTitle}`,
      redirectUrl: process.env.FRONTEND_URL || 'https://rockola-ciudad-gotica-licores.netlify.app'
    });

    if (paymentResult.success) {
      // Guardar pago pendiente
      pendingPayments[reference] = {
        songId,
        songTitle,
        customerName,
        amount: amount || 1000,
        timestamp: Date.now(),
        wompiTransactionId: paymentResult.transactionId
      };

      console.log(`💳 Pago Wompi creado: ${songTitle} - ref: ${reference}`);

      res.json({
        success: true,
        paymentUrl: paymentResult.paymentUrl,
        reference,
        transactionId: paymentResult.transactionId
      });
    } else {
      res.status(400).json({
        success: false,
        error: paymentResult.error || 'Error al crear pago'
      });
    }
  } catch (error) {
    console.error('Error creando pago Wompi:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno al procesar pago' 
    });
  }
});

// Webhook de Wompi (recibe notificaciones de pago)
app.post('/api/payment/wompi/webhook', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    console.log('📩 Webhook Wompi recibido:', event);

    // Validar evento de transacción aprobada
    if (event === 'transaction.updated' && data.status === 'APPROVED') {
      const reference = data.reference;
      const payment = pendingPayments[reference];

      if (payment) {
        // Buscar la canción en la cola
        const songIndex = queue.findIndex(s => s.id === payment.songId);
        
        if (songIndex !== -1) {
          // Remover canción de su posición actual
          const [song] = queue.splice(songIndex, 1);
          
          // Marcar como pago prioritario
          song.priority = true;
          song.paidPriority = true;
          song.paymentTimestamp = Date.now();
          song.paymentReference = reference;
          song.paymentMethod = 'wompi';
          
          // Insertar en la cola ordenada por prioridad
          const firstNonPriorityIndex = queue.findIndex(s => !s.paidPriority);
          
          if (firstNonPriorityIndex === -1) {
            queue.unshift(song);
          } else {
            let insertIndex = 0;
            for (let i = 0; i < firstNonPriorityIndex; i++) {
              if (queue[i].paymentTimestamp && song.paymentTimestamp > queue[i].paymentTimestamp) {
                insertIndex = i + 1;
              } else {
                break;
              }
            }
            queue.splice(insertIndex, 0, song);
          }
          
          writeData(QUEUE_FILE, queue);
          io.emit('queue-update', queue);
          
          // Eliminar pago pendiente
          delete pendingPayments[reference];
          
          console.log(`✅ Webhook Wompi: Pago confirmado para ${song.title} (ref: ${reference})`);
        }
      }
    }
    
    // Responder OK a Wompi
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error procesando webhook Wompi:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Verificar estado de transacción Wompi
app.get('/api/payment/wompi/status/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const payment = pendingPayments[reference];

    if (!payment) {
      return res.json({
        success: false,
        error: 'Pago no encontrado'
      });
    }

    // Crear instancia de Wompi
    const configLoader = ConfigLoader.getInstance();
    const clientConfig = configLoader.getClientById('ciudad-gotica');
    const wompi = new WompiPayment(clientConfig);

    // Verificar transacción
    const result = await wompi.verifyTransaction(payment.wompiTransactionId);

    res.json({
      success: true,
      status: result.status,
      payment: {
        reference,
        songTitle: payment.songTitle,
        amount: payment.amount,
        customerName: payment.customerName
      }
    });
  } catch (error) {
    console.error('Error verificando pago Wompi:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar pago'
    });
  }
});

// ============= ADVERTISEMENT ENDPOINTS =============

// Configurar multer para subir videos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, adsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `ad_${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB máximo
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de video'));
    }
  }
});

// Subir anuncio (cliente)
app.post('/api/advertisement/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const { username } = req.body;

    // Eliminar anuncio anterior si existe
    if (currentAdvertisement && currentAdvertisement.filename) {
      const oldFilePath = join(adsDir, currentAdvertisement.filename);
      if (existsSync(oldFilePath)) {
        try {
          unlinkSync(oldFilePath);
        } catch (err) {
          console.error('Error eliminando anuncio anterior:', err);
        }
      }
    }

    currentAdvertisement = {
      filename: req.file.filename,
      uploadedAt: new Date().toISOString(),
      uploadedBy: username || 'Anónimo',
      size: req.file.size
    };

    songsPlayedSinceAd = 0;

    io.emit('advertisement-update', currentAdvertisement);

    res.json({
      success: true,
      message: 'Anuncio subido exitosamente',
      advertisement: currentAdvertisement
    });

    console.log(`📺 Nuevo anuncio subido por ${username || 'Anónimo'}: ${req.file.filename}`);
  } catch (error) {
    console.error('Error subiendo anuncio:', error);
    res.status(500).json({ error: 'Error al subir el anuncio' });
  }
});

// Obtener anuncio actual
app.get('/api/advertisement/current', (req, res) => {
  res.json({
    advertisement: currentAdvertisement,
    songsUntilAd: currentAdvertisement ? Math.max(0, 4 - songsPlayedSinceAd) : null
  });
});

// Eliminar anuncio (admin)
app.delete('/api/advertisement', async (req, res) => {
  try {
    if (!currentAdvertisement) {
      return res.json({ success: true, message: 'No hay anuncio para eliminar' });
    }

    const filePath = join(adsDir, currentAdvertisement.filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    currentAdvertisement = null;
    songsPlayedSinceAd = 0;

    io.emit('advertisement-update', null);

    res.json({ success: true, message: 'Anuncio eliminado exitosamente' });
    console.log('📺 Anuncio eliminado por el administrador');
  } catch (error) {
    console.error('Error eliminando anuncio:', error);
    res.status(500).json({ error: 'Error al eliminar el anuncio' });
  }
});

// API Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    queue: queue.length,
    currentSong: currentSong?.title || 'ninguna',
    connectedUsers,
    cacheSize: searchCache.size,
    apiCallsToday,
    timestamp: new Date().toISOString()
  });
});

// Endpoint para mantener el servidor activo (keep-alive)
app.get('/api/ping', (req, res) => {
  res.json({ pong: true, timestamp: Date.now() });
});

// Endpoint para ver estadísticas de uso de API (solo admin)
app.get('/api/stats', (req, res) => {
  const cacheHitRate = apiCallsToday > 0 
    ? ((searchCache.size / (searchCache.size + apiCallsToday)) * 100).toFixed(2)
    : 0;
    
  res.json({
    cache: {
      size: searchCache.size,
      maxAge: `${CACHE_DURATION / 1000 / 60} minutos`
    },
    api: {
      callsToday: apiCallsToday,
      estimatedUnitsUsed: apiCallsToday * 100,
      quotaLimit: 10000,
      quotaRemaining: Math.max(0, 10000 - (apiCallsToday * 100))
    },
    efficiency: {
      cacheHitRate: `${cacheHitRate}%`,
      savedCalls: searchCache.size
    }
  });
});

// Buscar canciones en YouTube
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  
  console.log('🔍 Búsqueda recibida:', q);
  console.log('🔑 API Key configurada:', YOUTUBE_API_KEY ? 'Sí' : 'No');
  
  if (!YOUTUBE_API_KEY) {
    console.error('❌ YouTube API key NO configurada');
    return res.status(500).json({ error: 'YouTube API key not configured' });
  }

  // Normalizar query para caché (minúsculas, sin espacios extras)
  const cacheKey = q.toLowerCase().trim();
  
  // Verificar caché
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    const now = Date.now();
    
    if (now - cached.timestamp < CACHE_DURATION) {
      console.log('✅ Resultado de caché (ahorra cuota API)');
      return res.json(cached.data);
    } else {
      // Caché expirado, eliminar
      searchCache.delete(cacheKey);
    }
  }

  try {
    console.log('📡 Consultando YouTube API...');
    apiCallsToday++; // Incrementar contador
    
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: q,
        type: 'video',
        videoCategoryId: '10', // Música
        videoEmbeddable: 'true', // Solo videos que se pueden embeber
        maxResults: 50,
        key: YOUTUBE_API_KEY
      }
    });

    // Obtener IDs de videos para verificar detalles adicionales
    const videoIds = response.data.items.map(item => item.id.videoId).join(',');
    
    // Obtener detalles de videos para verificar restricciones
    const detailsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,contentDetails,status',
        id: videoIds,
        key: YOUTUBE_API_KEY
      }
    });

    // Filtrar solo videos públicos y embebibles
    const videos = detailsResponse.data.items
      .filter(item => 
        item.status.embeddable && 
        item.status.publicStatsViewable !== false
      )
      .map(item => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium.url,
        channelTitle: item.snippet.channelTitle
      }));

    console.log('✅ Encontrados', videos.length, 'videos embebibles');
    
    // Guardar en caché
    searchCache.set(cacheKey, {
      data: videos,
      timestamp: Date.now()
    });
    
    console.log(`💾 Resultado guardado en caché (${searchCache.size} búsquedas en caché)`);
    
    res.json(videos);
  } catch (error) {
    console.error('❌ YouTube API error:', error.response?.data || error.message);
    
    // Si es error de cuota excedida, informar al usuario
    if (error.response?.data?.error?.errors?.[0]?.reason === 'quotaExceeded') {
      console.error('🚫 CUOTA DE YOUTUBE EXCEDIDA - Se resetea a medianoche PT');
      return res.status(429).json({ 
        error: 'Cuota de búsquedas agotada',
        message: 'Se han realizado demasiadas búsquedas hoy. Intenta nuevamente mañana o contacta al administrador.',
        resetTime: 'Medianoche Pacific Time (PT)'
      });
    }
    
    res.status(500).json({ 
      error: 'Error searching YouTube',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// Obtener cola actual
app.get('/api/queue', (req, res) => {
  res.json(queue);
});

// Obtener canción actual
app.get('/api/current', (req, res) => {
  res.json(currentSong);
});

// Obtener menú
app.get('/api/menu', (req, res) => {
  res.json(menu);
});

// Agregar producto al menú
app.post('/api/menu', (req, res) => {
  const { name, price, category } = req.body;
  
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Nombre, precio y categoría son requeridos' });
  }
  
  const newItem = {
    id: Date.now(),
    name,
    price: parseFloat(price),
    category
  };
  
  menu.push(newItem);
  writeData(MENU_FILE, menu);
  
  // Emitir actualización a todos los clientes
  io.emit('menu-update', menu);
  
  res.json(newItem);
});

// Actualizar producto del menú
app.put('/api/menu/:id', (req, res) => {
  const { id } = req.params;
  const { name, price, category } = req.body;
  
  const index = menu.findIndex(item => item.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }
  
  menu[index] = {
    ...menu[index],
    name: name || menu[index].name,
    price: price !== undefined ? parseFloat(price) : menu[index].price,
    category: category || menu[index].category
  };
  
  writeData(MENU_FILE, menu);
  
  // Emitir actualización a todos los clientes
  io.emit('menu-update', menu);
  
  res.json(menu[index]);
});

// Eliminar producto del menú
app.delete('/api/menu/:id', (req, res) => {
  const { id } = req.params;
  
  const index = menu.findIndex(item => item.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }
  
  const deletedItem = menu.splice(index, 1)[0];
  writeData(MENU_FILE, menu);
  
  // Emitir actualización a todos los clientes
  io.emit('menu-update', menu);
  
  res.json(deletedItem);
});

// Obtener chat
app.get('/api/chat', (req, res) => {
  res.json(chatMessages.slice(-50)); // Últimos 50 mensajes
});

// Socket.io eventos
io.on('connection', (socket) => {
  connectedUsers++;
  console.log(`✅ Usuario conectado. Total: ${connectedUsers} usuarios`);
  
  // Enviar estado actual completo al nuevo usuario
  socket.emit('queue-update', queue);
  socket.emit('current-song', currentSong);
  socket.emit('chat-history', chatMessages);
  socket.emit('menu-update', menu);
  socket.emit('users-count', connectedUsers);
  
  console.log(`📤 Estado enviado: ${queue.length} canciones en cola, canción actual: ${currentSong?.title || 'ninguna'}`);
  
  // Notificar a todos sobre nuevo usuario
  io.emit('users-count', connectedUsers);

  // Agregar canción a la cola
  socket.on('add-song', (song) => {
    // Verificar límite de 3 canciones consecutivas por usuario
    const username = song.addedBy;
    if (username) {
      // Contar canciones consecutivas del usuario desde el final de la cola
      let consecutiveCount = 0;
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].addedBy === username) {
          consecutiveCount++;
        } else {
          // Si encontramos una canción de otro usuario, detenemos el conteo
          break;
        }
      }
      
      // Si ya tiene 3 canciones consecutivas, rechazar
      if (consecutiveCount >= 3) {
        socket.emit('song-limit-reached', {
          message: `Has alcanzado el límite de 3 canciones seguidas. Espera a que otro usuario agregue una canción.`,
          consecutiveCount
        });
        console.log(`❌ Usuario ${username} alcanzó límite de 3 canciones consecutivas`);
        return;
      }
    }
    
    const newSong = {
      ...song,
      id: Date.now().toString(),
      likes: 0,
      addedAt: new Date().toISOString(),
      likedBy: []
    };
    
    queue.push(newSong);
    sortQueue(queue);
    writeData(QUEUE_FILE, queue);
    
    io.emit('queue-update', queue);
    console.log(`Canción agregada: ${song.title} por ${song.addedBy || 'anónimo'}`);
  });

  // Dar like a una canción
  socket.on('like-song', ({ songId, userId }) => {
    const song = queue.find(s => s.id === songId);
    
    if (song) {
      if (!song.likedBy) song.likedBy = [];
      
      if (song.likedBy.includes(userId)) {
        // Quitar like
        song.likedBy = song.likedBy.filter(id => id !== userId);
        song.likes--;
      } else {
        // Agregar like
        song.likedBy.push(userId);
        song.likes++;
      }
      
      // Marcar como priority si tiene likes (pero NO paidPriority)
      if (song.likes > 0 && !song.paidPriority) {
        song.priority = true;
      } else if (song.likes === 0 && !song.paidPriority) {
        song.priority = false;
      }
      
      sortQueue(queue);
      writeData(QUEUE_FILE, queue);
      
      io.emit('queue-update', queue);
      console.log(`Like en canción: ${song.title} (${song.likes} likes)`);
    }
  });

  // Reproducir siguiente canción
  socket.on('play-next', () => {
    console.log('play-next recibido. Cola actual:', queue.length, 'canciones');
    
    // Verificar si debe mostrar anuncio cada 4 canciones
    if (currentAdvertisement && songsPlayedSinceAd >= 4) {
      songsPlayedSinceAd = 0;
      io.emit('show-advertisement', {
        url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/ads/${currentAdvertisement.filename}`,
        ...currentAdvertisement
      });
      console.log('📺 Mostrando anuncio después de 4 canciones');
      return;
    }
    
    if (queue.length > 0) {
      // Ordenar la cola correctamente (prioritarias primero, luego por likes)
      sortQueue(queue);
      currentSong = queue.shift();
      writeData(QUEUE_FILE, queue);
      
      songsPlayedSinceAd++;
      
      io.emit('current-song', currentSong);
      io.emit('queue-update', queue);
      
      const priorityType = currentSong.paidPriority ? '💰 PAGADA' : (currentSong.priority ? '❤️ LIKES' : '🎵 NORMAL');
      console.log(`✅ Reproduciendo: ${currentSong.title} [${priorityType}]. Quedan ${queue.length} en cola. Canciones desde anuncio: ${songsPlayedSinceAd}`);
    } else {
      currentSong = null;
      io.emit('current-song', null);
      console.log('❌ Cola vacía - no hay siguiente canción');
    }
  });

  // Mensaje de chat
  socket.on('chat-message', (message) => {
    const newMessage = {
      id: Date.now().toString(),
      username: message.username || 'Anónimo',
      text: message.text,
      timestamp: new Date().toISOString(),
      userId: message.userId, // ID del cliente que envía
      replyTo: message.replyTo, // Si es respuesta del admin, contiene info del destinatario
      isAdmin: message.username.includes('Administrador')
    };
    
    chatMessages.push(newMessage);
    
    // Mantener solo últimos 100 mensajes
    if (chatMessages.length > 100) {
      chatMessages = chatMessages.slice(-100);
    }
    
    writeData(CHAT_FILE, chatMessages);
    
    // Si es un mensaje del admin con respuesta específica, enviarlo solo a ese usuario y al admin
    if (newMessage.isAdmin && newMessage.replyTo && newMessage.replyTo.userId) {
      // Enviar al admin (todos los sockets admin)
      io.emit('admin-chat-message', newMessage);
      // Enviar al cliente específico
      io.emit('private-chat-message', { message: newMessage, targetUserId: newMessage.replyTo.userId });
    } else {
      // Mensajes de clientes van solo al admin y al propio cliente
      io.emit('chat-message', newMessage);
    }
  });

  // Eliminar canción específica (admin)
  socket.on('delete-song', (songId) => {
    const songIndex = queue.findIndex(s => s.id === songId);
    
    if (songIndex !== -1) {
      const deletedSong = queue.splice(songIndex, 1)[0];
      writeData(QUEUE_FILE, queue);
      io.emit('queue-update', queue);
      console.log(`Canción eliminada: ${deletedSong.title}`);
    }
  });

  // Limpiar cola (admin)
  socket.on('clear-queue', () => {
    queue = [];
    writeData(QUEUE_FILE, queue);
    io.emit('queue-update', queue);
    console.log('Cola limpiada');
  });

  // Usuario desconectado
  socket.on('disconnect', () => {
    connectedUsers--;
    io.emit('users-count', connectedUsers);
    console.log(`Usuario desconectado. Total: ${connectedUsers}`);
  });
});

// Iniciar servidor
httpServer.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor corriendo en http://${HOST}:${PORT}`);
  console.log(`👥 Socket.io listo para conexiones`);
  if (!YOUTUBE_API_KEY) {
    console.warn('⚠️  YouTube API key no configurada. Crea un archivo .env con tu clave.');
  }
});
