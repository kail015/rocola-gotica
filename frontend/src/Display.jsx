import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import './Display.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function Display() {
  const [currentSong, setCurrentSong] = useState(null);
  const socketRef = useRef(null);
  const [queue, setQueue] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const navigate = useNavigate();

  // Verificar autenticación
  useEffect(() => {
    const isAdmin = sessionStorage.getItem('isAdmin');
    if (!isAdmin) {
      navigate('/admin-access');
    }
  }, [navigate]);

  useEffect(() => {
    // Crear conexión socket
    socketRef.current = io(BACKEND_URL);
    const socket = socketRef.current;

    socket.on('current-song', (song) => {
      setCurrentSong(song);
    });

    socket.on('queue-update', (updatedQueue) => {
      setQueue(updatedQueue);
    });

    socket.on('chat-message', (message) => {
      setChatMessages(prev => [...prev, message]);
    });

    // Cargar mensajes existentes
    fetch(`${BACKEND_URL}/api/chat`)
      .then(res => res.json())
      .then(data => setChatMessages(data))
      .catch(err => console.error('Error loading chat:', err));

    return () => {
      socket.off('current-song');
      socket.off('queue-update');
      socket.off('chat-message');
      socket.disconnect();
    };
  }, []);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    
    if (socketRef.current) {
      const message = {
        username: '🛡️ Administrador',
        text: chatInput.trim()
      };
      
      // Si está respondiendo a alguien, agregar referencia
      if (replyingTo) {
        message.replyTo = replyingTo;
      }
      
      socketRef.current.emit('chat-message', message);
    }
    
    setChatInput('');
    setReplyingTo(null);
  };

  const handleReplyTo = (msg) => {
    setReplyingTo({
      username: msg.username,
      text: msg.text
    });
    setChatInput('');
  };

  return (
    <div className="display">
      <header className="display-header">
        <img src="/logogotica.jpg" alt="Ciudad Gótica Licores Bar" className="admin-logo" />
        <h1>🎵 ROCKOLA CIUDAD GÓTICA LICORES - Admin</h1>
        <div className="queue-count">
          {queue.length > 0 && `${queue.length} canciones en cola`}
        </div>
      </header>

      <main className="display-main">
        {/* Información de canción actual sin video */}
        <div className="current-song-panel">
          <h2>🎸 Reproduciendo ahora</h2>
          {currentSong ? (
            <div className="admin-current-song">
              <img src={currentSong.thumbnail} alt={currentSong.title} />
              <div className="admin-song-info">
                <h3>{currentSong.title}</h3>
                <p>{currentSong.channelTitle}</p>
                <span className="admin-likes">❤️ {currentSong.likes || 0} likes</span>
              </div>
              <button 
                className="skip-btn"
                onClick={() => socketRef.current?.emit('play-next')}
                title="Saltar a siguiente canción"
              >
                ⏭️ Siguiente
              </button>
            </div>
          ) : (
            <div className="no-song-panel">
              <p>No hay música sonando</p>
              {queue.length > 0 && (
                <button 
                  className="play-next-btn"
                  onClick={() => socketRef.current?.emit('play-next')}
                >
                  ▶️ Reproducir primera canción
                </button>
              )}
            </div>
          )}
        </div>

        {queue.length > 0 && (
          <div className="next-songs">
            <div className="next-songs-header">
              <h3>⏭️ Cola de canciones ({queue.length})</h3>
              <button 
                className="clear-all-btn"
                onClick={() => {
                  if (window.confirm('¿Eliminar todas las canciones de la cola?')) {
                    socketRef.current?.emit('clear-queue');
                  }
                }}
              >
                🗑️ Limpiar cola
              </button>
            </div>
            <div className="next-list">
              {queue.map((song, index) => (
                <div key={song.id} className="next-item">
                  <span className="next-position">#{index + 1}</span>
                  <img src={song.thumbnail} alt={song.title} />
                  <div className="next-info">
                    <p className="next-title">{song.title}</p>
                    <p className="next-artist">{song.channelTitle}</p>
                  </div>
                  <span className="next-likes">❤️ {song.likes}</span>
                  <button 
                    className="delete-song-btn"
                    onClick={() => socketRef.current?.emit('delete-song', song.id)}
                    title="Eliminar canción"
                  >
                    ❌
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat flotante para admin */}
        <button 
          className="chat-toggle-btn"
          onClick={() => setShowChat(!showChat)}
          title="Chat con clientes"
        >
          💬 {chatMessages.length > 0 && <span className="chat-badge">{chatMessages.length}</span>}
        </button>

        {showChat && (
          <div className="admin-chat-widget">
            <div className="admin-chat-header">
              <h3>💬 Chat en vivo</h3>
              <button onClick={() => setShowChat(false)}>✕</button>
            </div>
            <div className="admin-chat-messages">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="admin-chat-message">
                  {msg.replyTo && (
                    <div className="reply-reference">
                      <small>↩️ Respuesta a {msg.replyTo.username}:</small>
                      <small className="reply-text">"{msg.replyTo.text}"</small>
                    </div>
                  )}
                  <div className="message-header">
                    <strong>{msg.username}:</strong> {msg.text}
                    {!msg.username.includes('Administrador') && (
                      <button 
                        className="reply-btn"
                        onClick={() => handleReplyTo(msg)}
                        title="Responder a este mensaje"
                      >
                        ↩️
                      </button>
                    )}
                  </div>
                  <span className="admin-chat-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
            {replyingTo && (
              <div className="replying-banner">
                <span>↩️ Respondiendo a <strong>{replyingTo.username}</strong>: "{replyingTo.text}"</span>
                <button onClick={() => setReplyingTo(null)}>✕</button>
              </div>
            )}
            <div className="admin-chat-input">
              <input
                type="text"
                placeholder={replyingTo ? `Responder a ${replyingTo.username}...` : "Responder a los clientes..."}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button onClick={handleSendMessage}>Enviar</button>
            </div>
          </div>
        )}
      </main>

      <footer className="display-footer">
        <p>Escanea el QR para agregar tus canciones favoritas | 📺 <a href="/video" target="_blank">Abrir pantalla de video</a></p>
      </footer>
    </div>
  );
}

export default Display;
