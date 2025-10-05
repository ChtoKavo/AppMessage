// components/Feed.jsx
import React, { useState, useEffect } from 'react';
import './Feed.css';

const Feed = ({ currentUser, socket }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newPost, setNewPost] = useState({ content: '', image: null });
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [error, setError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);

  const API_BASE_URL = 'http://localhost:5001';

  useEffect(() => {
    if (currentUser) {
      loadPosts();
    }
  }, [currentUser]);

  // В компоненте Feed
useEffect(() => {
  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5001/api/posts?user_id=${currentUser.user_id}`);
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      } else {
        console.error('Failed to fetch posts');
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  fetchPosts();
}, [currentUser.user_id]);

  useEffect(() => {
    if (socket) {
      console.log('Socket connected in Feed component:', socket.connected);
      setSocketConnected(socket.connected);

      // Слушаем события WebSocket
      socket.on('connect', () => {
        console.log('Socket connected in Feed');
        setSocketConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected in Feed');
        setSocketConnected(false);
      });

      // Слушаем события лайков
      socket.on('post_liked', handlePostLiked);
      socket.on('post_unliked', handlePostUnliked);
      socket.on('like_error', handleLikeError);
      
      return () => {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('post_liked', handlePostLiked);
        socket.off('post_unliked', handlePostUnliked);
        socket.off('like_error', handleLikeError);
      };
    }
  }, [socket]);

  const loadPosts = async () => {
  try {
    setLoading(true);
    setError('');
    
    // Формируем URL с параметрами
    const url = new URL(`${API_BASE_URL}/api/posts`);
    if (currentUser && currentUser.user_id) {
      url.searchParams.append('user_id', currentUser.user_id.toString());
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Ошибка загрузки постов: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Убеждаемся, что data - массив
    if (Array.isArray(data)) {
      setPosts(data);
    } else {
      console.error('Полученные данные не являются массивом:', data);
      setPosts([]);
      setError('Ошибка формата данных');
    }
  } catch (error) {
    console.error('Ошибка загрузки постов:', error);
    setError('Не удалось загрузить посты');
    setPosts([]);
  } finally {
    setLoading(false);
  }
};

  // Обработчики WebSocket событий для лайков
  const handlePostLiked = (data) => {
    console.log('Post liked:', data);
    setPosts(prev => prev.map(post => {
      if (post.post_id === data.post_id) {
        return {
          ...post,
          is_liked: true,
          likes_count: (post.likes_count || 0) + 1
        };
      }
      return post;
    }));
  };

  const handlePostUnliked = (data) => {
    console.log('Post unliked:', data);
    setPosts(prev => prev.map(post => {
      if (post.post_id === data.post_id) {
        return {
          ...post,
          is_liked: false,
          likes_count: Math.max(0, (post.likes_count || 1) - 1)
        };
      }
      return post;
    }));
  };

  const handleLikeError = (errorData) => {
    console.error('Like error:', errorData);
    setError(errorData.error || 'Ошибка при лайке');
    // Откатываем оптимистичное обновление
    loadPosts(); // Перезагружаем посты для синхронизации
  };

  const createPost = async (e) => {
    e.preventDefault();
    if (!newPost.content.trim()) {
      setError('Введите текст поста');
      return;
    }

    try {
      setError('');
      const formData = new FormData();
formData.append('user_id', currentUser.user_id.toString());
formData.append('title', newPost.content.substring(0, 100));
formData.append('content', newPost.content);
formData.append('is_public', '1');
formData.append('category_id', '1'); 
      
      if (newPost.image) {
        formData.append('media', newPost.image);
      }

      const response = await fetch(`${API_BASE_URL}/api/posts`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка создания поста');
      }

      const post = await response.json();
      
      // Добавляем флаг is_liked для нового поста
      const postWithLike = { ...post, is_liked: false, likes_count: 0, comments_count: 0 };
      
      setPosts(prev => [postWithLike, ...prev]);
      setNewPost({ content: '', image: null });
      setShowCreatePost(false);
      setError('');
      
    } catch (error) {
      console.error('Ошибка создания поста:', error);
      setError(error.message || 'Не удалось создать пост');
    }
  };

  const handleLike = async (postId) => {
    console.log('Like clicked for post:', postId);
    console.log('Socket connected:', socketConnected);
    console.log('Socket object:', socket);

    if (!socket || !socketConnected) {
      // Альтернативный способ через REST API
      try {
        const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: currentUser.user_id
          })
        });

        if (response.ok) {
          const result = await response.json();
          // Обновляем состояние на основе ответа
          setPosts(prev => prev.map(post => {
            if (post.post_id === postId) {
              return {
                ...post,
                is_liked: result.is_liked,
                likes_count: result.likes_count
              };
            }
            return post;
          }));
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Ошибка лайка');
        }
      } catch (error) {
        console.error('Ошибка лайка через REST:', error);
        setError(`Ошибка: ${error.message}`);
        // Откатываем оптимистичное обновление
        loadPosts();
      }
      return;
    }

    try {
      // Оптимистичное обновление
      setPosts(prev => prev.map(post => {
        if (post.post_id === postId) {
          const wasLiked = post.is_liked;
          return {
            ...post,
            is_liked: !wasLiked,
            likes_count: wasLiked ? 
              Math.max(0, (post.likes_count || 1) - 1) : 
              (post.likes_count || 0) + 1
          };
        }
        return post;
      }));

      socket.emit('like_post', {
        post_id: postId,
        user_id: currentUser.user_id
      });

    } catch (error) {
      console.error('Ошибка отправки лайка через WebSocket:', error);
      setError('Не удалось поставить лайк');
      // Откатываем оптимистичное обновление
      loadPosts();
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверяем размер файла (максимум 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Размер файла не должен превышать 5MB');
        return;
      }
      
      // Проверяем тип файла
      if (!file.type.startsWith('image/')) {
        setError('Пожалуйста, выберите изображение');
        return;
      }
      
      setNewPost(prev => ({ ...prev, image: file }));
      setError('');
    }
  };

  const removeImage = () => {
    setNewPost(prev => ({ ...prev, image: null }));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} д назад`;
    
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="feed">
      <div className="feed-header">
        <h2>Лента новостей</h2>
        <div className="header-actions">
          {!socketConnected && (
            <span className="connection-warning">(REST режим)</span>
          )}
          <button 
            className="create-post-btn"
            onClick={() => setShowCreatePost(true)}
          >
            📝 Создать пост
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {showCreatePost && (
        <div className="create-post-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Создать пост</h3>
              <button 
                className="close-modal"
                onClick={() => {
                  setShowCreatePost(false);
                  setNewPost({ content: '', image: null });
                  setError('');
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={createPost}>
              <textarea
                value={newPost.content}
                onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                placeholder="Что у вас нового?"
                rows="4"
                maxLength="1000"
                className="post-textarea"
              />
              
              <div className="char-count">
                {newPost.content.length}/1000
              </div>

              {newPost.image && (
                <div className="image-preview">
                  <img 
                    src={URL.createObjectURL(newPost.image)} 
                    alt="Preview" 
                    className="preview-image"
                  />
                  <button 
                    type="button" 
                    className="remove-image-btn"
                    onClick={removeImage}
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="post-actions">
                <div className="action-buttons">
                  <label htmlFor="image-upload" className="file-upload-btn">
                    📷 Фото
                  </label>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                </div>
                
                <div className="modal-buttons">
                  <button 
                    type="button" 
                    className="cancel-btn"
                    onClick={() => {
                      setShowCreatePost(false);
                      setNewPost({ content: '', image: null });
                      setError('');
                    }}
                  >
                    Отмена
                  </button>
                  <button 
                    type="submit" 
                    className="submit-btn"
                    disabled={!newPost.content.trim()}
                  >
                    Опубликовать
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="posts-list">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            Загрузка постов...
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📰</div>
            <h3>Пока нет постов</h3>
            <p>Будьте первым, кто поделится новостью!</p>
            <button 
              className="create-first-post-btn"
              onClick={() => setShowCreatePost(true)}
            >
              Создать первый пост
            </button>
          </div>
        ) : (
          posts.map(post => (
            <PostItem 
              key={post.post_id} 
              post={post} 
              currentUser={currentUser}
              onLike={handleLike}
              formatDate={formatDate}
              socketConnected={socketConnected}
            />
          ))
        )}
      </div>
    </div>
  );
};

const PostItem = ({ post, currentUser, onLike, formatDate, socketConnected }) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const API_BASE_URL = 'http://localhost:5001';

  const loadComments = async () => {
    if (comments.length > 0) {
      setShowComments(!showComments);
      return;
    }

    try {
      setLoadingComments(true);
      const response = await fetch(
        `${API_BASE_URL}/api/posts/${post.post_id}/comments?user_id=${currentUser.user_id}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setComments(Array.isArray(data) ? data : []);
        setShowComments(true);
      }
    } catch (error) {
      console.error('Ошибка загрузки комментариев:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;

    try {
      // В реальном приложении здесь будет вызов API через WebSocket
      const tempComment = {
        comment_id: Date.now(), // временный ID
        post_id: post.post_id,
        user_id: currentUser.user_id,
        user_name: currentUser.name,
        content: newComment,
        created_at: new Date().toISOString(),
        is_own: true
      };

      setComments(prev => [...prev, tempComment]);
      setNewComment('');

      // Здесь можно добавить вызов socket.emit для отправки комментария
      console.log('Отправка комментария:', newComment);
      
    } catch (error) {
      console.error('Ошибка добавления комментария:', error);
    }
  };

  const handleCommentKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addComment();
    }
  };

  return (
    <div className="post-item">
      <div className="post-header">
        <div className="post-author">
          <div className="author-avatar">
            {post.author_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="author-info">
            <strong>{post.author_name || 'Неизвестный пользователь'}</strong>
            <span>{formatDate(post.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="post-content">
        <p>{post.content}</p>
        {post.image_url && (
          <img 
            src={`http://localhost:5001${post.image_url}`} 
            alt="Post media" 
            className="post-image" 
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        )}
      </div>

      <div className="post-stats">
        <span className="stat">{post.likes_count || 0} лайков</span>
        <span className="stat">{post.comments_count || 0} комментариев</span>
      </div>

      <div className="post-actions">
        <button 
          className={`like-btn ${post.is_liked ? 'liked' : ''}`}
          onClick={() => onLike(post.post_id)}
          title={socketConnected ? '' : 'Используется REST API'}
        >
          {post.is_liked ? '❤️' : '🤍'} 
          {post.is_liked ? 'Не нравится' : 'Нравится'}
        </button>
        <button 
          className="comment-btn"
          onClick={loadComments}
          disabled={loadingComments}
        >
          {loadingComments ? '...' : '💬 Комментировать'}
        </button>
        <button className="share-btn">
          🔄 Поделиться
        </button>
      </div>

      {showComments && (
        <div className="post-comments">
          <div className="add-comment">
            <div className="comment-avatar">
              {currentUser.name?.charAt(0).toUpperCase()}
            </div>
            <div className="comment-input-container">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={handleCommentKeyPress}
                placeholder="Напишите комментарий..."
                className="comment-input"
              />
              <button 
                onClick={addComment}
                disabled={!newComment.trim()}
                className="send-comment-btn"
              >
                Отправить
              </button>
            </div>
          </div>
          
          <div className="comments-list">
            {comments.length === 0 ? (
              <div className="no-comments">
                <p>Пока нет комментариев</p>
              </div>
            ) : (
              comments.map(comment => (
                <div key={comment.comment_id} className="comment">
                  <div className="comment-avatar small">
                    {comment.user_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="comment-content">
                    <div className="comment-header">
                      <strong>{comment.user_name}</strong>
                      <span className="comment-time">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    <p>{comment.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Feed;