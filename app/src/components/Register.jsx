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
  const [step, setStep] = useState('register'); // 'register' или 'confirm'
  const [confirmationCode, setConfirmationCode] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const API_BASE_URL = 'http://localhost:5001';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  // Шаг 1: Регистрация и отправка кода подтверждения
  const handleRegister = async (e) => {
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
      console.log('Register response:', data);

      if (response.ok) {
        // Сохраняем email для подтверждения
        setUserEmail(formData.email);
        // Переходим к шагу подтверждения
        setStep('confirm');
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

  // Шаг 2: Подтверждение email
  const handleConfirm = async (e) => {
  e.preventDefault();
  setError('');

  if (!confirmationCode) {
    setError('Введите код подтверждения');
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/confirm-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: userEmail, 
        confirmationCode: confirmationCode 
      }),
    });

    const data = await response.json();
    console.log('Confirm response:', data); // Для отладки
    
    if (response.ok) {
      // Проверяем разные возможные форматы ответа
      if (data.user && data.user.user_id && data.user.name && data.user.email) {
        // Формат: { user: { user_id, name, email, ... } }
        onRegister(data.user);
      } else if (data.user_id && data.name && data.email) {
        // Формат: { user_id, name, email, ... } (прямо в data)
        onRegister(data);
      } else {
        console.error('Некорректный формат данных:', data);
        throw new Error('Некорректные данные пользователя в ответе сервера');
      }
    } else {
      setError(data.error || 'Ошибка подтверждения email');
    }
  } catch (error) {
    console.error('Ошибка подтверждения:', error);
    setError(error.message || 'Ошибка соединения с сервером');
  } finally {
    setLoading(false);
  }
};

  // Форма регистрации
  const renderRegisterForm = () => (
    <div className="login-container">
      <div className="login-form">
        <h2>Регистрация</h2>
        
        <form onSubmit={handleRegister}>
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

  // Форма подтверждения email
  const renderConfirmationForm = () => (
    <div className="login-container">
      <div className="login-form">
        <h2>Подтверждение email</h2>
        <p>На адрес <strong>{userEmail}</strong> был отправлен код подтверждения.</p>
        <p>Введите код для завершения регистрации:</p>
        
        <form onSubmit={handleConfirm}>
          <div className="form-group">
            <label htmlFor="confirmationCode">Код подтверждения:</label>
            <input
              type="text"
              id="confirmationCode"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              required
              placeholder="Введите код из письма"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Подтверждение...' : 'Подтвердить email'}
          </button>
        </form>

        <div className="switch-auth">
          <p>Не получили код? 
            <span 
              className="switch-link" 
              onClick={() => setStep('register')}
            >
              Вернуться к регистрации
            </span>
          </p>
        </div>
      </div>
    </div>
  );

  // Рендерим соответствующую форму в зависимости от шага
  return step === 'register' ? renderRegisterForm() : renderConfirmationForm();
};

export default Register;