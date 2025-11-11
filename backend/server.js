import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
        maxResults: 50, // Aumentado de 10 a 50 resultados
        key: YOUTUBE_API_KEY
      }
    });

    const videos = response.data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle
    }));

    console.log('✅ Encontrados', videos.length, 'videos');
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
    queue.sort((a, b) => b.likes - a.likes);
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
      
      queue.sort((a, b) => b.likes - a.likes);
      writeData(QUEUE_FILE, queue);
      
      io.emit('queue-update', queue);
      console.log(`Like en canción: ${song.title} (${song.likes} likes)`);
    }
  });

  // Reproducir siguiente canción
  socket.on('play-next', () => {
    console.log('play-next recibido. Cola actual:', queue.length, 'canciones');
    if (queue.length > 0) {
      // Ordenar la cola por likes antes de tomar la primera
      queue.sort((a, b) => b.likes - a.likes);
      currentSong = queue.shift();
      writeData(QUEUE_FILE, queue);
      
      io.emit('current-song', currentSong);
      io.emit('queue-update', queue);
      console.log(`✅ Reproduciendo: ${currentSong.title} (${currentSong.likes} likes). Quedan ${queue.length} en cola`);
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
