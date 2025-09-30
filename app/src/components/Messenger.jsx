import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './Messenger.css';

const Messenger = ({ currentUser }) => {
  const [socket, setSocket] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [userStatuses, setUserStatuses] = useState({});
  const [userAvatars, setUserAvatars] = useState({});
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const API_BASE_URL = 'http://localhost:5001';

  // Инициализация WebSocket
  useEffect(() => {
    const newSocket = io(API_BASE_URL, {
      transports: ['websocket', 'polling']
    });
    
    setSocket(newSocket);

    if (currentUser) {
      newSocket.emit('register_user', currentUser.user_id.toString());
    }

    return () => {
      newSocket.close();
    };
  }, [currentUser]);

  // Обработчики WebSocket событий
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      if (message.chat_id === activeChat?.chat_id) {
        setMessages(prev => [...prev, { 
          ...message, 
          is_own: message.user_id === currentUser.user_id 
        }]);
      }
      loadChats();
    };

    const handleChatCreated = (chat) => {
      setChats(prev => [chat, ...prev]);
      setActiveChat(chat);
      setShowUserSearch(false);
      setSearchQuery('');
      setUsers([]);
      loadMessages(chat.chat_id);
    };

    const handleMessageError = (errorData) => {
      setError(errorData.error);
      setSending(false);
      setUploadingFile(false);
    };

    // Обработчики онлайн статуса
    const handleUserOnline = (userId) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
      setUserStatuses(prev => ({
        ...prev,
        [userId]: { is_online: true, last_seen: new Date().toISOString() }
      }));
    };

    const handleUserOffline = (userId) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      setUserStatuses(prev => ({
        ...prev,
        [userId]: { 
          is_online: false, 
          last_seen: new Date().toISOString() 
        }
      }));
    };

    const handleOnlineUsersList = (userIds) => {
      setOnlineUsers(new Set(userIds));
    };

    const handleUserStatusUpdate = (statuses) => {
      const newStatuses = {};
      statuses.forEach(status => {
        newStatuses[status.user_id] = status;
      });
      setUserStatuses(prev => ({ ...prev, ...newStatuses }));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('chat_created', handleChatCreated);
    socket.on('message_error', handleMessageError);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);
    socket.on('online_users_list', handleOnlineUsersList);
    socket.on('user_status_update', handleUserStatusUpdate);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('chat_created', handleChatCreated);
      socket.off('message_error', handleMessageError);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
      socket.off('online_users_list', handleOnlineUsersList);
      socket.off('user_status_update', handleUserStatusUpdate);
    };
  }, [socket, activeChat, currentUser]);

  // Загрузка чатов при изменении пользователя
  useEffect(() => {
    if (currentUser) {
      loadChats();
    }
  }, [currentUser]);

  // Автопрокрутка к новым сообщениям
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/chats/${currentUser.user_id}`);
      if (!response.ok) throw new Error('Ошибка загрузки чатов');
      const data = await response.json();
      setChats(data);
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
      setError('Ошибка загрузки чатов');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chatId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/messages/${chatId}?userId=${currentUser.user_id}`);
      if (!response.ok) throw new Error('Ошибка загрузки сообщений');
      const data = await response.json();
      
      const messagesWithOwnFlag = data.map(msg => ({
        ...msg,
        is_own: msg.user_id === currentUser.user_id
      }));
      
      setMessages(messagesWithOwnFlag);
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
      setError('Ошибка загрузки сообщений');
    } finally {
      setLoading(false);
    }
  };

  // Функция для отправки файла
  // Замените существующую функцию sendFile на эту:
const sendFile = async (file) => {
  if (!activeChat || !socket || uploadingFile) return;

  try {
    setUploadingFile(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chat_id', activeChat.chat_id);
    formData.append('user_id', currentUser.user_id.toString());

    // Определяем тип сообщения
    const fileType = file.type.startsWith('image/') ? 'image' : 
                    file.type.startsWith('video/') ? 'video' : 'file';

    // Оптимистичное обновление UI
    const tempMessage = {
      message_id: Date.now(),
      chat_id: activeChat.chat_id,
      user_id: currentUser.user_id,
      content: file.name,
      message_type: fileType,
      attachment_url: URL.createObjectURL(file),
      user_name: currentUser.name,
      user_email: currentUser.email,
      created_at: new Date().toISOString(),
      is_own: true,
      is_sending: true
    };

    setMessages(prev => [...prev, tempMessage]);

    // Отправка файла на сервер
    const response = await fetch(`${API_BASE_URL}/messages/upload`, {
      method: 'POST',
      body: formData
      // Не устанавливаем Content-Type - браузер сделает это сам с boundary
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Ошибка загрузки файла: ${response.status}`);
    }

    const result = await response.json();
    console.log('File upload response:', result);

    // Удаляем временное сообщение
    setMessages(prev => prev.filter(msg => !msg.is_sending));

    // Очистка превью
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

  } catch (error) {
    console.error('Ошибка отправки файла:', error);
    setError('Ошибка отправки файла: ' + error.message);
    // Удаляем временное сообщение при ошибке
    setMessages(prev => prev.filter(msg => !msg.is_sending));
  } finally {
    setUploadingFile(false);
  }
};
  // Обработчик выбора файла
  // Замените существующий обработчик handleFileSelect:
const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Проверка размера файла (50MB)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    setError(`Файл слишком большой (максимум ${maxSize / 1024 / 1024}MB)`);
    event.target.value = ''; // Очищаем input
    return;
  }

  // Проверка типа файла
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/mpeg',
    'video/ogg',
    'video/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (!allowedTypes.includes(file.type)) {
    setError('Неподдерживаемый тип файла');
    event.target.value = ''; // Очищаем input
    return;
  }

  setSelectedFile(file);
  setError(''); // Очищаем предыдущие ошибки

  // Создание превью
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => setFilePreview(e.target.result);
    reader.readAsDataURL(file);
  } else if (file.type.startsWith('video/')) {
    const videoUrl = URL.createObjectURL(file);
    setFilePreview(videoUrl);
  } else {
    setFilePreview(null);
  }
};

  // Отправка текстового сообщения
  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !activeChat || !socket || sending) return;

    const messageData = {
      chat_id: activeChat.chat_id,
      user_id: currentUser.user_id,
      content: newMessage.trim(),
      message_type: 'text'
    };

    try {
      setSending(true);
      
      const tempMessage = {
        message_id: Date.now(),
        chat_id: activeChat.chat_id,
        user_id: currentUser.user_id,
        content: newMessage.trim(),
        message_type: 'text',
        user_name: currentUser.name,
        user_email: currentUser.email,
        created_at: new Date().toISOString(),
        is_own: true,
        is_sending: true
      };

      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }

      socket.emit('send_message', messageData);
      
    } catch (error) {
      console.error('Ошибка отправки:', error);
      setError('Ошибка отправки сообщения');
      setMessages(prev => prev.filter(msg => !msg.is_sending));
    } finally {
      setSending(false);
    }
  };

  // Отправка файла при подтверждении
  const confirmFileSend = () => {
    if (selectedFile) {
      sendFile(selectedFile);
    }
  };

  // Отмена отправки файла
  const cancelFileSend = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short'
      });
    }
  };

  const getOtherParticipants = (chat) => {
    return chat.participant_names?.split(',')
      .filter(name => name.trim() !== currentUser.name)
      .join(', ') || 'Пользователь';
  };

  // Рендер содержимого сообщения
  const renderMessageContent = (message) => {
    switch (message.message_type) {
      case 'image':
        return (
          <div className="message-media">
            <img 
              src={`${API_BASE_URL}${message.attachment_url}`} 
              alt="Изображение"
              className="message-image"
              onClick={() => window.open(`${API_BASE_URL}${message.attachment_url}`, '_blank')}
            />
          </div>
        );
      
      case 'video':
        return (
          <div className="message-media">
            <video 
              controls 
              className="message-video"
              poster={message.video_thumbnail ? `${API_BASE_URL}${message.video_thumbnail}` : undefined}
            >
              <source src={`${API_BASE_URL}${message.attachment_url}`} type="video/mp4" />
              Ваш браузер не поддерживает видео.
            </video>
          </div>
        );
      
      case 'file':
        return (
          <div className="message-file">
            <div className="file-icon">📎</div>
            <div className="file-info">
              <a 
                href={`${API_BASE_URL}${message.attachment_url}`} 
                download
                className="file-link"
              >
                {message.content || 'Файл'}
              </a>
            </div>
          </div>
        );
      
      default:
        return <div className="message-text">{message.content}</div>;
    }
  };

  // Группировка сообщений по дате
  const groupMessagesByDate = (messages) => {
    const groups = [];
    let currentDate = null;

    messages.forEach(message => {
      const messageDate = new Date(message.created_at).toDateString();
      
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({
          type: 'date',
          date: message.created_at,
          id: `date-${messageDate}`
        });
      }
      
      groups.push({
        type: 'message',
        ...message
      });
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  if (!currentUser) {
    return (
      <div className="messenger">
        <div className="auth-warning">
          <h3>Войдите в систему для использования мессенджера</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="messenger">
      <div className="chat-sidebar">
        {/* Боковая панель чатов (остается без изменений) */}
        <div className="sidebar-header">
          <div className="current-user-info">
            <div className="avatar small">
              <div className="avatar-fallback">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
            </div>
            <span className="current-user-name">{currentUser.name}</span>
          </div>
          <button 
            className="new-chat-btn"
            onClick={() => setShowUserSearch(true)}
            title="Новый чат"
          >
            <span>+</span>
          </button>
        </div>

        {showUserSearch && (
          <div className="user-search">
            <div className="search-header">
              <h4>Новый чат</h4>
              <button 
                className="close-search"
                onClick={() => {
                  setShowUserSearch(false);
                  setSearchQuery('');
                  setUsers([]);
                }}
              >
                ×
              </button>
            </div>
            <input
              type="text"
              placeholder="Поиск пользователей..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                // searchUsers(e.target.value);
              }}
              className="search-input"
              autoFocus
            />
          </div>
        )}

        <div className="chat-list">
          {loading && chats.length === 0 ? (
            <div className="loading">Загрузка чатов...</div>
          ) : chats.length === 0 ? (
            <div className="no-chats">
              <p>У вас пока нет чатов</p>
              <button 
                onClick={() => setShowUserSearch(true)}
                className="start-chat-btn"
              >
                Начать общение
              </button>
            </div>
          ) : (
            chats.map(chat => (
              <div 
                key={chat.chat_id}
                className={`chat-item ${activeChat?.chat_id === chat.chat_id ? 'active' : ''}`}
                onClick={() => {
                  setActiveChat(chat);
                  loadMessages(chat.chat_id);
                }}
              >
                <div className="chat-info">
                  <div className="chat-name">
                    {getOtherParticipants(chat)}
                  </div>
                  <div className="last-message">
                    {chat.last_message ? 
                      (chat.last_message.length > 30 
                        ? chat.last_message.substring(0, 30) + '...' 
                        : chat.last_message)
                      : 'Нет сообщений'
                    }
                  </div>
                </div>
                {chat.last_message_time && (
                  <div className="chat-time">
                    {formatDate(chat.last_message_time)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="chat-main">
        {activeChat ? (
          <>
            <div className="chat-header">
              <div className="chat-header-info">
                <div>
                  <h3>{getOtherParticipants(activeChat)}</h3>
                  <span className="online-status">online</span>
                </div>
              </div>
            </div>

            <div className="messages-container">
              {loading && messages.length === 0 ? (
                <div className="loading">Загрузка сообщений...</div>
              ) : messages.length === 0 ? (
                <div className="no-messages">
                  <p>Нет сообщений</p>
                  <span>Начните общение первым!</span>
                </div>
              ) : (
                <div className="messages-list">
                  {messageGroups.map(item => {
                    if (item.type === 'date') {
                      return (
                        <div key={item.id} className="date-divider">
                          <span>{formatDate(item.date)}</span>
                        </div>
                      );
                    }
                    
                    return (
                      <div 
                        key={item.message_id}
                        className={`message ${item.is_own ? 'own' : 'other'} ${item.is_sending ? 'sending' : ''}`}
                      >
                        <div className="message-content">
                          {!item.is_own && (
                            <div className="message-sender">
                              {item.user_name}
                            </div>
                          )}
                          {renderMessageContent(item)}
                          <div className="message-time">
                            {formatTime(item.created_at)}
                            {item.is_sending && <span className="sending-indicator">...</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Форма ввода сообщения с возможностью отправки файлов */}
            <form className="message-input-form" onSubmit={sendMessage}>
  {selectedFile && (
    <div className="file-preview">
      <div className="file-preview-content">
        {filePreview ? (
          filePreview.startsWith('data:image') ? (
            <img src={filePreview} alt="Preview" className="file-preview-image" />
          ) : filePreview.startsWith('blob:') ? (
            <video src={filePreview} className="file-preview-video" controls />
          ) : null
        ) : (
          <div className="file-preview-icon">📎</div>
        )}
        <div className="file-preview-info">
          <div className="file-name">{selectedFile.name}</div>
          <div className="file-size">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
      </div>
      <div className="file-preview-actions">
        <button 
          type="button" 
          onClick={confirmFileSend}
          disabled={uploadingFile}
          className="send-file-btn"
        >
          {uploadingFile ? 'Отправка...' : 'Отправить'}
        </button>
        <button 
          type="button" 
          onClick={cancelFileSend}
          disabled={uploadingFile}
          className="cancel-file-btn"
        >
          Отмена
        </button>
      </div>
    </div>
  )}

  <div className="input-container">
    <input
      type="file"
      ref={fileInputRef}
      onChange={handleFileSelect}
      accept="image/*,video/*,.pdf,.doc,.docx,.txt"
      style={{ display: 'none' }}
    />
    
    <button 
      type="button"
      className="attach-file-btn"
      onClick={() => fileInputRef.current?.click()}
      title="Прикрепить файл"
      disabled={uploadingFile || sending || selectedFile}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
      </svg>
    </button>

    <input
      ref={messageInputRef}
      type="text"
      value={newMessage}
      onChange={(e) => setNewMessage(e.target.value)}
      onKeyPress={handleKeyPress}
      placeholder="Введите сообщение..."
      className="message-input"
      disabled={sending || uploadingFile || selectedFile}
    />

    <button 
      type="submit" 
      className={`send-button ${sending ? 'sending' : ''}`}
      disabled={(!newMessage.trim() && !selectedFile) || sending || uploadingFile}
      title="Отправить сообщение"
    >
      {sending ? (
        <div className="spinner"></div>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      )}
    </button>
  </div>
</form>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="welcome-message">
              <h3>Добро пожаловать в мессенджер!</h3>
              <p>Выберите чат для начала общения или создайте новый</p>
              <button 
                onClick={() => setShowUserSearch(true)}
                className="start-chat-btn large"
              >
                Начать новый чат
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}
    </div>
  );
};

export default Messenger;