import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import './Messenger.css';
import VoiceRecorder from './VoiceRecorder';

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
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  
  // Новые состояния для управления сообщениями
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const API_BASE_URL = 'http://localhost:5001';

  // Инициализация WebSocket соединения
  useEffect(() => {
    if (!currentUser) return;

    const newSocket = io(API_BASE_URL, {
      transports: ['websocket', 'polling']
    });
    
    setSocket(newSocket);
    newSocket.emit('register_user', currentUser.user_id.toString());

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

    const handleUserOnline = (userId) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
    };

    const handleUserOffline = (userId) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };

    const handleOnlineUsersList = (userIds) => {
      setOnlineUsers(new Set(userIds));
    };

    const handleMessageUpdated = (updatedMessage) => {
      if (updatedMessage.chat_id === activeChat?.chat_id) {
        setMessages(prev => prev.map(msg => 
          msg.message_id === updatedMessage.message_id 
            ? { ...updatedMessage, is_own: updatedMessage.user_id === currentUser.user_id }
            : msg
        ));
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('chat_created', handleChatCreated);
    socket.on('message_error', handleMessageError);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);
    socket.on('online_users_list', handleOnlineUsersList);
    socket.on('message_updated', handleMessageUpdated);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('chat_created', handleChatCreated);
      socket.off('message_error', handleMessageError);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
      socket.off('online_users_list', handleOnlineUsersList);
      socket.off('message_updated', handleMessageUpdated);
    };
  }, [socket, activeChat, currentUser]);

  // Загрузка чатов
  useEffect(() => {
    if (currentUser) {
      loadChats();
    }
  }, [currentUser]);

  // Автопрокрутка к новым сообщениям
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Закрытие контекстного меню при клике вне его
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/users/search/${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Ошибка поиска пользователей');
      const data = await response.json();
      
      const filteredUsers = data.filter(user => user.user_id !== currentUser.user_id);
      setUsers(filteredUsers);
    } catch (error) {
      console.error('Ошибка поиска пользователей:', error);
      setError('Ошибка поиска пользователей');
    } finally {
      setLoading(false);
    }
  };

  const createChat = async (participantId) => {
    try {
      setLoading(true);
      
      const checkResponse = await fetch(
        `${API_BASE_URL}/chats/check/${currentUser.user_id}/${participantId}`
      );
      
      if (!checkResponse.ok) throw new Error('Ошибка проверки чата');
      
      const checkData = await checkResponse.json();
      
      if (checkData.exists) {
        setActiveChat({ chat_id: checkData.chat_id });
        loadMessages(checkData.chat_id);
        setShowUserSearch(false);
        setSearchQuery('');
        setUsers([]);
      } else {
        socket.emit('create_chat', {
          user_id: currentUser.user_id,
          participant_id: participantId,
          chat_type: 'private'
        });
      }
    } catch (error) {
      console.error('Ошибка создания чата:', error);
      setError('Ошибка создания чата');
      setLoading(false);
    }
  };

  // Функция для показа контекстного меню с улучшенным позиционированием
  const handleContextMenu = (e, message) => {
    e.preventDefault();
    
    // Показываем меню только для своих сообщений
    if (message.is_own && message.message_type === 'text') {
      const menuWidth = 160; // Примерная ширина меню
      const menuHeight = 80; // Примерная высота меню
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let x = e.clientX;
      let y = e.clientY;
      
      // Корректируем позицию по X (чтобы меню не выходило за правый край)
      if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10;
      }
      
      // Корректируем позицию по Y (чтобы меню не выходило за нижний край)
      if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10;
      }
      
      // Сдвигаем меню левее курсора для лучшей видимости
      x = Math.max(10, x - menuWidth / 2);
      
      setContextMenu({
        x: x,
        y: y,
        message: message
      });
    }
  };

  // Закрытие контекстного меню
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Удаление сообщения
  const deleteMessage = async (message) => {
    try {
      // Проверяем, что это реальное сообщение из базы данных, а не временное
      if (message.is_sending || typeof message.message_id !== 'number' || message.message_id > 2000000000) {
        console.log('Нельзя удалить временное сообщение или сообщение с неверным ID');
        setError('Нельзя удалить отправляемое сообщение');
        closeContextMenu();
        return;
      }

      const response = await fetch(`${API_BASE_URL}/messages/${message.message_id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: currentUser.user_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка удаления сообщения');
      }

      // Удаляем сообщение из локального состояния
      setMessages(prev => prev.filter(msg => msg.message_id !== message.message_id));
      
    } catch (error) {
      console.error('Ошибка удаления сообщения:', error);
      setError('Ошибка удаления сообщения: ' + error.message);
    } finally {
      closeContextMenu();
    }
  };

  // Начало редактирования сообщения
  const startEditing = (message) => {
    setEditingMessage(message);
    setEditText(message.content);
    closeContextMenu();
  };

  // Отмена редактирования
  const cancelEditing = () => {
    setEditingMessage(null);
    setEditText('');
  };

  // Сохранение отредактированного сообщения
  const saveEditedMessage = async () => {
    if (!editText.trim() || !editingMessage) return;

    // Проверяем, что это реальное сообщение из базы данных
    if (editingMessage.is_sending || typeof editingMessage.message_id !== 'number' || editingMessage.message_id > 2000000000) {
      console.log('Нельзя редактировать временное сообщение');
      setError('Нельзя редактировать отправляемое сообщение');
      cancelEditing();
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/messages/${editingMessage.message_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editText.trim(),
          user_id: currentUser.user_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка редактирования сообщения');
      }

      const updatedMessage = await response.json();

      // Обновляем сообщение в локальном состоянии
      setMessages(prev => prev.map(msg => 
        msg.message_id === editingMessage.message_id 
          ? { ...msg, content: updatedMessage.content, is_edited: true }
          : msg
      ));

      cancelEditing();
      
    } catch (error) {
      console.error('Ошибка редактирования сообщения:', error);
      setError('Ошибка редактирования сообщения: ' + error.message);
    }
  };

  // Обработчик клавиш при редактировании
  const handleEditKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEditedMessage();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const sendFile = async (file) => {
    if (!activeChat || !socket || uploadingFile) return;

    try {
      setUploadingFile(true);
      setError('');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chat_id', activeChat.chat_id);
      formData.append('user_id', currentUser.user_id.toString());

      const fileType = file.type.startsWith('image/') ? 'image' : 
                      file.type.startsWith('video/') ? 'video' : 'file';
      
      const fileContent = getFileTypeText(file.type, file.name);

      // Временное сообщение
      const tempMessage = {
        message_id: Date.now(),
        chat_id: activeChat.chat_id,
        user_id: currentUser.user_id,
        content: fileContent,
        message_type: fileType,
        attachment_url: URL.createObjectURL(file),
        original_filename: file.name,
        file_size: file.size,
        file_type: file.type,
        user_name: currentUser.name,
        user_email: currentUser.email,
        created_at: new Date().toISOString(),
        is_own: true,
        is_sending: true
      };

      setMessages(prev => [...prev, tempMessage]);

      const response = await fetch(`${API_BASE_URL}/messages/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Ошибка загрузки файла: ${response.status}`);
      }

      setMessages(prev => prev.filter(msg => !msg.is_sending));
      setSelectedFile(null);
      setFilePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Ошибка отправки файла:', error);
      setError('Ошибка отправки файла: ' + error.message);
      setMessages(prev => prev.filter(msg => !msg.is_sending));
      setTimeout(() => setError(''), 5000);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`Файл слишком большой (максимум ${maxSize / 1024 / 1024}MB)`);
      event.target.value = '';
      return;
    }

    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip', 'application/x-rar-compressed',
      'text/plain', 'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Неподдерживаемый тип файла');
      event.target.value = '';
      return;
    }

    setSelectedFile(file);
    setError('');

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

  const getFileIcon = (fileType, fileName = '') => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('video/')) return '🎬';
    if (fileType === 'application/pdf') return '📕';
    if (fileType.includes('word') || fileName.toLowerCase().endsWith('.doc') || fileName.toLowerCase().endsWith('.docx')) return '📄';
    if (fileType.includes('excel') || fileName.toLowerCase().endsWith('.xls') || fileName.toLowerCase().endsWith('.xlsx')) return '📊';
    if (fileType.includes('powerpoint') || fileName.toLowerCase().endsWith('.ppt') || fileName.toLowerCase().endsWith('.pptx')) return '📽️';
    if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
    if (fileType.includes('text') || fileName.toLowerCase().endsWith('.txt')) return '📝';
    if (fileType.includes('csv')) return '📋';
    return '📎';
  };

  const getFileTypeText = (fileType, fileName = '') => {
    if (fileType.startsWith('image/')) return 'Изображение';
    if (fileType.startsWith('video/')) return 'Видео';
    if (fileType === 'application/pdf') return 'PDF документ';
    
    const ext = fileName.split('.').pop()?.toLowerCase();
    const extensionMap = {
      'doc': 'Документ Word', 'docx': 'Документ Word',
      'xls': 'Таблица Excel', 'xlsx': 'Таблица Excel',
      'ppt': 'Презентация', 'pptx': 'Презентация',
      'zip': 'Архив', 'rar': 'Архив',
      'txt': 'Текстовый файл', 'csv': 'CSV файл'
    };
    
    return extensionMap[ext] || 'Файл';
  };

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
      setError('');
      
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

      socket.emit('send_message', messageData, (response) => {
        if (response && response.error) {
          setError('Ошибка отправки: ' + response.error);
          setMessages(prev => prev.filter(msg => !msg.is_sending));
        }
      });
      
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => !msg.is_sending || msg.message_id !== tempMessage.message_id));
      }, 5000);
      
    } catch (error) {
      console.error('Ошибка отправки:', error);
      setError('Ошибка отправки сообщения');
      setMessages(prev => prev.filter(msg => !msg.is_sending));
    } finally {
      setSending(false);
    }
  };

  const confirmFileSend = () => {
    if (selectedFile) {
      sendFile(selectedFile);
    }
  };

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

  const VoiceMessagePlayer = ({ message, currentUser, API_BASE_URL }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef(null);
    const progressRef = useRef(null);

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const updateTime = () => setCurrentTime(audio.currentTime);
      const updateDuration = () => setDuration(audio.duration || 0);
      const handleEnded = () => setIsPlaying(false);
      const handleLoad = () => setDuration(audio.duration || 0);

      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('loadedmetadata', updateDuration);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('canplaythrough', handleLoad);

      return () => {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', updateDuration);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('canplaythrough', handleLoad);
      };
    }, []);

    const togglePlayPause = () => {
      const audio = audioRef.current;
      if (!audio) return;

      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    };

    const handleProgressClick = (e) => {
      const audio = audioRef.current;
      const progress = progressRef.current;
      if (!audio || !progress) return;

      const rect = progress.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audio.currentTime = percent * duration;
    };

    const formatTime = (seconds) => {
      if (!seconds || isNaN(seconds)) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progressPercent = duration ? (currentTime / duration) * 100 : 0;

    return (
      <div className={`voice-message-player ${isPlaying ? 'playing' : ''}`}>
        <audio
          ref={audioRef}
          src={`${API_BASE_URL}${message.attachment_url}`}
          preload="metadata"
        />
        
        <div className="voice-player-container">
          <div className="voice-controls">
            <button 
              className="play-pause-btn"
              onClick={togglePlayPause}
              title={isPlaying ? 'Пауза' : 'Воспроизвести'}
            >
              {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"/>
                  <rect x="14" y="4" width="4" height="16"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
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
            </div>
          </div>

          <div className="voice-time">
            <span className="current-time">{formatTime(currentTime)}</span>
            <span className="duration">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderMessageContent = (message) => {
    switch (message.message_type) {
      case 'voice':
        return (
          <VoiceMessagePlayer 
            message={message}
            currentUser={currentUser}
            API_BASE_URL={API_BASE_URL}
          />
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
      case 'image':
        const fileName = message.original_filename || message.content;
        const fileIcon = getFileIcon(message.file_type || '', fileName);
        const fileTypeText = getFileTypeText(message.file_type || '', fileName);
        
        if (message.message_type === 'image') {
          return (
            <div className="message-media">
              <img 
                src={`${API_BASE_URL}${message.attachment_url}`} 
                alt={fileName}
                className="message-image"
                onClick={() => window.open(`${API_BASE_URL}${message.attachment_url}`, '_blank')}
              />
            </div>
          );
        }
        
        return (
          <div className="message-file">
            <div className="file-icon" title={fileTypeText}>
              {fileIcon}
            </div>
            <div className="file-info">
              <div className="file-name">{fileName}</div>
              <div className="file-type">{fileTypeText}</div>
              {message.file_size && (
                <div className="file-size">
                  {(message.file_size / 1024 / 1024).toFixed(2)} MB
                </div>
              )}
            </div>
            <a 
              href={`${API_BASE_URL}${message.attachment_url}`} 
              download={fileName}
              className="file-download-btn"
              title="Скачать файл"
            >
              ⬇️
            </a>
          </div>
        );
      
      default:
        return <div className="message-text">{message.content}</div>;
    }
  };

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
                searchUsers(e.target.value);
              }}
              className="search-input"
              autoFocus
            />
            
            <div className="search-results">
              {loading ? (
                <div className="loading">Поиск...</div>
              ) : users.length > 0 ? (
                users.map(user => (
                  <div 
                    key={user.user_id}
                    className="user-result"
                    onClick={() => createChat(user.user_id)}
                  >
                    <div className="user-avatar">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{user.name}</div>
                      <div className="user-email">{user.email}</div>
                    </div>
                    <div className="user-status">
                      {onlineUsers.has(user.user_id) ? (
                        <span className="online">online</span>
                      ) : (
                        <span className="offline">offline</span>
                      )}
                    </div>
                  </div>
                ))
              ) : searchQuery.trim() ? (
                <div className="no-results">Пользователи не найдены</div>
              ) : null}
            </div>
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
                <div className="chat-avatar">
                  {getOtherParticipants(chat).split(',')[0].charAt(0).toUpperCase()}
                </div>
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
                <div className="chat-avatar">
                  {getOtherParticipants(activeChat).split(',')[0].charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3>{getOtherParticipants(activeChat)}</h3>
                  <span className="online-status">
                    {onlineUsers.has(activeChat.participant_id) ? 'online' : 'offline'}
                  </span>
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
                        onContextMenu={(e) => handleContextMenu(e, item)}
                      >
                        {!item.is_own && (
                          <div className="message-avatar">
                            {item.user_name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="message-content">
                          {!item.is_own && (
                            <div className="message-sender">
                              {item.user_name}
                            </div>
                          )}
                          
                          {/* Блок редактирования */}
                          {editingMessage?.message_id === item.message_id ? (
                            <div className="message-edit">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={handleEditKeyPress}
                                className="edit-textarea"
                                autoFocus
                                rows={Math.min(5, Math.max(1, editText.split('\n').length))}
                              />
                              <div className="edit-actions">
                                <button onClick={saveEditedMessage} className="save-edit-btn">
                                  Сохранить
                                </button>
                                <button onClick={cancelEditing} className="cancel-edit-btn">
                                  Отмена
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {renderMessageContent(item)}
                              <div className="message-time">
                                {formatTime(item.created_at)}
                                {item.is_edited && <span className="edited-indicator"> (изменено)</span>}
                                {item.is_sending && <span className="sending-indicator">...</span>}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

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
                      <div className="file-preview-icon">
                        {getFileIcon(selectedFile.type, selectedFile.name)}
                      </div>
                    )}
                    <div className="file-preview-info">
                      <div className="file-name">{selectedFile.name}</div>
                      <div className="file-type">{getFileTypeText(selectedFile.type, selectedFile.name)}</div>
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
                  accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar"
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

                <button 
                  type="button"
                  className="voice-message-btn"
                  onClick={() => setShowVoiceRecorder(true)}
                  title="Голосовое сообщение"
                  disabled={uploadingFile || sending || selectedFile}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
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

      {/* Контекстное меню для сообщений */}
      {contextMenu && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000
          }}
          onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие при клике на меню
        >
          <div className="context-menu-item" onClick={() => startEditing(contextMenu.message)}>
            ✏️ Редактировать
          </div>
          <div className="context-menu-item delete" onClick={() => deleteMessage(contextMenu.message)}>
            🗑️ Удалить
          </div>
        </div>
      )}

      {showVoiceRecorder && (
        <VoiceRecorder
          chatId={activeChat?.chat_id}
          userId={currentUser.user_id}
          onSendVoice={(message) => {
            setMessages(prev => [...prev, { 
              ...message, 
              is_own: true 
            }]);
            setShowVoiceRecorder(false);
          }}
          onClose={() => setShowVoiceRecorder(false)}
        />
      )}

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