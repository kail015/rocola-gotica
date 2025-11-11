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

  useEffect(() => {
    // Crear conexión socket solo una vez
    socketRef.current = io(BACKEND_URL);
    const socket = socketRef.current;

    socket.on('current-song', (song) => {
      console.log('📺 Canción actual recibida:', song?.title || 'ninguna');
      setCurrentSong(song);
      // Resetear flag cuando hay una canción reproduciéndose
      if (song) {
        autoPlayTriggeredRef.current = false;
      }
    });

    socket.on('queue-update', (updatedQueue) => {
      console.log('📋 Cola actualizada:', updatedQueue.length, 'canciones');
      setQueue(updatedQueue);
    });

    return () => {
      socket.off('current-song');
      socket.off('queue-update');
      socket.disconnect();
    };
  }, []);

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

  // Detener modo aleatorio y cambiar a canción de la cola cuando hay nuevas canciones
  useEffect(() => {
    if (queue.length > 0 && isRandomMode && currentSong?.isRandom) {
      console.log('🎵 Nueva canción agregada, saliendo del modo aleatorio...');
      setIsRandomMode(false);
      if (socketRef.current) {
        socketRef.current.emit('play-next');
      }
    }
  }, [queue, isRandomMode, currentSong]);

  // Función para obtener un video aleatorio de YouTube
  const getRandomVideo = async () => {
    try {
      const randomSearch = RANDOM_SEARCHES[Math.floor(Math.random() * RANDOM_SEARCHES.length)];
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(randomSearch)}&type=video&key=${YOUTUBE_API_KEY}`
      );
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.items.length);
        const video = data.items[randomIndex];
        
        return {
          videoId: video.id.videoId,
          title: video.snippet.title,
          channelTitle: video.snippet.channelTitle,
          thumbnail: video.snippet.thumbnails.default.url,
          likes: 0,
          isRandom: true
        };
      }
    } catch (error) {
      console.error('Error obteniendo video aleatorio:', error);
    }
    return null;
  };

  const handleSongEnd = async () => {
    console.log('🎵 Canción terminada, solicitando siguiente...');
    
    // Si hay canciones en la cola, reproducir la siguiente
    if (queue.length > 0) {
      setIsRandomMode(false);
      if (socketRef.current) {
        socketRef.current.emit('play-next');
      }
    } else {
      // Si no hay canciones en la cola, reproducir aleatoriamente
      console.log('🔀 Cola vacía, reproduciendo música aleatoria...');
      setIsRandomMode(true);
      const randomVideo = await getRandomVideo();
      if (randomVideo) {
        setCurrentSong(randomVideo);
      }
    }
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
          <YouTube
            key={currentSong.videoId}
            videoId={currentSong.videoId}
            opts={opts}
            onEnd={handleSongEnd}
            className="youtube-fullscreen"
          />
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
              {queue.length > 0 && (
                <>
                  <h3>🎵 Próximas canciones ({queue.length})</h3>
                  <div className="queue-list-video">
                    {queue.map((song, index) => (
                      <div key={song.id} className="queue-item-video">
                        <div className="queue-number">{index + 1}</div>
                        <img src={song.thumbnail} alt={song.title} />
                        <div className="queue-song-info">
                          <h4>{song.title}</h4>
                          <p>{song.channelTitle}</p>
                        </div>
                        <span className="queue-likes">❤️ {song.likes || 0}</span>
                      </div>
                    ))}
                  </div>
                </>
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
