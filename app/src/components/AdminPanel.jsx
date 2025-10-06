// AdminPanel.js - полная версия со скроллингом
import React, { useState, useEffect } from 'react';
import './AdminPanel.css';

const AdminPanel = ({ currentUser, onBack }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log(`Загрузка данных для вкладки: ${activeTab}`);
      
      switch (activeTab) {
        case 'users':
          const usersResponse = await fetch('http://localhost:5001/admin/users');
          if (!usersResponse.ok) {
            const errorData = await usersResponse.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(`Ошибка загрузки пользователей: ${usersResponse.status} - ${errorData.error}`);
          }
          const usersData = await usersResponse.json();
          console.log('Загружены пользователи:', usersData.length);
          setUsers(usersData);
          break;
          
        case 'posts':
          const postsResponse = await fetch('http://localhost:5001/admin/posts-simple');
          if (!postsResponse.ok) {
            const fallbackResponse = await fetch('http://localhost:5001/admin/posts?limit=100');
            if (!fallbackResponse.ok) {
              const errorData = await fallbackResponse.json().catch(() => ({ error: 'Unknown error' }));
              throw new Error(`Ошибка загрузки постов: ${fallbackResponse.status} - ${errorData.error}`);
            }
            const fallbackData = await fallbackResponse.json();
            console.log('Загружены посты через fallback:', fallbackData.length);
            setPosts(Array.isArray(fallbackData) ? fallbackData : []);
          } else {
            const postsData = await postsResponse.json();
            console.log('Загружены посты через simplified:', postsData.length);
            setPosts(Array.isArray(postsData) ? postsData : []);
          }
          break;
          
        case 'statistics':
          const statsResponse = await fetch('http://localhost:5001/admin/statistics');
          if (!statsResponse.ok) {
            const errorData = await statsResponse.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(`Ошибка загрузки статистики: ${statsResponse.status} - ${errorData.error}`);
          }
          const statsData = await statsResponse.json();
          console.log('Загружена статистика:', statsData);
          setStatistics(statsData);
          break;
          
        default:
          break;
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5001/admin/users/${userId}?current_user_id=${currentUser.user_id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setUsers(users.filter(user => user.user_id !== userId));
        alert('Пользователь успешно удален');
      } else {
        alert(`Ошибка при удалении пользователя: ${result.error}`);
      }
    } catch (error) {
      console.error('Ошибка удаления пользователя:', error);
      alert(`Ошибка при удалении пользователя: ${error.message}`);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот пост?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5001/admin/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();

      if (response.ok) {
        setPosts(posts.filter(post => post.post_id !== postId));
        alert('Пост успешно удален');
      } else {
        alert(`Ошибка при удалении поста: ${result.error}`);
      }
    } catch (error) {
      console.error('Ошибка удаления поста:', error);
      alert('Ошибка при удалении поста');
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const response = await fetch(`http://localhost:5001/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      const result = await response.json();

      if (response.ok) {
        setUsers(users.map(user => 
          user.user_id === userId 
            ? { ...user, is_active: !currentStatus }
            : user
        ));
        alert('Статус пользователя обновлен');
      } else {
        alert(`Ошибка при обновлении статуса: ${result.error}`);
      }
    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
      alert('Ошибка при обновлении статуса пользователя');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    try {
      return new Date(dateString).toLocaleString('ru-RU');
    } catch {
      return 'Неверная дата';
    }
  };

  const renderUsersTab = () => (
    <div className="admin-section">
      <h3>Управление пользователями</h3>
      {users.length === 0 ? (
        <div className="empty-state">
          <p>Пользователи не найдены</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Активен</th>
                <th>Подтвержден</th>
                <th>Дата регистрации</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.user_id}>
                  <td>{user.user_id}</td>
                  <td>
                    <div className="user-info">
                      <div className="user-name">{user.name || 'Не указано'}</div>
                      {user.nick && <div className="user-nick">@{user.nick}</div>}
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge ${user.role}`}>
                      {user.role === 'admin' ? 'Админ' : 'Пользователь'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${user.is_online ? 'online' : 'offline'}`}>
                      {user.is_online ? 'Онлайн' : 'Офлайн'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                      {user.is_active ? 'Активен' : 'Заблокирован'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${user.is_confirmed ? 'confirmed' : 'not-confirmed'}`}>
                      {user.is_confirmed ? 'Да' : 'Нет'}
                    </span>
                  </td>
                  <td>{formatDate(user.created_at)}</td>
                  <td className="actions">
                    {user.user_id !== currentUser.user_id && (
                      <>
                        <button
                          onClick={() => handleToggleUserStatus(user.user_id, user.is_active)}
                          className={`btn ${user.is_active ? 'btn-warning' : 'btn-success'}`}
                        >
                          {user.is_active ? 'Заблокировать' : 'Разблокировать'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.user_id)}
                          className="btn-danger"
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderPostsTab = () => (
    <div className="admin-section">
      <h3>Управление постами</h3>
      {posts.length === 0 ? (
        <div className="empty-state">
          <p>Посты не найдены</p>
          <button onClick={loadData} className="btn-refresh">
            Попробовать снова
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Заголовок</th>
                <th>Содержание</th>
                <th>Автор</th>
                <th>Лайки</th>
                <th>Комментарии</th>
                <th>Публичный</th>
                <th>Опубликован</th>
                <th>Дата создания</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.post_id}>
                  <td>{post.post_id}</td>
                  <td className="post-title">{post.title || 'Без заголовка'}</td>
                  <td className="post-content">
                    {post.content ? (
                      <div title={post.content}>
                        {post.content.length > 50 ? `${post.content.substring(0, 50)}...` : post.content}
                      </div>
                    ) : 'Нет содержания'}
                  </td>
                  <td>
                    <div className="author-info">
                      <div>{post.author_name || 'Неизвестно'}</div>
                      <div className="author-email">{post.author_email}</div>
                    </div>
                  </td>
                  <td>{post.likes_count || 0}</td>
                  <td>{post.comments_count || 0}</td>
                  <td>
                    <span className={`status-badge ${post.is_public ? 'active' : 'inactive'}`}>
                      {post.is_public ? 'Да' : 'Нет'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${post.is_published ? 'active' : 'inactive'}`}>
                      {post.is_published ? 'Да' : 'Нет'}
                    </span>
                  </td>
                  <td>{formatDate(post.created_at)}</td>
                  <td className="actions">
                    <button
                      onClick={() => handleDeletePost(post.post_id)}
                      className="btn-danger"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderStatisticsTab = () => (
    <div className="admin-section">
      <h3>Статистика системы</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <h4>Всего пользователей</h4>
          <div className="stat-number">{statistics.totalUsers || 0}</div>
        </div>
        <div className="stat-card">
          <h4>Всего постов</h4>
          <div className="stat-number">{statistics.totalPosts || 0}</div>
        </div>
        <div className="stat-card">
          <h4>Активных чатов</h4>
          <div className="stat-number">{statistics.activeChats || 0}</div>
        </div>
        <div className="stat-card">
          <h4>Онлайн пользователей</h4>
          <div className="stat-number">{statistics.onlineUsers || 0}</div>
        </div>
        <div className="stat-card">
          <h4>Новых пользователей (неделя)</h4>
          <div className="stat-number">{statistics.newUsers || 0}</div>
        </div>
        <div className="stat-card">
          <h4>Новых постов (неделя)</h4>
          <div className="stat-number">{statistics.newPosts || 0}</div>
        </div>
      </div>
      
      <div className="recent-activity">
        <h4>Последние действия</h4>
        {statistics.recentActivity && statistics.recentActivity.length > 0 ? (
          <ul className="activity-list">
            {statistics.recentActivity.map((activity, index) => (
              <li key={index} className="activity-item">
                <span className={`activity-type ${activity.type}`}>
                  {activity.type === 'post' ? '📝' : activity.type === 'user' ? '👤' : '💬'}
                  {activity.type}
                </span>
                <span className="activity-details">{activity.details}</span>
                <span className="activity-time">{formatDate(activity.timestamp)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Нет данных о последних действиях</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>⚙️ Панель администратора</h2>
        <div className="header-actions">
          <button onClick={loadData} className="btn-refresh" disabled={loading}>
            {loading ? '🔄 Загрузка...' : '🔄 Обновить'}
          </button>
          <button onClick={onBack} className="btn-back">
            ← Назад к приложению
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Пользователи
        </button>
        <button
          className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          📝 Посты
        </button>
        <button
          className={`tab-btn ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          📊 Статистика
        </button>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            Загрузка данных...
          </div>
        ) : (
          <>
            {activeTab === 'users' && renderUsersTab()}
            {activeTab === 'posts' && renderPostsTab()}
            {activeTab === 'statistics' && renderStatisticsTab()}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;