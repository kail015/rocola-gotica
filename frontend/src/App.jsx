import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const socket = io(BACKEND_URL);

function App() {
  const [queue, setQueue] = useState([]);
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

  // Socket listeners
  useEffect(() => {
    socket.on('queue-update', (updatedQueue) => {
      setQueue(updatedQueue);
    });

    socket.on('current-song', (song) => {
      setCurrentSong(song);
    });

    socket.on('chat-message', (message) => {
      setChatMessages(prev => [...prev, message]);
    });

    socket.on('users-count', (count) => {
      setUsersCount(count);
    });

    // Cargar datos iniciales
    loadInitialData();

    return () => {
      socket.off('queue-update');
      socket.off('current-song');
      socket.off('chat-message');
      socket.off('users-count');
    };
  }, []);

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
      setChatMessages(chatRes.data);
      setMenu(menuRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/search`, {
        params: { q: searchQuery }
      });
      setSearchResults(response.data);
      setActiveTab('search');
    } catch (error) {
      console.error('Error searching:', error);
      alert('Error al buscar canciones. Verifica que la API de YouTube esté configurada.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSong = (song) => {
    socket.emit('add-song', song);
    setSearchResults([]);
    setSearchQuery('');
    setActiveTab('queue');
  };

  const handleLikeSong = (songId) => {
    socket.emit('like-song', { songId, userId });
  };

  const handleSendMessage = () => {
    if (!chatInput.trim() || !username.trim()) return;
    
    socket.emit('chat-message', {
      username: username.trim(),
      text: chatInput.trim()
    });
    
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
          <img src="/logogotica.jpg" alt="Ciudad Gótica Licores Bar" className="logo" />
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
                      onClick={() => socket.emit('play-next')}
                    >
                      ▶️ Reproducir primera canción
                    </button>
                  )}
                  {queue.map((song, index) => (
                    <div key={song.id} className="song-item">
                      <span className="song-position">#{index + 1}</span>
                      <img src={song.thumbnail} alt={song.title} />
                      <div className="song-info">
                        <h4>{song.title}</h4>
                        <p>{song.channelTitle}</p>
                      </div>
                      <div className="song-actions">
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
                searchResults.map((song) => (
                  <div key={song.id} className="song-item">
                    <img src={song.thumbnail} alt={song.title} />
                    <div className="song-info">
                      <h4>{song.title}</h4>
                      <p>{song.channelTitle}</p>
                    </div>
                    <button 
                      className="add-btn"
                      onClick={() => handleAddSong({
                        videoId: song.id,
                        title: song.title,
                        thumbnail: song.thumbnail,
                        channelTitle: song.channelTitle
                      })}
                    >
                      ➕ Agregar
                    </button>
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
    </div>
  );
}

export default App;
