import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import YouTube from 'react-youtube';
import './VideoScreen.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const socket = io(BACKEND_URL);

function VideoScreen() {
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    socket.on('current-song', (song) => {
      setCurrentSong(song);
    });

    socket.on('queue-update', (updatedQueue) => {
      setQueue(updatedQueue);
    });

    return () => {
      socket.off('current-song');
      socket.off('queue-update');
    };
  }, []);

  const handleSongEnd = () => {
    socket.emit('play-next');
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
            videoId={currentSong.videoId}
            opts={opts}
            onEnd={handleSongEnd}
            className="youtube-fullscreen"
          />
          <div className="video-info-overlay">
            <div className="video-info-content">
              <h2>{currentSong.title}</h2>
              <p>{currentSong.channelTitle}</p>
              <span className="video-likes">❤️ {currentSong.likes || 0}</span>
            </div>
            {queue.length > 0 && (
              <div className="queue-sidebar">
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
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="waiting-screen">
          <div className="waiting-content">
            <img src="/logogotica.jpg" alt="Ciudad Gótica Licores Bar" className="waiting-logo" />
            <h1>🎵 Rocola Gótica</h1>
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
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoScreen;
