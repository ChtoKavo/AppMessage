import React, { useState } from 'react';


const App = () => {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const API_BASE_URL = 'http://localhost:5001';

  const fetchUsers = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/users`);
      if (!response.ok) throw new Error('Ошибка при получении пользователей');
      const data = await response.json();
      setUsers(data);
      setMessage(`Получено ${data.length} пользователей`);
    } catch (error) {
      console.error('Error:', error);
      setMessage('Ошибка при получении пользователей');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при создании пользователя');
      }

      const newUser = data;
      setUsers(prev => [...prev, newUser]);
      setFormData({ name: '', email: '', password: '' });
      setMessage('Пользователь успешно создан');
    } catch (error) {
      console.error('Error:', error);
      setMessage(error.message || 'Ошибка при создании пользователя');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="app">
      <h1>Тестовое приложение</h1>
      
      <div className="form-section">
        <h2>Регистрация пользователя</h2>
        <form className='user-form' onSubmit={createUser}>
          <div className="form-group">
            <label htmlFor="name">Имя:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder='Введите свое имя' 
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder='Введите свой email' 
              required
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
              onChange={handleInputChange}
              placeholder='Введите пароль (минимум 6 символов)' 
              required
              minLength="6"
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Создание...' : 'Создать пользователя'}
          </button>
        </form>
      </div>

      <div className="actions-section">
        <button onClick={fetchUsers} disabled={loading} className='fetch-btn'>
          {loading ? 'Загрузка...' : 'Получить всех пользователей'}
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('Ошибка') ? 'error' : 'success'}`}> 
          {message} 
        </div>
      )}

      {users.length > 0 && (
        <div className='user-section'>
          <h2>Список пользователей ({users.length})</h2>
          <div className="user-list">
            {users.map(user => (
              <div key={user.user_id} className="user-card">
                <p><strong>ID:</strong> {user.user_id}</p>
                <p><strong>Имя:</strong> {user.name}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Роль:</strong> {user.role}</p>
                <p><strong>Создан:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;