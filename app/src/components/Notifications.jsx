// components/Notifications.jsx
import React, { useState, useEffect } from 'react';
import './Notifications.css';

const Notifications = ({ currentUser, socket }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const API_BASE_URL = 'http://localhost:5001';

  useEffect(() => {
    loadNotifications();
    
    if (socket) {
      socket.on('new_notification', handleNewNotification);
      socket.on('new_friend_request', handleFriendRequest);
    }

    return () => {
      if (socket) {
        socket.off('new_notification', handleNewNotification);
        socket.off('new_friend_request', handleFriendRequest);
      }
    };
  }, [socket, currentUser]);

  const loadNotifications = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/users/${currentUser.user_id}/notifications`
      );
      const data = await response.json();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
    }
  };

  const handleNewNotification = (notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  const handleFriendRequest = (request) => {
    // Обработка запроса дружбы
  };

  const markAsRead = async (notificationId) => {
    try {
      await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      setNotifications(prev =>
        prev.map(n =>
          n.notification_id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Ошибка отметки уведомления:', error);
    }
  };

  const getNotificationText = (notification) => {
    const texts = {
      like: `${notification.from_user_name} понравился ваш пост`,
      comment: `${notification.from_user_name} прокомментировал ваш пост`,
      friend_request: `${notification.from_user_name} отправил запрос дружбы`,
      friend_accept: `${notification.from_user_name} принял запрос дружбы`
    };
    return texts[notification.type] || 'Новое уведомление';
  };

  return (
    <div className="notifications">
      <div className="notifications-header">
        <h3>Уведомления</h3>
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
      </div>

      <div className="notifications-list">
        {notifications.map(notification => (
          <div
            key={notification.notification_id}
            className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
            onClick={() => markAsRead(notification.notification_id)}
          >
            <div className="notification-avatar">
              {notification.from_user_name?.charAt(0).toUpperCase()}
            </div>
            <div className="notification-content">
              <p>{getNotificationText(notification)}</p>
              <span className="notification-time">
                {new Date(notification.created_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        
        {notifications.length === 0 && (
          <div className="no-notifications">
            <p>Уведомлений пока нет</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;