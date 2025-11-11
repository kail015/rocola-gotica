import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { generateNequiPayment, checkPaymentStatus } from './nequi-payment.js';

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
// Asegurar que todas las canciones en la cola tengan el array likedBy
queue = queue.map(song => ({
  ...song,
  likedBy: song.likedBy || [],
  likes: song.likes || 0
}));

let chatMessages = readData(CHAT_FILE, []);
let menu = readData(MENU_FILE, [
  { id: 1, name: 'Cerveza Nacional', price: 3000, category: 'Bebidas' },
  { id: 2, name: 'Cerveza Importada', price: 5000, category: 'Bebidas' },
  { id: 3, name: 'Cocktail de la Casa', price: 8000, category: 'Bebidas' },
  { id: 4, name: 'Picada Sencilla', price: 15000, category: 'Comida' },
  { id: 5, name: 'Picada Especial', price: 25000, category: 'Comida' }
]);

let currentSong = null;
let connectedUsers = 0;
let pendingPayments = {}; // { reference: { songId, amount, timestamp } }

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

// API Routes

// Buscar canciones en YouTube
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  
  console.log('🔍 Búsqueda recibida:', q);
  console.log('🔑 API Key configurada:', YOUTUBE_API_KEY ? 'Sí' : 'No');
  
  if (!YOUTUBE_API_KEY) {
    console.error('❌ YouTube API key NO configurada');
    return res.status(500).json({ error: 'YouTube API key not configured' });
  }

  try {
    console.log('📡 Consultando YouTube API...');
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
    res.json(videos);
  } catch (error) {
    console.error('❌ YouTube API error:', error.response?.data || error.message);
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
  console.log(`Usuario conectado. Total: ${connectedUsers}`);
  
  // Enviar estado actual al nuevo usuario
  socket.emit('queue-update', queue);
  socket.emit('current-song', currentSong);
  socket.emit('users-count', connectedUsers);
  
  // Notificar a todos sobre nuevo usuario
  io.emit('users-count', connectedUsers);

  // Agregar canción a la cola
  socket.on('add-song', (song) => {
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
    console.log(`Canción agregada: ${song.title}`);
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
    if (queue.length > 0) {
      // Ordenar la cola correctamente (prioritarias primero, luego por likes)
      sortQueue(queue);
      currentSong = queue.shift();
      writeData(QUEUE_FILE, queue);
      
      io.emit('current-song', currentSong);
      io.emit('queue-update', queue);
      
      const priorityType = currentSong.paidPriority ? '💰 PAGADA' : (currentSong.priority ? '❤️ LIKES' : '🎵 NORMAL');
      console.log(`✅ Reproduciendo: ${currentSong.title} [${priorityType}]. Quedan ${queue.length} en cola`);
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
