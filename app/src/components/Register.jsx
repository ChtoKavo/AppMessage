import React, { useState, useRef, useEffect } from 'react';
import './Register.css';

const Register = ({ onRegister, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    nick: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('register'); 
  const [confirmationCode, setConfirmationCode] = useState(['', '', '', '', '', '']);
  const [userEmail, setUserEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const inputRefs = useRef([]);
  const API_BASE_URL = 'http://localhost:5001';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleCodeChange = (index, value) => {
    // Разрешаем только цифры и буквы
    const sanitizedValue = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    if (sanitizedValue.length <= 1) {
      const newCode = [...confirmationCode];
      newCode[index] = sanitizedValue;
      setConfirmationCode(newCode);

      // Автоматически переходим к следующему полю
      if (sanitizedValue && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleCodeKeyDown = (index, e) => {
    // Обработка Backspace
    if (e.key === 'Backspace') {
      if (!confirmationCode[index] && index > 0) {
        // Если поле пустое и нажали Backspace - переходим к предыдущему полю
        const newCode = [...confirmationCode];
        newCode[index - 1] = '';
        setConfirmationCode(newCode);
        inputRefs.current[index - 1]?.focus();
      } else if (confirmationCode[index]) {
        // Если в поле есть значение - очищаем его
        const newCode = [...confirmationCode];
        newCode[index] = '';
        setConfirmationCode(newCode);
      }
    }

    // Обработка стрелок
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    if (pasteData.length === 6) {
      const newCode = pasteData.split('');
      setConfirmationCode(newCode);
      
      // Фокусируем последнее поле
      inputRefs.current[5]?.focus();
    }
  };

  const getFullCode = () => {
    return confirmationCode.join('');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (formData.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (!acceptedTerms) {
      setError('Необходимо принять условия использования');
      return;
    }

    if (!formData.name.trim()) {
      setError('Имя обязательно для заполнения');
      return;
    }

    if (!formData.surname.trim()) {
      setError('Фамилия обязательна для заполнения');
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
          surname: formData.surname,
          nick: formData.nick || null,
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();
      console.log('Register response:', data);

      if (response.ok) {
        setUserEmail(formData.email);
        setStep('confirm');
        // Сбрасываем код при переходе к подтверждению
        setConfirmationCode(['', '', '', '', '', '']);
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

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError('');

    const fullCode = getFullCode();
    if (fullCode.length !== 6) {
      setError('Введите полный код подтверждения (6 символов)');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/confirm-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: userEmail, 
          confirmationCode: fullCode 
        }),
      });

      const data = await response.json();
      console.log('Confirm response:', data);
      
      if (response.ok) {
        if (data.user && data.user.user_id && data.user.name && data.user.email) {
          onRegister(data.user);
        } else if (data.user_id && data.name && data.email) {
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

  // Фокусируем первое поле при монтировании формы подтверждения
  useEffect(() => {
    if (step === 'confirm' && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  const renderRegisterForm = () => (
    <div className="register-container">
      <div className="sphere-1"></div>
      <div className="sphere-2"></div>
      <div className="sphere-3"></div>
      
      <div className="header-sphere">
        <div className="header-content">
          <button 
            className="back-button"
            onClick={onSwitchToLogin}
            type="button"
          >
            ← Назад
          </button>
          <h1 className="register-title">Регистрация</h1>
        </div>
      </div>
      
      <div className="register-form">
        <form className="form-registration" onSubmit={handleRegister}>
          <div className="form-group">
            <input
              className='inputlol'
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Введите ваше имя*"
            />
          </div>

          <div className="form-group">
            <input
              className='inputlol'
              type="text"
              id="surname"
              name="surname"
              value={formData.surname}
              onChange={handleChange}
              required
              placeholder="Введите вашу фамилию*"
            />
          </div>

          <div className="form-group">
            <input
              className='inputlol'
              type="text"
              id="nick"
              name="nick"
              value={formData.nick}
              onChange={handleChange}
              placeholder="Введите ваш никнейм (необязательно)"
            />
          </div>

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
              placeholder="Введите пароль (мин. 6 символов)*"
            />
          </div>

          <div className="form-group">
            <input
              className='inputlol'
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Повторите пароль*"
            />
          </div>

          <div className="terms-group">
            <label className="terms-label">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="terms-checkbox"
              />
              <span className="checkmark"></span>
              Я принимаю условия и даю согласие на обработку моих персональных данных согласно 
            </label>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="register-button"
            disabled={loading || !acceptedTerms}
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

  const renderConfirmationForm = () => (
    <div className="register-container">
      <div className="sphere-1"></div>
      <div className="sphere-2"></div>
      <div className="sphere-3"></div>
      
      <div className="header-sphere">
        <div className="header-content">
          <button 
            className="back-button"
            onClick={() => setStep('register')}
            type="button"
          >
            ← Назад
          </button>
          <h1 className="register-title">Подтверждение</h1>
        </div>
      </div>
      
      <div className="register-form">
        <div className="confirmation-message">
          На адрес <span className="confirmation-email">{userEmail}</span> был отправлен код подтверждения.
        </div>
        <div className="confirmation-message">
          Введите код для завершения регистрации:
        </div>
        
        <form className="confirmation-form" onSubmit={handleConfirm}>
          <div className="code-inputs-container">
            {confirmationCode.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                className="code-input"
                type="text"
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(index, e)}
                onPaste={handleCodePaste}
                maxLength="1"
                required
                autoComplete="off"
              />
            ))}
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="confirm-button"
            disabled={loading || getFullCode().length !== 6}
          >
            {loading ? 'Подтверждение...' : 'Подтвердить email'}
          </button>
        </form>

        <div className="confirmation-switch">
          <p>Не получили код? 
            <span 
              className="confirmation-link" 
              onClick={() => setStep('register')}
            >
              Вернуться к регистрации
            </span>
          </p>
        </div>
      </div>
    </div>
  );

  return step === 'register' ? renderRegisterForm() : renderConfirmationForm();
};

export default Register;