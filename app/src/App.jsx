import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import ChatSelector from './components/ChatSelector';
import Messenger from './components/Messenger';
import Feed from './components/Feed';
import Notifications from './components/Notifications';
import Friends from './components/Friends';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';
import Search from './components/Search';
import Fon from '../public/фон.png';
import Logo from '../public/Лого.png'
import Friend from '../public/friend.png';
import Chat from '../public/chat.png';
import Lenta from '../public/lenta.png';
import Prof from '../public/Profile.png';
import Setting from '../public/settings.png';
import Notification from '../public/nofications.png';
import './App.css';

// Компонент для основной части приложения после авторизации
function MainApp({ currentUser, activeTab, setActiveTab, sidebarOpen, setSidebarOpen, handleLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userAvatar, setUserAvatar] = useState(null);
  const [profileUserId, setProfileUserId] = useState(null); // Новое состояние для просмотра профилей других пользователей

  // Загружаем аватар пользователя
  useEffect(() => {
    if (currentUser?.user_id) {
      loadUserAvatar();
    }
  }, [currentUser]);

  // Синхронизация активной вкладки с текущим маршрутом
  useEffect(() => {
    const path = location.pathname;
    if (path === '/' || path === '/feed') setActiveTab('feed');
    else if (path === '/chats' || path.startsWith('/chat/')) setActiveTab('messenger');
    else if (path === '/friends') setActiveTab('friends');
    else if (path === '/notifications') setActiveTab('notifications');
    else if (path === '/profile' || path.startsWith('/profile/')) setActiveTab('profile');
    else if (path === '/admin') setActiveTab('admin');
  }, [location.pathname, setActiveTab]);

  // Обработчик для просмотра профилей других пользователей
  const handleViewProfile = (userId) => {
    setProfileUserId(userId);
    navigate(`/profile/${userId}`);
    setActiveTab('profile');
    setSidebarOpen(false);
  };

  // Обработчик для возврата к своему профилю
  const handleViewMyProfile = () => {
    setProfileUserId(null);
    navigate('/profile');
    setActiveTab('profile');
    setSidebarOpen(false);
  };

  const loadUserAvatar = async () => {
    try {
      const response = await fetch(`http://localhost:5001/api/users/${currentUser.user_id}/avatar`);
      if (response.ok) {
        // Если аватар существует, устанавливаем URL
        setUserAvatar(`http://localhost:5001/api/users/${currentUser.user_id}/avatar?t=${Date.now()}`);
      } else {
        // Если аватар не найден, используем заглушку
        setUserAvatar(null);
      }
    } catch (error) {
      console.error('Ошибка загрузки аватара:', error);
      setUserAvatar(null);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    setProfileUserId(null); // Сбрасываем просмотр чужого профиля при смене вкладки
    
    // Навигация по маршрутам
    switch (tab) {
      case 'feed':
        navigate('/');
        break;
      case 'messenger':
        navigate('/chats');
        break;
      case 'friends':
        navigate('/friends');
        break;
      case 'notifications':
        navigate('/notifications');
        break;
      case 'profile':
        navigate('/profile');
        break;
      case 'admin':
        navigate('/admin');
        break;
      default:
        navigate('/');
    }
  };

  // Функция для отображения аватара
  const renderAvatar = () => {
    if (userAvatar) {
      return (
        <img 
          src={userAvatar} 
          alt="Аватар" 
          className="user-avatar-image"
          onError={(e) => {
            // Если изображение не загружается, показываем заглушку
            e.target.style.display = 'none';
          }}
        />
      );
    }
    
    return (
      <div className="user-avatar-fallback">
        {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
      </div>
    );
  };

  return (
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
                <img className="logo-large" src={Logo} alt="Логотип" />
              </a>
            </div>
            <div className="header-search">
              <Search currentUser={currentUser} />
              <button className="notification-btn" title="Уведомления">
                <img className="notification-icon-image" src={Notification} alt="" />
              </button>
            </div>
          </div>

          <div className="header-actions">
            <div className="user-menu">
              <div className="user-item">
                <div className="user-avatar" onClick={handleViewMyProfile} style={{ cursor: 'pointer' }}>
                  {renderAvatar()}
                </div>
                <div className="user-info" onClick={handleViewMyProfile} style={{ cursor: 'pointer' }}>
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
            className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={handleViewMyProfile}
          >
            <span className="sidebar-icon"><img src={Prof} alt="" /></span>
            <span className="sidebar-label">Профиль</span>
          </button>
        </nav>
      </aside>

      {/* Основной контент с маршрутизацией */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Feed currentUser={currentUser} />} />
          <Route path="/feed" element={<Feed currentUser={currentUser} />} />
          <Route path="/chats" element={<ChatSelector currentUser={currentUser} />} />
          <Route path="/chat/:chatId" element={<Messenger currentUser={currentUser} />} />
          <Route 
            path="/friends" 
            element={
              <Friends 
                currentUserId={currentUser.user_id} 
                onViewProfile={handleViewProfile} 
              />
            } 
          />
          <Route path="/notifications" element={<Notifications currentUser={currentUser} />} />
          <Route 
            path="/profile" 
            element={
              <Profile 
                currentUser={currentUser} 
              />
            } 
          />
          <Route 
            path="/profile/:userId" 
            element={
              <Profile 
                currentUser={currentUser} 
              />
            } 
          />
          <Route 
            path="/admin" 
            element={
              currentUser.role === 'admin' 
                ? <AdminPanel currentUser={currentUser} /> 
                : <Navigate to="/" replace />
            } 
          />
          {/* Резервный маршрут для несуществующих страниц */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

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
      localStorage.removeItem('currentUser');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (user) => {
    console.log('User logged in:', user);
    setCurrentUser(user);
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
    setActiveTab('feed');
    if (socket) {
      socket.disconnect();
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
    <Router>
      <div className="App">
        {/* Фон без размытия */}
        <div className="background-overlay">
          <div className="background-image"></div>
          <div className="background-gradient"></div>
        </div>
        
        <Routes>
          {/* Маршруты для неавторизованных пользователей */}
          <Route 
            path="*" 
            element={
              currentUser ? (
                <MainApp 
                  currentUser={currentUser}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  sidebarOpen={sidebarOpen}
                  setSidebarOpen={setSidebarOpen}
                  handleLogout={handleLogout}
                />
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
              )
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;