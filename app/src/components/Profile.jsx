import React, { useState, useEffect } from 'react';
import './Profile.css';

const Profile = ({ currentUser }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    bio: ''
  });

  const API_BASE_URL = 'http://localhost:5001';

  useEffect(() => {
    if (currentUser) {
      loadUserProfile();
    }
  }, [currentUser]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('Loading profile for user:', currentUser);
      
      if (!currentUser || !currentUser.user_id) {
        throw new Error('Текущий пользователь не определен');
      }

      const response = await fetch(`${API_BASE_URL}/api/users/${currentUser.user_id}/profile`);
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки профиля');
      }
      
      const userData = await response.json();
      console.log('Loaded user data:', userData);
      
      setUser(userData);
      setEditForm({
        name: userData.name || '',
        bio: userData.bio || ''
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (user) {
      setEditForm({
        name: user.name || '',
        bio: user.bio || ''
      });
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');
      
      const formData = new FormData();
      formData.append('name', editForm.name);
      formData.append('bio', editForm.bio);

      const response = await fetch(`${API_BASE_URL}/api/users/${currentUser.user_id}/profile`, {
        method: 'PUT',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Ошибка сохранения профиля');
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      setIsEditing(false);
      
      // Обновляем текущего пользователя в localStorage
      const savedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const updatedCurrentUser = {
        ...savedUser,
        name: updatedUser.name
      };
      localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));
      
    } catch (error) {
      console.error('Error saving profile:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getOnlineStatus = (userData) => {
    if (!userData) return 'Неизвестно';
    
    try {
      if (userData.is_online) {
        return 'В сети';
      } else if (userData.last_seen) {
        const lastSeen = new Date(userData.last_seen);
        const now = new Date();
        const diffHours = Math.floor((now - lastSeen) / (1000 * 60 * 60));
        
        if (diffHours < 1) {
          return 'Был(а) недавно';
        } else if (diffHours < 24) {
          return `Был(а) ${diffHours} ч. назад`;
        } else {
          return `Был(а) ${Math.floor(diffHours / 24)} д. назад`;
        }
      } else {
        return 'Никогда не был(а) онлайн';
      }
    } catch (error) {
      console.error('Error calculating online status:', error);
      return 'Неизвестно';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Неизвестно';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Неизвестно';
    }
  };

  // Если пользователь не загружен, показываем заглушку
  if (!currentUser) {
    return (
      <div className="profile-container">
        <div className="profile-error">
          <h3>Ошибка</h3>
          <p>Пользователь не авторизован</p>
        </div>
      </div>
    );
  }

  if (loading && !user) {
    return (
      <div className="profile-container">
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="profile-container">
        <div className="profile-error">
          <h3>Ошибка загрузки профиля</h3>
          <p>{error}</p>
          <button onClick={loadUserProfile} className="retry-button">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-container">
        <div className="profile-error">
          <h3>Профиль не найден</h3>
          <p>Не удалось загрузить данные профиля</p>
          <button onClick={loadUserProfile} className="retry-button">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h2>Профиль пользователя</h2>
        {!isEditing && (
          <button onClick={handleEdit} className="edit-button">
            Редактировать
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="profile-content">
        <div className="profile-avatar-section">
          <div className="avatar">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="online-status">
            <span className={`status-dot ${user.is_online ? 'online' : 'offline'}`}></span>
            {getOnlineStatus(user)}
          </div>
        </div>

        <div className="profile-info">
          {isEditing ? (
            <div className="edit-form">
              <div className="form-group">
                <label htmlFor="name">Имя:</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={editForm.name}
                  onChange={handleInputChange}
                  placeholder="Введите ваше имя"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="bio">О себе:</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={editForm.bio}
                  onChange={handleInputChange}
                  placeholder="Расскажите о себе..."
                  rows="4"
                  disabled={loading}
                />
              </div>

              <div className="form-actions">
                <button 
                  onClick={handleSave} 
                  className="save-button"
                  disabled={loading}
                >
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button 
                  onClick={handleCancel} 
                  className="cancel-button"
                  disabled={loading}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="profile-details">
              <div className="detail-item">
                <label>Имя:</label>
                <span>{user.name || 'Не указано'}</span>
              </div>

              <div className="detail-item">
                <label>Email:</label>
                <span>{user.email || 'Не указан'}</span>
              </div>

              <div className="detail-item">
                <label>О себе:</label>
                <span>{user.bio || 'Не указано'}</span>
              </div>

              <div className="detail-item">
                <label>Статус:</label>
                <span>{user.role === 'admin' ? 'Администратор' : 'Пользователь'}</span>
              </div>

              <div className="detail-item">
                <label>Дата регистрации:</label>
                <span>{formatDate(user.created_at)}</span>
              </div>

              <div className="detail-item">
                <label>Количество постов:</label>
                <span>{user.posts_count || 0}</span>
              </div>

              <div className="detail-item">
                <label>Друзей:</label>
                <span>{user.friends_count || 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;