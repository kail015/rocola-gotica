import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import './Display.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const socket = io(BACKEND_URL);

function Display() {
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const navigate = useNavigate();

  // Verificar autenticación
  useEffect(() => {
    const isAdmin = sessionStorage.getItem('isAdmin');
    if (!isAdmin) {
      navigate('/admin-access');
    }
  }, [navigate]);

  useEffect(() => {
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
    };
  }, []);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    
    socket.emit('chat-message', {
      username: '🛡️ Administrador',
      text: chatInput.trim()
    });
    
    setChatInput('');
  };

  return (
    <div className="display">
      <header className="display-header">
        <img src="/logogotica.jpg" alt="Ciudad Gótica Licores Bar" className="admin-logo" />
        <h1>🎵 Rocola Gótica - Admin</h1>
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
                onClick={() => socket.emit('play-next')}
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
                  onClick={() => socket.emit('play-next')}
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
                    socket.emit('clear-queue');
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
                    onClick={() => socket.emit('delete-song', song.id)}
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
                  <strong>{msg.username}:</strong> {msg.text}
                  <span className="admin-chat-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
            <div className="admin-chat-input">
              <input
                type="text"
                placeholder="Responder a los clientes..."
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
