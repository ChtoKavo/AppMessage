import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import Messenger from './components/Messenger';
import Feed from './components/Feed';
import Notifications from './components/Notifications';
import Friends from './components/Friends';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';
import Fon from '../public/фон.png'
import Logo from '../public/Лого.png'
import Friend from '../public/friend.png'
import Chat from '../public/chat.png'
import Lenta from '../public/lenta.png'
import Prof from '../public/Profile.png'
import Setting from '../public/settings.png'
import Notification from '../public/nofications.png';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  const loadUserFromStorage = () => {
    try {
      const savedUser = localStorage.getItem('currentUser');
      console.log('Saved user from localStorage:', savedUser);
      
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        console.log('Parsed user:', parsedUser);
        setCurrentUser(parsedUser);
      }
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      // Очищаем поврежденные данные
      localStorage.removeItem('currentUser');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (user) => {
    console.log('User logged in:', user);
    setCurrentUser(user);
    // Сохраняем только необходимые данные пользователя
    const userToSave = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    localStorage.setItem('currentUser', JSON.stringify(userToSave));
  };

  const handleRegister = (user) => {
    console.log('User registered:', user);
    setCurrentUser(user);
    const userToSave = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    localStorage.setItem('currentUser', JSON.stringify(userToSave));
  };

  const handleLogout = () => {
    console.log('Logging out...');
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setShowAdminPanel(false);
    setSidebarOpen(false);
    if (socket) {
      socket.disconnect();
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false); // Закрываем боковое меню при выборе раздела
  };

  const renderContent = () => {
    if (!currentUser) return null;

    switch (activeTab) {
      case 'feed':
        return <Feed currentUser={currentUser} socket={socket} />;
      case 'messenger':
        return <Messenger currentUser={currentUser} socket={socket} />;
      case 'friends':
        return <Friends currentUser={currentUser} socket={socket} />;
      case 'notifications':
        return <Notifications currentUser={currentUser} socket={socket} />;
      case 'profile':
        return <Profile currentUser={currentUser} />;
      case 'admin':
        return <AdminPanel currentUser={currentUser} onBack={() => setActiveTab('feed')} />;
      default:
        return <Feed currentUser={currentUser} socket={socket} />;
    }
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="App">
      {/* Фон без размытия */}
      <div className="background-overlay">
        <div className="background-image"></div>
        <div className="background-gradient"></div>
      </div>
      
      {currentUser ? (
        <div className="app-container">
          {/* Упрощенная шапка */}
          <header className="main-header">
            <div className="header-container">
              <div className="header-left">
                <button 
                  className="sidebar-toggle"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  <span className="toggle-icon">☰</span>
                  <span className="toggle-text">Меню</span>
                </button>
                <div className="header-brand">
                  <a href="#" className="logo">
                    <div className="logo-icon"><img src={Logo} alt="" /></div>
                    <span className="logo-text">Chill Out</span>
                  </a>
                </div>
              </div>

              <div className="header-actions">
                <div className="user-menu">
                  <div className="user-item">
                    <div className="user-avatar">
                      {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{currentUser.name}</div>
                      <div className="user-role">{currentUser.role}</div>
                    </div>
                  </div>
                  
                  {currentUser.role === 'admin' && (
                    <button 
                      className={`admin-btn ${activeTab === 'admin' ? 'active' : ''}`}
                      onClick={() => handleTabChange('admin')}
                    >
                      <span className="admin-icon"><img src={Setting} alt="" /></span>
                      <span>Админ</span>
                    </button>
                  )}

                  <button onClick={handleLogout} className="logout-btn">
                    <span className="logout-icon">🚪</span>
                    <span>Выйти</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Боковое меню как отдельное окно */}
          <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} 
               onClick={() => setSidebarOpen(false)}>
          </div>
          
          <aside className={`sidebar ${sidebarOpen ? 'active' : ''}`}>
            <div className="sidebar-header">
              <h3>Навигация</h3>
              <button 
                className="sidebar-close"
                onClick={() => setSidebarOpen(false)}
              >
                ×
              </button>
            </div>
            
            <nav className="sidebar-nav">
              <button 
                className={`sidebar-item ${activeTab === 'feed' ? 'active' : ''}`}
                onClick={() => handleTabChange('feed')}
              >
                <span className="sidebar-icon"><img src={Lenta} alt="" /></span>
                <span className="sidebar-label">Лента</span>
              </button>
              <button 
                className={`sidebar-item ${activeTab === 'messenger' ? 'active' : ''}`}
                onClick={() => handleTabChange('messenger')}
              >
                <span className="sidebar-icon"><img src={Chat} alt="" /></span>
                <span className="sidebar-label">Мессенджер</span>
              </button>
              <button 
                className={`sidebar-item ${activeTab === 'friends' ? 'active' : ''}`}
                onClick={() => handleTabChange('friends')}
              >
                <span className="sidebar-icon"><img src={Friend} alt="" /></span>
                <span className="sidebar-label">Друзья</span>
              </button>
              <button 
                className={`sidebar-item ${activeTab === 'notifications' ? 'active' : ''}`}
                onClick={() => handleTabChange('notifications')}
              >
                <span className="sidebar-icon"><img src={Notification} alt="" /></span>
                <span className="sidebar-label">Уведомления</span>
              </button>
              <button 
                className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => handleTabChange('profile')}
              >
                <span className="sidebar-icon"><img src={Prof} alt="" /></span>
                <span className="sidebar-label">Профиль</span>
              </button>
            </nav>
          </aside>

          {/* Основной контент */}
          <main className="main-content">
            {renderContent()}
          </main>
        </div>
      ) : showRegister ? (
        <Register 
          onRegister={handleRegister} 
          onSwitchToLogin={() => setShowRegister(false)}
        />
      ) : (
        <Login 
          onLogin={handleLogin} 
          onSwitchToRegister={() => setShowRegister(true)}
        />
      )}
    </div>
  );
}

export default App;