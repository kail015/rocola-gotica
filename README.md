# 🎵 Rocola Gótica - Bar Jukebox Social

Una aplicación web de jukebox social para bares donde los clientes pueden:
- 🔍 Buscar y agregar canciones desde YouTube
- ❤️ Dar "like" a las canciones para priorizarlas en la cola
- 🎸 Ver qué está sonando en tiempo real
- 💬 Chatear con otros clientes
- 📋 Ver el menú y precios del bar

## 🚀 Tecnologías

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Real-time**: Socket.io
- **Base de datos**: JSON (migrable a MongoDB)
- **API**: YouTube Data API v3

## 📦 Instalación

### 1. Instalar dependencias

#### Backend
\`\`\`bash
cd backend
npm install
\`\`\`

#### Frontend
\`\`\`bash
cd frontend
npm install
\`\`\`

### 2. Configurar YouTube API

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto
3. Habilita "YouTube Data API v3"
4. Crea credenciales (API Key)
5. Crea un archivo \`.env\` en la carpeta \`backend\`:

\`\`\`env
PORT=3001
YOUTUBE_API_KEY=tu_api_key_aqui
\`\`\`

## 🎮 Uso

### Iniciar el Backend

\`\`\`bash
cd backend
npm start
\`\`\`

O en modo desarrollo con auto-reload:

\`\`\`bash
npm run dev
\`\`\`

El servidor estará disponible en: http://localhost:3001

### Iniciar el Frontend

\`\`\`bash
cd frontend
npm run dev
\`\`\`

La aplicación estará disponible en: http://localhost:5173

## 🎯 Características

### Para Clientes
- Buscar canciones en YouTube
- Agregar canciones a la cola
- Votar por canciones (likes)
- Ver la cola ordenada por popularidad
- Chat en tiempo real
- Ver menú de precios

### Sistema
- Cola automática ordenada por likes
- Reproducción sincronizada para todos
- Persistencia de datos en JSON
- Actualización en tiempo real con Socket.io
- Responsive (móvil y desktop)

## 📁 Estructura del Proyecto

\`\`\`
rocola-gotica/
├── backend/
│   ├── server.js          # Servidor principal
│   ├── package.json       # Dependencias backend
│   ├── .env              # Configuración (no incluido)
│   └── data/             # Datos persistentes (JSON)
│       ├── queue.json    # Cola de canciones
│       ├── chat.json     # Mensajes del chat
│       └── menu.json     # Menú del bar
│
└── frontend/
    ├── src/
    │   ├── App.jsx       # Componente principal
    │   ├── App.css       # Estilos
    │   └── main.jsx      # Punto de entrada
    ├── package.json      # Dependencias frontend
    └── vite.config.js    # Configuración Vite
\`\`\`

## 🔧 API Endpoints

### Backend REST API

- \`GET /api/search?q=query\` - Buscar canciones en YouTube
- \`GET /api/queue\` - Obtener cola actual
- \`GET /api/current\` - Obtener canción actual
- \`GET /api/menu\` - Obtener menú del bar
- \`GET /api/chat\` - Obtener mensajes del chat

### Socket.io Events

**Cliente → Servidor**
- \`add-song\` - Agregar canción a la cola
- \`like-song\` - Dar like a una canción
- \`play-next\` - Reproducir siguiente canción
- \`chat-message\` - Enviar mensaje al chat
- \`clear-queue\` - Limpiar cola (admin)

**Servidor → Cliente**
- \`queue-update\` - Actualización de la cola
- \`current-song\` - Canción actual
- \`chat-message\` - Nuevo mensaje
- \`users-count\` - Cantidad de usuarios conectados

## 🎨 Personalización

### Cambiar colores del tema
Edita \`frontend/src/App.css\` y \`frontend/src/index.css\`

### Modificar menú del bar
Edita \`backend/data/menu.json\` o usa la API

### Agregar autenticación
Implementa middleware de autenticación en \`backend/server.js\`

## 🚀 Despliegue

### Backend (Heroku, Railway, etc.)
1. Asegúrate de tener el archivo \`.env\` configurado
2. Sube el código del backend
3. Configura las variables de entorno

### Frontend (Vercel, Netlify, etc.)
1. Actualiza \`BACKEND_URL\` en \`App.jsx\` con la URL de tu backend
2. Build: \`npm run build\`
3. Sube la carpeta \`dist\`

## 📝 Notas

- El sistema guarda automáticamente los datos en archivos JSON
- Los likes son por usuario (identificado por ID único)
- Las canciones se ordenan automáticamente por likes
- El chat mantiene los últimos 100 mensajes

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Siéntete libre de:
- Reportar bugs
- Sugerir nuevas características
- Mejorar el código
- Actualizar la documentación

## 📄 Licencia

MIT License - Siéntete libre de usar este proyecto como quieras.

---

Hecho con ❤️ para bares góticos y rockeros 🎸🦇
