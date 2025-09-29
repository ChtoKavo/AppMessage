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
  
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);

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
        setMessages(prev => [...prev, { ...message, is_own: message.user_id === currentUser.user_id }]);
      }
      // Обновляем список чатов при новом сообщении
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
    };

    socket.on('new_message', handleNewMessage);
    socket.on('chat_created', handleChatCreated);
    socket.on('message_error', handleMessageError);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('chat_created', handleChatCreated);
      socket.off('message_error', handleMessageError);
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
      const response = await fetch(`${API_BASE_URL}/messages/${chatId}`);
      if (!response.ok) throw new Error('Ошибка загрузки сообщений');
      const data = await response.json();
      
      // Добавляем флаг is_own для каждого сообщения
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
      const response = await fetch(`${API_BASE_URL}/users/search/${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Ошибка поиска');
      const data = await response.json();
      setUsers(data.filter(user => user.user_id !== currentUser.user_id));
    } catch (error) {
      console.error('Ошибка поиска пользователей:', error);
      setError('Ошибка поиска пользователей');
    }
  };

  const createChat = async (participantId) => {
    if (!socket) {
      setError('Нет соединения с сервером');
      return;
    }
    
    try {
      // Проверяем, существует ли уже чат с этим пользователем
      const checkResponse = await fetch(
        `${API_BASE_URL}/chats/check/${currentUser.user_id}/${participantId}`
      );
      const { exists, chat_id } = await checkResponse.json();
      
      if (exists) {
        // Если чат существует, переключаемся на него
        const existingChat = chats.find(chat => chat.chat_id === chat_id);
        if (existingChat) {
          setActiveChat(existingChat);
          loadMessages(chat_id);
        }
        setShowUserSearch(false);
        return;
      }
      
      // Создаем новый чат
      socket.emit('create_chat', {
        user_id: currentUser.user_id,
        participant_id: participantId,
        chat_type: 'private'
      });
    } catch (error) {
      console.error('Ошибка создания чата:', error);
      setError('Ошибка создания чата');
    }
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
      
      // Оптимистичное обновление UI
      const tempMessage = {
        message_id: Date.now(), // Временный ID
        chat_id: activeChat.chat_id,
        user_id: currentUser.user_id,
        content: newMessage.trim(),
        message_type: 'text',
        user_name: currentUser.name,
        user_email: currentUser.email,
        created_at: new Date().toISOString(),
        is_own: true,
        is_sending: true // Флаг что сообщение отправляется
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
          <h3>Мои чаты</h3>
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
              {users.map(user => (
                <div 
                  key={user.user_id} 
                  className="search-result-item"
                  onClick={() => createChat(user.user_id)}
                >
                  <div className="user-avatar">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-info">
                    <div className="user-name">{user.name}</div>
                    <div className="user-email">{user.email}</div>
                  </div>
                </div>
              ))}
              {users.length === 0 && searchQuery && (
                <div className="no-results">Пользователи не найдены</div>
              )}
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
                  {getOtherParticipants(chat)
                    .split(',')
                    .map(name => name.trim().charAt(0))
                    .join('')
                    .toUpperCase()}
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
                <div className="active-chat-avatar">
                  {getOtherParticipants(activeChat)
                    .split(',')
                    .map(name => name.trim().charAt(0))
                    .join('')
                    .toUpperCase()}
                </div>
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
                          <div className="message-text">{item.content}</div>
                          <div className="message-time">
                            {formatTime(item.created_at)}
                            {item.is_sending && <span className="sending-indicator">...</span>}
                          </div>
                        </div>
                        {!item.is_own && (
                          <div className="message-sender">
                            {item.user_name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <form className="message-input-form" onSubmit={sendMessage}>
              <input
                ref={messageInputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Введите сообщение..."
                className="message-input"
                disabled={sending}
                maxLength={1000}
              />
              <button 
                type="submit" 
                className={`send-button ${sending ? 'sending' : ''}`}
                disabled={!newMessage.trim() || sending}
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