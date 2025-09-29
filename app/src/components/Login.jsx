
import React, { useState } from 'react';


const Login = ({ onLogin, onSwitchToRegister }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = 'http://localhost:5001';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');

    try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

       const data = await response.json();
    console.log('Login response:', data); // Для отладки

    if (response.ok) {
      // Сервер возвращает данные пользователя напрямую, а не в свойстве user
      if (data && data.user_id && data.name && data.email) {
        onLogin(data);
      } else {
        throw new Error('Некорректные данные пользователя в ответе сервера');
      }
    } else {
      setError(data.error || 'Ошибка входа');
    }
  } catch (error) {
    console.error('Ошибка входа:', error);
    setError(error.message || 'Ошибка соединения с сервером');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="auth-container">
      <div className="auth-form">
        <div className="auth-header">
          <h2>Вход в мессенджер</h2>
          <p>Войдите в свой аккаунт</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Введите ваш email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Введите ваш пароль"
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="auth-switch">
          <p>Нет аккаунта? 
            <span 
              className="switch-link" 
              onClick={onSwitchToRegister}
            >
              Зарегистрироваться
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;