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
      console.log('📺 Evento show-advertisement recibido:', adData);
      console.log('📺 URL del anuncio:', adData.url);
      setCurrentSong({
        isAdvertisement: true,
        videoUrl: adData.url,
        title: '📺 Anuncio Publicitario',
        uploadedBy: adData.uploadedBy || 'Cliente',
        channelTitle: `Publicidad de ${adData.uploadedBy || 'Cliente'}`
      });
      autoPlayTriggeredRef.current = false; // Resetear para que después del anuncio pueda reproducir
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
        <div className="two-column-layout">
          {/* COLUMNA IZQUIERDA - REPRODUCTOR */}
          <div className="video-column">
            {currentSong.isAdvertisement ? (
              // Mostrar video de publicidad
              <video
              key={currentSong.videoUrl}
              src={currentSong.videoUrl}
              autoPlay
              muted={false}
              playsInline
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                backgroundColor: '#000',
                zIndex: 1000
              }}
              onLoadStart={() => {
                console.log('📺 Cargando anuncio...');
                console.log('📺 URL:', currentSong.videoUrl);
              }}
              onLoadedMetadata={(e) => {
                console.log('📺 Metadata cargada');
                console.log('📺 Duración:', e.target.duration, 'segundos');
                console.log('📺 Video width:', e.target.videoWidth);
                console.log('📺 Video height:', e.target.videoHeight);
              }}
              onCanPlay={() => console.log('📺 Anuncio listo para reproducir')}
              onPlay={() => console.log('📺 ▶️ Anuncio reproduciéndose')}
              onTimeUpdate={(e) => {
                // Log cada 2 segundos
                if (Math.floor(e.target.currentTime) % 2 === 0) {
                  console.log(`📺 Reproduciendo: ${Math.floor(e.target.currentTime)}s / ${Math.floor(e.target.duration)}s`);
                }
              }}
              onEnded={() => {
                console.log('📺 ✅ Anuncio finalizado, notificando al servidor');
                // Notificar al backend que el anuncio terminó para que lo elimine
                socketRef.current?.emit('advertisement-ended');
                setCurrentSong(null); // Limpiar primero
                setTimeout(() => {
                  console.log('📺 Reproduciendo siguiente canción');
                  socketRef.current?.emit('play-next');
                }, 500);
              }}
              onError={(e) => {
                console.error('❌ Error cargando anuncio:', e);
                console.error('❌ Error code:', e.target.error?.code);
                console.error('❌ Error message:', e.target.error?.message);
                console.error('❌ URL que falló:', currentSong.videoUrl);
                console.error('❌ Network state:', e.target.networkState);
                console.error('❌ Ready state:', e.target.readyState);
                
                // Mostrar alerta al admin
                if (e.target.error?.code === 4) {
                  console.error('❌ FORMATO DE VIDEO INCOMPATIBLE');
                  console.error('❌ El navegador no puede reproducir este codec');
                  console.error('❌ Recodifique el video a MP4 (H.264) compatible con navegadores');
                }
                
                // Si el anuncio falla, pasar a la siguiente canción
                setTimeout(() => {
                  socketRef.current?.emit('play-next');
                }, 1000);
              }}
              onPause={() => console.log('📺 ⏸️ Video pausado')}
              onWaiting={() => console.log('📺 ⏳ Esperando buffer...')}
              onStalled={() => console.log('📺 ⚠️ Video detenido (stalled)')}
              controls={true}
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
                className="youtube-player"
              />
            )}
            
            {/* Info del video debajo del reproductor */}
            {!currentSong.isAdvertisement && (
              <div className="video-info-bottom">
                <div className="powered-by-youtube">
                  <span>▶️ Powered by YouTube</span>
                </div>
                <div className="current-song-info">
                  {isRandomMode && (
                    <div className="random-mode-badge">
                      🔀 Reproducción Aleatoria
                    </div>
                  )}
                  <h3 className="song-title">{currentSong.title}</h3>
                  <p className="song-channel">{currentSong.channelTitle}</p>
                  {!isRandomMode && <span className="video-likes">❤️ {currentSong.likes || 0}</span>}
                </div>
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA - LOGO Y COLA */}
          <div className="sidebar-column">
            <div className="sidebar-header">
              <img src="/logogotica.png" alt="Ciudad Gótica Licores" className="sidebar-logo" />
              <h1 className="bar-name">ROCKOLA CIUDAD GÓTICA LICORES</h1>
            </div>

            <div className="qr-section-sidebar">
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
            
            {/* Footer con créditos */}
            <div className="sidebar-footer">
              <span>Desarrollado por</span>
              <img src="/lunatica-logo.png" alt="Lunatica App Solutions" className="lunatica-logo-sidebar" />
              <span>Lunatica App Solutions</span>
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
