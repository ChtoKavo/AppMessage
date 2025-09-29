import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import Messenger from './components/Messenger';
import Feed from './components/Feed';
import Notifications from './components/Notifications';
import Friends from './components/Friends';
import Profile from './components/Profile';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);

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
    if (socket) {
      socket.disconnect();
    }
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
      {currentUser ? (
        <div className="app-container">
          <header className="app-header">
            <div className="header-content">
              <h1>Социальная сеть</h1>
              <div className="user-info">
                <span className="welcome-text">Привет, {currentUser.name}</span>
                <button onClick={handleLogout} className="logout-button">
                  Выйти
                </button>
              </div>
            </div>
          </header>

          <div className="app-main">
            <nav className="app-nav">
              <button 
                className={`nav-btn ${activeTab === 'feed' ? 'active' : ''}`}
                onClick={() => setActiveTab('feed')}
              >
                📰 Лента
              </button>
              <button 
                className={`nav-btn ${activeTab === 'messenger' ? 'active' : ''}`}
                onClick={() => setActiveTab('messenger')}
              >
                💬 Мессенджер
              </button>
              <button 
                className={`nav-btn ${activeTab === 'friends' ? 'active' : ''}`}
                onClick={() => setActiveTab('friends')}
              >
                👥 Друзья
              </button>
              <button 
                className={`nav-btn ${activeTab === 'notifications' ? 'active' : ''}`}
                onClick={() => setActiveTab('notifications')}
              >
                🔔 Уведомления
              </button>
              <button 
                className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                👤 Профиль
              </button>
            </nav>

            <main className="app-content">
              {renderContent()}
            </main>
          </div>
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