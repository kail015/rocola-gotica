import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import YouTube from 'react-youtube';
import { QRCodeSVG } from 'qrcode.react';
import './VideoScreen.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function VideoScreen() {
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
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

  const handleSongEnd = () => {
    console.log('🎵 Canción terminada, solicitando siguiente...');
    if (socketRef.current) {
      socketRef.current.emit('play-next');
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
              <h2>{currentSong.title}</h2>
              <p>{currentSong.channelTitle}</p>
              <span className="video-likes">❤️ {currentSong.likes || 0}</span>
            </div>
            <div className="queue-sidebar">
              <div className="qr-section">
                <QRCodeSVG 
                  value="https://rockola-ciudad-gotica-licores.netlify.app"
                  size={120}
                  level="H"
                  includeMargin={true}
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
            <h1>🎵 ROCKOLA CIUDAD GÓTICA LICORES</h1>
            <div className="waiting-animation">
              <div className="music-note">♪</div>
              <div className="music-note">♫</div>
              <div className="music-note">♪</div>
            </div>
            <p>Esperando música...</p>
            {queue.length > 0 && (
              <p className="queue-info">
                {queue.length} {queue.length === 1 ? 'canción' : 'canciones'} en cola
              </p>
            )}
            <div className="waiting-qr">
              <QRCodeSVG 
                value="https://rockola-ciudad-gotica-licores.netlify.app"
                size={150}
                level="H"
                includeMargin={true}
                className="qr-code-waiting"
              />
              <p className="qr-text-waiting">📱 Escanea para agregar canciones</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoScreen;
