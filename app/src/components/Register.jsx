
import React, { useState } from 'react';


const Register = ({ onRegister, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
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
  setError('');

     // Валидация
  if (formData.password !== formData.confirmPassword) {
    setError('Пароли не совпадают');
    return;
  }

  if (formData.password.length < 6) {
    setError('Пароль должен содержать минимум 6 символов');
    return;
  }

  setLoading(true);

     try {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: formData.name,
        email: formData.email,
        password: formData.password
      })
    });

      const data = await response.json();
    console.log('Register response:', data); // Для отладки

    if (response.ok) {
      // Сервер возвращает данные пользователя напрямую
      if (data && data.user_id && data.name && data.email) {
        onRegister(data);
      } else {
        throw new Error('Некорректные данные пользователя в ответе сервера');
      }
    } else {
      setError(data.error || 'Ошибка регистрации');
    }
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    setError('Ошибка соединения с сервером');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Регистрация</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Имя:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Введите ваше имя"
            />
          </div>

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
              placeholder="Введите пароль (мин. 6 символов)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Подтвердите пароль:</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Повторите пароль"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="switch-auth">
          <p>Уже есть аккаунт? 
            <span 
              className="switch-link" 
              onClick={onSwitchToLogin}
            >
              Войти
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;