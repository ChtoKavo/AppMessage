// components/Friends.jsx
import React, { useState, useEffect } from 'react';
import './Friends.css';

const Friends = ({ currentUser, socket }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsFilter, setFriendsFilter] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const API_BASE_URL = 'http://localhost:5001';

  // Вспомогательные функции должны быть объявлены до их использования
  const getOnlineFriends = () => {
    return friends.filter(friend => friend.is_online);
  };

  const getOfflineFriends = () => {
    return friends.filter(friend => !friend.is_online);
  };

  useEffect(() => {
    if (currentUser) {
      loadFriends();
      loadFriendRequests();
    }
  }, [currentUser]);

  useEffect(() => {
    if (socket) {
      console.log('Socket connected in Friends component:', socket.connected);
      setSocketConnected(socket.connected);

      // Слушаем события WebSocket
      socket.on('connect', () => {
        console.log('Socket connected in Friends');
        setSocketConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected in Friends');
        setSocketConnected(false);
      });

      socket.on('new_friend_request', handleNewFriendRequest);
      socket.on('friend_request_accepted', handleFriendRequestAccepted);
      socket.on('friend_request_sent', handleFriendRequestSent);
      socket.on('friend_request_responded', handleFriendRequestResponded);
      socket.on('friend_request_error', handleFriendRequestError);
      
      return () => {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('new_friend_request', handleNewFriendRequest);
        socket.off('friend_request_accepted', handleFriendRequestAccepted);
        socket.off('friend_request_sent', handleFriendRequestSent);
        socket.off('friend_request_responded', handleFriendRequestResponded);
        socket.off('friend_request_error', handleFriendRequestError);
      };
    }
  }, [socket]);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/users/${currentUser.user_id}/friends`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setFriends(data);
    } catch (error) {
      console.error('Ошибка загрузки друзей:', error);
      alert('Ошибка загрузки списка друзей');
    } finally {
      setLoading(false);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/users/${currentUser.user_id}/friend-requests`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setFriendRequests(data);
    } catch (error) {
      console.error('Ошибка загрузки запросов:', error);
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/users/search/${encodeURIComponent(query)}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const users = await response.json();
      
      // Исключаем текущего пользователя и уже добавленных друзей
      const filteredUsers = users.filter(user => 
        user.user_id !== currentUser.user_id &&
        !friends.some(friend => friend.user_id === user.user_id)
      );
      
      setSearchResults(filteredUsers);
    } catch (error) {
      console.error('Ошибка поиска:', error);
    }
  };

  const sendFriendRequest = async (toUserId) => {
    console.log('Sending friend request to:', toUserId);
    console.log('Socket connected:', socketConnected);
    console.log('Socket object:', socket);

    if (!socket || !socketConnected) {
      console.error('WebSocket не подключен');
      
      // Альтернативный способ через REST API
      try {
        const response = await fetch(`${API_BASE_URL}/api/friends/request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from_user_id: currentUser.user_id,
            to_user_id: toUserId
          })
        });

        if (response.ok) {
          // Убираем пользователя из результатов поиска
          setSearchResults(prev => prev.filter(user => user.user_id !== toUserId));
          alert('Запрос дружбы отправлен!');
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Ошибка отправки запроса');
        }
      } catch (error) {
        console.error('Ошибка отправки запроса через REST:', error);
        alert(`Ошибка отправки запроса: ${error.message}`);
      }
      return;
    }

    try {
      socket.emit('friend_request', {
        from_user_id: currentUser.user_id,
        to_user_id: toUserId
      });

      // Убираем пользователя из результатов поиска
      setSearchResults(prev => prev.filter(user => user.user_id !== toUserId));
      
      // Сообщение об успехе покажем через socket событие
    } catch (error) {
      console.error('Ошибка отправки запроса через WebSocket:', error);
      alert('Ошибка отправки запроса через WebSocket');
    }
  };

  const respondToFriendRequest = async (friendshipId, response) => {
    console.log('Responding to friend request:', friendshipId, response);

    if (!socket || !socketConnected) {
      // Альтернативный способ через REST API
      try {
        const apiResponse = await fetch(`${API_BASE_URL}/api/friends/respond`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            friendship_id: friendshipId,
            response: response,
            user_id: currentUser.user_id
          })
        });

        if (apiResponse.ok) {
          // Убираем запрос из списка
          setFriendRequests(prev => prev.filter(req => req.friendship_id !== friendshipId));
          
          if (response === 'accepted') {
            // Перезагружаем список друзей
            await loadFriends();
          }
          alert(`Запрос дружбы ${response === 'accepted' ? 'принят' : 'отклонен'}`);
        } else {
          const errorData = await apiResponse.json();
          throw new Error(errorData.error || 'Ошибка обработки запроса');
        }
      } catch (error) {
        console.error('Ошибка обработки запроса через REST:', error);
        alert(`Ошибка обработки запроса: ${error.message}`);
      }
      return;
    }

    try {
      socket.emit('respond_friend_request', {
        friendship_id: friendshipId,
        response: response,
        user_id: currentUser.user_id
      });

      // Убираем запрос из списка
      setFriendRequests(prev => prev.filter(req => req.friendship_id !== friendshipId));
      
      if (response === 'accepted') {
        // Перезагружаем список друзей
        await loadFriends();
      }
    } catch (error) {
      console.error('Ошибка обработки запроса через WebSocket:', error);
      alert('Ошибка обработки запроса через WebSocket');
    }
  };

  // Обработчики WebSocket событий
  const handleNewFriendRequest = (request) => {
    console.log('New friend request received:', request);
    loadFriendRequests();
  };

  const handleFriendRequestAccepted = (data) => {
    console.log('Friend request accepted:', data);
    loadFriends();
    loadFriendRequests();
  };

  const handleFriendRequestSent = (data) => {
    console.log('Friend request sent:', data);
    alert('Запрос дружбы отправлен!');
  };

  const handleFriendRequestResponded = (data) => {
    console.log('Friend request responded:', data);
    alert(`Запрос дружбы ${data.response === 'accepted' ? 'принят' : 'отклонен'}`);
  };

  const handleFriendRequestError = (errorData) => {
    console.error('Friend request error:', errorData);
    alert(`Ошибка: ${errorData.error}`);
  };

  const removeFriend = async (friendId) => {
  if (!confirm('Вы уверены, что хотите удалить из друзей?')) {
    return;
  }

  try {
    console.log('Removing friend with ID:', friendId);
    console.log('Current user ID:', currentUser.user_id);

    // Способ 1: Используем новый endpoint с телом запроса
    const response = await fetch(`${API_BASE_URL}/api/friends`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: currentUser.user_id,
        friend_id: friendId
      })
    });
    
    console.log('Delete response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Delete result:', result);
      
      // Убираем друга из списка
      setFriends(prev => prev.filter(f => 
        f.user_id !== friendId && f.friend_id !== friendId
      ));
      alert('Друг удален');
    } else {
      // Если endpoint не работает, пробуем альтернативный способ
      await removeFriendAlternative(friendId);
    }
  } catch (error) {
    console.error('Ошибка удаления друга (основной способ):', error);
    // Пробуем альтернативный способ
    await removeFriendAlternative(friendId);
  }
};

// Альтернативный способ удаления друга
const removeFriendAlternative = async (friendId) => {
  try {
    console.log('Trying alternative method to remove friend:', friendId);
    
    // Находим friendship_id через API
    const friendship = await findFriendshipId(friendId);
    
    if (friendship && friendship.friendship_id) {
      console.log('Found friendship ID:', friendship.friendship_id);
      
      const response = await fetch(`${API_BASE_URL}/api/friends/${friendship.friendship_id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Alternative delete result:', result);
        
        setFriends(prev => prev.filter(f => 
          f.user_id !== friendId && f.friend_id !== friendId
        ));
        alert('Друг удален');
      } else {
        throw new Error(`Сервер вернул статус: ${response.status}`);
      }
    } else {
      throw new Error('Не найден ID дружбы');
    }
  } catch (error) {
    console.error('Ошибка альтернативного удаления:', error);
    
    // Последний способ: удаляем только из состояния
    setFriends(prev => prev.filter(f => 
      f.user_id !== friendId && f.friend_id !== friendId
    ));
    alert('Друг удален из списка (изменения могут не сохраниться на сервере)');
  }
};

// Вспомогательная функция для поиска friendship_id
const findFriendshipId = async (friendId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/users/${currentUser.user_id}/friends`
    );
    
    if (response.ok) {
      const friends = await response.json();
      const friendship = friends.find(f => 
        f.user_id === friendId || f.friend_id === friendId
      );
      return friendship;
    } else {
      throw new Error('Не удалось загрузить список друзей');
    }
  } catch (error) {
    console.error('Error finding friendship ID:', error);
    throw error;
  }
};

  return (
    <div className="friends">
      <div className="friends-header">
        <h1>Друзья</h1>
        <div className="friends-stats">
          {friendRequests.length > 0 && (
            <span className="stat requests">Запросы: {friendRequests.length}</span>
          )}
          {!socketConnected && (
            <span className="stat warning">(REST режим)</span>
          )}
        </div>
      </div>

      <div className="friends-controls">
        <div className="friends-tabs">
        <button 
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Все друзья
        </button>
        <button 
          className={`tab ${activeTab === 'online' ? 'active' : ''}`}
          onClick={() => setActiveTab('online')}
        >
          Друзья онлайн
        </button>
        <button 
            className={`tab ${activeTab === 'mutual' ? 'active' : ''}`}
            onClick={() => setActiveTab('mutual')}
        >
          Общие друзья
        </button>
        </div>
        <button 
          className="find-friends-btn"
          onClick={() => setActiveTab('find')}
        >
          Найти друзей
        </button>
      </div>

      <div className="friends-search">
        <input
          type="text"
          placeholder="Поиск среди друзей..."
          value={friendsFilter}
          onChange={(e) => setFriendsFilter(e.target.value)}
          className="friends-filter-input"
        />
      </div>

      <div className="friends-content">
        {activeTab === 'all' && (
          <FriendsList 
            friends={friends.filter(f => {
              if (!friendsFilter.trim()) return true;
              const q = friendsFilter.toLowerCase();
              return ((f.name||'').toLowerCase().includes(q) || (f.email||'').toLowerCase().includes(q));
            })}
            onRemoveFriend={removeFriend}
            loading={loading}
            emptyMessage="У вас пока нет друзей"
          />
        )}

        {activeTab === 'online' && (
          <FriendsList 
            friends={getOnlineFriends().filter(f => {
              if (!friendsFilter.trim()) return true;
              const q = friendsFilter.toLowerCase();
              return ((f.name||'').toLowerCase().includes(q) || (f.email||'').toLowerCase().includes(q));
            })}
            onRemoveFriend={removeFriend}
            loading={loading}
            emptyMessage="Нет друзей онлайн"
          />
        )}

        {activeTab === 'mutual' && (
          <FriendsList 
            friends={friends.filter(f => f.is_mutual).filter(f => {
              if (!friendsFilter.trim()) return true;
              const q = friendsFilter.toLowerCase();
              return ((f.name||'').toLowerCase().includes(q) || (f.email||'').toLowerCase().includes(q));
            })}
            onRemoveFriend={removeFriend}
            loading={loading}
            emptyMessage="Нет общих друзей"
          />
        )}

        {activeTab === 'find' && (
          <FindFriends 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            onSearch={searchUsers}
            onSendRequest={sendFriendRequest}
            currentUser={currentUser}
            socketConnected={socketConnected}
          />
        )}
      </div>
    </div>
  );
};

// Компонент списка друзей
const FriendsList = ({ friends, onRemoveFriend, loading, emptyMessage }) => {
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Загрузка друзей...
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">👥</div>
        <h3>{emptyMessage}</h3>
        <p>Найдите новых друзей во вкладке "Найти друзей"</p>
      </div>
    );
  }

  return (
    <div className="friends-list">
      <div className="friends-grid">
        {friends.map(friend => (
          <FriendCard 
            key={friend.user_id} 
            friend={friend} 
            onRemove={onRemoveFriend}
          />
        ))}
      </div>
    </div>
  );
};

// Компонент карточки друга
const FriendCard = ({ friend, onRemove }) => {
  const [showActions, setShowActions] = useState(false);

  const handleMessage = () => {
    alert(`Открыть чат с ${friend.name}`);
  };

  const handleCall = () => {
    alert(`Позвонить ${friend.name}`);
  };

  const getLastSeen = (lastSeen) => {
    if (!lastSeen) return 'давно';
    
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} д назад`;
    
    return lastSeenDate.toLocaleDateString('ru-RU');
  };

  return (
    <div className="friend-card">
      <div className="friend-main">
        <div className="friend-avatar">
          {friend.name.charAt(0).toUpperCase()}
          {friend.is_online && <div className="online-indicator"></div>}
        </div>
        
        <div className="friend-info">
          <h4 className="friend-name">{friend.name}</h4>
          <p className="friend-email">{friend.email}</p>
          <div className="friend-status">
            {friend.is_online ? (
              <span className="status online">В сети</span>
            ) : (
              <span className="status offline">
                Был(а) {getLastSeen(friend.last_seen)}
              </span>
            )}
          </div>
        </div>

        <div className="friend-actions">
          <button 
            className="action-btn more"
            onClick={() => setShowActions(!showActions)}
            title="Действия"
          >
            ⋮
          </button>
          
          {showActions && (
            <div className="actions-menu">
              <button 
                className="action-item remove"
                onClick={() => onRemove(friend.user_id)}
              >
                🗑️ Удалить из друзей
              </button>
              <button 
                className="action-item"
                onClick={() => alert('Оставить в подписчиках')}
              >
                👤 Оставить в подписчиках
              </button>
              <button 
                className="action-item"
                onClick={() => alert('Посмотреть друзей')}
              >
                👥 Посмотреть друзей
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="friend-actions-bar">
        <button 
          className="action-btn primary"
          onClick={handleMessage}
        >
          💬 Сообщение
        </button>
        <button 
          className="action-btn secondary"
          onClick={handleCall}
        >
          📞 Позвонить
        </button>
      </div>
    </div>
  );
};

// Компонент запросов в друзья
const FriendRequests = ({ requests, onRespond, emptyMessage }) => {
  if (requests.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📨</div>
        <h3>{emptyMessage}</h3>
        <p>Когда вам пришлют запрос дружбы, он появится здесь</p>
      </div>
    );
  }

  return (
    <div className="requests-list">
      <h3>Запросы в друзья</h3>
      {requests.map(request => (
        <div key={request.friendship_id} className="request-card">
          <div className="request-avatar">
            {request.from_user_name.charAt(0).toUpperCase()}
          </div>
          
          <div className="request-info">
            <h4>{request.from_user_name}</h4>
            <p>{request.from_user_email}</p>
            <span className="request-date">
              {new Date(request.created_at).toLocaleDateString('ru-RU')}
            </span>
          </div>

          <div className="request-actions">
            <button 
              className="accept-btn"
              onClick={() => onRespond(request.friendship_id, 'accepted')}
            >
              Принять
            </button>
            <button 
              className="reject-btn"
              onClick={() => onRespond(request.friendship_id, 'rejected')}
            >
              Отклонить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// Компонент поиска друзей с индикатором соединения
const FindFriends = ({ 
  searchQuery, 
  setSearchQuery, 
  searchResults, 
  onSearch, 
  onSendRequest,
  currentUser,
  socketConnected
}) => {
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (value.trim()) {
      // Дебаунс поиска
      const timeoutId = setTimeout(() => {
        onSearch(value);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    } else {
      onSearch('');
    }
  };

  return (
    <div className="find-friends">
      <div className="search-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Введите имя или email пользователя..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
          />
          <div className="search-icon">🔍</div>
        </div>
        
        <div className="search-tips">
          <p>💡 Найдите друзей по имени или email адресу</p>
          {!socketConnected && (
            <p className="connection-warning">
              ⚠️ WebSocket не подключен, используется REST API
            </p>
          )}
        </div>
      </div>

      <div className="search-results">
        {searchQuery && searchResults.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>Пользователи не найдены</h3>
            <p>Попробуйте изменить поисковый запрос</p>
          </div>
        )}

        {searchResults.map(user => (
          <div key={user.user_id} className="user-card">
            <div className="user-avatar">
              {user.name.charAt(0).toUpperCase()}
              {user.is_online && <div className="online-indicator"></div>}
            </div>
            
            <div className="user-info">
              <h4>{user.name}</h4>
              <p>{user.email}</p>
              <span className={`user-status ${user.is_online ? 'online' : 'offline'}`}>
                {user.is_online ? 'В сети' : 'Не в сети'}
              </span>
            </div>

            <button 
              className="add-friend-btn"
              onClick={() => onSendRequest(user.user_id)}
            >
              Добавить в друзья
            </button>
          </div>
        ))}

        {!searchQuery && (
          <div className="search-prompt">
            <div className="prompt-icon">👥</div>
            <h3>Найдите своих друзей</h3>
            <p>Введите имя или email в поле поиска выше</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Friends;