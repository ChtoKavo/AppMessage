const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const db = require('./db');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const nodemailer = require('nodemailer')
const bodyParser = require('body-parser');


dotenv.config();

const app = express();
const server = http.createServer(app);

// =========================== НАСТРОЙКА CORS ============================
const corsOptions = {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://localhost:5174"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "Access-Control-Allow-Headers"]
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (corsOptions.origin.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Allow-Headers');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =========================== НАСТРОЙКА SOCKET.IO ============================
const io = socketIo(server, {
  cors: corsOptions,
  allowEIO3: true
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: "Yra222225522@gmail.com",
    pass: "hoxz zegf yeix jgoo",
  },
});

// =========================== НАСТРОЙКА MULTER ДЛЯ ЗАГРУЗКИ ФАЙЛОВ ============================
const audioDir = path.join(__dirname, 'uploads/audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

const audioStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/audio/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'voice-' + uniqueSuffix + '.webm'); 
  }
});

const uploadAudio = multer({
  storage: audioStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только аудио файлы!'), false);
    }
  }
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const mediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
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
  storage: mediaStorage,
  limits: {
    fileSize: 50 * 1024 * 1024
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
    fileSize: 5 * 1024 * 1024 
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars!'), false);
    }
  }
});

const avatarsDir = path.join(__dirname, 'uploads/avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const PORT = process.env.PORT || 5001;
const activeUsers = new Map();

// =========================== SOCKET.IO ОБРАБОТЧИКИ ============================
io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  socket.on('register_user', async (userId) => {
    activeUsers.set(userId.toString(), socket.id);
  
    await db.execute(
      'UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE user_id = ?',
      [userId]
    );
    
    socket.broadcast.emit('user_online', parseInt(userId));
    
    const onlineUsers = Array.from(activeUsers.keys()).map(id => parseInt(id));
    socket.emit('online_users_list', onlineUsers);
  });

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

  socket.on('send_message', async (messageData) => {
    try {
      const { chat_id, user_id, content, message_type = 'text', attachment_url = null } = messageData;
      
      const [result] = await db.execute(
        'INSERT INTO messages (chat_id, user_id, content, message_type, attachment_url) VALUES (?, ?, ?, ?, ?)',
        [chat_id, user_id, content, message_type, attachment_url]
      );

      const [messages] = await db.execute(`
        SELECT m.*, u.name as user_name, u.email as user_email 
        FROM messages m 
        JOIN users u ON m.user_id = u.user_id 
        WHERE m.message_id = ?
      `, [result.insertId]);

      const fullMessage = messages[0];

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

      await db.execute(
        'UPDATE chats SET last_activity = NOW() WHERE chat_id = ?',
        [chat_id]
      );

    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      socket.emit('message_error', { error: 'Не удалось отправить сообщение' });
    }
  });

  socket.on('create_chat', async (chatData) => {
    try {
      const { user_id, participant_id, chat_type = 'private', chat_name = null } = chatData;
      
      const [chatResult] = await db.execute(
        'INSERT INTO chats (chat_type, chat_name, created_by) VALUES (?, ?, ?)',
        [chat_type, chat_name, user_id]
      );

      const chatId = chatResult.insertId;

      await db.execute(
        'INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)',
        [chatId, user_id, chatId, participant_id]
      );

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

  socket.on('update_message', async (updateData) => {
    try {
      const { message_id, content, user_id } = updateData;
      
      const [result] = await db.execute(
        'UPDATE messages SET content = ?, is_edited = TRUE WHERE message_id = ? AND user_id = ?',
        [content, message_id, user_id]
      );

      if (result.affectedRows === 0) {
        socket.emit('message_update_error', { error: 'Сообщение не найдено или нет прав для редактирования' });
        return;
      }

      const [messages] = await db.execute(`
        SELECT m.*, u.name as user_name, u.email as user_email 
        FROM messages m 
        JOIN users u ON m.user_id = u.user_id 
        WHERE m.message_id = ?
      `, [message_id]);

      const updatedMessage = messages[0];

      const [participants] = await db.execute(
        'SELECT user_id FROM chat_participants WHERE chat_id = ?',
        [updatedMessage.chat_id]
      );

      participants.forEach(participant => {
        const participantSocketId = activeUsers.get(participant.user_id.toString());
        if (participantSocketId) {
          io.to(participantSocketId).emit('message_updated', updatedMessage);
        }
      });

    } catch (error) {
      console.error('Ошибка обновления сообщения:', error);
      socket.emit('message_update_error', { error: 'Не удалось обновить сообщение' });
    }
  });

  socket.on('delete_message', async (deleteData) => {
    try {
      const { message_id, user_id } = deleteData;
      
      const [result] = await db.execute(
        'DELETE FROM messages WHERE message_id = ? AND user_id = ?',
        [message_id, user_id]
      );

      if (result.affectedRows === 0) {
        socket.emit('message_delete_error', { error: 'Сообщение не найдено или нет прав для удаления' });
        return;
      }

      socket.emit('message_deleted', { message_id });

    } catch (error) {
      console.error('Ошибка удаления сообщения:', error);
      socket.emit('message_delete_error', { error: 'Не удалось удалить сообщение' });
    }
  });

  socket.on('disconnect', async () => {
    for (let [userId, socketId] of activeUsers.entries()) {
      if (socketId === socket.id) {
        activeUsers.delete(userId);
        
        await db.execute(
          'UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE user_id = ?',
          [userId]
        );
        
        socket.broadcast.emit('user_offline', parseInt(userId));
        break;
      }
    }
  });
});

// =========================== API ДЛЯ ЧАТОВ И СООБЩЕНИЙ ============================
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

app.put('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content, user_id } = req.body;

    if (!content || !user_id) {
      return res.status(400).json({ error: 'content и user_id обязательны' });
    }

    const [result] = await db.execute(
      'UPDATE messages SET content = ?, is_edited = TRUE WHERE message_id = ? AND user_id = ?',
      [content, messageId, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено или нет прав для редактирования' });
    }

    const [messages] = await db.execute(`
      SELECT m.*, u.name as user_name, u.email as user_email 
      FROM messages m 
      JOIN users u ON m.user_id = u.user_id 
      WHERE m.message_id = ?
    `, [messageId]);

    const updatedMessage = messages[0];

    res.json(updatedMessage);
  } catch (error) {
    console.error('Ошибка редактирования сообщения:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id обязателен' });
    }

    const [result] = await db.execute(
      'DELETE FROM messages WHERE message_id = ? AND user_id = ?',
      [messageId, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено или нет прав для удаления' });
    }

    res.json({ message: 'Сообщение успешно удалено' });
  } catch (error) {
    console.error('Ошибка удаления сообщения:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =========================== API ДЛЯ ЗАГРУЗКИ ФАЙЛОВ ============================
app.post('/messages/upload-voice', uploadAudio.single('audio'), async (req, res) => {
  try {
    const { chat_id, user_id, duration } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Аудио файл не загружен' });
    }

    if (!chat_id || !user_id) {
      return res.status(400).json({ error: 'chat_id и user_id обязательны' });
    }

    const attachment_url = `/uploads/audio/${req.file.filename}`;

    const [result] = await db.execute(
      'INSERT INTO messages (chat_id, user_id, content, message_type, attachment_url, duration) VALUES (?, ?, ?, ?, ?, ?)',
      [chat_id, user_id, 'Голосовое сообщение', 'voice', attachment_url, duration || 0]
    );

    const [messages] = await db.execute(`
      SELECT m.*, u.name as user_name, u.email as user_email 
      FROM messages m 
      JOIN users u ON m.user_id = u.user_id 
      WHERE m.message_id = ?
    `, [result.insertId]);

    const fullMessage = messages[0];

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

    await db.execute(
      'UPDATE chats SET last_activity = NOW() WHERE chat_id = ?',
      [chat_id]
    );

    res.json({
      message: 'Голосовое сообщение успешно отправлено',
      uploadedMessage: fullMessage
    });

  } catch (error) {
    console.error('Ошибка загрузки голосового сообщения:', error);
    res.status(500).json({ error: 'Ошибка загрузки голосового сообщения: ' + error.message });
  }
});

app.post('/messages/upload', upload.single('file'), async (req, res) => {
  try {
    const { chat_id, user_id } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    if (!chat_id || !user_id) {
      return res.status(400).json({ error: 'chat_id и user_id обязательны' });
    }

    let message_type = 'file';
    let content = req.file.originalname;
    
    if (req.file.mimetype.startsWith('image/')) {
      message_type = 'image';
      content = 'Изображение';
    } else if (req.file.mimetype.startsWith('video/')) {
      message_type = 'video';
      content = 'Видео';
    }

    const fileType = req.file.mimetype.startsWith('image/') ? 'images' : 
                    req.file.mimetype.startsWith('video/') ? 'videos' : 'files';
    const attachment_url = `/uploads/${fileType}/${req.file.filename}`;

    const [result] = await db.execute(
      'INSERT INTO messages (chat_id, user_id, content, message_type, attachment_url) VALUES (?, ?, ?, ?, ?)',
      [chat_id, user_id, content, message_type, attachment_url]
    );

    const [messages] = await db.execute(`
      SELECT m.*, u.name as user_name, u.email as user_email 
      FROM messages m 
      JOIN users u ON m.user_id = u.user_id 
      WHERE m.message_id = ?
    `, [result.insertId]);

    const fullMessage = messages[0];

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

// =========================== API ДЛЯ АУТЕНТИФИКАЦИИ И ПОЛЬЗОВАТЕЛЕЙ ============================
app.get('/users', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT user_id, name, email, role, created_at, is_online, last_seen FROM users');
    res.json(rows);
  } catch(error) {
    console.error(error);
    res.status(500).json({error: 'Database error'});
  }
});

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

app.post('/users/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email обязателен' });
    }

    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    
    res.json({ 
      exists: users.length > 0,
      is_confirmed: users.length > 0 ? users[0].is_confirmed : false
    });

  } catch (error) {
    console.error('Ошибка проверки email:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.post('/resend-confirmation', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email обязателен' });
    }

    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = users[0];

    if (user.is_confirmed) {
      return res.status(400).json({ error: 'Email уже подтвержден' });
    }

    const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();

    await db.execute(
      'UPDATE users SET confirmation_code = ?, updated_at = NOW() WHERE email = ?',
      [confirmationCode, email]
    );

    const mailOptions = {
      from: ' "Chil Out" <Yra222225522@gmail.com>',
      to: email,
      subject: 'Новый код подтверждения регистрации',
      html: `
        <!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin: 0;
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 500px;
      margin: 0 auto;
      background: white;
      border-radius: 15px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .header {
      background: #8a9bd4ff;
      color: white;
      padding: 25px 30px 20px;
      text-align: center;
    }
    .logo-container {
      margin-bottom: 15px;
    }
    .logo {
      max-width: 120px;
      height: auto;
      filter: brightness(0) invert(1);
    }
    .content {
      padding: 30px;
    }
    .code-container {
      background: linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%);
      border-radius: 12px;
      padding: 25px;
      margin: 25px 0;
      text-align: center;
      border: 1px solid #e1e5ff;
      position: relative;
      overflow: hidden;
    }
    .code-container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ffa705, #ff6b00);
    }
    .code {
      font-size: 42px;
      font-weight: 800;
      color: #ff6b00;
      letter-spacing: 8px;
      margin: 15px 0;
      text-shadow: 0 2px 4px rgba(255, 107, 0, 0.2);
      font-family: 'Courier New', monospace;
    }
    .note {
      background: #fff9e6;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    .footer-logo {
      max-width: 80px;
      height: auto;
      margin-bottom: 10px;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-container">
        <img src="./image/Лого.png" alt="Chill Out" class="logo">
      </div>
      <h1 style="margin: 0; font-size: 24px;">Новый код для входа в Chill Out</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">Ваш новый код доступа</p>
    </div>
    
    <div class="content">
      <p>Здравствуйте!</p>
      <p>Вы запросили новый код подтверждения. Для завершения регистрации введите следующий код:</p>
      
      <div class="code-container">
        <div class="code">${confirmationCode}</div>
        <p style="color: #666; margin: 5px 0; font-size: 14px;">Новый код подтверждения</p>
      </div>
      
      <div class="note">
        <strong>Важно:</strong> Никому не сообщайте этот код. 
        Срок действия кода — 10 минут.
      </div>
      
      <div class="footer">
        <img src="/Лого.png" alt="Chill Out" class="footer-logo">
        <p style="color: #888; font-size: 12px; margin: 5px 0;">
          Если вы не запрашивали новый код, пожалуйста, проигнорируйте это письмо.
        </p>
        <p style="color: #aaa; font-size: 11px; margin: 5px 0;">
          © 2024 Chill Out. Все права защищены.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
      `
    };

    await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Ошибка отправки email:', error);
          reject(error);
        } else {
          console.log('Новый код отправлен:', info.response);
          resolve(info);
        }
      });
    });

    res.status(200).json({ 
      message: 'Новый код подтверждения отправлен на ваш email.',
      email: email
    });

  } catch (error) {
    console.error('Ошибка повторной отправки кода:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.post('/users', async (req, res) => {
  try {
    const { name, surname, nick, email, password, categories } = req.body;
    
    if (!name || !surname || !email || !password) {
      return res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' });
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

   
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      
      const [result] = await connection.execute(
        'INSERT INTO users (name, surname, nick, email, password, is_confirmed) VALUES (?, ?, ?, ?, ?, ?)',
        [name, surname, nick, email, password, false]
      );

      const userId = result.insertId;

      
      if (categories && Array.isArray(categories) && categories.length > 0) {
        
        const placeholders = categories.map(() => '?').join(',');
        const [existingCategories] = await connection.execute(
          `SELECT category_id FROM categories WHERE category_id IN (${placeholders})`,
          categories
        );

        const validCategoryIds = existingCategories.map(cat => cat.category_id);
        
        if (validCategoryIds.length > 0) {
          // Исправленный способ массовой вставки
          const values = validCategoryIds.map(categoryId => [userId, categoryId]);
          const valuePlaceholders = values.map(() => '(?, ?)').join(',');
          const flatValues = values.flat();
          
          await connection.execute(
            `INSERT INTO user_categories (user_id, category_id) VALUES ${valuePlaceholders}`,
            flatValues
          );
        }
      }

      
      const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();

      await connection.execute(
        'UPDATE users SET confirmation_code = ?, updated_at = NOW() WHERE user_id = ?',
        [confirmationCode, userId]
      );

      
      const mailOptions = {
        from: 'Yra222225522@gmail.com',
        to: email,
        subject: 'Код подтверждения регистрации',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                padding: 20px;
                min-height: 100vh;
              }
              .container {
                max-width: 500px;
                margin: 0 auto;
                background: white;
                border-radius: 15px;
                overflow: hidden;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              }
              .header {
                background: #8a9bd4ff;
                color: white;
                padding: 30px;
                text-align: center;
              }
              .content {
                padding: 40px 30px;
              }
              .code-container {
                background: #f8f9ff;
                border-radius: 12px;
                padding: 25px;
                margin: 25px 0;
                text-align: center;
                border: 1px solid #e1e5ff;
              }
              .code {
                font-size: 42px;
                font-weight: 800;
                color: #ffa705;
                letter-spacing: 8px;
                margin: 10px 0;
              }
              .note {
                background: #fff9e6;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .button {
                display: inline-block;
                background-color: #ffa705;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 25px;
                margin: 10px 0;
                font-weight: 600;
              }
              .user-info {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 15px;
                margin: 15px 0;
                border-left: 4px solid #8a9bd4;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 28px;">Добро пожаловать в Chill Out!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Ваш код подтверждения регистрации</p>
              </div>
              
              <div class="content">
                <div class="user-info">
                  <p style="margin: 0; color: #555;">Здравствуйте, <strong>${name} ${surname}</strong>!</p>
                  <p style="margin: 5px 0 0 0; color: #555;">Благодарим за регистрацию в нашем сообществе.</p>
                </div>
                
                <p>Для завершения регистрации введите следующий код подтверждения:</p>
                
                <div class="code-container">
                  <div class="code">${confirmationCode}</div>
                  <p style="color: #666; margin: 5px 0;">Код подтверждения</p>
                </div>
                
                <div class="note">
                  <strong>Важно:</strong> Никому не сообщайте этот код. 
                  Срок действия кода — 10 минут.
                </div>
                
                <p style="text-align: center;">
                  <span class="button">Использовать код</span>
                </p>
                
                <p style="color: #888; font-size: 14px; text-align: center;">
                  Если вы не запрашивали регистрацию, пожалуйста, проигнорируйте это письмо.
                </p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      await new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Ошибка отправки email:', error);
            reject(error);
          } else {
            console.log('Email отправлен:', info.response);
            resolve(info);
          }
        });
      });

      // Фиксируем транзакцию
      await connection.commit();

      // Получаем данные созданного пользователя (без пароля)
      const [newUser] = await db.execute(
        'SELECT user_id, name, surname, nick, email, role, created_at FROM users WHERE user_id = ?',
        [userId]
      );

      res.status(201).json({ 
        message: 'Регистрация успешна. Код подтверждения отправлен на ваш email.',
        user_id: userId,
        email: email,
        requires_confirmation: true,
        user: newUser[0]
      });

    } catch (error) {
      // Откатываем транзакцию в случае ошибки
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch(error) {
    console.error('Database error:', error);
    
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }
    
    res.status(500).json({ error: 'Внутренняя ошибка сервера: ' + error.message });
  }
});

app.post('/confirm-email', async (req, res) => {
  try {
    const { email, confirmationCode } = req.body;

    if (!email || !confirmationCode) {
      return res.status(400).json({ error: 'Email и код подтверждения обязательны' });
    }

    const [users] = await db.execute(
      'SELECT * FROM users WHERE email = ? AND confirmation_code = ?',
      [email, confirmationCode]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Неверный код подтверждения' });
    }

    await db.execute(
      'UPDATE users SET is_confirmed = true, confirmation_code = NULL WHERE email = ?',
      [email]
    );

    
    const [confirmedUser] = await db.execute(
      `SELECT u.user_id, u.name, u.surname, u.nick, u.email, u.role, u.created_at, 
              u.is_online, u.last_seen, u.avatar_url, u.bio
       FROM users u 
       WHERE u.email = ?`,
      [email]
    );

   
    const [userCategories] = await db.execute(
      `SELECT c.category_id, c.name, c.icon 
       FROM user_categories uc 
       JOIN categories c ON uc.category_id = c.category_id 
       WHERE uc.user_id = ?`,
      [confirmedUser[0].user_id]
    );

    const userData = {
      ...confirmedUser[0],
      categories: userCategories
    };

    res.status(200).json({
      message: 'Email успешно подтвержден',
      user: userData
    });

  } catch (error) {
    console.error('Ошибка подтверждения email:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const [users] = await db.execute(
      'SELECT user_id, name, surname, nick, email, password, role, is_confirmed FROM users WHERE email = ?',
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

app.get('/auth/me', async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: 'ID пользователя обязателен' });
    }

    const [users] = await db.execute(
      'SELECT user_id, name, surname, nick, email, role, created_at, is_online, last_seen FROM users WHERE user_id = ?',
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

// =========================== API ДЛЯ СОЦИАЛЬНЫХ ФУНКЦИЙ ============================
app.get('/api/posts', async (req, res) => {
  try {
    const { page = 1, limit = 10, user_id } = req.query;
    
    let query = `
      SELECT p.*, u.name as author_name, u.email as author_email
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.is_published = TRUE AND (p.is_public = TRUE OR p.user_id = ?)
      ORDER BY p.created_at DESC
    `;

    const limitNum = parseInt(limit) || 10;
    const pageNum = parseInt(page) || 1;
    const offset = (pageNum - 1) * limitNum;
    
    query += ` LIMIT ${limitNum} OFFSET ${offset}`;

    const [posts] = await db.execute(query, [user_id]);

    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        try {
          const [likes] = await db.execute(
            'SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?',
            [post.post_id]
          );

          const [comments] = await db.execute(
            'SELECT COUNT(*) as count FROM comments WHERE post_id = ?',
            [post.post_id]
          );

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

app.post('/api/posts/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const { user_id } = req.body;
    
    if (!postId || !user_id) {
      return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
    }

    const [existingLikes] = await db.execute(
      'SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?',
      [postId, user_id]
    );

    let is_liked;
    let likes_count;

    if (existingLikes.length > 0) {
      await db.execute(
        'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
        [postId, user_id]
      );
      
      await db.execute(
        'UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE post_id = ?',
        [postId]
      );

      is_liked = false;
      
      const [postResult] = await db.execute(
        'SELECT likes_count FROM posts WHERE post_id = ?',
        [postId]
      );
      likes_count = postResult[0]?.likes_count || 0;
    } else {
      await db.execute(
        'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)',
        [postId, user_id]
      );
      
      await db.execute(
        'UPDATE posts SET likes_count = likes_count + 1 WHERE post_id = ?',
        [postId]
      );

      is_liked = true;
      
      const [postResult] = await db.execute(
        'SELECT likes_count FROM posts WHERE post_id = ?',
        [postId]
      );
      likes_count = postResult[0]?.likes_count || 0;

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

app.post('/api/posts', upload.single('media'), async (req, res) => {
  try {
    const { user_id, title, content, category_id = 1, is_public = 'true' } = req.body;
    
    if (!user_id || !content) {
      return res.status(400).json({ error: 'user_id и content обязательны' });
    }

    const media_url = req.file ? `/uploads/${req.file.filename}` : null;

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

    const [posts] = await db.execute(`
      SELECT p.*, u.name as author_name, u.email as author_email 
      FROM posts p 
      JOIN users u ON p.user_id = u.user_id 
      WHERE p.post_id = ?
    `, [result.insertId]);

    const newPost = posts[0];

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

app.get('/api/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { user_id } = req.query;

    const [comments] = await db.execute(`
      SELECT c.*, u.name as user_name, u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `, [postId]);

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

app.post('/api/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { user_id, content, parent_comment_id = null } = req.body;
    
    if (!postId || !user_id || !content) {
      return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
    }

    const [result] = await db.execute(
      'INSERT INTO comments (post_id, user_id, content, parent_comment_id) VALUES (?, ?, ?, ?)',
      [postId, user_id, content, parent_comment_id]
    );

    await db.execute(
      'UPDATE posts SET comments_count = comments_count + 1 WHERE post_id = ?',
      [postId]
    );

    const [comments] = await db.execute(`
      SELECT c.*, u.name as user_name, u.email as user_email 
      FROM comments c 
      JOIN users u ON c.user_id = u.user_id 
      WHERE c.comment_id = ?
    `, [result.insertId]);

    const fullComment = comments[0];

    const [posts] = await db.execute(
      'SELECT user_id FROM posts WHERE post_id = ?',
      [postId]
    );
    
    if (posts.length > 0 && posts[0].user_id !== user_id) {
      await db.execute(
        'INSERT INTO notifications (user_id, from_user_id, type, post_id, comment_id) VALUES (?, ?, "comment", ?, ?)',
        [posts[0].user_id, user_id, postId, result.insertId]
      );
    }

    res.status(201).json(fullComment);

  } catch (error) {
    console.error('Ошибка добавления комментария:', error);
    res.status(500).json({ error: 'Не удалось добавить комментарий' });
  }
});

app.post('/api/comments/:commentId/like', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { user_id } = req.body;
    
    if (!commentId || !user_id) {
      return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
    }

    const [existingLikes] = await db.execute(
      'SELECT * FROM comment_likes WHERE comment_id = ? AND user_id = ?',
      [commentId, user_id]
    );

    let is_liked;
    let likes_count;

    if (existingLikes.length > 0) {
      await db.execute(
        'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?',
        [commentId, user_id]
      );
      
      is_liked = false;
    } else {
      await db.execute(
        'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)',
        [commentId, user_id]
      );
      
      is_liked = true;
    }

    const [likes] = await db.execute(
      'SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ?',
      [commentId]
    );

    likes_count = likes[0]?.count || 0;

    res.json({ 
      comment_id: parseInt(commentId),
      user_id: parseInt(user_id),
      is_liked,
      likes_count
    });

  } catch (error) {
    console.error('Ошибка лайка комментария:', error);
    res.status(500).json({ error: 'Не удалось обработать лайк комментария' });
  }
});

// =========================== API ДЛЯ ДРУЗЕЙ ============================
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

app.post('/api/friends/request', async (req, res) => {
  try {
    const { from_user_id, to_user_id } = req.body;
    
    const [result] = await db.execute(
      'INSERT INTO friendships (user_id1, user_id2, action_user_id, status) VALUES (?, ?, ?, "pending")',
      [from_user_id, to_user_id, from_user_id]
    );

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

app.post('/api/friends/respond', async (req, res) => {
  try {
    const { friendship_id, response, user_id } = req.body;
    
    await db.execute(
      'UPDATE friendships SET status = ? WHERE friendship_id = ?',
      [response, friendship_id]
    );

    if (response === 'accepted') {
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

app.delete('/api/friends/:friendshipId', async (req, res) => {
  try {
    const { friendshipId } = req.params;
    
    if (!friendshipId) {
      return res.status(400).json({ error: 'ID дружбы обязателен' });
    }

    const [friendships] = await db.execute(
      'SELECT * FROM friendships WHERE friendship_id = ?',
      [friendshipId]
    );

    if (friendships.length === 0) {
      return res.status(404).json({ error: 'Запись о дружбе не найдена' });
    }

    await db.execute(
      'DELETE FROM friendships WHERE friendship_id = ?',
      [friendshipId]
    );

    res.json({ 
      success: true,
      message: 'Друг успешно удален',
      friendship_id: parseInt(friendshipId)
    });

  } catch (error) {
    console.error('Ошибка удаления друга:', error);
    res.status(500).json({ 
      success: false,
      error: 'Не удалось удалить друга: ' + error.message 
    });
  }
});

app.delete('/api/friends', async (req, res) => {
  try {
    const { user_id, friend_id } = req.body;
    
    if (!user_id || !friend_id) {
      return res.status(400).json({ 
        success: false,
        error: 'ID пользователей обязательны' 
      });
    }

    const [friendships] = await db.execute(
      `SELECT friendship_id, user_id1, user_id2, status 
       FROM friendships 
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

    await db.execute(
      'DELETE FROM friendships WHERE friendship_id = ?',
      [friendshipId]
    );

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

app.get('/api/friends/check/:userId/:friendId', async (req, res) => {
  try {
    const { userId, friendId } = req.params;
    
    const [friendships] = await db.execute(
      `SELECT friendship_id, status, action_user_id 
       FROM friendships 
       WHERE ((user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?))`,
      [userId, friendId, friendId, userId]
    );

    if (friendships.length === 0) {
      return res.json({ 
        is_friend: false,
        status: 'not_friends'
      });
    }

    const friendship = friendships[0];
    
    res.json({
      is_friend: friendship.status === 'accepted',
      status: friendship.status,
      friendship_id: friendship.friendship_id,
      is_pending: friendship.status === 'pending',
      action_user_id: friendship.action_user_id
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// =========================== API ДЛЯ УВЕДОМЛЕНИЙ ============================
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

// =========================== API ДЛЯ ПРОФИЛЕЙ ============================
app.get('/api/users/:userId/profile', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [users] = await db.execute(`
      SELECT u.user_id, u.name, u.surname, u.nick, u.email, u.role, u.created_at, u.is_online, u.last_seen, u.avatar_url, u.bio,
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

app.get('/api/users/:userId/posts', async (req, res) => {
  try {
    const { userId } = req.params;
    const { current_user_id } = req.query;

    const [posts] = await db.execute(`
      SELECT p.*, u.name as author_name, u.email as author_email
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.user_id = ? AND p.is_published = TRUE 
        AND (p.is_public = TRUE OR p.user_id = ?)
      ORDER BY p.created_at DESC
    `, [userId, current_user_id]);

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

app.put('/api/users/:userId/profile', uploadAvatar.single('avatar'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, bio } = req.body;
    
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

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Database error: ' + error.message });
  }
});

app.get('/api/users/:userId/avatar', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [users] = await db.execute(
      'SELECT avatar_url FROM users WHERE user_id = ?',
      [userId]
    );

    if (users.length === 0 || !users[0].avatar_url) {
      return res.status(404).json({ error: 'Аватар не найден' });
    }

    const avatarPath = path.join(__dirname, users[0].avatar_url);
    
    if (!fs.existsSync(avatarPath)) {
      return res.status(404).json({ error: 'Файл аватара не найден' });
    }

    res.sendFile(avatarPath);
  } catch (error) {
    console.error('Error getting avatar:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/users/search/:query', async (req, res) => {
  try {
    const query = `%${req.params.query}%`;
    
    const [users] = await db.execute(
      'SELECT user_id, name, email, avatar_url, is_online, last_seen FROM users WHERE name LIKE ? OR email LIKE ? OR nick LIKE ? LIMIT 20',
      [query, query, query]
    );

    res.json(users);
  } catch(error) {
    console.error(error);
    res.status(500).json({error: 'Database error'});
  }
});

// =========================== СЛУЖЕБНЫЕ МАРШРУТЫ ============================
app.get('/status', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    activeUsers: activeUsers.size,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Социальная сеть API',
    version: '1.0.0',
    endpoints: {
      auth: ['POST /auth/login', 'GET /auth/me'],
      users: ['GET /users', 'POST /users', 'GET /users/search/:query'],
      chats: ['GET /chats/:userId', 'GET /chats/check/:userId/:participantId'],
      messages: ['GET /messages/:chatId', 'PUT /messages/:messageId', 'DELETE /messages/:messageId'],
      posts: ['GET /api/posts', 'POST /api/posts'],
      friends: ['GET /api/users/:userId/friends', 'POST /api/friends/request'],
      notifications: ['GET /api/users/:userId/notifications']
    }
  });
});

app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Файл слишком большой' });
    }
  }
  
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📱 WebSocket сервер активен на порту ${PORT}`);
  console.log(`🕒 Время запуска: ${new Date().toLocaleString()}`);
  console.log(`🌐 CORS настроен для: ${corsOptions.origin.join(', ')}`);
});

module.exports = { app, io, activeUsers };