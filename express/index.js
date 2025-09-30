const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const db = require('./db');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Создаем папку для загрузок если её нет
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const mediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Создаем папки по типам файлов
    const fileType = file.mimetype.startsWith('image/') ? 'images' : 
                    file.mimetype.startsWith('video/') ? 'videos' : 'files';
    const dir = `uploads/${fileType}`;
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Создаем папки по типам файлов
    const fileType = file.mimetype.startsWith('image/') ? 'images' : 
                    file.mimetype.startsWith('video/') ? 'videos' : 'files';
    const dir = `uploads/${fileType}`;
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit для видео
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || 
        file.mimetype.startsWith('video/') ||
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения, видео, PDF, Word и текстовые файлы!'), false);
    }
  }
});

// В разделе настройки multer добавьте:
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadAvatar = multer({ 
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for avatars
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars!'), false);
    }
  }
});

// Создаем папку для аватарок если её нет
const avatarsDir = path.join(__dirname, 'uploads/avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const PORT = process.env.PORT || 5001;
const activeUsers = new Map();

// Middleware для проверки аутентификации
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  
  // В реальном приложении здесь должна быть проверка JWT токена
  // Для демо просто пропускаем запрос
  next();
};


// WebSocket соединения
io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  // Регистрация пользователя
  socket.on('register_user', async (userId) => {
    activeUsers.set(userId.toString(), socket.id);
    console.log(`Пользователь ${userId} зарегистрирован с socket ${socket.id}`);
    
    // Обновляем статус пользователя как онлайн
    await db.execute(
      'UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE user_id = ?',
      [userId]
    );
    
    // Уведомляем всех о новом онлайн пользователе
    socket.broadcast.emit('user_online', parseInt(userId));
    
    // Отправляем текущему пользователю список всех онлайн пользователей
    const onlineUsers = Array.from(activeUsers.keys()).map(id => parseInt(id));
    socket.emit('online_users_list', onlineUsers);
  });

  // Получение статуса пользователей
  socket.on('get_user_status', async (userIds) => {
    try {
      if (!Array.isArray(userIds) || userIds.length === 0) return;
      
      const placeholders = userIds.map(() => '?').join(',');
      const [users] = await db.execute(
        `SELECT user_id, is_online, last_seen FROM users WHERE user_id IN (${placeholders})`,
        userIds
      );
      
      socket.emit('user_status_update', users);
    } catch (error) {
      console.error('Ошибка получения статуса пользователей:', error);
    }
  });

  // Периодическая проверка активности
  socket.on('user_activity', async (userId) => {
    try {
      await db.execute(
        'UPDATE users SET last_seen = NOW() WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.error('Ошибка обновления активности:', error);
    }
  });

  // Отправка сообщения
  socket.on('send_message', async (messageData) => {
    try {
      const { chat_id, user_id, content, message_type = 'text', attachment_url = null } = messageData;
      
      const [result] = await db.execute(
        'INSERT INTO messages (chat_id, user_id, content, message_type, attachment_url) VALUES (?, ?, ?, ?, ?)',
        [chat_id, user_id, content, message_type, attachment_url]
      );

      // Получаем полные данные сообщения
      const [messages] = await db.execute(`
        SELECT m.*, u.name as user_name, u.email as user_email 
        FROM messages m 
        JOIN users u ON m.user_id = u.user_id 
        WHERE m.message_id = ?
      `, [result.insertId]);

      const fullMessage = messages[0];

      // Получаем участников чата
      const [participants] = await db.execute(
        'SELECT user_id FROM chat_participants WHERE chat_id = ?',
        [chat_id]
      );

      // Отправляем сообщение всем участникам чата
      participants.forEach(participant => {
        const participantSocketId = activeUsers.get(participant.user_id.toString());
        if (participantSocketId) {
          io.to(participantSocketId).emit('new_message', fullMessage);
        }
      });

      // Обновляем время последнего сообщения в чате
      await db.execute(
        'UPDATE chats SET last_activity = NOW() WHERE chat_id = ?',
        [chat_id]
      );

    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      socket.emit('message_error', { error: 'Не удалось отправить сообщение' });
    }
  });

  // Создание чата
  socket.on('create_chat', async (chatData) => {
    try {
      const { user_id, participant_id, chat_type = 'private', chat_name = null } = chatData;
      
      // Создаем чат
      const [chatResult] = await db.execute(
        'INSERT INTO chats (chat_type, chat_name, created_by) VALUES (?, ?, ?)',
        [chat_type, chat_name, user_id]
      );

      const chatId = chatResult.insertId;

      // Добавляем участников
      await db.execute(
        'INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)',
        [chatId, user_id, chatId, participant_id]
      );

      // Получаем полные данные чата
      const [chats] = await db.execute(`
        SELECT c.*, 
               GROUP_CONCAT(u.user_id) as participant_ids,
               GROUP_CONCAT(u.name) as participant_names
        FROM chats c
        JOIN chat_participants cp ON c.chat_id = cp.chat_id
        JOIN users u ON cp.user_id = u.user_id
        WHERE c.chat_id = ?
        GROUP BY c.chat_id
      `, [chatId]);

      const newChat = chats[0];

      // Отправляем данные о новом чате обоим пользователям
      [user_id, participant_id].forEach(userId => {
        const userSocketId = activeUsers.get(userId.toString());
        if (userSocketId) {
          io.to(userSocketId).emit('chat_created', newChat);
        }
      });

    } catch (error) {
      console.error('Ошибка создания чата:', error);
      socket.emit('chat_error', { error: 'Не удалось создать чат' });
    }
  });

  // WebSocket обработчики - исправленные

  // Лайк поста
  socket.on('like_post', async (data) => {
    try {
      const { post_id, user_id } = data;
      
      if (!post_id || !user_id) {
        socket.emit('like_error', { error: 'Отсутствуют обязательные параметры' });
        return;
      }

      console.log('Processing like for post:', post_id, 'user:', user_id);

      // Проверяем, не лайкал ли уже пользователь
      const [existingLikes] = await db.execute(
        'SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?',
        [post_id, user_id]
      );

      if (existingLikes.length > 0) {
        // Убираем лайк
        await db.execute(
          'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
          [post_id, user_id]
        );
        
        await db.execute(
          'UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE post_id = ?',
          [post_id]
        );

        socket.emit('post_unliked', { post_id, user_id });
        
        // Уведомляем автора поста
        const [posts] = await db.execute(
          'SELECT user_id FROM posts WHERE post_id = ?',
          [post_id]
        );
        
        if (posts.length > 0) {
          const authorSocketId = activeUsers.get(posts[0].user_id.toString());
          if (authorSocketId) {
            io.to(authorSocketId).emit('post_unliked_by_user', { post_id, user_id });
          }
        }
      } else {
        // Добавляем лайк
        await db.execute(
          'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)',
          [post_id, user_id]
        );
        
        await db.execute(
          'UPDATE posts SET likes_count = likes_count + 1 WHERE post_id = ?',
          [post_id]
        );

        // Создаем уведомление для автора поста
        const [posts] = await db.execute(
          'SELECT user_id FROM posts WHERE post_id = ?',
          [post_id]
        );
        
        if (posts.length > 0 && posts[0].user_id !== user_id) {
          await db.execute(
            'INSERT INTO notifications (user_id, from_user_id, type, post_id) VALUES (?, ?, "like", ?)',
            [posts[0].user_id, user_id, post_id]
          );

          // Отправляем уведомление автору поста, если он онлайн
          const authorSocketId = activeUsers.get(posts[0].user_id.toString());
          if (authorSocketId) {
            const [userData] = await db.execute(
              'SELECT name FROM users WHERE user_id = ?',
              [user_id]
            );
            
            io.to(authorSocketId).emit('new_notification', {
              type: 'like',
              from_user_id: user_id,
              from_user_name: userData[0]?.name,
              post_id: post_id
            });
          }
        }

        socket.emit('post_liked', { post_id, user_id });
      }

    } catch (error) {
      console.error('Ошибка лайка:', error);
      socket.emit('like_error', { error: 'Не удалось обработать лайк' });
    }
  });

  // Добавление комментария
  socket.on('add_comment', async (commentData) => {
    try {
      const { post_id, user_id, content, parent_comment_id = null } = commentData;
      
      if (!post_id || !user_id || !content) {
        socket.emit('comment_error', { error: 'Отсутствуют обязательные параметры' });
        return;
      }

      console.log('Adding comment:', { post_id, user_id, content });

      const [result] = await db.execute(
        'INSERT INTO comments (post_id, user_id, content, parent_comment_id) VALUES (?, ?, ?, ?)',
        [post_id, user_id, content, parent_comment_id]
      );

      // Обновляем счетчик комментариев
      await db.execute(
        'UPDATE posts SET comments_count = comments_count + 1 WHERE post_id = ?',
        [post_id]
      );

      // Получаем полные данные комментария
      const [comments] = await db.execute(`
        SELECT c.*, u.name as user_name, u.email as user_email 
        FROM comments c 
        JOIN users u ON c.user_id = u.user_id 
        WHERE c.comment_id = ?
      `, [result.insertId]);

      const fullComment = comments[0];

      // Создаем уведомление для автора поста
      const [posts] = await db.execute(
        'SELECT user_id FROM posts WHERE post_id = ?',
        [post_id]
      );
      
      if (posts.length > 0 && posts[0].user_id !== user_id) {
        await db.execute(
          'INSERT INTO notifications (user_id, from_user_id, type, post_id, comment_id) VALUES (?, ?, "comment", ?, ?)',
          [posts[0].user_id, user_id, post_id, result.insertId]
        );

        const authorSocketId = activeUsers.get(posts[0].user_id.toString());
        if (authorSocketId) {
          const [userData] = await db.execute(
            'SELECT name FROM users WHERE user_id = ?',
            [user_id]
          );
          
          io.to(authorSocketId).emit('new_notification', {
            type: 'comment',
            from_user_id: user_id,
            from_user_name: userData[0]?.name,
            post_id: post_id,
            comment_id: result.insertId
          });
        }
      }

      // Отправляем комментарий всем, кто смотрит этот пост
      socket.broadcast.emit('new_comment', fullComment);
      socket.emit('comment_added', fullComment);

    } catch (error) {
      console.error('Ошибка добавления комментария:', error);
      socket.emit('comment_error', { error: 'Не удалось добавить комментарий' });
    }
  });

  // Запрос дружбы
  socket.on('friend_request', async (data) => {
    try {
      const { from_user_id, to_user_id } = data;
      
      // Проверяем, не существует ли уже запрос
      const [existingRequests] = await db.execute(
        'SELECT * FROM friendships WHERE ((user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?)) AND status IN ("pending", "accepted")',
        [from_user_id, to_user_id, to_user_id, from_user_id]
      );

      if (existingRequests.length > 0) {
        socket.emit('friend_request_error', { error: 'Запрос дружбы уже существует' });
        return;
      }

      const [result] = await db.execute(
        'INSERT INTO friendships (user_id1, user_id2, action_user_id, status) VALUES (?, ?, ?, "pending")',
        [from_user_id, to_user_id, from_user_id]
      );

      // Создаем уведомление
      await db.execute(
        'INSERT INTO notifications (user_id, from_user_id, type, friendship_id) VALUES (?, ?, "friend_request", ?)',
        [to_user_id, from_user_id, result.insertId]
      );

      // Отправляем уведомление получателю
      const toUserSocketId = activeUsers.get(to_user_id.toString());
      if (toUserSocketId) {
        const [fromUserData] = await db.execute(
          'SELECT name, email FROM users WHERE user_id = ?',
          [from_user_id]
        );
        
        io.to(toUserSocketId).emit('new_friend_request', {
          from_user_id,
          from_user_name: fromUserData[0]?.name,
          friendship_id: result.insertId
        });
      }

      socket.emit('friend_request_sent', { to_user_id });

    } catch (error) {
      console.error('Ошибка запроса дружбы:', error);
      socket.emit('friend_request_error', { error: 'Не удалось отправить запрос дружбы' });
    }
  });

  // Ответ на запрос дружбы
  socket.on('respond_friend_request', async (data) => {
    try {
      const { friendship_id, response, user_id } = data; // response: 'accepted' or 'rejected'
      
      // Получаем данные о запросе дружбы
      const [friendships] = await db.execute(
        'SELECT * FROM friendships WHERE friendship_id = ?',
        [friendship_id]
      );

      if (friendships.length === 0) {
        socket.emit('friend_response_error', { error: 'Запрос дружбы не найден' });
        return;
      }

      const friendship = friendships[0];
      const from_user_id = friendship.action_user_id;
      const to_user_id = friendship.user_id1 === from_user_id ? friendship.user_id2 : friendship.user_id1;

      // Обновляем статус дружбы
      await db.execute(
        'UPDATE friendships SET status = ? WHERE friendship_id = ?',
        [response, friendship_id]
      );

      if (response === 'accepted') {
        // Создаем уведомление для отправителя
        await db.execute(
          'INSERT INTO notifications (user_id, from_user_id, type, friendship_id) VALUES (?, ?, "friend_accept", ?)',
          [from_user_id, to_user_id, friendship_id]
        );

        // Уведомляем отправителя
        const fromUserSocketId = activeUsers.get(from_user_id.toString());
        if (fromUserSocketId) {
          const [toUserData] = await db.execute(
            'SELECT name, email FROM users WHERE user_id = ?',
            [to_user_id]
          );
          
          io.to(fromUserSocketId).emit('friend_request_accepted', {
            from_user_id: to_user_id,
            from_user_name: toUserData[0]?.name,
            friendship_id: friendship_id
          });
        }
      }

      socket.emit('friend_request_responded', { friendship_id, response });

    } catch (error) {
      console.error('Ошибка ответа на запрос дружбы:', error);
      socket.emit('friend_response_error', { error: 'Не удалось обработать ответ' });
    }
  });

  // Отключение пользователя
  socket.on('disconnect', async () => {
    for (let [userId, socketId] of activeUsers.entries()) {
      if (socketId === socket.id) {
        activeUsers.delete(userId);
        
        // Обновляем статус пользователя как оффлайн
        await db.execute(
          'UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE user_id = ?',
          [userId]
        );
        
        socket.broadcast.emit('user_offline', parseInt(userId));
        console.log(`Пользователь ${userId} отключился`);
        break;
      }
    }
  });
});

// ==================== REST API ====================

// Проверка существования чата
app.get('/chats/check/:userId/:participantId', async (req, res) => {
  try {
    const { userId, participantId } = req.params;
    
    const [chats] = await db.execute(`
      SELECT cp1.chat_id 
      FROM chat_participants cp1
      JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
      JOIN chats c ON cp1.chat_id = c.chat_id
      WHERE cp1.user_id = ? AND cp2.user_id = ? AND c.chat_type = 'private'
    `, [userId, participantId]);

    if (chats.length > 0) {
      res.json({ exists: true, chat_id: chats[0].chat_id });
    } else {
      res.json({ exists: false });
    }
  } catch(error) {
    console.error(error);
    res.status(500).json({error: 'Database error'});
  }
});

// Получение пользователей
app.get('/users', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT user_id, name, email, role, created_at, is_online, last_seen FROM users');
    res.json(rows);
  } catch(error) {
    console.error(error);
    res.status(500).json({error: 'Database error'});
  }
});

// Получение статуса пользователя
app.get('/api/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [users] = await db.execute(
      'SELECT user_id, is_online, last_seen FROM users WHERE user_id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Получение статуса нескольких пользователей
app.post('/api/users/status', async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'Список ID пользователей обязателен' });
    }

    const placeholders = userIds.map(() => '?').join(',');
    const [users] = await db.execute(
      `SELECT user_id, is_online, last_seen FROM users WHERE user_id IN (${placeholders})`,
      userIds
    );

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Регистрация пользователя
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

    const [newUser] = await db.execute(
      'SELECT user_id, name, email, role, created_at FROM users WHERE user_id = ?', 
      [result.insertId]
    );
    
    res.status(201).json(newUser[0]);
  } catch(error) {
    console.error('Database error:', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return res.status(400).json({error: 'Пользователь с таким email уже существует'});
    }
    res.status(500).json({error: 'Внутренняя ошибка сервера'});
  }
});

// Получение чатов пользователя
app.get('/chats/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const [chats] = await db.execute(`
  SELECT c.*, 
         GROUP_CONCAT(u.user_id) as participant_ids,
         GROUP_CONCAT(u.name) as participant_names,
         (SELECT content FROM messages WHERE chat_id = c.chat_id ORDER BY created_at DESC LIMIT 1) as last_message,
         (SELECT created_at FROM messages WHERE chat_id = c.chat_id ORDER BY created_at DESC LIMIT 1) as last_message_time,
         (SELECT COUNT(*) FROM messages WHERE chat_id = c.chat_id AND is_read = FALSE AND user_id != ?) as unread_count
  FROM chats c
  JOIN chat_participants cp ON c.chat_id = cp.chat_id
  JOIN users u ON cp.user_id = u.user_id
  WHERE c.chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = ?)
  GROUP BY c.chat_id
  ORDER BY COALESCE(last_message_time, '1970-01-01') DESC, c.created_at DESC
`, [userId, userId]);

    res.json(chats);
  } catch(error) {
    console.error(error);
    res.status(500).json({error: 'Database error'});
  }
});

// Аутентификация
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const [users] = await db.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    const user = users[0];

    if (user.password !== password) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    const { password: _, ...userWithoutPassword } = user;
    
    // Обновляем статус онлайн
    await db.execute(
      'UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE user_id = ?',
      [user.user_id]
    );

    res.json({ 
      ...userWithoutPassword,
      message: 'Вход выполнен успешно'
    });

  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Проверка аутентификации
app.get('/auth/me', async (req, res) => {
  try {
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'ID пользователя обязателен' });
    }

    const [users] = await db.execute(
      'SELECT user_id, name, email, role, created_at, is_online, last_seen FROM users WHERE user_id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Ошибка проверки аутентификации:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение сообщений чата
app.get('/messages/:chatId', async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const { userId } = req.query;
    
    const [messages] = await db.execute(`
      SELECT m.*, u.name as user_name, u.email as user_email 
      FROM messages m 
      JOIN users u ON m.user_id = u.user_id 
      WHERE m.chat_id = ? 
      ORDER BY m.created_at ASC
    `, [chatId]);

    // Помечаем сообщения как прочитанные
    if (userId) {
      await db.execute(
        'UPDATE messages SET is_read = TRUE, read_at = NOW() WHERE chat_id = ? AND user_id != ? AND is_read = FALSE',
        [chatId, userId]
      );
    }

    res.json(messages);
  } catch(error) {
    console.error(error);
    res.status(500).json({error: 'Database error'});
  }
});

const uploadDirs = ['uploads/images', 'uploads/videos', 'uploads/files', 'uploads/avatars'];
uploadDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${fullPath}`);
  }
});

// Поиск пользователей
app.get('/users/search/:query', async (req, res) => {
  try {
    const query = `%${req.params.query}%`;
    
    const [users] = await db.execute(
      'SELECT user_id, name, email, is_online, last_seen FROM users WHERE name LIKE ? OR email LIKE ?',
      [query, query]
    );

    res.json(users);
  } catch(error) {
    console.error(error);
    res.status(500).json({error: 'Database error'});
  }
});

// ==================== API ДЛЯ СОЦИАЛЬНЫХ ФУНКЦИЙ ====================

// Получение постов - исправленная версия
app.get('/api/posts', async (req, res) => {
  try {
    const { page = 1, limit = 10, user_id } = req.query;
    
    console.log('Loading posts with params:', { user_id, page, limit });

    // Альтернативный подход без LIMIT/OFFSET параметров
    let query = `
      SELECT p.*, u.name as author_name, u.email as author_email
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.is_published = TRUE AND (p.is_public = TRUE OR p.user_id = ?)
      ORDER BY p.created_at DESC
    `;

    // Если нужна пагинация, добавляем LIMIT через шаблонную строку
    const limitNum = parseInt(limit) || 10;
    const pageNum = parseInt(page) || 1;
    const offset = (pageNum - 1) * limitNum;
    
    query += ` LIMIT ${limitNum} OFFSET ${offset}`;

    const [posts] = await db.execute(query, [user_id]);

    // Затем для каждого поста получаем количество лайков и комментариев
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        try {
          // Получаем количество лайков
          const [likes] = await db.execute(
            'SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?',
            [post.post_id]
          );

          // Получаем количество комментариев
          const [comments] = await db.execute(
            'SELECT COUNT(*) as count FROM comments WHERE post_id = ?',
            [post.post_id]
          );

          // Проверяем, лайкнул ли текущий пользователь этот пост
          let is_liked = false;
          if (user_id) {
            const [userLike] = await db.execute(
              'SELECT 1 as is_liked FROM post_likes WHERE post_id = ? AND user_id = ?',
              [post.post_id, user_id]
            );
            is_liked = userLike.length > 0;
          }

          return {
            ...post,
            likes_count: likes[0]?.count || 0,
            comments_count: comments[0]?.count || 0,
            is_liked: is_liked
          };
        } catch (error) {
          console.error(`Error processing post ${post.post_id}:`, error);
          return {
            ...post,
            likes_count: 0,
            comments_count: 0,
            is_liked: false
          };
        }
      })
    );

    res.json(postsWithCounts);
  } catch (error) {
    console.error('Error loading posts:', error);
    res.status(500).json({ error: 'Database error: ' + error.message });
  }
});

// Добавьте этот endpoint после других API маршрутов:
app.post('/messages/upload', upload.single('file'), async (req, res) => {
  try {
    const { chat_id, user_id } = req.body;
    
    console.log('File upload request:', {
      chat_id,
      user_id,
      file: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        filename: req.file.filename
      } : 'No file'
    });

    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    if (!chat_id || !user_id) {
      return res.status(400).json({ error: 'chat_id и user_id обязательны' });
    }

    // Определяем тип сообщения
    let message_type = 'file';
    let content = req.file.originalname;
    
    if (req.file.mimetype.startsWith('image/')) {
      message_type = 'image';
      content = 'Изображение';
    } else if (req.file.mimetype.startsWith('video/')) {
      message_type = 'video';
      content = 'Видео';
    }

    // Формируем правильный URL для файла
    const fileType = req.file.mimetype.startsWith('image/') ? 'images' : 
                    req.file.mimetype.startsWith('video/') ? 'videos' : 'files';
    const attachment_url = `/uploads/${fileType}/${req.file.filename}`;

    // Сохраняем сообщение в базу
    const [result] = await db.execute(
      'INSERT INTO messages (chat_id, user_id, content, message_type, attachment_url) VALUES (?, ?, ?, ?, ?)',
      [chat_id, user_id, content, message_type, attachment_url]
    );

    // Получаем полные данные сообщения
    const [messages] = await db.execute(`
      SELECT m.*, u.name as user_name, u.email as user_email 
      FROM messages m 
      JOIN users u ON m.user_id = u.user_id 
      WHERE m.message_id = ?
    `, [result.insertId]);

    const fullMessage = messages[0];

    // Отправляем сообщение через WebSocket всем участникам чата
    const [participants] = await db.execute(
      'SELECT user_id FROM chat_participants WHERE chat_id = ?',
      [chat_id]
    );

    participants.forEach(participant => {
      const participantSocketId = activeUsers.get(participant.user_id.toString());
      if (participantSocketId) {
        io.to(participantSocketId).emit('new_message', fullMessage);
      }
    });

    // Обновляем время последней активности чата
    await db.execute(
      'UPDATE chats SET last_activity = NOW() WHERE chat_id = ?',
      [chat_id]
    );

    res.json({
      message: 'Файл успешно загружен',
      uploadedMessage: fullMessage
    });

  } catch (error) {
    console.error('Ошибка загрузки файла:', error);
    res.status(500).json({ error: 'Ошибка загрузки файла: ' + error.message });
  }
});

app.post('/api/posts/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const { user_id } = req.body;
    
    if (!postId || !user_id) {
      return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
    }

    // Проверяем, не лайкал ли уже пользователь
    const [existingLikes] = await db.execute(
      'SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?',
      [postId, user_id]
    );

    let is_liked;
    let likes_count;

    if (existingLikes.length > 0) {
      // Убираем лайк
      await db.execute(
        'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
        [postId, user_id]
      );
      
      await db.execute(
        'UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE post_id = ?',
        [postId]
      );

      is_liked = false;
      
      // Получаем обновленное количество лайков
      const [postResult] = await db.execute(
        'SELECT likes_count FROM posts WHERE post_id = ?',
        [postId]
      );
      likes_count = postResult[0]?.likes_count || 0;
    } else {
      // Добавляем лайк
      await db.execute(
        'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)',
        [postId, user_id]
      );
      
      await db.execute(
        'UPDATE posts SET likes_count = likes_count + 1 WHERE post_id = ?',
        [postId]
      );

      is_liked = true;
      
      // Получаем обновленное количество лайков
      const [postResult] = await db.execute(
        'SELECT likes_count FROM posts WHERE post_id = ?',
        [postId]
      );
      likes_count = postResult[0]?.likes_count || 0;

      // Создаем уведомление для автора поста
      const [posts] = await db.execute(
        'SELECT user_id FROM posts WHERE post_id = ?',
        [postId]
      );
      
      if (posts.length > 0 && posts[0].user_id !== user_id) {
        await db.execute(
          'INSERT INTO notifications (user_id, from_user_id, type, post_id) VALUES (?, ?, "like", ?)',
          [posts[0].user_id, user_id, postId]
        );
      }
    }

    res.json({ 
      post_id: parseInt(postId),
      user_id: parseInt(user_id),
      is_liked,
      likes_count
    });

  } catch (error) {
    console.error('Ошибка лайка через REST:', error);
    res.status(500).json({ error: 'Не удалось обработать лайк' });
  }
});

// Создание поста
app.post('/api/posts', upload.single('media'), async (req, res) => {
  try {
    const { user_id, title, content, category_id = 1, is_public = 'true' } = req.body;
    
    if (!user_id || !content) {
      return res.status(400).json({ error: 'user_id и content обязательны' });
    }

    const media_url = req.file ? `/uploads/${req.file.filename}` : null;

    // Преобразуем булевые значения в числа для MySQL
    const isPublicBool = is_public === 'true' || is_public === true;
    const categoryId = parseInt(category_id) || 1;

    const [result] = await db.execute(
      'INSERT INTO posts (user_id, title, content, image_url, category_id, is_public) VALUES (?, ?, ?, ?, ?, ?)',
      [
        parseInt(user_id), 
        title || content.substring(0, 100), 
        content, 
        media_url, 
        categoryId, 
        isPublicBool ? 1 : 0
      ]
    );

    // Получаем созданный пост с информацией об авторе
    const [posts] = await db.execute(`
      SELECT p.*, u.name as author_name, u.email as author_email 
      FROM posts p 
      JOIN users u ON p.user_id = u.user_id 
      WHERE p.post_id = ?
    `, [result.insertId]);

    const newPost = posts[0];

    // Добавляем счетчики для нового поста
    const postWithCounts = {
      ...newPost,
      likes_count: 0,
      comments_count: 0,
      is_liked: false
    };

    res.status(201).json(postWithCounts);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Получение комментариев поста
app.get('/api/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { user_id } = req.query;

    console.log('Loading comments for post:', postId, 'user:', user_id);

    const [comments] = await db.execute(`
      SELECT c.*, u.name as user_name, u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `, [postId]);

    // Добавляем информацию о лайках для каждого комментария
    const commentsWithLikes = await Promise.all(
      comments.map(async (comment) => {
        const [likes] = await db.execute(
          'SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ?',
          [comment.comment_id]
        );

        const [userLike] = await db.execute(
          'SELECT 1 as is_liked FROM comment_likes WHERE comment_id = ? AND user_id = ?',
          [comment.comment_id, user_id]
        );

        return {
          ...comment,
          likes_count: likes[0]?.count || 0,
          is_liked: userLike.length > 0
        };
      })
    );

    res.json(commentsWithLikes);
  } catch (error) {
    console.error('Error loading comments:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Получение друзей пользователя
app.get('/api/users/:userId/friends', async (req, res) => {
  try {
    const { userId } = req.params;
    
   const [friends] = await db.execute(`
  SELECT 
    u.user_id, 
    u.name, 
    u.email, 
    u.is_online, 
    u.last_seen,
    CASE 
      WHEN uf.user_id1 = ? THEN uf.user_id2 
      ELSE uf.user_id1 
    END as friend_id,
    uf.friendship_id
  FROM users u
  JOIN friendships uf ON (u.user_id = uf.user_id1 OR u.user_id = uf.user_id2)
  WHERE (uf.user_id1 = ? OR uf.user_id2 = ?) 
    AND uf.status = 'accepted'
    AND u.user_id != ?
  ORDER BY u.is_online DESC, u.name ASC
`, [userId, userId, userId, userId]);

    res.json(friends);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Получение запросов в друзья
app.get('/api/users/:userId/friend-requests', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [requests] = await db.execute(`
      SELECT f.*, u.name as from_user_name, u.email as from_user_email
      FROM friendships f
      JOIN users u ON f.action_user_id = u.user_id
      WHERE ((f.user_id1 = ? AND f.user_id2 != ?) OR (f.user_id2 = ? AND f.user_id1 != ?))
        AND f.status = 'pending'
        AND f.action_user_id != ?
      ORDER BY f.created_at DESC
    `, [userId, userId, userId, userId, userId]);

    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Отправка запроса дружбы
app.post('/api/friends/request', async (req, res) => {
  try {
    const { from_user_id, to_user_id } = req.body;
    
    const [result] = await db.execute(
      'INSERT INTO friendships (user_id1, user_id2, action_user_id, status) VALUES (?, ?, ?, "pending")',
      [from_user_id, to_user_id, from_user_id]
    );

    // Создаем уведомление
    await db.execute(
      'INSERT INTO notifications (user_id, from_user_id, type, friendship_id) VALUES (?, ?, "friend_request", ?)',
      [to_user_id, from_user_id, result.insertId]
    );

    res.status(201).json({ 
      message: 'Запрос отправлен',
      friendship_id: result.insertId 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Ответ на запрос дружбы
app.post('/api/friends/respond', async (req, res) => {
  try {
    const { friendship_id, response, user_id } = req.body;
    
    await db.execute(
      'UPDATE friendships SET status = ? WHERE friendship_id = ?',
      [response, friendship_id]
    );

    if (response === 'accepted') {
      // Получаем данные о дружбе для уведомления
      const [friendships] = await db.execute(
        'SELECT * FROM friendships WHERE friendship_id = ?',
        [friendship_id]
      );
      
      if (friendships.length > 0) {
        const friendship = friendships[0];
        const from_user_id = friendship.action_user_id;
        
        await db.execute(
          'INSERT INTO notifications (user_id, from_user_id, type, friendship_id) VALUES (?, ?, "friend_accept", ?)',
          [from_user_id, user_id, friendship_id]
        );
      }
    }

    res.json({ message: `Запрос дружбы ${response === 'accepted' ? 'принят' : 'отклонен'}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Получение уведомлений
app.get('/api/users/:userId/notifications', async (req, res) => {
  try {
    const { userId } = req.params;
    const { unread_only = false } = req.query;
    
    let query = `
      SELECT n.*, u.name as from_user_name, u.email as from_user_email,
             p.title as post_title, c.content as comment_content
      FROM notifications n
      JOIN users u ON n.from_user_id = u.user_id
      LEFT JOIN posts p ON n.post_id = p.post_id
      LEFT JOIN comments c ON n.comment_id = c.comment_id
      WHERE n.user_id = ?
    `;
    
    const params = [userId];
    
    if (unread_only) {
      query += ' AND n.is_read = FALSE';
    }
    
    query += ' ORDER BY n.created_at DESC LIMIT 50';
    
    const [notifications] = await db.execute(query, params);

    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Отметка уведомления как прочитанного
app.put('/api/notifications/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    await db.execute(
      'UPDATE notifications SET is_read = TRUE WHERE notification_id = ?',
      [notificationId]
    );

    res.json({ message: 'Уведомление отмечено как прочитанное' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Отметка всех уведомлений как прочитанных
app.put('/api/users/:userId/notifications/read-all', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await db.execute(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    res.json({ message: 'Все уведомления отмечены как прочитанные' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});


// Получение профиля пользователя
// Получение профиля пользователя
app.get('/api/users/:userId/profile', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [users] = await db.execute(`
      SELECT u.user_id, u.name, u.email, u.role, u.created_at, u.is_online, u.last_seen, u.avatar_url, u.bio,
             COUNT(DISTINCT p.post_id) as posts_count,
             COUNT(DISTINCT f.friendship_id) as friends_count
      FROM users u
      LEFT JOIN posts p ON u.user_id = p.user_id AND p.is_published = TRUE
      LEFT JOIN friendships f ON (u.user_id = f.user_id1 OR u.user_id = f.user_id2) AND f.status = 'accepted'
      WHERE u.user_id = ?
      GROUP BY u.user_id
    `, [userId]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Получение постов пользователя
app.get('/api/users/:userId/posts', async (req, res) => {
  try {
    const { userId } = req.params;
    const { current_user_id } = req.query;

    console.log('Loading user posts:', { userId, current_user_id });

    // Получаем посты пользователя
    const [posts] = await db.execute(`
      SELECT p.*, u.name as author_name, u.email as author_email
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.user_id = ? AND p.is_published = TRUE 
        AND (p.is_public = TRUE OR p.user_id = ?)
      ORDER BY p.created_at DESC
    `, [userId, current_user_id]);

    // Добавляем счетчики для каждого поста
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const [likes] = await db.execute(
          'SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?',
          [post.post_id]
        );

        const [comments] = await db.execute(
          'SELECT COUNT(*) as count FROM comments WHERE post_id = ?',
          [post.post_id]
        );

        const [userLike] = await db.execute(
          'SELECT 1 as is_liked FROM post_likes WHERE post_id = ? AND user_id = ?',
          [post.post_id, current_user_id]
        );

        return {
          ...post,
          likes_count: likes[0]?.count || 0,
          comments_count: comments[0]?.count || 0,
          is_liked: userLike.length > 0
        };
      })
    );

    res.json(postsWithCounts);
  } catch (error) {
    console.error('Error loading user posts:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Обновление профиля пользователя с аватаркой
app.put('/api/users/:userId/profile', uploadAvatar.single('avatar'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, bio } = req.body;
    
    console.log('Updating profile for user:', userId);
    console.log('Request body:', { name, bio });
    console.log('Uploaded file:', req.file);

    let updateFields = [];
    let params = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      params.push(name);
    }
    
    if (req.file) {
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      updateFields.push('avatar_url = ?');
      params.push(avatarUrl);
      console.log('New avatar URL:', avatarUrl);
    }
    
    if (bio !== undefined) {
      updateFields.push('bio = ?');
      params.push(bio);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }
    
    params.push(userId);
    
    await db.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
      params
    );

    // Получаем обновленный профиль
    const [users] = await db.execute(`
      SELECT user_id, name, email, role, created_at, is_online, last_seen, avatar_url, bio,
             (SELECT COUNT(*) FROM posts WHERE user_id = ? AND is_published = TRUE) as posts_count,
             (SELECT COUNT(*) FROM friendships WHERE (user_id1 = ? OR user_id2 = ?) AND status = 'accepted') as friends_count
      FROM users WHERE user_id = ?
    `, [userId, userId, userId, userId]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const updatedUser = users[0];
    console.log('Updated user profile:', updatedUser);

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Database error: ' + error.message });
  }
});

// Получение аватарки пользователя
app.get('/api/users/:userId/avatar', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [users] = await db.execute(
      'SELECT avatar_url FROM users WHERE user_id = ?',
      [userId]
    );

    if (users.length === 0 || !users[0].avatar_url) {
      // Возвращаем дефолтную аватарку или 404
      return res.status(404).json({ error: 'Аватар не найден' });
    }

    const avatarPath = path.join(__dirname, users[0].avatar_url);
    
    // Проверяем существует ли файл
    if (!fs.existsSync(avatarPath)) {
      return res.status(404).json({ error: 'Файл аватара не найден' });
    }

    res.sendFile(avatarPath);
  } catch (error) {
    console.error('Error getting avatar:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Удаление друга по friendship_id
app.delete('/api/friends/:friendshipId', async (req, res) => {
  try {
    const { friendshipId } = req.params;
    
    console.log('DELETE /api/friends/:friendshipId called with ID:', friendshipId);

    if (!friendshipId) {
      return res.status(400).json({ error: 'ID дружбы обязателен' });
    }

    // Проверяем существование дружбы
    const [friendships] = await db.execute(
      'SELECT * FROM friendships WHERE friendship_id = ?',
      [friendshipId]
    );

    if (friendships.length === 0) {
      console.log('Friendship not found for ID:', friendshipId);
      return res.status(404).json({ error: 'Запись о дружбе не найдена' });
    }

    const friendship = friendships[0];
    console.log('Found friendship to delete:', friendship);

    // Удаляем запись о дружбе
    await db.execute(
      'DELETE FROM friendships WHERE friendship_id = ?',
      [friendshipId]
    );

    console.log('Friendship deleted successfully');

    res.json({ 
      success: true,
      message: 'Друг успешно удален',
      friendship_id: parseInt(friendshipId),
      deleted_friendship: friendship
    });

  } catch (error) {
    console.error('Ошибка удаления друга:', error);
    res.status(500).json({ 
      success: false,
      error: 'Не удалось удалить друга: ' + error.message 
    });
  }
});

// Удаление друга по user_id
app.delete('/api/friends', async (req, res) => {
  try {
    const { user_id, friend_id } = req.body;
    
    console.log('DELETE /api/friends called with:', { user_id, friend_id });

    if (!user_id || !friend_id) {
      return res.status(400).json({ 
        success: false,
        error: 'ID пользователей обязательны' 
      });
    }

    // Находим friendship_id
    const [friendships] = await db.execute(
      `SELECT friendship_id, user_id1, user_id2, status 
       FROM friendships 
       WHERE status = 'accepted' 
       AND ((user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?))`,
      [user_id, friend_id, friend_id, user_id]
    );

    console.log('Found friendships:', friendships);

    if (friendships.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Запись о дружбе не найдена' 
      });
    }

    const friendshipId = friendships[0].friendship_id;
    console.log('Deleting friendship with ID:', friendshipId);

    // Удаляем запись о дружбе
    await db.execute(
      'DELETE FROM friendships WHERE friendship_id = ?',
      [friendshipId]
    );

    console.log('Friendship deleted successfully');

    res.json({ 
      success: true,
      message: 'Друг успешно удален',
      friendship_id: friendshipId,
      user_id: parseInt(user_id),
      friend_id: parseInt(friend_id)
    });

  } catch (error) {
    console.error('Ошибка удаления друга:', error);
    res.status(500).json({ 
      success: false,
      error: 'Не удалось удалить друга: ' + error.message 
    });
  }
});

// Альтернативный endpoint для удаления по user_id через query parameters
app.delete('/api/friends/remove', async (req, res) => {
  try {
    const { user_id, friend_id } = req.query;
    
    console.log('DELETE /api/friends/remove called with:', { user_id, friend_id });

    if (!user_id || !friend_id) {
      return res.status(400).json({ 
        success: false,
        error: 'ID пользователей обязательны' 
      });
    }

    // Находим friendship_id
    const [friendships] = await db.execute(
      `SELECT friendship_id FROM friendships 
       WHERE status = 'accepted' 
       AND ((user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?))`,
      [user_id, friend_id, friend_id, user_id]
    );

    if (friendships.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Запись о дружбе не найдена' 
      });
    }

    const friendshipId = friendships[0].friendship_id;

    // Удаляем запись о дружбе
    await db.execute(
      'DELETE FROM friendships WHERE friendship_id = ?',
      [friendshipId]
    );

    res.json({ 
      success: true,
      message: 'Друг успешно удален',
      friendship_id: friendshipId
    });

  } catch (error) {
    console.error('Ошибка удаления друга:', error);
    res.status(500).json({ 
      success: false,
      error: 'Не удалось удалить друга' 
    });
  }
});

// Статус сервера
app.get('/status', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    activeUsers: activeUsers.size,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Корневой маршрут
app.get('/', (req, res) => {
  res.json({
    message: 'Социальная сеть API',
    version: '1.0.0',
    endpoints: {
      auth: ['POST /auth/login', 'GET /auth/me'],
      users: ['GET /users', 'POST /users', 'GET /users/search/:query'],
      chats: ['GET /chats/:userId', 'GET /chats/check/:userId/:participantId'],
      messages: ['GET /messages/:chatId'],
      posts: ['GET /api/posts', 'POST /api/posts'],
      friends: ['GET /api/users/:userId/friends', 'POST /api/friends/request'],
      notifications: ['GET /api/users/:userId/notifications']
    }
  });
});

// Обработка ошибок
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Файл слишком большой' });
    }
  }
  
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Запуск сервера
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📱 WebSocket сервер активен на порту ${PORT}`);
  console.log(`🕒 Время запуска: ${new Date().toLocaleString()}`);
});

module.exports = { app, io, activeUsers }; 