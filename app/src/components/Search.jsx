import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Search.css'; 

const Search = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({
    users: [],
    posts: [],
    chats: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const searchRef = useRef(null);
  const navigate = useNavigate();

  // Закрытие поиска при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Поиск при изменении запроса
  useEffect(() => {
    if (query.trim().length === 0) {
      setResults({ users: [], posts: [], chats: [] });
      return;
    }

    const searchTimeout = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const performSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      // Поиск пользователей
      const usersResponse = await fetch(`http://localhost:5001/api/users/search/${encodeURIComponent(query)}`);
      const usersData = await usersResponse.json();

      // Поиск постов
      const postsResponse = await fetch(`http://localhost:5001/api/posts/search?q=${encodeURIComponent(query)}&user_id=${currentUser.user_id}`);
      const postsData = await postsResponse.json();

      // Поиск чатов
      const chatsResponse = await fetch(`http://localhost:5001/api/chats/search?q=${encodeURIComponent(query)}&user_id=${currentUser.user_id}`);
      const chatsData = await chatsResponse.json();

      setResults({
        users: usersData || [],
        posts: postsData || [],
        chats: chatsData || []
      });
    } catch (error) {
      console.error('Search error:', error);
      setResults({ users: [], posts: [], chats: [] });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserClick = (user) => {
    navigate(`/profile/${user.user_id}`);
    setIsOpen(false);
    setQuery('');
  };

  const handlePostClick = (post) => {
    // Здесь можно добавить навигацию к посту
    console.log('Post clicked:', post);
    setIsOpen(false);
    setQuery('');
  };

  const handleChatClick = (chat) => {
    navigate(`/chat/${chat.chat_id}`);
    setIsOpen(false);
    setQuery('');
  };

  const clearSearch = () => {
    setQuery('');
    setResults({ users: [], posts: [], chats: [] });
    setIsOpen(false);
  };

  const totalResults = results.users.length + results.posts.length + results.chats.length;

  return (
    <div className="search-container" ref={searchRef}>
      <div className="search-input-wrapper">
        <input
          type="text"
          className="header-search-input"
          placeholder="Поиск пользователей, постов, сообщений..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
        />
        {query && (
          <button className="search-clear-btn" onClick={clearSearch}>
            ×
          </button>
        )}
      </div>

      {isOpen && query && (
        <div className="search-results">
          <div className="search-results-header">
            <div className="search-tabs">
              <button
                className={`search-tab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                Все ({totalResults})
              </button>
              <button
                className={`search-tab ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                Люди ({results.users.length})
              </button>
              <button
                className={`search-tab ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                Посты ({results.posts.length})
              </button>
              <button
                className={`search-tab ${activeTab === 'chats' ? 'active' : ''}`}
                onClick={() => setActiveTab('chats')}
              >
                Чаты ({results.chats.length})
              </button>
            </div>
          </div>

          <div className="search-results-content">
            {isLoading ? (
              <div className="search-loading">
                <div className="loading-spinner"></div>
                <span>Поиск...</span>
              </div>
            ) : totalResults === 0 ? (
              <div className="search-empty">
                <span>Ничего не найдено</span>
              </div>
            ) : (
              <>
                {/* Все результаты */}
                {activeTab === 'all' && (
                  <>
                    {results.users.length > 0 && (
                      <div className="search-section">
                        <div className="search-section-title">Люди</div>
                        {results.users.slice(0, 3).map(user => (
                          <div
                            key={user.user_id}
                            className="search-result-item"
                            onClick={() => handleUserClick(user)}
                          >
                            <div className="user-avatar-small">
                              {user.avatar_url ? (
                                <img src={`http://localhost:5001${user.avatar_url}`} alt={user.name} />
                              ) : (
                                <div className="avatar-fallback">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="search-result-info">
                              <div className="search-result-name">{user.name}</div>
                              <div className="search-result-email">{user.email}</div>
                            </div>
                            <div className={`user-status ${user.is_online ? 'online' : 'offline'}`}>
                              {user.is_online ? 'Online' : 'Offline'}
                            </div>
                          </div>
                        ))}
                        {results.users.length > 3 && (
                          <div className="search-show-more">
                            Показать еще {results.users.length - 3} пользователей
                          </div>
                        )}
                      </div>
                    )}

                    {results.posts.length > 0 && (
                      <div className="search-section">
                        <div className="search-section-title">Посты</div>
                        {results.posts.slice(0, 2).map(post => (
                          <div
                            key={post.post_id}
                            className="search-result-item"
                            onClick={() => handlePostClick(post)}
                          >
                            <div className="post-content-preview">
                              <div className="post-author">{post.author_name}</div>
                              <div className="post-text">{post.content.substring(0, 100)}...</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {results.chats.length > 0 && (
                      <div className="search-section">
                        <div className="search-section-title">Чаты</div>
                        {results.chats.slice(0, 2).map(chat => (
                          <div
                            key={chat.chat_id}
                            className="search-result-item"
                            onClick={() => handleChatClick(chat)}
                          >
                            <div className="chat-preview">
                              <div className="chat-name">{chat.chat_name || 'Безымянный чат'}</div>
                              <div className="last-message">{chat.last_message}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Только пользователи */}
                {activeTab === 'users' && results.users.map(user => (
                  <div
                    key={user.user_id}
                    className="search-result-item"
                    onClick={() => handleUserClick(user)}
                  >
                    <div className="user-avatar-small">
                      {user.avatar_url ? (
                        <img src={`http://localhost:5001${user.avatar_url}`} alt={user.name} />
                      ) : (
                        <div className="avatar-fallback">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="search-result-info">
                      <div className="search-result-name">{user.name}</div>
                      <div className="search-result-email">{user.email}</div>
                      {user.bio && (
                        <div className="search-result-bio">{user.bio}</div>
                      )}
                    </div>
                    <div className={`user-status ${user.is_online ? 'online' : 'offline'}`}>
                      {user.is_online ? 'Online' : 'Offline'}
                    </div>
                  </div>
                ))}

                {/* Только посты */}
                {activeTab === 'posts' && results.posts.map(post => (
                  <div
                    key={post.post_id}
                    className="search-result-item post-result"
                    onClick={() => handlePostClick(post)}
                  >
                    <div className="post-author-info">
                      <div className="post-author-avatar">
                        {post.author_avatar ? (
                          <img src={`http://localhost:5001${post.author_avatar}`} alt={post.author_name} />
                        ) : (
                          <div className="avatar-fallback">
                            {post.author_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="post-author-name">{post.author_name}</div>
                    </div>
                    <div className="post-content">
                      {post.content}
                    </div>
                    {post.image_url && (
                      <div className="post-image-preview">
                        <img src={`http://localhost:5001${post.image_url}`} alt="Post" />
                      </div>
                    )}
                    <div className="post-stats">
                      <span>❤️ {post.likes_count}</span>
                      <span>💬 {post.comments_count}</span>
                    </div>
                  </div>
                ))}

                {/* Только чаты */}
                {activeTab === 'chats' && results.chats.map(chat => (
                  <div
                    key={chat.chat_id}
                    className="search-result-item"
                    onClick={() => handleChatClick(chat)}
                  >
                    <div className="chat-avatar">
                      <div className="avatar-fallback">
                        {chat.chat_name ? chat.chat_name.charAt(0).toUpperCase() : 'Ч'}
                      </div>
                    </div>
                    <div className="search-result-info">
                      <div className="search-result-name">
                        {chat.chat_name || chat.participant_names}
                      </div>
                      <div className="last-message">{chat.last_message}</div>
                      <div className="last-message-time">
                        {new Date(chat.last_message_time).toLocaleDateString()}
                      </div>
                    </div>
                    {chat.unread_count > 0 && (
                      <div className="unread-badge">{chat.unread_count}</div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;