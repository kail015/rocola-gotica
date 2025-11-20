import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
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
  const [menu, setMenu] = useState([]);
  const [showMenuManager, setShowMenuManager] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: 'Bebidas' });
  const [showAdManager, setShowAdManager] = useState(false);
  const [pendingAds, setPendingAds] = useState([]);
  const [approvedAds, setApprovedAds] = useState([]);
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
      // Admin ve todos los mensajes
      setChatMessages(prev => [...prev, message]);
    });

    socket.on('admin-chat-message', (message) => {
      // Mensajes enviados por el admin
      setChatMessages(prev => [...prev, message]);
    });

    socket.on('menu-update', (updatedMenu) => {
      setMenu(updatedMenu);
    });

    // Cargar mensajes existentes
    fetch(`${BACKEND_URL}/api/chat`)
      .then(res => res.json())
      .then(data => {
        // Admin ve todos los mensajes
        setChatMessages(data);
      })
      .catch(err => console.error('Error loading chat:', err));

    // Cargar menú
    fetch(`${BACKEND_URL}/api/menu`)
      .then(res => res.json())
      .then(data => setMenu(data))
      .catch(err => console.error('Error loading menu:', err));

    // Cargar anuncios pendientes
    fetch(`${BACKEND_URL}/api/advertisement/pending`)
      .then(res => res.json())
      .then(data => {
        console.log('📺 Anuncios cargados:', data);
        setPendingAds(data.pending || []);
        setApprovedAds(data.approved || []);
      })
      .catch(err => console.error('Error loading ads:', err));

    socket.on('pending-advertisement', (ad) => {
      console.log('📺 Nuevo anuncio recibido:', ad);
      setPendingAds(prev => {
        const updated = [...prev, ad];
        console.log('📺 Lista actualizada:', updated);
        return updated;
      });
      alert(`📺 Nuevo anuncio pendiente de aprobación de: ${ad.uploadedBy}`);
    });

    return () => {
      socket.off('current-song');
      socket.off('queue-update');
      socket.off('chat-message');
      socket.off('admin-chat-message');
      socket.off('menu-update');
      socket.off('pending-advertisement');
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
      text: msg.text,
      userId: msg.userId // Importante: incluir el userId del cliente
    });
    setChatInput('');
  };

  // Funciones para gestionar el menú
  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price) {
      alert('Por favor completa todos los campos');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      
      if (response.ok) {
        setNewItem({ name: '', price: '', category: 'Bebidas' });
        alert('Producto agregado exitosamente');
      }
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Error al agregar producto');
    }
  };

  const handleUpdateItem = async (id) => {
    if (!editingItem.name || !editingItem.price) {
      alert('Por favor completa todos los campos');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/menu/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem)
      });
      
      if (response.ok) {
        setEditingItem(null);
        alert('Producto actualizado exitosamente');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Error al actualizar producto');
    }
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/menu/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        alert('Producto eliminado exitosamente');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Error al eliminar producto');
    }
  };

  const startEditing = (item) => {
    setEditingItem({ ...item });
  };

  const cancelEditing = () => {
    setEditingItem(null);
  };

  return (
    <div className="display">
      <header className="display-header">
        <img src="/logogotica.png" alt="Ciudad Gótica Licores Bar" className="admin-logo" />
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
                    {song.addedBy && (
                      <p className="song-added-by">👤 {song.addedBy}</p>
                    )}
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

        {/* Botón para gestionar menú */}
        <button 
          className="menu-toggle-btn"
          onClick={() => setShowMenuManager(!showMenuManager)}
          title="Gestionar Menú"
        >
          🍽️ Menú
        </button>

        {/* Botón para gestionar publicidad - DESHABILITADO TEMPORALMENTE
        <button 
          className="ad-toggle-btn"
          onClick={() => setShowAdManager(!showAdManager)}
          title="Gestionar Publicidad"
        >
          📺 Ads {pendingAds.length > 0 && <span className="ad-badge">{pendingAds.length}</span>}
        </button>
        */}

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

        {/* Panel de gestión del menú */}
        {showMenuManager && (
          <div className="menu-manager-widget">
            <div className="menu-manager-header">
              <h3>🍽️ Gestionar Menú</h3>
              <button onClick={() => setShowMenuManager(false)}>✕</button>
            </div>
            
            <div className="menu-manager-content">
              {/* Formulario para agregar nuevo producto */}
              <div className="add-item-form">
                <h4>➕ Agregar Producto</h4>
                <input
                  type="text"
                  placeholder="Nombre del producto"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Precio"
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                />
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                >
                  <option value="Bebidas">Bebidas</option>
                  <option value="Comida">Comida</option>
                  <option value="Snacks">Snacks</option>
                  <option value="Cocteles">Cocteles</option>
                </select>
                <button onClick={handleAddItem} className="add-item-btn">
                  Agregar Producto
                </button>
              </div>

              {/* Lista de productos existentes */}
              <div className="menu-items-list">
                <h4>📋 Productos Actuales</h4>
                {menu.map((item) => (
                  <div key={item.id} className="menu-manager-item">
                    {editingItem && editingItem.id === item.id ? (
                      // Modo edición
                      <div className="edit-item-form">
                        <input
                          type="text"
                          value={editingItem.name}
                          onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        />
                        <input
                          type="number"
                          value={editingItem.price}
                          onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                        />
                        <select
                          value={editingItem.category}
                          onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                        >
                          <option value="Bebidas">Bebidas</option>
                          <option value="Comida">Comida</option>
                          <option value="Snacks">Snacks</option>
                          <option value="Cocteles">Cocteles</option>
                        </select>
                        <div className="edit-actions">
                          <button onClick={() => handleUpdateItem(item.id)} className="save-btn">
                            ✓ Guardar
                          </button>
                          <button onClick={cancelEditing} className="cancel-btn">
                            ✕ Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Modo vista
                      <>
                        <div className="item-info">
                          <h5>{item.name}</h5>
                          <p className="item-category">{item.category}</p>
                          <p className="item-price">${item.price.toLocaleString()}</p>
                        </div>
                        <div className="item-actions">
                          <button onClick={() => startEditing(item)} className="edit-btn" title="Editar">
                            ✏️
                          </button>
                          <button onClick={() => handleDeleteItem(item.id)} className="delete-btn" title="Eliminar">
                            🗑️
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Panel de gestión de publicidad - DESHABILITADO TEMPORALMENTE */}
        {false && showAdManager && (
          <div className="menu-manager ad-manager">
            <div className="menu-panel">
              <div className="menu-header">
                <h3>📺 Gestión de Publicidad</h3>
                <div style={{display: 'flex', gap: '1rem'}}>
                  <button 
                    onClick={async () => {
                      const res = await axios.get(`${BACKEND_URL}/api/advertisement/pending`);
                      setPendingAds(res.data.pending || []);
                      setApprovedAds(res.data.approved || []);
                    }}
                    style={{background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer'}}
                  >
                    🔄 Recargar
                  </button>
                  <button onClick={() => setShowAdManager(false)} className="close-btn">✕</button>
                </div>
              </div>
              
              <div style={{padding: '2rem', overflowY: 'auto', flex: 1, background: '#0a1628', minHeight: '500px'}}>
                {/* Anuncios pendientes */}
                <div style={{background: '#1e3a5f', padding: '1.5rem', marginBottom: '2rem', borderRadius: '10px', border: '2px solid #ff914d'}}>
                  <h4 style={{color: '#ff914d', margin: '0 0 1rem 0', fontSize: '1.3rem'}}>⏳ Pendientes de aprobación ({pendingAds?.length || 0})</h4>
                  
                  {pendingAds && pendingAds.length > 0 ? (
                    pendingAds.map((ad, index) => (
                      <div key={ad.id || index} style={{background: '#0f1f3a', padding: '1rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #3b82f6'}}>
                        <p style={{color: 'white', margin: '0.5rem 0', fontSize: '1rem'}}>👤 <strong>{ad.uploadedBy}</strong></p>
                        <p style={{color: '#8b9cb5', margin: '0.5rem 0', fontSize: '0.9rem'}}>📅 {new Date(ad.uploadedAt).toLocaleString('es-CO')}</p>
                        <p style={{color: '#8b9cb5', margin: '0.5rem 0', fontSize: '0.9rem'}}>📦 {(ad.size / 1024 / 1024).toFixed(2)} MB</p>
                        <div style={{marginTop: '1rem', display: 'flex', gap: '0.5rem'}}>
                          <button 
                            onClick={async () => {
                              try {
                                await axios.post(`${BACKEND_URL}/api/advertisement/approve/${ad.id}`);
                                alert('✅ Anuncio aprobado y agregado a la cola');
                                const res = await axios.get(`${BACKEND_URL}/api/advertisement/pending`);
                                setPendingAds(res.data.pending || []);
                                setApprovedAds(res.data.approved || []);
                              } catch (error) {
                                alert('❌ Error: ' + (error.response?.data?.error || error.message));
                              }
                            }}
                            style={{padding: '0.6rem 1.2rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}
                          >
                            ✅ Aprobar
                          </button>
                          <button 
                            onClick={async () => {
                              if (window.confirm(`¿Rechazar anuncio de ${ad.uploadedBy}?`)) {
                                try {
                                  await axios.delete(`${BACKEND_URL}/api/advertisement/reject/${ad.id}`);
                                  alert('❌ Anuncio rechazado');
                                  const res = await axios.get(`${BACKEND_URL}/api/advertisement/pending`);
                                  setPendingAds(res.data.pending || []);
                                  setApprovedAds(res.data.approved || []);
                                } catch (error) {
                                  alert('❌ Error: ' + (error.response?.data?.error || error.message));
                                }
                              }
                            }}
                            style={{padding: '0.6rem 1.2rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}
                          >
                            ❌ Rechazar
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{color: '#e2e8f0', textAlign: 'center', padding: '2rem', margin: 0}}>No hay anuncios pendientes</p>
                  )}
                </div>
                
                {/* Cola de anuncios aprobados */}
                <div style={{background: '#1e3a5f', padding: '1.5rem', borderRadius: '10px', border: '2px solid #10b981'}}>
                  <h4 style={{color: '#10b981', margin: '0 0 1rem 0', fontSize: '1.3rem'}}>✅ Cola de anuncios aprobados ({approvedAds?.length || 0})</h4>
                  {approvedAds && approvedAds.length > 0 ? (
                    <>
                      {approvedAds.length > 0 && (
                        <div style={{marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                          <button 
                            onClick={async () => {
                              try {
                                await axios.post(`${BACKEND_URL}/api/advertisement/test-trigger`);
                                alert('🎬 Anuncio activado manualmente. Ve a la pantalla de video para verlo.');
                              } catch (error) {
                                alert('❌ Error: ' + (error.response?.data?.error || error.message));
                              }
                            }}
                            style={{padding: '0.6rem 1.2rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}
                          >
                            🎬 Probar Próximo Anuncio
                          </button>
                        </div>
                      )}
                      {approvedAds.map((ad, index) => (
                        <div key={ad.id || index} style={{background: '#0f1f3a', padding: '1rem', marginBottom: '1rem', borderRadius: '8px', border: index === 0 ? '2px solid #10b981' : '1px solid #3b82f6'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem'}}>
                            {index === 0 ? <span style={{fontSize: '1.2rem'}}>▶️</span> : <span style={{color: '#8b9cb5'}}>#{index + 1}</span>}
                            <p style={{color: 'white', margin: 0}}>👤 <strong>{ad.uploadedBy}</strong></p>
                          </div>
                          <p style={{color: '#8b9cb5', margin: '0.5rem 0', fontSize: '0.9rem'}}>📁 {ad.filename}</p>
                          <p style={{color: '#8b9cb5', margin: '0.5rem 0', fontSize: '0.9rem'}}>📅 {new Date(ad.approvedAt).toLocaleString('es-CO')}</p>
                          {index === 0 && <p style={{color: '#10b981', margin: '0.5rem 0', fontSize: '0.9rem', fontWeight: 'bold'}}>Próximo en reproducirse</p>}
                        </div>
                      ))}
                    </>
                  ) : (
                    <p style={{color: '#e2e8f0', textAlign: 'center', padding: '2rem', margin: 0}}>No hay anuncios aprobados en cola</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="display-footer">
        <p>Escanea el QR para agregar tus canciones favoritas | 📺 <a href="/video" target="_blank">Abrir pantalla de video</a></p>
        <div className="footer-credits">
          <span>Desarrollado por</span>
          <img src="/lunatica-logo.png" alt="Lunatica App Solutions" className="lunatica-logo" />
          <span>Lunatica App Solutions</span>
        </div>
      </footer>
    </div>
  );
}

export default Display;
