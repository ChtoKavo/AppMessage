  import React, { useState, useRef, useEffect } from 'react';
  import './VoiceRecorder.css';


  const VoiceRecorder = ({ chatId, userId, onSendVoice, onClose }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState('');
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const streamRef = useRef(null);

    // Максимальная длительность записи (2 минуты)
    const MAX_RECORDING_TIME = 120;

    useEffect(() => {
      return () => {
        // Очистка при размонтировании
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
      };
    }, [audioUrl]);

    const startRecording = async () => {
      try {
        // Запрашиваем доступ к микрофону
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          } 
        });
        
        streamRef.current = stream;
        audioChunksRef.current = [];
        
        // Создаем MediaRecorder
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        mediaRecorderRef.current = mediaRecorder;

        // Обработчик данных записи
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        // Обработчик завершения записи
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          
          setAudioBlob(audioBlob);
          setAudioUrl(audioUrl);
        };

        // Начинаем запись
        mediaRecorder.start(1000); 
        setIsRecording(true);
        setRecordingTime(0);

        // Запускаем таймер
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => {
            if (prev >= MAX_RECORDING_TIME) {
              stopRecording();
              return MAX_RECORDING_TIME;
            }
            return prev + 1;
          });
        }, 1000);

      } catch (error) {
        console.error('Ошибка доступа к микрофону:', error);
        alert('Не удалось получить доступ к микрофону. Проверьте разрешения браузера.');
      }
    };

    const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }

        // Останавливаем все треки потока
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      }
    };

    const cancelRecording = () => {
      stopRecording();
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl('');
      }
      setRecordingTime(0);
    };


 const sendVoiceMessage = async () => {
  if (!audioBlob || !chatId || !userId) return;

  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-message.webm');
    formData.append('chat_id', chatId);
    formData.append('user_id', userId);
    formData.append('duration', recordingTime);

    const response = await fetch('http://localhost:5001/messages/upload-voice', {
      method: 'POST',
      body: formData,
      credentials: 'include', // важно для CORS с куками
      headers: {
        // Не устанавливайте Content-Type вручную для FormData
        // Браузер установит его автоматически с boundary
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Ошибка сервера: ${response.status}`);
    }

    const result = await response.json();
    
    if (onSendVoice) {
      onSendVoice(result.uploadedMessage);
    }
    
    if (onClose) {
      onClose();
    }

  } catch (error) {
    console.error('Ошибка отправки голосового сообщения:', error);
    alert('Ошибка отправки голосового сообщения: ' + error.message);
  }
};

    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
      <div className="voice-recorder-overlay">
        <div className="voice-recorder-container">
          <div className="voice-recorder-header">
            <h3>Голосовое сообщение</h3>
            <button className="close-button" onClick={onClose}>×</button>
          </div>

          <div className="voice-recorder-body">
            {!audioBlob ? (
              // Режим записи
              <div className="recording-section">
                <div className="recording-visualization">
                  {isRecording && (
                    <div className="sound-waves">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="sound-bar" style={{ animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="recording-time">
                  {formatTime(recordingTime)}
                </div>

                <div className="recording-controls">
                  {!isRecording ? (
                    <button 
                      className="record-button start"
                      onClick={startRecording}
                      type="button"
                    >
                      <span className="record-icon">●</span>
                      Начать запись
                    </button>
                  ) : (
                    <button 
                      className="record-button stop"
                      onClick={stopRecording}
                      type="button"
                    >
                      <span className="stop-icon">■</span>
                      Завершить запись
                    </button>
                  )}
                </div>

                {isRecording && (
                  <div className="recording-hint">
                    Говорите в микрофон... Максимум {MAX_RECORDING_TIME} секунд
                  </div>
                )}
              </div>
            ) : (
              // Режим прослушивания
              <div className="playback-section">
                <audio 
                  controls 
                  src={audioUrl}
                  className="voice-playback"
                />
                
                <div className="playback-controls">
                  <button 
                    className="control-button retry"
                    onClick={cancelRecording}
                    type="button"
                  >
                    Перезаписать
                  </button>
                  <button 
                    className="control-button send"
                    onClick={sendVoiceMessage}
                    type="button"
                  >
                    Отправить
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  export default VoiceRecorder;