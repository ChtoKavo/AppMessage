import React, { useState, useRef, useEffect } from 'react';

const VoiceMessagePlayer = ({ message, currentUser, API_BASE_URL }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const audioRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      const audioDuration = audio.duration || 0;
      setDuration(audioDuration);
      setAudioLoaded(true);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    const handleLoad = () => {
      const audioDuration = audio.duration || 0;
      setDuration(audioDuration);
      setAudioLoaded(true);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplaythrough', handleLoad);
    audio.addEventListener('load', handleLoad);

    // Используем duration из сообщения как fallback
    if (message.duration && !audioLoaded) {
      setDuration(message.duration);
    }

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplaythrough', handleLoad);
      audio.removeEventListener('load', handleLoad);
    };
  }, [message.duration, audioLoaded]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(error => {
        console.error('Ошибка воспроизведения:', error);
        setIsPlaying(false);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e) => {
    const audio = audioRef.current;
    const progress = progressRef.current;
    if (!audio || !progress) return;

    const rect = progress.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Используем duration из аудио или из сообщения
  const displayDuration = duration > 0 ? duration : (message.duration || 0);
  const progressPercent = displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0;

  return (
    <div className={`voice-message-player ${isPlaying ? 'playing' : ''}`}>
      <audio
        ref={audioRef}
        src={`${API_BASE_URL}${message.attachment_url}`}
        preload="metadata"
        onError={(e) => console.error('Audio loading error:', e)}
      />
      
      <div className="voice-player-container">
        <div className="voice-controls">
          <button 
            className="play-pause-btn"
            onClick={togglePlayPause}
            disabled={!audioLoaded && !message.duration}
            title={isPlaying ? 'Пауза' : 'Воспроизвести'}
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          <div 
            ref={progressRef}
            className="voice-progress"
            onClick={handleProgressClick}
          >
            <div 
              className="progress-bar"
              style={{ width: `${progressPercent}%` }}
            />
            <div className="progress-background"/>
          </div>
        </div>

        <div className="voice-time">
          <span className="current-time">{formatTime(currentTime)}</span>
          <span className="duration-separator">/</span>
          <span className="duration">{formatTime(displayDuration)}</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceMessagePlayer;