import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import YouTube from 'react-youtube';
import { QRCodeSVG } from 'qrcode.react';
import './VideoScreen.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const YOUTUBE_API_KEY = 'AIzaSyDBzDvHctztTDoOLD4wEE8fOQPY8nmmRac';

// Lista de búsquedas aleatorias para música variada
const RANDOM_SEARCHES = [
  'música popular en español',
  'música latina 2024',
  'reggaeton hits',
  'rock en español',
  'salsa romántica',
  'bachata hits',
  'música electrónica',
  'pop latino',
  'música tropical',
  'merengue clásico'
];

function VideoScreen() {
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isRandomMode, setIsRandomMode] = useState(false);
  const socketRef = useRef(null);
  const autoPlayTriggeredRef = useRef(false);

  // Keep-alive: mantener servidor activo
  useEffect(() => {
    const keepAlive = setInterval(async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/ping`);
        if (response.ok) {
          console.log('🏓 Keep-alive ping enviado');
        }
      } catch (error) {
        console.error('❌ Error en keep-alive:', error);
      }
    }, 5 * 60 * 1000); // Cada 5 minutos

    return () => clearInterval(keepAlive);
  }, []);

  useEffect(() => {
    // Crear conexión socket solo una vez
    socketRef.current = io(BACKEND_URL);
    const socket = socketRef.current;

    socket.on('current-song', (song) => {
      console.log('📺 Canción actual recibida:', song?.title || 'ninguna');
      
      if (song) {
        // Si viene una canción real de la cola, usarla y salir del modo aleatorio
        setCurrentSong(song);
        autoPlayTriggeredRef.current = false;
        setIsRandomMode(false);
      } else {
        // Si viene null, resetear para permitir modo aleatorio o nuevo auto-play
        setCurrentSong(null);
        autoPlayTriggeredRef.current = false;
      }
    });

    socket.on('queue-update', (updatedQueue) => {
      console.log('📋 Cola actualizada:', updatedQueue.length, 'canciones');
      setQueue(updatedQueue);
      
      // Si había una canción sonando y se borró la cola, resetear auto-play
      if (updatedQueue.length === 0) {
        autoPlayTriggeredRef.current = false;
      }
    });

    socket.on('show-advertisement', (adData) => {
      console.log('📺 Mostrando anuncio publicitario');
      setCurrentSong({
        isAdvertisement: true,
        videoUrl: adData.url,
        title: 'Anuncio Publicitario',
        uploadedBy: adData.uploadedBy
      });
    });

    socket.on('connect', () => {
      console.log('✅ Socket conectado al servidor');
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket desconectado del servidor');
    });

    return () => {
      socket.off('current-song');
      socket.off('queue-update');
      socket.off('show-advertisement');
      socket.off('connect');
      socket.off('disconnect');
      socket.disconnect();
    };
  }, []); // Solo se ejecuta una vez al montar

  // Auto-iniciar primera canción cuando la cola tenga canciones y no haya nada reproduciéndose
  useEffect(() => {
    if (queue.length > 0 && !currentSong && !autoPlayTriggeredRef.current && socketRef.current) {
      console.log('🚀 Auto-iniciando primera canción...');
      autoPlayTriggeredRef.current = true; // Marcar que ya se ejecutó
      const timer = setTimeout(() => {
        socketRef.current.emit('play-next');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [queue, currentSong]);

  // Detener modo aleatorio cuando hay canciones en cola (pero no interrumpir reproducción actual)
  useEffect(() => {
    if (queue.length > 0 && isRandomMode) {
      console.log('🎵 Canciones agregadas a la cola, modo aleatorio se desactivará al terminar esta canción');
      setIsRandomMode(false);
    }
  }, [queue, isRandomMode]);

  // Función para obtener un video aleatorio de YouTube
  const getRandomVideo = async () => {
    try {
      const randomSearch = RANDOM_SEARCHES[Math.floor(Math.random() * RANDOM_SEARCHES.length)];
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(randomSearch)}&type=video&videoEmbeddable=true&key=${YOUTUBE_API_KEY}`
      );
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        // Obtener IDs de videos
        const videoIds = data.items.map(item => item.id.videoId).join(',');
        
        // Verificar detalles de embebibilidad
        const detailsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoIds}&key=${YOUTUBE_API_KEY}`
        );
        const detailsData = await detailsResponse.json();
        
        // Filtrar solo videos embebibles
        const embeddableVideos = detailsData.items.filter(item => item.status.embeddable);
        
        if (embeddableVideos.length > 0) {
          const randomIndex = Math.floor(Math.random() * embeddableVideos.length);
          const video = embeddableVideos[randomIndex];
          
          return {
            videoId: video.id,
            title: video.snippet.title,
            channelTitle: video.snippet.channelTitle,
            thumbnail: video.snippet.thumbnails.default.url,
            likes: 0,
            isRandom: true
          };
        }
      }
    } catch (error) {
      console.error('Error obteniendo video aleatorio:', error);
    }
    return null;
  };

  const handleSongEnd = async () => {
    console.log('🎵 Canción terminada');
    console.log('📊 Estado: Cola:', queue.length, '| Modo aleatorio:', isRandomMode, '| Canción actual es aleatoria:', currentSong?.isRandom);
    
    // Si hay canciones en la cola, reproducir la siguiente
    if (queue.length > 0) {
      console.log('✅ Hay canciones en cola, reproduciendo siguiente...');
      setIsRandomMode(false);
      if (socketRef.current) {
        socketRef.current.emit('play-next');
      }
    } else {
      // Si no hay canciones en la cola, reproducir aleatoriamente
      console.log('🔀 Cola vacía, activando modo aleatorio...');
      setIsRandomMode(true);
      
      // Pequeño delay para asegurar que el modo aleatorio está activo
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const randomVideo = await getRandomVideo();
      if (randomVideo) {
        console.log('✅ Video aleatorio obtenido:', randomVideo.title);
        setCurrentSong(randomVideo);
      } else {
        console.log('❌ No se pudo obtener video aleatorio, reintentando en 2 segundos...');
        setTimeout(async () => {
          const retryVideo = await getRandomVideo();
          if (retryVideo) {
            console.log('✅ Video aleatorio obtenido (reintento):', retryVideo.title);
            setCurrentSong(retryVideo);
          } else {
            console.error('❌ No se pudo obtener video aleatorio después de reintentar');
          }
        }, 2000);
      }
    }
  };

  const handleError = async (event) => {
    console.error('❌ Error en reproductor de YouTube:', event);
    console.log('🔄 Intentando siguiente canción...');
    
    // Si es modo aleatorio, intentar otro video
    if (isRandomMode) {
      const randomVideo = await getRandomVideo();
      if (randomVideo) {
        setCurrentSong(randomVideo);
      }
    } else if (queue.length > 0) {
      // Si hay cola, pasar a la siguiente
      if (socketRef.current) {
        socketRef.current.emit('play-next');
      }
    }
  };

  const handleReady = (event) => {
    console.log('✅ Reproductor listo:', currentSong?.title);
  };

  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      controls: 0,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
    },
  };

  return (
    <div className="video-screen">
      {currentSong ? (
        <div className="fullscreen-video">
          {currentSong.isAdvertisement ? (
            // Mostrar video de publicidad
            <video
              key={currentSong.videoUrl}
              src={currentSong.videoUrl}
              autoPlay
              onEnded={() => {
                console.log('📺 Anuncio finalizado, reproduciendo siguiente canción');
                socketRef.current?.emit('play-next');
              }}
              className="advertisement-video"
              controls={false}
            />
          ) : (
            // Mostrar video de YouTube normal
            <YouTube
              key={currentSong.videoId}
              videoId={currentSong.videoId}
              opts={opts}
              onEnd={handleSongEnd}
              onError={handleError}
              onReady={handleReady}
              className="youtube-fullscreen"
            />
          )}
          <div className="video-info-overlay">
            <div className="video-header-logo">
              <img src="/logogotica.png" alt="Ciudad Gótica" className="video-logo" />
            </div>
            <div className="video-info-content">
              {isRandomMode && (
                <div className="random-mode-badge">
                  🔀 Reproducción Aleatoria
                </div>
              )}
              <h2>{currentSong.title}</h2>
              <p>{currentSong.channelTitle}</p>
              {!isRandomMode && <span className="video-likes">❤️ {currentSong.likes || 0}</span>}
            </div>
            <div className="queue-sidebar">
              <div className="qr-section">
                <QRCodeSVG 
                  value="https://rockola-ciudad-gotica-licores.netlify.app"
                  size={120}
                  level="H"
                  includeMargin={false}
                  className="qr-code"
                />
                <p className="qr-text">📱 Escanea para agregar canciones</p>
              </div>
              
              <h3 className="queue-title">🎵 Cola de Reproducción ({queue.length})</h3>
              
              {queue.length > 0 ? (
                <div className="queue-list-video">
                  {queue.map((song, index) => (
                    <div key={song.id} className={`queue-item-video ${song.paidPriority ? 'priority-queue' : ''}`}>
                      <div className="queue-number">#{index + 1}</div>
                      <img src={song.thumbnail} alt={song.title} />
                      <div className="queue-song-info">
                        <h4>
                          {song.paidPriority && <span className="priority-badge-small">⚡</span>}
                          {song.title}
                        </h4>
                        <p>{song.channelTitle}</p>
                        {song.addedBy && (
                          <p className="added-by">👤 {song.addedBy}</p>
                        )}
                      </div>
                      <span className="queue-likes">❤️ {song.likes || 0}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-queue-message">
                  <p>🎶 No hay canciones en cola</p>
                  <p className="hint-text">Escanea el QR para agregar</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="waiting-screen">
          <div className="waiting-content">
            <img src="/logogotica.png" alt="Ciudad Gótica Licores Bar" className="waiting-logo" />
            <h1>ROCKOLA CIUDAD GÓTICA LICORES</h1>
            <div className="waiting-animation">
              <div className="music-note">♪</div>
              <div className="music-note">♫</div>
              <div className="music-note">♪</div>
            </div>
            <p>Esperando música...</p>
            {queue.length > 0 && (
              <p className="queue-info">
                {queue.length} {queue.length === 1 ? 'canción en cola' : 'canciones en cola'}
              </p>
            )}
            <div className="waiting-qr">
              <QRCodeSVG 
                value="https://rockola-ciudad-gotica-licores.netlify.app"
                size={140}
                level="H"
                includeMargin={false}
                className="qr-code-waiting"
              />
              <p className="qr-text-waiting">📱 Escanea para agregar canciones</p>
            </div>
            
            <div className="video-footer-credits">
              <span>Desarrollado por</span>
              <img src="/lunatica-logo.png" alt="Lunatica App Solutions" className="lunatica-logo-small" />
              <span>Lunatica App Solutions</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoScreen;
