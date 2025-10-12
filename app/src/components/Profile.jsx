import React, { useState, useEffect, useRef } from 'react';
import './Profile.css';

const Profile = ({ currentUser, profileUserId = null }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditPage, setIsEditPage] = useState(false);
  const [bannerPreview, setBannerPreview] = useState(null);
  const fileInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  
  const [editForm, setEditForm] = useState({
    name: '',
    bio: ''
  });

  const API_BASE_URL = 'http://localhost:5001';

  // Определяем, это свой профиль или чужой
  const isOwnProfile = !profileUserId || profileUserId === currentUser?.user_id;
  const targetUserId = profileUserId || currentUser?.user_id;

  useEffect(() => {
    if (currentUser) {
      loadUserProfile();
    }
  }, [currentUser, profileUserId]);

  // Закрываем меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMenuOpen && !event.target.closest('.kebab-menu')) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Закрываем модальное окно при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isModalOpen && event.target.classList.contains('modal-overlay')) {
        closeModal();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModalOpen]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('Loading profile for user:', currentUser);
      
      if (!currentUser || !currentUser.user_id) {
        throw new Error('Текущий пользователь не определен');
      }

      const response = await fetch(`${API_BASE_URL}/api/users/${targetUserId}/profile`);
      
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
      
      // Устанавливаем превью аватарки если есть
      if (userData.avatar_url) {
        setAvatarPreview(`${API_BASE_URL}${userData.avatar_url}?t=${Date.now()}`);
      } else {
        setAvatarPreview(null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditPage(true);
    closeMenu();
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleAdditionalInfo = () => {
    setIsModalOpen(true);
    closeMenu();
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleBlockUser = () => {
    console.log('Заблокировать пользователя');
    closeMenu();
  };

  const handleIgnoreUser = () => {
    console.log('Игнорировать пользователя');
    closeMenu();
  };

  const handleCancel = () => {
    setIsEditing(false);
    setAvatarPreview(user?.avatar_url ? `${API_BASE_URL}${user.avatar_url}` : null);
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
      setUploadProgress(0);
      
      const formData = new FormData();
      formData.append('name', editForm.name);
      formData.append('bio', editForm.bio);

      // Добавляем файл аватарки если выбран новый
      if (fileInputRef.current?.files[0]) {
        formData.append('avatar', fileInputRef.current.files[0]);
      }

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const updatedUser = JSON.parse(xhr.responseText);
          setUser(updatedUser);
          setIsEditing(false);
          setIsEditPage(false);
          
          // Обновляем текущего пользователя в localStorage
          const savedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
          const updatedCurrentUser = {
            ...savedUser,
            name: updatedUser.name,
            avatar_url: updatedUser.avatar_url
          };
          localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));
          
          // Сбрасываем превью
          setAvatarPreview(updatedUser.avatar_url ? `${API_BASE_URL}${updatedUser.avatar_url}?t=${Date.now()}` : null);
          setBannerPreview(null);
          setUploadProgress(0);
        } else {
          setError('Ошибка сохранения профиля');
        }
        setLoading(false);
      });

      xhr.addEventListener('error', () => {
        setError('Ошибка сети при сохранении профиля');
        setLoading(false);
        setUploadProgress(0);
      });

      xhr.open('PUT', `${API_BASE_URL}/api/users/${currentUser.user_id}/profile`);
      xhr.send(formData);
      
    } catch (error) {
      console.error('Error saving profile:', error);
      setError(error.message);
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleAvatarClick = () => {
    if (isEditing) {
      fileInputRef.current?.click();
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверяем тип файла
      if (!file.type.startsWith('image/')) {
        setError('Пожалуйста, выберите изображение');
        return;
      }

      // Проверяем размер файла (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Размер файла не должен превышать 5MB');
        return;
      }

      // Создаем превью
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target.result);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const removeAvatar = () => {
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBannerClick = () => {
    bannerInputRef.current?.click();
  };

  const handleBannerChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверяем тип файла
      if (!file.type.startsWith('image/')) {
        setError('Пожалуйста, выберите изображение');
        return;
      }

      // Проверяем размер файла (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Размер файла не должен превышать 5MB');
        return;
      }

      // Создаем превью
      const reader = new FileReader();
      reader.onload = (e) => {
        setBannerPreview(e.target.result);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const removeBanner = () => {
    setBannerPreview(null);
    if (bannerInputRef.current) {
      bannerInputRef.current.value = '';
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('Вы уверены, что хотите удалить аккаунт? Это действие нельзя отменить.')) {
      // Здесь будет логика удаления аккаунта
      console.log('Удаление аккаунта');
    }
  };

  const handleBackToProfile = () => {
    setIsEditPage(false);
    setBannerPreview(null);
    setAvatarPreview(user?.avatar_url ? `${API_BASE_URL}${user.avatar_url}` : null);
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

  // Если открыта страница редактирования
  if (isEditPage) {
    return (
      <div className="profile-container">
        <div className="profile-banner edit-banner">
          <div 
            className="banner-overlay"
            style={{
              backgroundImage: bannerPreview ? `url(${bannerPreview})` : 'none'
            }}
          >
          </div>
          
          <input
            type="file"
            ref={bannerInputRef}
            onChange={handleBannerChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          
          {/* Аватар пользователя */}
          <div className="profile-avatar-section">
            <div 
              className="avatar editable"
              onClick={handleAvatarClick}
              style={{
                backgroundImage: avatarPreview ? `url(${avatarPreview})` : 'none'
              }}
            >
              {!avatarPreview && (user.name ? user.name.charAt(0).toUpperCase() : 'U')}
            </div>
            
            <div className="user-name-section">
              <div className="name-status-row">
                <h3 className="user-name">{user.name || 'Не указано'}</h3>
              </div>
              
              <div className="edit-controls">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <button 
                  type="button" 
                  onClick={handleAvatarClick}
                  className="edit-control-button avatar-button"
                >
                  <span className="button-icon">👤</span>
                  <span className="button-text">Сменить аватар</span>
                </button>
                
                <input
                  type="file"
                  ref={bannerInputRef}
                  onChange={handleBannerChange}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <button 
                  className="edit-control-button banner-button"
                  onClick={handleBannerClick}
                >
                  <span className="button-icon">🖼️</span>
                  <span className="button-text">Сменить баннер</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="edit-profile-content">
          <div className="edit-form-section">
            <h3>Редактирование профиля</h3>
            
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
                {loading ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
              <button 
                onClick={handleBackToProfile} 
                className="cancel-button"
                disabled={loading}
              >
                Отмена
              </button>
            </div>
          </div>

          <div className="danger-zone">
            <h3>Опасная зона</h3>
            <p>Удаление аккаунта — необратимая операция. Все ваши данные будут удалены навсегда.</p>
            <button 
              onClick={handleDeleteAccount}
              className="delete-account-button"
            >
              Удалить аккаунт
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-banner">
        
        {/* Аватар пользователя, наполовину в баннере */}
        <div className="profile-avatar-section">
          <div 
            className={`avatar ${isEditing ? 'editable' : ''}`}
            onClick={handleAvatarClick}
            style={{
              backgroundImage: avatarPreview ? `url(${avatarPreview})` : 'none'
            }}
          >
            {!avatarPreview && (user.name ? user.name.charAt(0).toUpperCase() : 'U')}
          </div>
          
          {isEditing && (
            <div className="avatar-controls">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <button 
                type="button" 
                onClick={handleAvatarClick}
                className="avatar-upload-button"
              >
                Сменить фото
              </button>
              {avatarPreview && (
                <button 
                  type="button" 
                  onClick={removeAvatar}
                  className="avatar-remove-button"
                >
                  Удалить
                </button>
              )}
            </div>
          )}
          
          <div className="user-name-section">
            <div className="name-status-row">
              <h3 className="user-name">{user.name || 'Не указано'}</h3>
              <div className="online-status">
                <span className={`status-dot ${user.is_online ? 'online' : 'offline'}`}></span>
                {getOnlineStatus(user)}
              </div>
            </div>
            <p className="registration-date">Зарегистрирован {formatDate(user.created_at)}</p>
            
            {/* Кебаб-меню */}
            <div className="kebab-menu">
              <button 
                className="kebab-button"
                onClick={toggleMenu}
                aria-label="Меню"
              >
                <span className="kebab-dot"></span>
                <span className="kebab-dot"></span>
                <span className="kebab-dot"></span>
              </button>
              
              {isMenuOpen && (
                <div className="dropdown-menu">
                  {isOwnProfile ? (
                    <>
                      <button 
                        className="menu-item"
                        onClick={handleEdit}
                      >
                        Редактировать профиль
                      </button>
                      <button 
                        className="menu-item"
                        onClick={handleAdditionalInfo}
                      >
                        Доп. информация
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        className="menu-item"
                        onClick={handleAdditionalInfo}
                      >
                        Доп. информация
                      </button>
                      <button 
                        className="menu-item danger"
                        onClick={handleBlockUser}
                      >
                        Заблокировать
                      </button>
                      <button 
                        className="menu-item danger"
                        onClick={handleIgnoreUser}
                      >
                        Игнорировать
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="upload-progress">
              <div 
                className="progress-bar" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
              <span>Загрузка: {Math.round(uploadProgress)}%</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="profile-content">
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
              {/* Информация профиля */}
            </div>
          )}
        </div>
      </div>

      {/* Новые блоки под профилем */}
      <div className="profile-bottom-section">
        {/* Блок мини-галереи (60%) */}
        <div className="gallery-section">
          <div className="section-header">
            <h3>Галерея</h3>
            <span className="section-count">{user.gallery_count || 0} фото</span>
          </div>
          <div className="gallery-grid">
            {/* Первые 3 фото */}
            {[1, 2, 3].map((item) => (
              <div key={item} className="gallery-item">
                <div className="gallery-placeholder">
                  <span>Фото {item}</span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Кнопки галереи */}
          <div className="gallery-buttons">
            <button className="gallery-button upload-button">
              <span className="button-icon">📷</span>
              <span className="button-text">Загрузить фото</span>
            </button>
            <button className="gallery-button view-all-button">
              <span className="button-icon">👁️</span>
              <span className="button-text">Посмотреть всё</span>
            </button>
          </div>
          
          {/* Кнопка создания поста */}
          <div className="create-post-section">
            <button className="create-post-button">
              <span className="button-icon">✍️</span>
              <span className="button-text">Написать пост</span>
            </button>
          </div>
        </div>

        {/* Блок друзей и подписчиков (40%) */}
        <div className="friends-section">
          <div className="section-header">
            <h3>Друзья и подписчики</h3>
          </div>
          
          {/* Блок подписчиков */}
          <div className="followers-section">
            <h4>Подписчики</h4>
            <div className="followers-grid">
              {/* Заглушки для подписчиков */}
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="follower-item">
                  <div className="follower-avatar">
                    <span>F{item}</span>
                  </div>
                  <span className="follower-name">Подписчик {item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Разделительная черта */}
          <div className="section-divider"></div>

          {/* Блок друзей */}
          <div className="friends-section-grid">
            <h4>Друзья</h4>
            <div className="friends-grid">
              {/* Заглушки для списка друзей */}
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="friend-item">
                  <div className="friend-avatar">
                    <span>U{item}</span>
                  </div>
                  <span className="friend-name">Пользователь {item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно дополнительной информации */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Дополнительная информация</h3>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-detail-item">
                <label>Email:</label>
                <span>{user?.email || 'Не указан'}</span>
              </div>
              
              <div className="modal-detail-item">
                <label>Статус:</label>
                <span>{user?.role === 'admin' ? 'Администратор' : 'Пользователь'}</span>
              </div>
              
              <div className="modal-detail-item">
                <label>О себе:</label>
                <span>{user?.bio || 'Не указано'}</span>
              </div>
              
              <div className="modal-detail-item">
                <label>Количество постов:</label>
                <span>{user?.posts_count || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;