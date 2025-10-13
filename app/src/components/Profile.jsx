import React, { useState, useEffect, useRef } from 'react';
import './Profile.css';

const Profile = ({ currentUser, profileUserId = null }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditPage, setIsEditPage] = useState(false);
  
  // Новые состояния для друзей, подписчиков и галереи
  const [friends, setFriends] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [gallery, setGallery] = useState([]); // Инициализируем как пустой массив
  const [galleryCount, setGalleryCount] = useState(0);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  
  const fileInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const postImageInputRef = useRef(null);
  
  const [editForm, setEditForm] = useState({
    name: '',
    bio: ''
  });

  const [postForm, setPostForm] = useState({
    content: '',
    image: null
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

  // Загрузка профиля пользователя
  const loadUserProfile = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!currentUser || !currentUser.user_id) {
        throw new Error('Текущий пользователь не определен');
      }

      const response = await fetch(`${API_BASE_URL}/api/users/${targetUserId}/profile?t=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки профиля: ' + response.status);
      }
      
      const userData = await response.json();
      
      setUser(userData);
      setEditForm({
        name: userData.name || '',
        bio: userData.bio || ''
      });
      
      // Устанавливаем превью баннера и аватара
      if (userData.banner_url) {
        const bannerUrl = userData.banner_url.includes('http') 
          ? `${userData.banner_url}?t=${Date.now()}`
          : `${API_BASE_URL}${userData.banner_url}?t=${Date.now()}`;
        setBannerPreview(bannerUrl);
      } else {
        setBannerPreview(null);
      }

      if (userData.avatar_url) {
        const avatarUrl = userData.avatar_url.includes('http')
          ? `${userData.avatar_url}?t=${Date.now()}`
          : `${API_BASE_URL}${userData.avatar_url}?t=${Date.now()}`;
        setAvatarPreview(avatarUrl);
      } else {
        setAvatarPreview(null);
      }
      
    } catch (error) {
      console.error('❌ Error loading profile:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка друзей и подписчиков
  const loadFriendsData = async () => {
    try {
      if (isOwnProfile) {
        // Загрузка друзей
        const friendsRes = await fetch(`${API_BASE_URL}/api/users/${targetUserId}/friends`);
        if (friendsRes.ok) {
          const friendsData = await friendsRes.json();
          setFriends(friendsData || []);
        }
        
        // Загрузка подписчиков
        const followersRes = await fetch(`${API_BASE_URL}/api/users/${targetUserId}/followers`);
        if (followersRes.ok) {
          const followersData = await followersRes.json();
          setFollowers(followersData || []);
        }
      } else {
        // Для чужого профиля показываем только друзей
        const friendsRes = await fetch(`${API_BASE_URL}/api/users/${targetUserId}/friends`);
        if (friendsRes.ok) {
          const friendsData = await friendsRes.json();
          setFriends(friendsData || []);
        }
        setFollowers([]); // Подписчики скрыты для чужих профилей
      }
    } catch (error) {
      console.error('Error loading friends data:', error);
      setFriends([]);
      setFollowers([]);
    }
  };

  // Загрузка галереи
 const loadGallery = async () => {
  try {
    setGalleryLoading(true);
    console.log('Loading gallery for user:', targetUserId);
    
    const response = await fetch(`${API_BASE_URL}/api/users/${targetUserId}/gallery?limit=3`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const galleryData = await response.json();
    console.log('Gallery data received:', galleryData);
    
    setGallery(galleryData.photos || []);
    setGalleryCount(galleryData.total_count || 0);
  } catch (error) {
    console.error('Error loading gallery:', error);
    setGallery([]);
    setGalleryCount(0);
  } finally {
    setGalleryLoading(false);
  }
};

  // Проверка статуса подписки
  const checkFollowStatus = async () => {
    if (!isOwnProfile && currentUser) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/follow/check/${currentUser.user_id}/${targetUserId}`
        );
        if (response.ok) {
          const data = await response.json();
          setIsFollowed(data.is_following || false);
        }
      } catch (error) {
        console.error('Error checking follow status:', error);
        setIsFollowed(false);
      }
    }
  };

  // Подписка/отписка
  const handleFollow = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/follow/${targetUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUser.user_id })
      });
      
      if (response.ok) {
        const result = await response.json();
        setIsFollowed(result.is_following || false);
        
        // Обновляем список подписчиков
        if (isOwnProfile) {
          loadFriendsData();
        }
      }
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  // Загрузка фото в галерею
  const handleGalleryUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('userId', targetUserId);
      
      const response = await fetch(`${API_BASE_URL}/api/gallery/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        // Обновляем галерею
        loadGallery();
        return result;
      } else {
        throw new Error('Ошибка загрузки фото');
      }
    } catch (error) {
      console.error('Error uploading to gallery:', error);
      setError('Ошибка загрузки фото');
    }
  };

  // Создание поста
  const handleCreatePost = async () => {
    try {
      const formData = new FormData();
      formData.append('user_id', currentUser.user_id);
      formData.append('content', postForm.content);
      
      if (postForm.image) {
        formData.append('media', postForm.image);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/posts`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        setPostForm({ content: '', image: null });
        // Можно добавить уведомление об успешном создании поста
        alert('Пост успешно создан!');
      } else {
        throw new Error('Ошибка создания поста');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      setError('Ошибка создания поста');
    }
  };

  // Просмотр галереи
  const openGalleryModal = () => {
    setIsGalleryModalOpen(true);
  };

  const closeGalleryModal = () => {
    setIsGalleryModalOpen(false);
    setSelectedImage(null);
  };

  const openImageModal = (image) => {
    setSelectedImage(image);
  };

  // Вызов функций загрузки данных
  useEffect(() => {
    if (user) {
      loadFriendsData();
      loadGallery();
      checkFollowStatus();
    }
  }, [user, isOwnProfile]);

  // Обработчики изменений в форме
  const handleGalleryImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Пожалуйста, выберите изображение');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError('Размер файла не должен превышать 10MB');
        return;
      }

      handleGalleryUpload(file);
      e.target.value = ''; // Сброс input
    }
  };

  const handlePostImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Пожалуйста, выберите изображение');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError('Размер файла не должен превышать 10MB');
        return;
      }

      setPostForm(prev => ({ ...prev, image: file }));
    }
  };

  const handlePostContentChange = (e) => {
    setPostForm(prev => ({ ...prev, content: e.target.value }));
  };

  // Остальные существующие функции
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
    setBannerPreview(user?.banner_url ? `${API_BASE_URL}${user.banner_url}` : null);
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

      if (fileInputRef.current?.files[0]) {
        formData.append('avatar', fileInputRef.current.files[0]);
      }

      if (bannerInputRef.current?.files[0]) {
        formData.append('banner', bannerInputRef.current.files[0]);
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
          try {
            const updatedUser = JSON.parse(xhr.responseText);
            setUser(updatedUser);
            setIsEditing(false);
            setIsEditPage(false);
            
            // Обновляем текущего пользователя в localStorage
            const savedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const updatedCurrentUser = {
              ...savedUser,
              name: updatedUser.name,
              avatar_url: updatedUser.avatar_url,
              banner_url: updatedUser.banner_url,
              bio: updatedUser.bio
            };
            localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));
            
            // Принудительно обновляем превью
            if (updatedUser.banner_url) {
              const newBannerUrl = `${API_BASE_URL}${updatedUser.banner_url}?t=${Date.now()}`;
              setBannerPreview(newBannerUrl);
            } else {
              setBannerPreview(null);
            }
            
            if (updatedUser.avatar_url) {
              const newAvatarUrl = `${API_BASE_URL}${updatedUser.avatar_url}?t=${Date.now()}`;
              setAvatarPreview(newAvatarUrl);
            }
            
            setUploadProgress(0);
            
          } catch (parseError) {
            console.error('Error parsing response:', parseError);
            setError('Ошибка обработки ответа сервера: ' + parseError.message);
          }
        } else {
          let errorMessage = 'Ошибка сохранения профиля';
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            errorMessage = errorResponse.error || errorMessage;
          } catch (e) {
            console.error('Error parsing error response:', e);
          }
          setError(errorMessage);
        }
        setLoading(false);
      });

      xhr.addEventListener('error', (e) => {
        console.error('Network error during profile save:', e);
        setError('Ошибка сети при сохранении профиля');
        setLoading(false);
        setUploadProgress(0);
      });

      xhr.addEventListener('abort', () => {
        console.log('Request aborted');
        setLoading(false);
        setUploadProgress(0);
      });

      const url = `${API_BASE_URL}/api/users/${currentUser.user_id}/profile`;
      xhr.open('PUT', url);
      xhr.send(formData);
      
    } catch (error) {
      console.error('Error in handleSave:', error);
      setError(error.message);
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleAvatarClick = () => {
    if (isEditing || isEditPage) {
      fileInputRef.current?.click();
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Пожалуйста, выберите изображение');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('Размер файла не должен превышать 5MB');
        return;
      }

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
      if (!file.type.startsWith('image/')) {
        setError('Пожалуйста, выберите изображение');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('Размер файла не должен превышать 5MB');
        return;
      }

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
      console.log('Удаление аккаунта');
    }
  };

  const handleBackToProfile = () => {
    setIsEditPage(false);
    setBannerPreview(user?.banner_url ? `${API_BASE_URL}${user.banner_url}` : null);
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
               backgroundImage: bannerPreview ? `url(${bannerPreview})` : (user?.banner_url ? `url(${user.banner_url})` : 'none')
            }}
          >
            <div className="banner-controls">
              <button 
                className="banner-upload-button"
                onClick={handleBannerClick}
              >
                📷 Сменить баннер
              </button>
              {(bannerPreview || user?.banner_url) && (
                <button 
                  className="banner-remove-button"
                  onClick={removeBanner}
                >
                  ❌ Удалить
                </button>
              )}
            </div>
          </div>
          
          <input
            type="file"
            ref={bannerInputRef}
            onChange={handleBannerChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          
          <div className="profile-avatar-section">
            <div 
              className="avatar editable"
              onClick={handleAvatarClick}
              style={{
                backgroundImage: avatarPreview ? `url(${avatarPreview})` : (user?.avatar_url ? `url(${API_BASE_URL}${user.avatar_url})` : 'none')
              }}
            >
              {!avatarPreview && !user?.avatar_url && (user.name ? user.name.charAt(0).toUpperCase() : 'U')}
            </div>
            
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
                Сменить аватар
              </button>
              {(avatarPreview || user?.avatar_url) && (
                <button 
                  type="button" 
                  onClick={removeAvatar}
                  className="avatar-remove-button"
                >
                  Удалить аватар
                </button>
              )}
            </div>
            
            <div className="user-name-section">
              <div className="name-status-row">
                <h3 className="user-name">{user.name || 'Не указано'}</h3>
              </div>
              
              <div className="edit-controls">
                <button 
                  onClick={handleBackToProfile}
                  className="back-to-profile-button"
                >
                  ← Назад к профилю
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

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="upload-progress">
            <div 
              className="progress-bar" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
            <span>Загрузка: {Math.round(uploadProgress)}%</span>
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
        <div 
          className="banner-overlay"
          style={{
            backgroundImage: user?.banner_url ? `url(${API_BASE_URL}${user.banner_url})` : 'none'
          }}
        ></div>
        
        <div className="profile-avatar-section">
          <div 
            className={`avatar ${isEditing ? 'editable' : ''}`}
            onClick={handleAvatarClick}
            style={{
              backgroundImage: avatarPreview ? `url(${avatarPreview})` : (user?.avatar_url ? `url(${API_BASE_URL}${user.avatar_url})` : 'none')
            }}
          >
            {!avatarPreview && !user?.avatar_url && (user.name ? user.name.charAt(0).toUpperCase() : 'U')}
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
              {(avatarPreview || user?.avatar_url) && (
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
            
            {/* Кнопка подписки для чужого профиля */}
            {!isOwnProfile && (
              <button 
                className={`follow-button ${isFollowed ? 'unfollow' : 'follow'}`}
                onClick={handleFollow}
              >
                {isFollowed ? '✓ Подписан' : '+ Подписаться'}
              </button>
            )}
            
            {/* Кебаб-меню для своего профиля */}
            {isOwnProfile && (
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
                  </div>
                )}
              </div>
            )}
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
              <div className="bio-section">
                <h4>О себе</h4>
                <p>{user.bio || 'Пользователь еще не добавил информацию о себе.'}</p>
              </div>
              
              <div className="stats-section">
                <div className="stat-item">
                  <span className="stat-number">{user.posts_count || 0}</span>
                  <span className="stat-label">Публикаций</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{Array.isArray(friends) ? friends.length : 0}</span>
                  <span className="stat-label">Друзей</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{Array.isArray(followers) ? followers.length : 0}</span>
                  <span className="stat-label">Подписчиков</span>
                </div>
              </div>
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
            <span className="section-count">{galleryCount} фото</span>
          </div>
          
          {galleryLoading ? (
            <div className="gallery-loading">
              <div className="loading-spinner small"></div>
              <p>Загрузка галереи...</p>
            </div>
          ) : (
            <>
              <div className="gallery-grid">
  {Array.isArray(gallery) && gallery.map((photo, index) => (
    <div 
      key={photo.gallery_id || index} 
      className="gallery-item"
      onClick={() => openImageModal(photo)}
    >
      <img 
        src={`${API_BASE_URL}${photo.image_url}`} 
        alt={`Фото ${index + 1}`}
        loading="lazy"
        onError={(e) => {
          console.error('Error loading image:', photo.image_url);
          e.target.style.display = 'none';
          if (e.target.nextSibling) {
            e.target.nextSibling.style.display = 'block';
          }
        }}
      />
      <div className="gallery-placeholder" style={{display: 'none'}}>
        <span>Ошибка загрузки</span>
      </div>
    </div>
  ))}
  
  {/* Заполнители если фото меньше 3 */}
  {Array.isArray(gallery) && gallery.length === 0 && !galleryLoading && (
    <div className="gallery-item placeholder">
      <div className="gallery-placeholder">
        <span>Нет фото</span>
      </div>
    </div>
  )}
</div>
              
              {/* Кнопки галереи */}
              <div className="gallery-buttons">
                {isOwnProfile && (
                  <button 
                    className="gallery-button upload-button"
                    onClick={() => galleryInputRef.current?.click()}
                  >
                    <span className="button-icon">📷</span>
                    <span className="button-text">Загрузить фото</span>
                  </button>
                )}
                <button 
                  className="gallery-button view-all-button"
                  onClick={openGalleryModal}
                >
                  <span className="button-icon">👁️</span>
                  <span className="button-text">Посмотреть всё</span>
                </button>
              </div>
            </>
          )}
          
          <input
            type="file"
            ref={galleryInputRef}
            onChange={handleGalleryImageChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          
          {/* Кнопка создания поста */}
          {isOwnProfile && (
            <div className="create-post-section">
              <div className="post-form">
                <textarea
                  placeholder="Что у вас нового?"
                  value={postForm.content}
                  onChange={handlePostContentChange}
                  rows="3"
                />
                <div className="post-form-actions">
                  <button 
                    className="post-image-button"
                    onClick={() => postImageInputRef.current?.click()}
                  >
                    📎 Добавить фото
                  </button>
                  <button 
                    className="create-post-button"
                    onClick={handleCreatePost}
                    disabled={!postForm.content.trim() && !postForm.image}
                  >
                    Опубликовать
                  </button>
                </div>
                {postForm.image && (
                  <div className="post-image-preview">
                    <img 
                      src={URL.createObjectURL(postForm.image)} 
                      alt="Предпросмотр" 
                    />
                    <button 
                      className="remove-image-button"
                      onClick={() => setPostForm(prev => ({ ...prev, image: null }))}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={postImageInputRef}
                onChange={handlePostImageChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
          )}
        </div>

        {/* Блок друзей и подписчиков (40%) */}
        <div className="friends-section">
          <div className="section-header">
            <h3>Друзья и подписчики</h3>
          </div>
          
          {/* Блок подписчиков (только для своего профиля) */}
          {isOwnProfile && Array.isArray(followers) && followers.length > 0 && (
            <div className="followers-section">
              <h4>Подписчики ({followers.length})</h4>
              <div className="followers-grid">
                {followers.slice(0, 6).map((follower) => (
                  <div key={follower.user_id} className="follower-item">
                    <div 
                      className="follower-avatar"
                      style={{
                        backgroundImage: follower.avatar_url 
                          ? `url(${API_BASE_URL}${follower.avatar_url})`
                          : 'none'
                      }}
                    >
                      {!follower.avatar_url && follower.name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="follower-name">{follower.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Разделительная черта */}
          {(isOwnProfile && Array.isArray(followers) && followers.length > 0 && Array.isArray(friends) && friends.length > 0) && (
            <div className="section-divider"></div>
          )}

          {/* Блок друзей */}
          {Array.isArray(friends) && friends.length > 0 && (
            <div className="friends-section-grid">
              <h4>Друзья ({friends.length})</h4>
              <div className="friends-grid">
                {friends.slice(0, 6).map((friend) => (
                  <div key={friend.user_id} className="friend-item">
                    <div 
                      className="friend-avatar"
                      style={{
                        backgroundImage: friend.avatar_url 
                          ? `url(${API_BASE_URL}${friend.avatar_url})`
                          : 'none'
                      }}
                    >
                      {!friend.avatar_url && friend.name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="friend-name">{friend.name}</span>
                    <span className={`friend-status ${friend.is_online ? 'online' : 'offline'}`}>
                      {friend.is_online ? 'online' : 'offline'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Сообщение если нет друзей и подписчиков */}
          {(!Array.isArray(friends) || friends.length === 0) && (isOwnProfile && (!Array.isArray(followers) || followers.length === 0)) && (
            <div className="empty-state">
              <p>Пока нет друзей и подписчиков</p>
            </div>
          )}
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

              <div className="modal-detail-item">
                <label>Друзей:</label>
                <span>{Array.isArray(friends) ? friends.length : 0}</span>
              </div>

              <div className="modal-detail-item">
                <label>Подписчиков:</label>
                <span>{Array.isArray(followers) ? followers.length : 0}</span>
              </div>

              <div className="modal-detail-item">
                <label>Дата регистрации:</label>
                <span>{formatDate(user?.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно галереи */}
      {isGalleryModalOpen && (
        <div className="modal-overlay" onClick={closeGalleryModal}>
          <div className="gallery-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Галерея ({galleryCount} фото)</h3>
              <button className="modal-close" onClick={closeGalleryModal}>
                ×
              </button>
            </div>
            <div className="gallery-modal-body">
              {Array.isArray(gallery) && gallery.length > 0 ? (
                <div className="full-gallery-grid">
                  {gallery.map((photo) => (
                    <div 
                      key={photo.gallery_id} 
                      className="gallery-modal-item"
                      onClick={() => openImageModal(photo)}
                    >
                      <img 
                        src={`${API_BASE_URL}${photo.image_url}`} 
                        alt="Фото из галереи"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-gallery">
                  <p>В галерее пока нет фото</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно просмотра изображения */}
      {selectedImage && (
        <div className="modal-overlay" onClick={closeGalleryModal}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <button className="modal-close" onClick={closeGalleryModal}>
                ×
              </button>
            </div>
            <div className="image-modal-body">
              <img 
                src={`${API_BASE_URL}${selectedImage.image_url}`} 
                alt="Просмотр фото"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;