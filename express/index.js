const express = require('express');
const app = express();
const dotenv = require('dotenv');
const db = require('./db');
const cors = require('cors');

dotenv.config();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;


app.get('/users', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM users');
        res.json(rows);
    }
    catch(error) {
        console.error(error);
        res.status(500).json({error: 'Database error'});
    }
});


app.post('/users', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
        }

        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Некорректный формат email' });
        }

        
        const [existingUsers] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        
        const [result] = await db.execute(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, password] 
        );

        
        const [newUser] = await db.execute('SELECT * FROM users WHERE user_id = ?', [result.insertId]);
        
        res.status(201).json(newUser[0]);
    }
    catch(error) {
        console.error('Database error:', error);
        
        
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            return res.status(400).json({error: 'Пользователь с таким email уже существует'});
        }
        
        res.status(500).json({error: 'Внутренняя ошибка сервера'});
    }
});


app.get('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const [rows] = await db.execute('SELECT * FROM users WHERE user_id = ?', [userId]);
        
        if (rows.length === 0) {
            return res.status(404).json({error: 'Пользователь не найден'});
        }
        
        res.json(rows[0]);
    }
    catch(error) {
        console.error(error);
        res.status(500).json({error: 'Database error'});
    }
});


app.put('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { name, email } = req.body;

       
        if (email) {
            const [existingUsers] = await db.execute(
                'SELECT * FROM users WHERE email = ? AND user_id != ?', 
                [email, userId]
            );
            if (existingUsers.length > 0) {
                return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
            }
        }

        const [result] = await db.execute(
            'UPDATE users SET name = ?, email = ? WHERE user_id = ?',
            [name, email, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({error: 'Пользователь не найден'});
        }

        const [updatedUser] = await db.execute('SELECT * FROM users WHERE user_id = ?', [userId]);
        res.json(updatedUser[0]);
    }
    catch(error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({error: 'Пользователь с таким email уже существует'});
        }
        res.status(500).json({error: 'Database error'});
    }
});


app.delete('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const [result] = await db.execute('DELETE FROM users WHERE user_id = ?', [userId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({error: 'Пользователь не найден'});
        }
        
        res.json({message: 'Пользователь успешно удален'});
    }
    catch(error) {
        console.error(error);
        res.status(500).json({error: 'Database error'});
    }
});

app.get('/', (req, res) => {
    res.send('Сервер работает');
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});