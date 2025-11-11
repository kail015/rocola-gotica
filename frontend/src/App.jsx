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

  // Cargar nombre de usuario del localStorage
  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
      setUsername(savedUsername);
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

    // Cargar datos iniciales
    loadInitialData();

    return () => {
      socket.off('queue-update');
      socket.off('current-song');
      socket.off('chat-message');
      socket.off('private-chat-message');
      socket.off('users-count');
      socket.off('menu-update');
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
      socketRef.current.emit('add-song', song);
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
      // Iniciar pago
      const response = await axios.post(`${BACKEND_URL}/api/payment/priority`, { songId });
      
      if (response.data.success) {
        const { reference, amount } = response.data;
        const nequiPhone = '3208504177'; // Número de Nequi de Ciudad Gótica Licores
        
        // Copiar referencia al clipboard
        if (navigator.clipboard) {
          navigator.clipboard.writeText(reference).catch(() => {});
        }

        console.log(`💳 Pago generado: ${reference} - Abriendo Nequi...`);

        // Crear deep link de Nequi para abrir la app directamente
        // Formato: nequi://payment?phoneNumber=XXX&amount=XXX&message=XXX
        const nequiDeepLink = `nequi://payment?phoneNumber=${nequiPhone}&amount=${amount}&message=${encodeURIComponent(reference)}`;
        
        // Crear URL alternativa para web (si no tiene la app instalada)
        const nequiWebUrl = `https://m.nequi.com.co/send?phone=${nequiPhone}&amount=${amount}&message=${encodeURIComponent(reference)}`;
        
        // Intentar abrir la app de Nequi
        const openedApp = window.open(nequiDeepLink, '_blank');
        
        // Si no se pudo abrir la app (no está instalada), intentar la web
        setTimeout(() => {
          if (!openedApp || openedApp.closed) {
            // Mostrar modal con opciones
            const userChoice = window.confirm(
              `⚡ PAGO DE PRIORIDAD\n\n` +
              `🎵 Canción: ${song.title}\n` +
              `� Monto: $${amount.toLocaleString()}\n` +
              `🔢 Referencia: ${reference}\n\n` +
              `📱 Haz clic en OK para abrir Nequi\n` +
              `(La referencia ya está copiada)\n\n` +
              `Tu canción subirá automáticamente al confirmar el pago`
            );
            
            if (userChoice) {
              // Intentar abrir de nuevo o mostrar instrucciones
              window.location.href = nequiDeepLink;
            }
          }
        }, 500);

        // Mostrar notificación de espera
        setTimeout(() => {
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #fbbf24, #f59e0b);
            color: #000;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(251, 191, 36, 0.6);
            z-index: 10000;
            font-weight: 600;
            animation: slideIn 0.3s ease-out;
          `;
          notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              ⏳ Esperando confirmación de pago...
            </div>
            <div style="font-size: 0.8rem; margin-top: 0.3rem; opacity: 0.8;">
              Referencia: ${reference}
            </div>
          `;
          document.body.appendChild(notification);

          // Remover notificación después de 10 segundos
          setTimeout(() => {
            notification.remove();
          }, 10000);
        }, 2000);

        // Iniciar verificación periódica del pago
        let checksCount = 0;
        const maxChecks = 120; // 10 minutos (120 * 5 segundos)
        
        const checkInterval = setInterval(async () => {
          checksCount++;
          
          try {
            const statusResponse = await axios.get(`${BACKEND_URL}/api/payment/status/${reference}`);
            
            if (statusResponse.data.paid) {
              clearInterval(checkInterval);
              
              // Mostrar notificación de éxito
              const successNotification = document.createElement('div');
              successNotification.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
                padding: 2rem 3rem;
                border-radius: 20px;
                box-shadow: 0 12px 40px rgba(16, 185, 129, 0.6);
                z-index: 10001;
                font-size: 1.5rem;
                font-weight: bold;
                text-align: center;
                animation: popIn 0.5s ease-out;
              `;
              successNotification.innerHTML = `
                ✅ ¡PAGO CONFIRMADO!<br>
                <span style="font-size: 1rem; font-weight: normal; opacity: 0.9; margin-top: 0.5rem; display: block;">
                  🎵 Tu canción ahora es PRIORITARIA
                </span>
              `;
              document.body.appendChild(successNotification);

              setTimeout(() => {
                successNotification.remove();
              }, 5000);
            }
          } catch (error) {
            console.error('Error verificando pago:', error);
          }

          // Detener después del tiempo máximo
          if (checksCount >= maxChecks) {
            clearInterval(checkInterval);
            console.log('Verificación de pago finalizada por timeout');
          }
        }, 5000); // Verificar cada 5 segundos
      }
    } catch (error) {
      console.error('Error al procesar pago:', error);
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

  const hasSongLiked = (song) => {
    return song.likedBy && song.likedBy.includes(userId);
  };

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
        <div className="nequi-info-banner">
          💰 Haz que tu canción suene primero por <strong>$1,000</strong> • 
          Envía a Nequi: <strong>3208504177</strong> ⚡
        </div>
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
                        {index > 0 && !song.paidPriority && (
                          <button 
                            className="priority-btn"
                            onClick={() => handlePriorityPayment(song.id)}
                            title="Pagar $1,000 para que suene primero"
                          >
                            ⚡ $1,000
                          </button>
                        )}
                        <button 
                          className={`like-btn ${hasSongLiked(song) ? 'liked' : ''}`}
                          onClick={() => handleLikeSong(song.id)}
                        >
                          ❤️ {song.likes}
                        </button>
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
              <div className="username-input">
                <input
                  type="text"
                  placeholder="Tu nombre..."
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  maxLength={20}
                />
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
