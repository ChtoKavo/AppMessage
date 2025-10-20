import React, { useState } from 'react';
import './Login.css';

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

      if (response.ok) {
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
    <div className="login-container">
      <div className="login-background">
        <div className="sphere-12">
          <div className="sphere-content">
            <div className="login-title">Вход</div>
            <div className="login-form">
              <form onSubmit={handleSubmit} className="form-login">
                <div className="form-group">
                  <input
                    className='inputlol'
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="Введите ваш email*"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <input
                    className='inputlol'
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="Введите ваш пароль*"
                    disabled={loading}
                  />
                </div>

                {error && <div className="error-message">{error}</div>}

                <button 
                  type="submit" 
                  className="login-button"
                  disabled={loading}
                >
                  {loading ? 'Вход...' : 'Войти'}
                </button>
              </form>

              <div className="switch-auth">
                <p className='no'>Нет аккаунта? 
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
        </div>
        <div className="sphere-22"></div>
        <div className="sphere-32"></div>
        <div className="orange-sphere-1"></div>
        <div className="orange-sphere-2"></div>
      </div>
    </div>
  );
};

export default Login;