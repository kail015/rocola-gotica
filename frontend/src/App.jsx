import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function App() {
  const [queue, setQueue] = useState([]);
  const socketRef = useRef(null);
  const [currentSong, setCurrentSong] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [username, setUsername] = useState('');
  const [menu, setMenu] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [activeTab, setActiveTab] = useState('queue'); // queue, search, chat, menu
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [showIntro, setShowIntro] = useState(true);
  const [userId] = useState(() => {
    let id = localStorage.getItem('userId');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('userId', id);
    }
    return id;
  });
  const [isSearching, setIsSearching] = useState(false);
  const playerRef = useRef(null);
  const chatEndRef = useRef(null);

  // Verificar si el usuario tiene nombre guardado, si no, mostrar modal
  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    if (savedUsername && savedUsername.trim()) {
      setUsername(savedUsername);
      setShowNameModal(false);
    } else {
      setShowNameModal(true);
    }
  }, []);

  // Keep-alive: mantener servidor activo
  useEffect(() => {
    // Hacer ping cada 5 minutos para evitar que Render ponga el servidor a dormir
    const keepAlive = setInterval(async () => {
      try {
        await axios.get(`${BACKEND_URL}/api/ping`);
        console.log('🏓 Ping enviado al servidor');
      } catch (error) {
        console.error('❌ Error en keep-alive:', error);
      }
    }, 5 * 60 * 1000); // Cada 5 minutos

    return () => clearInterval(keepAlive);
  }, []);

  // Socket listeners
  useEffect(() => {
    // Crear conexión socket
    socketRef.current = io(BACKEND_URL);
    const socket = socketRef.current;

    socket.on('queue-update', (updatedQueue) => {
      setQueue(updatedQueue);
    });

    socket.on('current-song', (song) => {
      setCurrentSong(song);
    });

    socket.on('chat-message', (message) => {
      // Solo agregar si es mensaje del propio usuario o del admin respondiendo a este usuario
      if (message.userId === userId || 
          (message.isAdmin && (!message.replyTo || message.replyTo.userId === userId))) {
        setChatMessages(prev => [...prev, message]);
      }
    });

    socket.on('private-chat-message', ({ message, targetUserId }) => {
      // Solo mostrar si es para este usuario
      if (targetUserId === userId) {
        setChatMessages(prev => [...prev, message]);
      }
    });

    socket.on('users-count', (count) => {
      setUsersCount(count);
    });

    socket.on('menu-update', (updatedMenu) => {
      setMenu(updatedMenu);
    });

    socket.on('song-limit-reached', ({ message }) => {
      alert(`⚠️ ${message}`);
    });

    socket.on('advertisement-approved', ({ username }) => {
      if (username === userName) {
        alert('✅ ¡Tu anuncio ha sido aprobado! Se reproducirá cada 4 canciones.');
      }
    });

    socket.on('advertisement-rejected', ({ username }) => {
      if (username === userName) {
        alert('❌ Tu anuncio no fue aprobado. Por favor intenta con otro video.');
      }
    });

    // Cargar datos iniciales
    loadInitialData();

    return () => {
      socket.off('queue-update');
      socket.off('current-song');
      socket.off('chat-message');
      socket.off('private-chat-message');
      socket.off('users-count');
      socket.off('menu-update');
      socket.off('song-limit-reached');
      socket.off('advertisement-approved');
      socket.off('advertisement-rejected');
      socket.disconnect();
    };
  }, [userId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadInitialData = async () => {
    try {
      const [chatRes, menuRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/chat`),
        axios.get(`${BACKEND_URL}/api/menu`)
      ]);
      // Filtrar mensajes: solo los del usuario actual o respuestas del admin para este usuario
      const filteredMessages = chatRes.data.filter(msg => 
        msg.userId === userId || 
        (msg.isAdmin && (!msg.replyTo || msg.replyTo.userId === userId))
      );
      setChatMessages(filteredMessages);
      setMenu(menuRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    console.log('🔍 Buscando:', searchQuery);
    console.log('🌐 Backend URL:', BACKEND_URL);
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/search`, {
        params: { q: searchQuery }
      });
      console.log('✅ Resultados:', response.data.length, 'canciones');
      setSearchResults(response.data);
      setActiveTab('search');
    } catch (error) {
      console.error('❌ Error searching:', error);
      console.error('❌ Detalles:', error.response?.data);
      const errorMsg = error.response?.data?.details || error.response?.data?.error || 'Error al buscar canciones';
      alert(`Error: ${errorMsg}\n\nVerifica que:\n1. El backend esté funcionando\n2. La API de YouTube esté configurada en Render`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSong = (song) => {
    if (socketRef.current) {
      // Incluir el nombre del usuario que agrega la canción
      socketRef.current.emit('add-song', {
        ...song,
        addedBy: username
      });
    }
    setSearchResults([]);
    setSearchQuery('');
    setActiveTab('queue');
  };

  const handleLikeSong = (songId) => {
    if (socketRef.current) {
      socketRef.current.emit('like-song', { songId, userId });
    }
  };

  const handlePriorityPayment = async (songId) => {
    const song = queue.find(s => s.id === songId);
    if (!song) return;

    try {
      // Solicitar link de pago a Wompi
      const response = await axios.post(`${BACKEND_URL}/api/payment/wompi/create`, {
        songId: songId,
        songTitle: song.title,
        customerName: username,
        amount: 1000 // $1,000 COP
      });

      if (response.data.success) {
        const { paymentUrl, reference } = response.data;
        
        // Abrir Wompi en nueva ventana
        window.open(paymentUrl, '_blank');
        
        // Mostrar notificación
        alert(`💳 Pago generado\n\n🎵 Canción: ${song.title}\n💰 Monto: $1,000\n🔢 Referencia: ${reference}\n\n✅ Se abrió la ventana de Wompi para completar el pago.\n\nTu canción subirá automáticamente al confirmar.`);
      } else {
        alert('❌ Error generando el pago. Intenta de nuevo.');
      }
    } catch (error) {
      console.error('Error al crear pago:', error);
      alert('❌ Error al procesar el pago. Por favor intenta de nuevo.');
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim() || !username.trim()) return;
    
    if (socketRef.current) {
      socketRef.current.emit('chat-message', {
        username: username.trim(),
        text: chatInput.trim(),
        userId: userId
      });
    }
    
    setChatInput('');
  };

  const handleUsernameChange = (newUsername) => {
    setUsername(newUsername);
    localStorage.setItem('username', newUsername);
  };

  const handleSaveUsername = () => {
    const trimmedName = tempUsername.trim();
    if (trimmedName.length >= 2) {
      setUsername(trimmedName);
      localStorage.setItem('username', trimmedName);
      setShowNameModal(false);
      setTempUsername('');
    } else {
      alert('⚠️ El nombre debe tener al menos 2 caracteres');
    }
  };

  const hasSongLiked = (song) => {
    return song.likedBy && song.likedBy.includes(userId);
  };

  const handleIntroEnd = () => {
    setShowIntro(false);
  };

  const handleSkipIntro = () => {
    setShowIntro(false);
  };

  // Mostrar video de intro primero
  if (showIntro) {
    return (
      <div className="intro-overlay">
        <video
          className="intro-video"
          autoPlay
          muted
          playsInline
          onEnded={handleIntroEnd}
        >
          <source src="/intro.mp4" type="video/mp4" />
        </video>
        <button className="skip-intro-btn" onClick={handleSkipIntro}>
          Saltar intro →
        </button>
      </div>
    );
  }

  // Si no hay nombre, solo mostrar el modal
  if (showNameModal) {
    return (
      <div className="app">
        <div className="name-modal-overlay">
          <div className="name-modal">
            <div className="name-modal-header">
              <img src="/logogotica.png" alt="Ciudad Gótica" className="modal-logo" />
              <h2>¡Bienvenido a la Rockola!</h2>
              <p>Para continuar, ingresa tu nombre</p>
            </div>
            <div className="name-modal-body">
              <input
                type="text"
                placeholder="Tu nombre (mínimo 2 caracteres)..."
                value={tempUsername}
                onChange={(e) => setTempUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveUsername()}
                maxLength={20}
                autoFocus
              />
              <button 
                className="name-modal-btn"
                onClick={handleSaveUsername}
                disabled={tempUsername.trim().length < 2}
              >
                Continuar 🎵
              </button>
            </div>
            <p className="name-modal-note">
              💡 Tu nombre quedará vinculado al chat
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Solo mostrar la app cuando el nombre esté ingresado
  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <img src="/logogotica.png" alt="Ciudad Gótica Licores Bar" className="logo" />
          <div className="header-text">
            <h1>🎵 ROCKOLA CIUDAD GÓTICA LICORES</h1>
            <span className="users-badge">👥 {usersCount} conectados</span>
          </div>
        </div>
        <p className="header-subtitle">
          ⚠️ Las canciones con contenido explícito o que no vayan con la temática del bar podrán ser eliminadas
        </p>
      </header>

      <main className="main-content">
        {/* Información de canción actual (sin video) */}
        <section className="current-player">
          <h2>🎸 Sonando en el Bar</h2>
          {currentSong ? (
            <div className="current-song-info">
              <img src={currentSong.thumbnail} alt={currentSong.title} className="current-thumbnail" />
              <div className="current-details">
                <h3>{currentSong.title}</h3>
                <p>{currentSong.channelTitle}</p>
                <div className="current-likes">❤️ {currentSong.likes || 0} likes</div>
              </div>
            </div>
          ) : (
            <div className="no-song">
              <p>No hay música sonando</p>
              <p className="hint">¡Busca y agrega canciones!</p>
            </div>
          )}
        </section>

        {/* Barra de búsqueda */}
        <section className="search-section">
          <div className="youtube-badge">
            <span>▶️ Powered by YouTube</span>
          </div>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Buscar canción en YouTube..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              disabled={isSearching}
            />
            <button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? '⏳' : '🔍'} Buscar
            </button>
          </div>
        </section>

        {/* Tabs de navegación */}
        <nav className="tabs">
          <button 
            className={activeTab === 'queue' ? 'active' : ''}
            onClick={() => setActiveTab('queue')}
          >
            📜 Cola ({queue.length})
          </button>
          <button 
            className={activeTab === 'search' ? 'active' : ''}
            onClick={() => setActiveTab('search')}
          >
            🔍 Resultados
          </button>
          <button 
            className={activeTab === 'chat' ? 'active' : ''}
            onClick={() => setActiveTab('chat')}
          >
            💬 Chat
          </button>
          <button 
            className={activeTab === 'menu' ? 'active' : ''}
            onClick={() => setActiveTab('menu')}
          >
            📋 Precios
          </button>
          <button 
            className={activeTab === 'ad' ? 'active' : ''}
            onClick={() => setActiveTab('ad')}
          >
            📺 Publicita
          </button>
        </nav>

        {/* Contenido de tabs */}
        <section className="tab-content">
          {/* Cola de canciones */}
          {activeTab === 'queue' && (
            <div className="queue-list">
              {queue.length === 0 ? (
                <p className="empty-message">No hay canciones en la cola</p>
              ) : (
                <>
                  {!currentSong && queue.length > 0 && (
                    <button 
                      className="play-first-btn"
                      onClick={() => socketRef.current?.emit('play-next')}
                    >
                      ▶️ Reproducir primera canción
                    </button>
                  )}
                  {queue.map((song, index) => (
                    <div key={song.id} className={`song-item ${song.paidPriority ? 'priority-song' : ''}`}>
                      <span className="song-position">#{index + 1}</span>
                      <img src={song.thumbnail} alt={song.title} />
                      <div className="song-info">
                        <h4>
                          {song.paidPriority && <span className="priority-badge">⚡ PRIORITARIA</span>}
                          {song.title}
                        </h4>
                        <p>{song.channelTitle}</p>
                      </div>
                      <div className="song-actions">
                        <button 
                          className={`like-btn ${hasSongLiked(song) ? 'liked' : ''}`}
                          onClick={() => handleLikeSong(song.id)}
                        >
                          ❤️ {song.likes}
                        </button>
                        {index > 0 && !song.paidPriority && (
                          <button 
                            className="priority-btn"
                            onClick={() => handlePriorityPayment(song.id)}
                            title="Haz que tu canción suene antes"
                          >
                            ⚡ Pagar $1,000
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Resultados de búsqueda */}
          {activeTab === 'search' && (
            <div className="search-results">
              {searchResults.length === 0 ? (
                <p className="empty-message">Busca canciones para agregar a la cola</p>
              ) : (
                searchResults.map((song, index) => (
                  <div key={song.id} className="song-item">
                    <span className="song-position">#{index + 1}</span>
                    <img src={song.thumbnail} alt={song.title} />
                    <div className="song-info">
                      <h4>{song.title}</h4>
                      <p>{song.channelTitle}</p>
                    </div>
                    <div className="song-actions">
                      <button 
                        className="add-btn"
                        onClick={() => handleAddSong({
                          videoId: song.id,
                          title: song.title,
                          thumbnail: song.thumbnail,
                          channelTitle: song.channelTitle
                        })}
                      >
                        ➕
                      </button>
                      <button className="like-btn-search">
                        👍 0
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Chat */}
          {activeTab === 'chat' && (
            <div className="chat-container">
              <div className="username-display">
                <span className="username-label">👤 Chateando como:</span>
                <span className="username-value">{username}</span>
              </div>
              <div className="chat-messages">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="chat-message">
                    {msg.replyTo && (
                      <div className="client-reply-reference">
                        <small>↩️ Respuesta a {msg.replyTo.username}:</small>
                        <small className="reply-text">"{msg.replyTo.text}"</small>
                      </div>
                    )}
                    <strong>{msg.username}:</strong> {msg.text}
                    <span className="chat-time">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="chat-input-container">
                <input
                  type="text"
                  placeholder={username ? 'Escribe un mensaje...' : 'Ingresa tu nombre primero'}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={!username}
                />
                <button onClick={handleSendMessage} disabled={!username || !chatInput.trim()}>
                  Enviar
                </button>
              </div>
            </div>
          )}

          {/* Menú de precios */}
          {activeTab === 'menu' && (
            <div className="menu-list">
              {menu.map((item) => (
                <div key={item.id} className="menu-item">
                  <div className="menu-info">
                    <h4>{item.name}</h4>
                    <span className="menu-category">{item.category}</span>
                  </div>
                  <span className="menu-price">${item.price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* Publicita con nosotros */}
          {activeTab === 'ad' && (
            <div className="ad-upload-section">
              <div className="ad-info">
                <h3>📺 Publicita tu negocio</h3>
                <p>Sube un video de máximo 10 segundos</p>
                <p className="ad-note">Se reproducirá cada 4 canciones en la pantalla de video</p>
              </div>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    // Crear video temporal para verificar duración
                    const video = document.createElement('video');
                    video.preload = 'metadata';
                    video.onloadedmetadata = async () => {
                      window.URL.revokeObjectURL(video.src);
                      if (video.duration > 10) {
                        alert('⚠️ El video debe durar máximo 10 segundos');
                        e.target.value = '';
                        return;
                      }
                      
                      // Subir video
                      const formData = new FormData();
                      formData.append('video', file);
                      formData.append('username', username);
                      
                      try {
                        const response = await axios.post(`${BACKEND_URL}/api/advertisement/upload`, formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        if (response.data.success) {
                          alert('✅ Video publicitario subido exitosamente');
                          e.target.value = '';
                        }
                      } catch (error) {
                        alert('❌ Error al subir el video: ' + (error.response?.data?.error || error.message));
                      }
                    };
                    video.src = URL.createObjectURL(file);
                  }
                }}
                className="ad-file-input"
                id="ad-video-upload"
              />
              <label htmlFor="ad-video-upload" className="ad-upload-btn">
                📤 Seleccionar Video
              </label>
            </div>
          )}
        </section>
      </main>
      
      <footer className="app-footer">
        <div className="footer-content">
          <span>Desarrollado por</span>
          <img src="/lunatica-logo.png" alt="Lunatica App Solutions" className="lunatica-logo" />
          <span>Lunatica App Solutions</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
