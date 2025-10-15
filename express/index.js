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

        // Создаем папки если они не существуют
  const ensureDirectories = () => {
    const directories = [
      'uploads',
      'uploads/avatars', 
      'uploads/banners',
      'uploads/audio',
      'uploads/images',
      'uploads/videos',
      'uploads/files',
      'uploads/gallery' 
    ];
    
    directories.forEach(dir => {
      const fullPath = path.join(__dirname, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Created directory: ${fullPath}`);
      }
      
      // Проверяем права на запись
      try {
        fs.accessSync(fullPath, fs.constants.W_OK);
        console.log(`Write access OK: ${fullPath}`);
      } catch (accessError) {
        console.error(`No write access to: ${fullPath}`, accessError);
      }
    });
  };

  // Вызываем при запуске сервера
  ensureDirectories();

        // =========================== НАСТРОЙКА CORS ============================
        const corsOptions = {
          origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://localhost:5174"],
          credentials: true,
          methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
          allowedHeaders: [
            "Content-Type", 
            "Authorization", 
            "X-Requested-With", 
            "Accept", 
            "Origin", 
            "Access-Control-Allow-Headers",
            "user-id",
            "x-user-id"
          ],
          exposedHeaders: ["Content-Range", "X-Content-Range"]
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
          res.header('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
          res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
          res.header('Access-Control-Expose-Headers', corsOptions.exposedHeaders.join(', '));
          

          if (req.method === 'OPTIONS') {
            return res.status(200).end();
          }
          
          next();
        });

        // =========================== ОБСЛУЖИВАНИЕ СТАТИЧЕСКИХ ФАЙЛОВ ============================


        app.use('/uploads/gallery', express.static(path.join(__dirname, 'uploads/gallery'), {
    setHeaders: (res, path) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }));

        const profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      if (file.fieldname === 'avatar') {
        const dir = 'uploads/avatars/';
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
      } else if (file.fieldname === 'banner') {
        const dir = 'uploads/banners/';
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
      } else {
        cb(new Error('Unexpected field'), false);
      }
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const uploadProfile = multer({ 
    storage: profileStorage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'), false);
      }
    }
  }).fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
  ]);

        const bannerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/banners/')
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'banner-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const uploadBanner = multer({ 
    storage: bannerStorage,
    limits: {
      fileSize: 5 * 1024 * 1024 
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for banners!'), false);
      }
    }
  });

  const bannersDir = path.join(__dirname, 'uploads/banners');
  if (!fs.existsSync(bannersDir)) {
    fs.mkdirSync(bannersDir, { recursive: true });
  }
  
  // Обслуживание статических файлов с правильными заголовками
  app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, path) => {
      // Отключаем кэширование для разработки
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Устанавливаем правильные заголовки для изображений
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (path.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (path.endsWith('.gif')) {
        res.setHeader('Content-Type', 'image/gif');
      } else if (path.endsWith('.webp')) {
        res.setHeader('Content-Type', 'image/webp');
      }
    }
  }));

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

        // Обслуживание статических файлов
  app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads/avatars'), {
    setHeaders: (res, path) => {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }));

  app.use('/uploads/banners', express.static(path.join(__dirname, 'uploads/banners'), {
    setHeaders: (res, path) => {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }));

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

        // Добавьте этот endpoint после существующего /chats/check
  app.post('/chats', async (req, res) => {
    try {
      const { user_id, participant_id, chat_type = 'private', chat_name = null } = req.body;
      
      console.log('Создание чата с данными:', req.body);

      if (!user_id || !participant_id) {
        return res.status(400).json({ error: 'user_id и participant_id обязательны' });
      }

      // Проверяем существование пользователей
      const [users] = await db.execute(
        'SELECT user_id FROM users WHERE user_id IN (?, ?)',
        [user_id, participant_id]
      );

      if (users.length !== 2) {
        return res.status(404).json({ error: 'Один из пользователей не найден' });
      }

      const connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        // Создаем чат
        const [chatResult] = await connection.execute(
          'INSERT INTO chats (chat_type, chat_name, created_by) VALUES (?, ?, ?)',
          [chat_type, chat_name, user_id]
        );

        const chatId = chatResult.insertId;

        // Добавляем участников
        await connection.execute(
          'INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)',
          [chatId, user_id, chatId, participant_id]
        );

        // Получаем созданный чат с полной информацией
        const [chats] = await connection.execute(`
          SELECT c.*, 
                GROUP_CONCAT(u.user_id) as participant_ids,
                GROUP_CONCAT(u.name) as participant_names
          FROM chats c
          JOIN chat_participants cp ON c.chat_id = cp.chat_id
          JOIN users u ON cp.user_id = u.user_id
          WHERE c.chat_id = ?
          GROUP BY c.chat_id
        `, [chatId]);

        await connection.commit();

        const newChat = chats[0];
        console.log('Чат успешно создан:', newChat);

        // Отправляем уведомление через WebSocket
        [user_id, participant_id].forEach(userId => {
          const userSocketId = activeUsers.get(userId.toString());
          if (userSocketId) {
            io.to(userSocketId).emit('chat_created', newChat);
          }
        });

        res.status(201).json(newChat);

      } catch (transactionError) {
        await connection.rollback();
        throw transactionError;
      } finally {
        connection.release();
      }

    } catch (error) {
      console.error('Ошибка создания чата:', error);
      res.status(500).json({ error: 'Не удалось создать чат: ' + error.message });
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


        // =========================== API ДЛЯ АДМИНИСТРАТОРА ============================


        // Получение всех постов для админ-панели (исправленная версия)
        app.get('/admin/posts', async (req, res) => {
          let connection;
          try {
            console.log('=== НАЧАЛО ЗАПРОСА ADMIN/POSTS ===');
            
            const { limit = '100' } = req.query;
            console.log('Получен лимит:', limit);
            
            // Получаем соединение для отладки
            connection = await db.getConnection();
            
            // Сначала просто получаем все посты без сложных JOIN
            const simpleQuery = `
              SELECT 
                post_id,
                user_id,
                title,
                content,
                image_url,
                is_public,
                is_published,
                created_at,
                updated_at
              FROM posts 
              ORDER BY created_at DESC
            `;
            
            console.log('Выполняем простой запрос постов');
            const [posts] = await connection.execute(simpleQuery);
            console.log(`Найдено постов в БД: ${posts.length}`);

            if (posts.length === 0) {
              console.log('В базе данных нет постов');
              return res.json([]);
            }

            // Теперь для каждого поста получаем информацию об авторе и счетчики
            const postsWithDetails = [];
            
            for (const post of posts) {
              try {
                // Получаем информацию об авторе
                const [users] = await connection.execute(
                  'SELECT name, email FROM users WHERE user_id = ?',
                  [post.user_id]
                );
                
                const author = users[0] || { name: 'Неизвестный', email: 'unknown@example.com' };

                // Получаем счетчики
                const [likes] = await connection.execute(
                  'SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?',
                  [post.post_id]
                );

                const [comments] = await connection.execute(
                  'SELECT COUNT(*) as count FROM comments WHERE post_id = ?',
                  [post.post_id]
                );

                postsWithDetails.push({
                  post_id: post.post_id,
                  user_id: post.user_id,
                  title: post.title,
                  content: post.content,
                  image_url: post.image_url,
                  is_public: Boolean(post.is_public),
                  is_published: Boolean(post.is_published),
                  created_at: post.created_at,
                  updated_at: post.updated_at,
                  author_name: author.name,
                  author_email: author.email,
                  likes_count: likes[0]?.count || 0,
                  comments_count: comments[0]?.count || 0
                });

              } catch (postError) {
                console.error(`Ошибка обработки поста ${post.post_id}:`, postError);
                // Добавляем пост с базовой информацией
                postsWithDetails.push({
                  post_id: post.post_id,
                  user_id: post.user_id,
                  title: post.title,
                  content: post.content,
                  image_url: post.image_url,
                  is_public: Boolean(post.is_public),
                  is_published: Boolean(post.is_published),
                  created_at: post.created_at,
                  updated_at: post.updated_at,
                  author_name: 'Ошибка загрузки',
                  author_email: 'error@example.com',
                  likes_count: 0,
                  comments_count: 0
                });
              }
            }

            // Применяем лимит
            const limitNum = parseInt(limit);
            const finalPosts = isNaN(limitNum) ? postsWithDetails : postsWithDetails.slice(0, limitNum);
            
            console.log(`Возвращаем постов: ${finalPosts.length}`);
            console.log('=== УСПЕШНОЕ ЗАВЕРШЕНИЕ ЗАПРОСА ===');
            
            res.json(finalPosts);
            
          } catch (error) {
            console.error('=== КРИТИЧЕСКАЯ ОШИБКА В ADMIN/POSTS ===');
            console.error('Ошибка:', error.message);
            console.error('Stack:', error.stack);
            
            res.status(500).json({ 
              error: 'Database error',
              message: error.message,
              details: 'Ошибка при выполнении запроса к базе данных'
            });
          } finally {
            if (connection) {
              connection.release();
            }
          }
        });

        // Endpoint для проверки состояния базы данных
        app.get('/admin/debug', async (req, res) => {
          try {
            console.log('=== DEBUG INFORMATION ===');
            
            const connection = await db.getConnection();
            
            // Проверяем таблицу posts
            const [postsInfo] = await connection.execute('SHOW COLUMNS FROM posts');
            console.log('Структура таблицы posts:', postsInfo);
            
            const [postsCount] = await connection.execute('SELECT COUNT(*) as count FROM posts');
            console.log('Количество постов:', postsCount[0].count);
            
            // Проверяем таблицу users
            const [usersCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
            console.log('Количество пользователей:', usersCount[0].count);
            
            // Пробуем выполнить простой запрос
            const [samplePosts] = await connection.execute('SELECT * FROM posts LIMIT 3');
            console.log('Пример постов:', samplePosts);
            
            connection.release();
            
            res.json({
              posts_structure: postsInfo,
              posts_count: postsCount[0].count,
              users_count: usersCount[0].count,
              sample_posts: samplePosts
            });
            
          } catch (error) {
            console.error('DEBUG ERROR:', error);
            res.status(500).json({ error: error.message });
          }
        });

        // Упрощенный endpoint для постов (без счетчиков)
        app.get('/admin/posts-simple', async (req, res) => {
          try {
            console.log('=== УПРОЩЕННЫЙ ЗАПРОС ПОСТОВ ===');
            
            const query = `
              SELECT 
                p.post_id,
                p.user_id,
                p.title,
                p.content,
                p.image_url,
                p.is_public,
                p.is_published,
                p.created_at,
                p.updated_at,
                u.name as author_name,
                u.email as author_email
              FROM posts p
              LEFT JOIN users u ON p.user_id = u.user_id
              ORDER BY p.created_at DESC
              LIMIT 100
            `;
            
            console.log('Выполняем упрощенный запрос');
            const [posts] = await db.execute(query);
            console.log(`Успешно загружено постов: ${posts.length}`);
            
            // Просто возвращаем посты без дополнительных запросов
            const simplePosts = posts.map(post => ({
              ...post,
              likes_count: 0,
              comments_count: 0,
              is_public: Boolean(post.is_public),
              is_published: Boolean(post.is_published)
            }));
            
            res.json(simplePosts);
            
          } catch (error) {
            console.error('Ошибка в упрощенном запросе:', error);
            res.status(500).json({ 
              error: 'Database error in simple query',
              message: error.message 
            });
          }
        });

        // Получение всех пользователей для админ-панели
        app.get('/admin/users', async (req, res) => {
          try {
            const [users] = await db.execute(`
              SELECT 
                user_id, 
                name, 
                surname,
                nick,
                email, 
                role, 
                is_active,
                is_online,
                is_confirmed,
                created_at, 
                last_seen,
                avatar_url,
                bio
              FROM users 
              ORDER BY created_at DESC
            `);
            res.json(users);
          } catch(error) {
            console.error('Ошибка загрузки пользователей для админ-панели:', error);
            res.status(500).json({error: 'Database error: ' + error.message});
          }
        });

        // Статистика для админ-панели
        app.get('/admin/statistics', async (req, res) => {
          try {
            // Общее количество пользователей
            const [totalUsers] = await db.execute('SELECT COUNT(*) as count FROM users');
            
            // Общее количество постов
            const [totalPosts] = await db.execute('SELECT COUNT(*) as count FROM posts');
            
            // Активные чаты (чаты с сообщениями за последние 24 часа)
            const [activeChats] = await db.execute(`
              SELECT COUNT(DISTINCT chat_id) as count 
              FROM messages 
              WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            `);
            
            // Онлайн пользователи
            const [onlineUsers] = await db.execute('SELECT COUNT(*) as count FROM users WHERE is_online = TRUE');
            
            // Новые пользователи за последнюю неделю
            const [newUsers] = await db.execute(`
              SELECT COUNT(*) as count 
              FROM users 
              WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            `);
            
            // Новые посты за последнюю неделю
            const [newPosts] = await db.execute(`
              SELECT COUNT(*) as count 
              FROM posts 
              WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            `);

            // Последние действия
            const [recentActivity] = await db.execute(`
              (SELECT 'post' as type, CONCAT('Новый пост от ', u.name) as details, p.created_at as timestamp
              FROM posts p
              JOIN users u ON p.user_id = u.user_id
              ORDER BY p.created_at DESC 
              LIMIT 5)
              UNION ALL
              (SELECT 'user' as type, CONCAT('Новый пользователь: ', name) as details, created_at as timestamp
              FROM users 
              ORDER BY created_at DESC 
              LIMIT 5)
              UNION ALL
              (SELECT 'message' as type, CONCAT('Новое сообщение от ', u.name) as details, m.created_at as timestamp
              FROM messages m
              JOIN users u ON m.user_id = u.user_id
              ORDER BY m.created_at DESC 
              LIMIT 5)
              ORDER BY timestamp DESC 
              LIMIT 10
            `);

            res.json({
              totalUsers: totalUsers[0].count,
              totalPosts: totalPosts[0].count,
              activeChats: activeChats[0].count,
              onlineUsers: onlineUsers[0].count,
              newUsers: newUsers[0].count,
              newPosts: newPosts[0].count,
              recentActivity
            });
          } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
            res.status(500).json({ error: 'Database error: ' + error.message });
          }
        });


        // Удаление пользователя (с обработкой связанных данных)
        app.delete('/admin/users/:userId', async (req, res) => {
          let connection;
          try {
            const { userId } = req.params;
            const { current_user_id } = req.query;
            
            console.log('Попытка удаления пользователя:', userId, 'от пользователя:', current_user_id);

            // Проверяем существование пользователя
            const [users] = await db.execute('SELECT * FROM users WHERE user_id = ?', [userId]);
            if (users.length === 0) {
              return res.status(404).json({ error: 'Пользователь не найден' });
            }

            // Нельзя удалить самого себя
            if (parseInt(userId) === parseInt(current_user_id)) {
              return res.status(400).json({ error: 'Нельзя удалить самого себя' });
            }

            // Получаем соединение для транзакции
            connection = await db.getConnection();
            await connection.beginTransaction();

            try {
              console.log('Начинаем удаление связанных данных пользователя:', userId);

              // 1. Удаляем уведомления, связанные с пользователем
              await connection.execute('DELETE FROM notifications WHERE user_id = ? OR from_user_id = ?', [userId, userId]);
              console.log('Удалены уведомления');

              // 2. Удаляем лайки комментариев
              await connection.execute('DELETE FROM comment_likes WHERE user_id = ?', [userId]);
              console.log('Удалены лайки комментариев');

              // 3. Удаляем комментарии пользователя
              await connection.execute('DELETE FROM comments WHERE user_id = ?', [userId]);
              console.log('Удалены комментарии');

              // 4. Удаляем лайки постов
              await connection.execute('DELETE FROM post_likes WHERE user_id = ?', [userId]);
              console.log('Удалены лайки постов');

              // 5. Обновляем посты - устанавливаем user_id в NULL или удаляем
              // Сначала проверяем, есть ли посты у пользователя
              const [userPosts] = await connection.execute('SELECT post_id FROM posts WHERE user_id = ?', [userId]);
              if (userPosts.length > 0) {
                // Удаляем связанные с постами данные
                for (const post of userPosts) {
                  await connection.execute('DELETE FROM comments WHERE post_id = ?', [post.post_id]);
                  await connection.execute('DELETE FROM post_likes WHERE post_id = ?', [post.post_id]);
                }
                // Удаляем посты пользователя
                await connection.execute('DELETE FROM posts WHERE user_id = ?', [userId]);
                console.log('Удалены посты пользователя');
              }

              // 6. Обрабатываем дружеские связи
              await connection.execute('DELETE FROM friendships WHERE user_id1 = ? OR user_id2 = ?', [userId, userId]);
              console.log('Удалены дружеские связи');

              // 7. Обрабатываем чаты, где пользователь является создателем
              const [userChats] = await connection.execute('SELECT chat_id FROM chats WHERE created_by = ?', [userId]);
              if (userChats.length > 0) {
                for (const chat of userChats) {
                  // Удаляем сообщения в чате
                  await connection.execute('DELETE FROM messages WHERE chat_id = ?', [chat.chat_id]);
                  // Удаляем участников чата
                  await connection.execute('DELETE FROM chat_participants WHERE chat_id = ?', [chat.chat_id]);
                }
                // Удаляем чаты, созданные пользователем
                await connection.execute('DELETE FROM chats WHERE created_by = ?', [userId]);
                console.log('Удалены чаты, созданные пользователем');
              }

              // 8. Удаляем пользователя из чатов (как участника)
              await connection.execute('DELETE FROM chat_participants WHERE user_id = ?', [userId]);
              console.log('Удален пользователь из чатов');

              // 9. Удаляем сообщения пользователя
              await connection.execute('DELETE FROM messages WHERE user_id = ?', [userId]);
              console.log('Удалены сообщения пользователя');

              // 10. Удаляем категории пользователя
              await connection.execute('DELETE FROM user_categories WHERE user_id = ?', [userId]);
              console.log('Удалены категории пользователя');

              // 11. Наконец удаляем самого пользователя
              await connection.execute('DELETE FROM users WHERE user_id = ?', [userId]);
              console.log('Пользователь удален');

              // Фиксируем транзакцию
              await connection.commit();

              res.json({ 
                success: true,
                message: 'Пользователь и все связанные данные успешно удалены',
                user_id: parseInt(userId)
              });

            } catch (transactionError) {
              // Откатываем транзакцию в случае ошибки
              await connection.rollback();
              throw transactionError;
            }

          } catch (error) {
            console.error('Ошибка удаления пользователя:', error);
            res.status(500).json({ error: 'Database error: ' + error.message });
          } finally {
            if (connection) {
              connection.release();
            }
          }
        });

        // Удаление поста
        app.delete('/admin/posts/:postId', async (req, res) => {
          try {
            const { postId } = req.params;
            
            console.log('Попытка удаления поста:', postId);

            // Проверяем существование поста
            const [posts] = await db.execute('SELECT * FROM posts WHERE post_id = ?', [postId]);
            if (posts.length === 0) {
              return res.status(404).json({ error: 'Пост не найден' });
            }

            // Удаляем пост (каскадное удаление настроено в БД)
            await db.execute('DELETE FROM posts WHERE post_id = ?', [postId]);
            
            console.log('Пост успешно удален:', postId);
            
            res.json({ 
              success: true,
              message: 'Пост успешно удален',
              post_id: parseInt(postId)
            });
          } catch (error) {
            console.error('Ошибка удаления поста:', error);
            res.status(500).json({ error: 'Database error: ' + error.message });
          }
        });

        // Обновление статуса пользователя
        app.put('/admin/users/:userId/status', async (req, res) => {
          try {
            const { userId } = req.params;
            const { is_active } = req.body;
            
            console.log('Обновление статуса пользователя:', userId, is_active);

            // Проверяем существование пользователя
            const [users] = await db.execute('SELECT * FROM users WHERE user_id = ?', [userId]);
            if (users.length === 0) {
              return res.status(404).json({ error: 'Пользователь не найден' });
            }

            await db.execute(
              'UPDATE users SET is_active = ?, updated_at = NOW() WHERE user_id = ?',
              [is_active, userId]
            );
            
            console.log('Статус пользователя обновлен:', userId, is_active);
            
            res.json({ 
              success: true,
              message: 'Статус пользователя обновлен',
              user_id: parseInt(userId),
              is_active: is_active
            });
          } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            res.status(500).json({ error: 'Database error: ' + error.message });
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

        // API для получения расширенного статуса пользователя
  // API для получения статуса пользователя
  app.get('/api/users/:userId/status', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const [users] = await db.execute(
        `SELECT user_id, is_online, user_status, status_message, last_seen, last_activity 
        FROM users WHERE user_id = ?`,
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

  // Получение предложенных друзей
  app.get('/api/users/suggested/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Находим пользователей, которые не являются друзьями и не имеют pending запросов
      const [suggestedUsers] = await db.execute(`
        SELECT DISTINCT u.user_id, u.name, u.email, u.avatar_url, u.is_online, u.last_seen
        FROM users u
        WHERE u.user_id != ?
          AND u.user_id NOT IN (
            SELECT 
              CASE 
                WHEN user_id1 = ? THEN user_id2 
                ELSE user_id1 
              END as friend_id
            FROM friendships 
            WHERE (user_id1 = ? OR user_id2 = ?) 
              AND status IN ('accepted', 'pending')
          )
          AND u.is_active = TRUE
        ORDER BY RAND()
        LIMIT 10
      `, [userId, userId, userId, userId]);

      res.json(suggestedUsers);
    } catch (error) {
      console.error('Error loading suggested friends:', error);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // API для поиска пользователей
app.get('/api/users/search/:query', async (req, res) => {
  try {
    const query = `%${req.params.query}%`;
    
    const [users] = await db.execute(
      `SELECT 
        user_id, 
        name, 
        email, 
        avatar_url, 
        is_online, 
        last_seen,
        bio
      FROM users 
      WHERE (name LIKE ? OR email LIKE ? OR nick LIKE ?) 
        AND is_active = TRUE
      LIMIT 20`,
      [query, query, query]
    );

    res.json(users);
  } catch(error) {
    console.error('Search users error:', error);
    res.status(500).json({error: 'Database error'});
  }
});

// API для поиска постов
app.get('/api/posts/search', async (req, res) => {
  try {
    const { q, user_id } = req.query;
    const query = `%${q}%`;
    
    let sqlQuery = `
      SELECT 
        p.*, 
        u.name as author_name,
        u.avatar_url as author_avatar,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.post_id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) as comments_count
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      WHERE (p.content LIKE ? OR p.title LIKE ?)
        AND p.is_published = TRUE
    `;
    
    let params = [query, query];

    if (user_id && user_id !== 'undefined' && user_id !== 'null') {
      sqlQuery += ' AND (p.is_public = TRUE OR p.user_id = ?)';
      params.push(parseInt(user_id));
    } else {
      sqlQuery += ' AND p.is_public = TRUE';
    }
    
    sqlQuery += ' ORDER BY p.created_at DESC LIMIT 10';

    const [posts] = await db.execute(sqlQuery, params);
    res.json(posts);
  } catch(error) {
    console.error('Search posts error:', error);
    res.status(500).json({error: 'Database error'});
  }
});

// API для поиска чатов
app.get('/api/chats/search', async (req, res) => {
  try {
    const { q, user_id } = req.query;
    const query = `%${q}%`;
    
    const [chats] = await db.execute(`
      SELECT DISTINCT c.*,
        GROUP_CONCAT(u.name) as participant_names,
        (SELECT content FROM messages WHERE chat_id = c.chat_id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE chat_id = c.chat_id ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM messages WHERE chat_id = c.chat_id AND is_read = FALSE AND user_id != ?) as unread_count
      FROM chats c
      JOIN chat_participants cp ON c.chat_id = cp.chat_id
      JOIN users u ON cp.user_id = u.user_id
      WHERE c.chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = ?)
        AND (c.chat_name LIKE ? OR u.name LIKE ?)
      GROUP BY c.chat_id
      ORDER BY last_message_time DESC
      LIMIT 10
    `, [parseInt(user_id), parseInt(user_id), query, query]);

    res.json(chats);
  } catch(error) {
    console.error('Search chats error:', error);
    res.status(500).json({error: 'Database error'});
  }
});

  app.get('/api/users/search/:query', async (req, res) => {
    try {
      const query = `%${req.params.query}%`;
      
      const [users] = await db.execute(
        `SELECT user_id, name, email, avatar_url, is_online, last_seen, bio 
        FROM users 
        WHERE (name LIKE ? OR email LIKE ? OR nick LIKE ?) 
          AND is_active = TRUE
        LIMIT 20`,
        [query, query, query]
      );

      res.json(users);
    } catch(error) {
      console.error(error);
      res.status(500).json({error: 'Database error'});
    }
  });


  app.post('/api/users/statuses', async (req, res) => {
    try {
      const { userIds } = req.body;
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'Список ID пользователей обязателен' });
      }

      const placeholders = userIds.map(() => '?').join(',');
      const [users] = await db.execute(
        `SELECT user_id, is_online, user_status, status_message, last_seen, last_activity 
        FROM users WHERE user_id IN (${placeholders})`,
        userIds
      );

      res.json(users);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Database error' });
    }
  });



  app.get('/api/users/:userId/gallery', async (req, res) => {
    let connection;
    try {
      const { userId } = req.params;
      const { limit = 3 } = req.query;
      
      console.log('=== GALLERY API CALL ===');
      console.log('User ID:', userId);
      console.log('Limit:', limit);

      // Проверяем валидность userId
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ 
          error: 'Invalid user ID',
          received: userId 
        });
      }

      const numericUserId = parseInt(userId);
      const numericLimit = parseInt(limit);

      // Получаем соединение
      connection = await db.getConnection();

      // Проверяем существование пользователя
      const [users] = await connection.execute(
        'SELECT user_id, name FROM users WHERE user_id = ?',
        [numericUserId]
      );

      if (users.length === 0) {
        return res.status(404).json({ 
          error: 'User not found',
          user_id: numericUserId
        });
      }

      console.log('User found:', users[0].name);

      // ИСПРАВЛЕННЫЙ ЗАПРОС - используем конкатенацию для LIMIT
      const query = `
        SELECT 
          gallery_id,
          user_id,
          image_url,
          thumbnail_url,
          description,
          created_at
        FROM user_gallery 
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ${numericLimit}
      `;
      
      console.log('Executing query:', query);
      console.log('With parameter:', numericUserId);

      const [photos] = await connection.execute(query, [numericUserId]);

      // Получаем общее количество фото
      const [countResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM user_gallery WHERE user_id = ?',
        [numericUserId]
      );

      console.log(`Found ${photos.length} photos for user ${numericUserId}`);

      const response = {
        photos: photos || [],
        total_count: countResult[0]?.total || 0,
        user: {
          id: users[0].user_id,
          name: users[0].name
        }
      };

      console.log('Sending response:', response);
      res.json(response);

    } catch (error) {
      console.error('❌ CRITICAL ERROR in gallery endpoint:');
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error stack:', error.stack);
      
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message,
        code: error.code
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  });

  // Загрузка фото в галерею
  const galleryStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      const dir = 'uploads/gallery/';
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'gallery-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const uploadGallery = multer({ 
    storage: galleryStorage,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'), false);
      }
    }
  });

  app.post('/api/gallery/upload', uploadGallery.single('image'), async (req, res) => {
    try {
      const { userId, description = '' } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
      }

      if (!userId) {
        return res.status(400).json({ error: 'ID пользователя обязателен' });
      }

      const image_url = `/uploads/gallery/${req.file.filename}`;

      const [result] = await db.execute(
        'INSERT INTO user_gallery (user_id, image_url, description) VALUES (?, ?, ?)',
        [userId, image_url, description]
      );

      const [photos] = await db.execute(
        'SELECT * FROM user_gallery WHERE gallery_id = ?',
        [result.insertId]
      );

      res.json({
        message: 'Фото успешно загружено',
        photo: photos[0]
      });

    } catch (error) {
      console.error('Error uploading to gallery:', error);
      res.status(500).json({ error: 'Ошибка загрузки фото' });
    }
  });

  // Удаление фото из галереи
  app.delete('/api/gallery/:photoId', async (req, res) => {
    try {
      const { photoId } = req.params;
      const { userId } = req.body;

      const [photos] = await db.execute(
        'SELECT * FROM user_gallery WHERE gallery_id = ? AND user_id = ?',
        [photoId, userId]
      );

      if (photos.length === 0) {
        return res.status(404).json({ error: 'Фото не найдено или нет прав для удаления' });
      }

      // Удаляем файл с диска
      const photoPath = path.join(__dirname, photos[0].image_url);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }

      await db.execute(
        'DELETE FROM user_gallery WHERE gallery_id = ?',
        [photoId]
      );

      res.json({ message: 'Фото успешно удалено' });
    } catch (error) {
      console.error('Error deleting gallery photo:', error);
      res.status(500).json({ error: 'Ошибка удаления фото' });
    }
  });

  // API для обновления статуса
  app.put('/api/users/status', async (req, res) => {
    try {
      const { user_id, status, status_message } = req.body;
      
      await db.execute(
        `UPDATE users SET user_status = ?, status_message = ?, last_activity = NOW() 
        WHERE user_id = ?`,
        [status, status_message, user_id]
      );

      // Отправляем обновление через WebSocket
      const [contacts] = await db.execute(`
        SELECT DISTINCT cp.user_id 
        FROM chat_participants cp 
        WHERE cp.chat_id IN (
          SELECT chat_id FROM chat_participants WHERE user_id = ?
        ) AND cp.user_id != ?
      `, [user_id, user_id]);
      
      contacts.forEach(contact => {
        const contactSocketId = activeUsers.get(contact.user_id.toString());
        if (contactSocketId) {
          io.to(contactSocketId).emit('contact_status_updated', {
            user_id: parseInt(user_id),
            status,
            status_message,
            last_activity: new Date().toISOString()
          });
        }
      });

      res.json({ success: true, status, status_message });
    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // API для обновления статуса пользователя
  app.put('/api/users/status', async (req, res) => {
    try {
      const { user_id, status, status_message } = req.body;
      
      await db.execute(
        `UPDATE users SET user_status = ?, status_message = ?, last_activity = NOW() 
        WHERE user_id = ?`,
        [status, status_message, user_id]
      );

      // Отправляем обновление статуса через WebSocket
      const userSocketId = activeUsers.get(user_id.toString());
      if (userSocketId) {
        io.to(userSocketId).emit('user_status_updated', {
          user_id: parseInt(user_id),
          status,
          status_message
        });
      }

      // Уведомляем всех пользователей в чатах с этим пользователем
      const [chats] = await db.execute(
        `SELECT DISTINCT cp.chat_id 
        FROM chat_participants cp 
        WHERE cp.user_id != ? AND cp.chat_id IN (
          SELECT chat_id FROM chat_participants WHERE user_id = ?
        )`,
        [user_id, user_id]
      );

      // ПРАВИЛЬНО - так должно быть:
  for (const chat of chats) {
    const [participants] = await db.execute(
      'SELECT user_id FROM chat_participants WHERE chat_id = ?',
      [chat.chat_id]
    );
    
    for (const participant of participants) {
      const participantSocketId = activeUsers.get(participant.user_id.toString());
      if (participantSocketId) {
        io.to(participantSocketId).emit('contact_status_updated', {
          user_id: parseInt(user_id),
          status,
          status_message
        });
      }
    }
  }

      res.json({ success: true, status, status_message });
    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
      res.status(500).json({ error: 'Database error' });
    }
  });


  setInterval(async () => {
    try {
      // Меняем статус на "away" после 5 минут бездействия
      const [inactiveUsers] = await db.execute(
        `SELECT user_id FROM users 
        WHERE is_online = TRUE 
        AND user_status = 'online' 
        AND last_activity < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
      );

      for (const user of inactiveUsers) {
        await db.execute(
          'UPDATE users SET user_status = "away" WHERE user_id = ?',
          [user.user_id]
        );

        // Уведомляем контактов
        const [contacts] = await db.execute(`
          SELECT DISTINCT cp.user_id 
          FROM chat_participants cp 
          WHERE cp.chat_id IN (
            SELECT chat_id FROM chat_participants WHERE user_id = ?
          ) AND cp.user_id != ?
        `, [user.user_id, user.user_id]);
        
        contacts.forEach(contact => {
          const contactSocketId = activeUsers.get(contact.user_id.toString());
          if (contactSocketId) {
            io.to(contactSocketId).emit('contact_status_updated', {
              user_id: user.user_id,
              status: 'away',
              last_activity: new Date().toISOString()
            });
          }
        });
      }
    } catch (error) {
      console.error('Ошибка автоматического обновления статусов:', error);
    }
  }, 60000); // Проверка каждую минуту

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
        // В server.js обновите endpoint для получения постов
  app.get('/api/posts', async (req, res) => {
    try {
      const { page = 1, limit = 10, user_id } = req.query;
      
      let query = `
        SELECT p.*, u.name as author_name, u.email as author_email
        FROM posts p
        JOIN users u ON p.user_id = u.user_id
        WHERE p.is_published = TRUE
      `;
      
      let params = [];

      if (user_id && user_id !== 'undefined' && user_id !== 'null') {
        query += ' AND (p.is_public = TRUE OR p.user_id = ?)';
        params.push(parseInt(user_id));
      } else {
        query += ' AND p.is_public = TRUE';
      }
      
      query += ' ORDER BY p.created_at DESC';

      const limitNum = parseInt(limit) || 10;
      const pageNum = parseInt(page) || 1;
      const offset = (pageNum - 1) * limitNum;
      
      query += ` LIMIT ${limitNum} OFFSET ${offset}`;

      console.log('Executing posts query:', query);
      console.log('With params:', params);

      const [posts] = await db.execute(query, params);

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

            // Получаем все изображения для поста
            const [postImages] = await db.execute(
              'SELECT image_url FROM post_images WHERE post_id = ? ORDER BY image_order',
              [post.post_id]
            );

            let is_liked = false;
            if (user_id && user_id !== 'undefined' && user_id !== 'null') {
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
              is_liked: is_liked,
              images: postImages.map(img => img.image_url) // добавляем массив изображений
            };
          } catch (error) {
            console.error(`Error processing post ${post.post_id}:`, error);
            return {
              ...post,
              likes_count: 0,
              comments_count: 0,
              is_liked: false,
              images: [] // пустой массив в случае ошибки
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

        // Получение списка друзей
  app.get('/api/users/:userId/friends', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const [friends] = await db.execute(`
        SELECT 
          u.user_id,
          u.name,
          u.email,
          u.avatar_url,
          u.is_online,
          u.last_seen
        FROM friendships f
        JOIN users u ON (
          (f.user_id1 = ? AND u.user_id = f.user_id2) OR 
          (f.user_id2 = ? AND u.user_id = f.user_id1)
        )
        WHERE f.status = 'accepted'
        ORDER BY u.is_online DESC, u.name ASC
      `, [userId, userId]);

      res.json(friends);
    } catch (error) {
      console.error('Error loading friends:', error);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Получение списка подписчиков
  app.get('/api/users/:userId/followers', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const [followers] = await db.execute(`
        SELECT 
          u.user_id,
          u.name,
          u.email,
          u.avatar_url,
          u.is_online,
          u.last_seen
        FROM followers f
        JOIN users u ON f.follower_id = u.user_id
        WHERE f.following_id = ?
        ORDER BY f.created_at DESC
      `, [userId]);

      res.json(followers);
    } catch (error) {
      console.error('Error loading followers:', error);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Проверка статуса подписки
  app.get('/api/follow/check/:userId/:targetUserId', async (req, res) => {
    try {
      const { userId, targetUserId } = req.params;
      
      const [follows] = await db.execute(
        'SELECT 1 as is_following FROM followers WHERE follower_id = ? AND following_id = ?',
        [userId, targetUserId]
      );

      res.json({ is_following: follows.length > 0 });
    } catch (error) {
      console.error('Error checking follow status:', error);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Подписка/отписка
  app.post('/api/follow/:targetUserId', async (req, res) => {
    try {
      const { targetUserId } = req.params;
      const { userId } = req.body;

      const [existing] = await db.execute(
        'SELECT * FROM followers WHERE follower_id = ? AND following_id = ?',
        [userId, targetUserId]
      );

      if (existing.length > 0) {
        // Отписка
        await db.execute(
          'DELETE FROM followers WHERE follower_id = ? AND following_id = ?',
          [userId, targetUserId]
        );
        res.json({ is_following: false, message: 'Отписался' });
      } else {
        // Подписка
        await db.execute(
          'INSERT INTO followers (follower_id, following_id) VALUES (?, ?)',
          [userId, targetUserId]
        );
        res.json({ is_following: true, message: 'Подписался' });
      }
    } catch (error) {
      console.error('Error following user:', error);
      res.status(500).json({ error: 'Database error' });
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

  // В server.js измените endpoint для создания постов
  app.post('/api/posts', upload.array('media', 5), async (req, res) => { // Используем upload.array вместо upload.single
    try {
      const { user_id, title, content, category_id = 1, is_public = 'true' } = req.body;
      
      if (!user_id || !content) {
        return res.status(400).json({ error: 'user_id и content обязательны' });
      }

      // Обрабатываем массив файлов
      let image_urls = [];
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          const fileType = file.mimetype.startsWith('image/') ? 'images' : 
                          file.mimetype.startsWith('video/') ? 'videos' : 'files';
          const fileUrl = `/uploads/${fileType}/${file.filename}`;
          image_urls.push(fileUrl);
        });
      }

      const isPublicBool = is_public === 'true' || is_public === true;
      const categoryId = parseInt(category_id) || 1;

      // Сохраняем первый URL изображения в image_url для обратной совместимости
      const firstImageUrl = image_urls.length > 0 ? image_urls[0] : null;

      const [result] = await db.execute(
        'INSERT INTO posts (user_id, title, content, image_url, category_id, is_public) VALUES (?, ?, ?, ?, ?, ?)',
        [
          parseInt(user_id), 
          title || content.substring(0, 100), 
          content, 
          firstImageUrl, // сохраняем первое изображение для совместимости
          categoryId, 
          isPublicBool ? 1 : 0
        ]
      );

      // Сохраняем все изображения в отдельную таблицу
      if (image_urls.length > 0) {
        for (const imageUrl of image_urls) {
          await db.execute(
            'INSERT INTO post_images (post_id, image_url, image_order) VALUES (?, ?, ?)',
            [result.insertId, imageUrl, image_urls.indexOf(imageUrl)]
          );
        }
      }

      const [posts] = await db.execute(`
        SELECT p.*, u.name as author_name, u.email as author_email 
        FROM posts p 
        JOIN users u ON p.user_id = u.user_id 
        WHERE p.post_id = ?
      `, [result.insertId]);

      const newPost = posts[0];

      // Получаем все изображения для поста
      const [postImages] = await db.execute(
        'SELECT image_url FROM post_images WHERE post_id = ? ORDER BY image_order',
        [result.insertId]
      );

      const postWithCounts = {
        ...newPost,
        likes_count: 0,
        comments_count: 0,
        is_liked: false,
        images: postImages.map(img => img.image_url) // добавляем массив изображений
      };

      res.status(201).json(postWithCounts);
    } catch (error) {
      console.error('Error creating post:', error);
      res.status(500).json({ error: 'Database error: ' + error.message });
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

        // Исправленный endpoint для добавления комментариев
  app.post('/api/posts/:postId/comments', async (req, res) => {
    try {
      const { postId } = req.params;
      const { user_id, content, parent_comment_id = null } = req.body;
      
      console.log('Adding comment:', { postId, user_id, content });
      
      if (!postId || !user_id || !content) {
        return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
      }

      // Проверяем существование поста
      const [posts] = await db.execute(
        'SELECT post_id FROM posts WHERE post_id = ?',
        [postId]
      );

      if (posts.length === 0) {
        return res.status(404).json({ error: 'Пост не найден' });
      }

      const [result] = await db.execute(
        'INSERT INTO comments (post_id, user_id, content, parent_comment_id) VALUES (?, ?, ?, ?)',
        [postId, user_id, content, parent_comment_id]
      );

      // Обновляем счетчик комментариев в посте
      await db.execute(
        'UPDATE posts SET comments_count = COALESCE(comments_count, 0) + 1 WHERE post_id = ?',
        [postId]
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
      const [postAuthors] = await db.execute(
        'SELECT user_id FROM posts WHERE post_id = ?',
        [postId]
      );
      
      if (postAuthors.length > 0 && postAuthors[0].user_id !== parseInt(user_id)) {
        await db.execute(
          'INSERT INTO notifications (user_id, from_user_id, type, post_id, comment_id) VALUES (?, ?, "comment", ?, ?)',
          [postAuthors[0].user_id, user_id, postId, result.insertId]
        );
      }

      console.log('Comment added successfully:', fullComment);
      
      res.status(201).json({
        ...fullComment,
        likes_count: 0,
        is_liked: false
      });

    } catch (error) {
      console.error('Ошибка добавления комментария:', error);
      res.status(500).json({ error: 'Не удалось добавить комментарий: ' + error.message });
    }
  });

        // Исправленный endpoint для лайков комментариев
  app.post('/api/comments/:commentId/like', async (req, res) => {
    try {
      const { commentId } = req.params;
      const { user_id } = req.body;
      
      console.log('Comment like request:', { commentId, user_id });
      
      if (!commentId || !user_id) {
        return res.status(400).json({ error: 'Отсутствуют обязательные параметры' });
      }

      // Проверяем существование комментария
      const [comments] = await db.execute(
        'SELECT comment_id FROM comments WHERE comment_id = ?',
        [commentId]
      );

      if (comments.length === 0) {
        return res.status(404).json({ error: 'Комментарий не найден' });
      }

      const [existingLikes] = await db.execute(
        'SELECT * FROM comment_likes WHERE comment_id = ? AND user_id = ?',
        [commentId, user_id]
      );

      let is_liked;
      let likes_count;

      if (existingLikes.length > 0) {
        // Удаляем лайк
        await db.execute(
          'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?',
          [commentId, user_id]
        );
        
        is_liked = false;
        console.log('Comment like removed');
      } else {
        // Добавляем лайк
        await db.execute(
          'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)',
          [commentId, user_id]
        );
        
        is_liked = true;
        console.log('Comment like added');
      }

      // Получаем обновленное количество лайков
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
      res.status(500).json({ error: 'Не удалось обработать лайк комментария: ' + error.message });
    }
  });

        // =========================== API ДЛЯ ДРУЗЕЙ ============================
      // =========================== API ДЛЯ ДРУЗЕЙ ============================

  // Получение списка друзей
  app.get('/api/users/:userId/friends', async (req, res) => {
    try {
      const { userId } = req.params;
      
      console.log('Loading friends for user:', userId);

      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const [friends] = await db.execute(`
        SELECT 
          u.user_id, 
          u.name, 
          u.email, 
          u.avatar_url, 
          u.is_online, 
          u.last_seen,
          u.bio
        FROM friendships f
        JOIN users u ON (
          (f.user_id1 = ? AND u.user_id = f.user_id2) OR 
          (f.user_id2 = ? AND u.user_id = f.user_id1)
        )
        WHERE f.status = 'accepted'
        ORDER BY u.is_online DESC, u.name ASC
      `, [parseInt(userId), parseInt(userId)]);

      console.log(`Found ${friends.length} friends for user ${userId}`);
      res.json(friends);

    } catch (error) {
      console.error('Error loading friends:', error);
      res.status(500).json({ error: 'Database error: ' + error.message });
    }
  });

  // Получение заявок в друзья
  app.get('/api/users/:userId/friend-requests', async (req, res) => {
    try {
      const { userId } = req.params;
      
      console.log('Loading friend requests for user:', userId);

      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const [requests] = await db.execute(`
        SELECT 
          f.friendship_id,
          f.user_id1,
          f.user_id2, 
          f.action_user_id,
          f.status,
          f.created_at,
          u.name as from_user_name, 
          u.email as from_user_email,
          u.avatar_url as from_user_avatar
        FROM friendships f
        JOIN users u ON f.action_user_id = u.user_id
        WHERE (
          (f.user_id1 = ? AND f.user_id2 != ?) OR 
          (f.user_id2 = ? AND f.user_id1 != ?)
        )
        AND f.status = 'pending'
        AND f.action_user_id != ?
        ORDER BY f.created_at DESC
      `, [parseInt(userId), parseInt(userId), parseInt(userId), parseInt(userId), parseInt(userId)]);

      console.log(`Found ${requests.length} friend requests for user ${userId}`);
      res.json(requests);

    } catch (error) {
      console.error('Error loading friend requests:', error);
      res.status(500).json({ error: 'Database error: ' + error.message });
    }
  });

  // Отправка запроса в друзья
  app.post('/api/friends/request', async (req, res) => {
    try {
      const { from_user_id, to_user_id } = req.body;
      
      console.log('Friend request data:', { from_user_id, to_user_id });

      // Валидация параметров
      if (!from_user_id || !to_user_id) {
        return res.status(400).json({ 
          error: 'from_user_id и to_user_id обязательны',
          received: { from_user_id, to_user_id }
        });
      }

      if (from_user_id === to_user_id) {
        return res.status(400).json({ error: 'Нельзя отправить запрос самому себе' });
      }

      // Проверяем существование пользователей
      const [users] = await db.execute(
        'SELECT user_id FROM users WHERE user_id IN (?, ?) AND is_active = TRUE',
        [parseInt(from_user_id), parseInt(to_user_id)]
      );

      if (users.length !== 2) {
        return res.status(404).json({ error: 'Один из пользователей не найден' });
      }

      // Проверяем, не существует ли уже дружба или запрос
      const [existingFriendships] = await db.execute(
        `SELECT friendship_id, status 
        FROM friendships 
        WHERE (user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?)`,
        [parseInt(from_user_id), parseInt(to_user_id), parseInt(to_user_id), parseInt(from_user_id)]
      );

      if (existingFriendships.length > 0) {
        const existing = existingFriendships[0];
        if (existing.status === 'pending') {
          return res.status(400).json({ error: 'Запрос в друзья уже отправлен' });
        } else if (existing.status === 'accepted') {
          return res.status(400).json({ error: 'Пользователь уже у вас в друзьях' });
        }
      }

      // Создаем запрос в друзья
      const [result] = await db.execute(
        'INSERT INTO friendships (user_id1, user_id2, action_user_id, status) VALUES (?, ?, ?, "pending")',
        [parseInt(from_user_id), parseInt(to_user_id), parseInt(from_user_id)]
      );

      console.log('Friend request created with ID:', result.insertId);

      // Создаем уведомление
      await db.execute(
        'INSERT INTO notifications (user_id, from_user_id, type, friendship_id) VALUES (?, ?, "friend_request", ?)',
        [parseInt(to_user_id), parseInt(from_user_id), result.insertId]
      );

      res.status(201).json({ 
        message: 'Запрос в друзья отправлен',
        friendship_id: result.insertId 
      });

    } catch (error) {
      console.error('Error sending friend request:', error);
      res.status(500).json({ 
        error: 'Database error: ' + error.message,
        details: 'Не удалось отправить запрос в друзья'
      });
    }
  });

  // Ответ на запрос дружбы
  app.post('/api/friends/respond', async (req, res) => {
    try {
      const { friendship_id, response, user_id } = req.body;
      
      console.log('Friend request response:', { friendship_id, response, user_id });

      // Валидация
      if (!friendship_id || !response || !user_id) {
        return res.status(400).json({ 
          error: 'friendship_id, response и user_id обязательны',
          received: { friendship_id, response, user_id }
        });
      }

      const validResponses = ['accepted', 'declined'];
      if (!validResponses.includes(response)) {
        return res.status(400).json({ 
          error: 'response должен быть "accepted" или "declined"',
          received: response
        });
      }

      // Проверяем существование запроса
      const [friendships] = await db.execute(
        'SELECT * FROM friendships WHERE friendship_id = ?',
        [parseInt(friendship_id)]
      );

      if (friendships.length === 0) {
        return res.status(404).json({ error: 'Запрос дружбы не найден' });
      }

      const friendship = friendships[0];
      
      // Проверяем, что пользователь имеет право отвечать на этот запрос
      const isUserInFriendship = friendship.user_id1 === parseInt(user_id) || friendship.user_id2 === parseInt(user_id);
      if (!isUserInFriendship) {
        return res.status(403).json({ error: 'Нет прав для ответа на этот запрос' });
      }

      // Обновляем статус дружбы
      await db.execute(
        'UPDATE friendships SET status = ? WHERE friendship_id = ?',
        [response, parseInt(friendship_id)]
      );

      console.log(`Friend request ${friendship_id} ${response} by user ${user_id}`);

      // Если запрос принят, создаем уведомление для отправителя
      if (response === 'accepted') {
        const from_user_id = friendship.action_user_id;
        
        await db.execute(
          'INSERT INTO notifications (user_id, from_user_id, type, friendship_id) VALUES (?, ?, "friend_accept", ?)',
          [parseInt(from_user_id), parseInt(user_id), parseInt(friendship_id)]
        );
      }

      res.json({ 
        message: `Запрос дружбы ${response === 'accepted' ? 'принят' : 'отклонен'}`,
        friendship_id: parseInt(friendship_id),
        status: response
      });

    } catch (error) {
      console.error('Error responding to friend request:', error);
      res.status(500).json({ 
        error: 'Database error: ' + error.message,
        details: 'Не удалось обработать запрос дружбы'
      });
    }
  });

  // Удаление друга
  app.delete('/api/friends', async (req, res) => {
    try {
      const { user_id, friend_id } = req.body;
      
      console.log('Remove friend request:', { user_id, friend_id });

      // Валидация
      if (!user_id || !friend_id) {
        return res.status(400).json({ 
          error: 'user_id и friend_id обязательны',
          received: { user_id, friend_id }
        });
      }

      if (user_id === friend_id) {
        return res.status(400).json({ error: 'Нельзя удалить самого себя' });
      }

      // Находим запись о дружбе
      const [friendships] = await db.execute(
        `SELECT friendship_id, user_id1, user_id2, status 
        FROM friendships 
        WHERE status = 'accepted' 
        AND ((user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?))`,
        [parseInt(user_id), parseInt(friend_id), parseInt(friend_id), parseInt(user_id)]
      );

      if (friendships.length === 0) {
        return res.status(404).json({ error: 'Запись о дружбе не найдена' });
      }

      const friendshipId = friendships[0].friendship_id;

      // Удаляем запись о дружбе
      await db.execute(
        'DELETE FROM friendships WHERE friendship_id = ?',
        [parseInt(friendshipId)]
      );

      console.log(`Friendship ${friendshipId} deleted between ${user_id} and ${friend_id}`);

      res.json({ 
        success: true,
        message: 'Друг успешно удален',
        friendship_id: friendshipId,
        user_id: parseInt(user_id),
        friend_id: parseInt(friend_id)
      });

    } catch (error) {
      console.error('Error removing friend:', error);
      res.status(500).json({ 
        success: false,
        error: 'Не удалось удалить друга: ' + error.message 
      });
    }
  });

  // Проверка статуса дружбы
  app.get('/api/friends/check/:userId/:friendId', async (req, res) => {
    try {
      const { userId, friendId } = req.params;
      
      console.log('Check friendship status:', { userId, friendId });

      if (!userId || !friendId) {
        return res.status(400).json({ error: 'userId и friendId обязательны' });
      }

      const [friendships] = await db.execute(
        `SELECT friendship_id, status, action_user_id 
        FROM friendships 
        WHERE ((user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?))`,
        [parseInt(userId), parseInt(friendId), parseInt(friendId), parseInt(userId)]
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
        action_user_id: friendship.action_user_id,
        is_outgoing: friendship.action_user_id === parseInt(userId)
      });

    } catch (error) {
      console.error('Error checking friendship:', error);
      res.status(500).json({ error: 'Database error: ' + error.message });
    }
  });

  // Получение предложенных друзей
  app.get('/api/users/suggested/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      console.log('Loading suggested friends for user:', userId);

      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Упрощенный запрос для предложенных друзей
      const [suggestedUsers] = await db.execute(`
        SELECT DISTINCT 
          u.user_id, 
          u.name, 
          u.email, 
          u.avatar_url, 
          u.is_online, 
          u.last_seen,
          u.bio,
          (SELECT COUNT(*) FROM friendships f 
          WHERE ((f.user_id1 = u.user_id AND f.user_id2 IN 
                  (SELECT CASE WHEN user_id1 = ? THEN user_id2 ELSE user_id1 END 
                  FROM friendships WHERE (user_id1 = ? OR user_id2 = ?) AND status = 'accepted'))
                  OR (f.user_id2 = u.user_id AND f.user_id1 IN 
                  (SELECT CASE WHEN user_id1 = ? THEN user_id2 ELSE user_id1 END 
                  FROM friendships WHERE (user_id1 = ? OR user_id2 = ?) AND status = 'accepted'))
          ) AND f.status = 'accepted') as mutual_friends
        FROM users u
        WHERE u.user_id != ?
          AND u.user_id NOT IN (
            SELECT 
              CASE 
                WHEN user_id1 = ? THEN user_id2 
                ELSE user_id1 
              END as friend_id
            FROM friendships 
            WHERE (user_id1 = ? OR user_id2 = ?) 
              AND status IN ('accepted', 'pending')
          )
          AND u.is_active = TRUE
        ORDER BY mutual_friends DESC, RAND()
        LIMIT 10
      `, [
        parseInt(userId), parseInt(userId), parseInt(userId),
        parseInt(userId), parseInt(userId), parseInt(userId),
        parseInt(userId), parseInt(userId), parseInt(userId), parseInt(userId)
      ]);

      console.log(`Found ${suggestedUsers.length} suggested friends for user ${userId}`);
      res.json(suggestedUsers);

    } catch (error) {
      console.error('Error loading suggested friends:', error);
      res.status(500).json({ error: 'Database error: ' + error.message });
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
        // В файле server.js, в endpoint /api/users/:userId/profile
  // Исправленный endpoint для получения профиля
  app.get('/api/users/:userId/profile', async (req, res) => {
    try {
      const { userId } = req.params;
      
      console.log('=== LOADING PROFILE API ===');
      console.log('Requested user ID:', userId);
      
      const [users] = await db.execute(`
        SELECT 
          u.user_id, 
          u.name, 
          u.surname, 
          u.nick, 
          u.email, 
          u.role, 
          u.created_at, 
          u.is_online, 
          u.last_seen, 
          u.avatar_url, 
          u.banner_url,
          u.bio,
          COUNT(DISTINCT p.post_id) as posts_count,
          COUNT(DISTINCT f.friendship_id) as friends_count
        FROM users u
        LEFT JOIN posts p ON u.user_id = p.user_id AND p.is_published = TRUE
        LEFT JOIN friendships f ON (u.user_id = f.user_id1 OR u.user_id = f.user_id2) AND f.status = 'accepted'
        WHERE u.user_id = ?
        GROUP BY u.user_id
      `, [userId]);

      console.log('Users found:', users.length);

      if (users.length === 0) {
        console.log('User not found');
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const user = users[0];
      
      console.log('User data from DB:', {
        user_id: user.user_id,
        name: user.name,
        avatar_url: user.avatar_url,
        banner_url: user.banner_url
      });
      
      // УБИРАЕМ добавление полных URL - возвращаем относительные пути
      const userWithUrls = {
        ...user,
        // Оставляем относительные пути, фронтенд сам добавит базовый URL
        avatar_url: user.avatar_url,
        banner_url: user.banner_url
      };

      console.log('User data with relative URLs:', {
        avatar_url: userWithUrls.avatar_url,
        banner_url: userWithUrls.banner_url
      });

      res.json(userWithUrls);
    } catch (error) {
      console.error('Error loading profile:', error);
      res.status(500).json({ error: 'Database error: ' + error.message });
    }
  });

  // Endpoint для принудительного обновления статических файлов
  app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, path) => {
      // Отключаем кэширование для разработки
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Устанавливаем правильные заголовки для изображений
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (path.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (path.endsWith('.gif')) {
        res.setHeader('Content-Type', 'image/gif');
      }
    }
  }));

        app.get('/api/users/:userId/posts', async (req, res) => {
          try {
            const { userId } = req.params;
            const { current_user_id } = req.query;

            let query = `
              SELECT p.*, u.name as author_name, u.email as author_email
              FROM posts p
              JOIN users u ON p.user_id = u.user_id
              WHERE p.user_id = ? AND p.is_published = TRUE
            `;
            
            let params = [userId];

            // Если current_user_id передан и это тот же пользователь, показываем все посты
            if (current_user_id && current_user_id !== 'undefined' && current_user_id !== 'null' && parseInt(current_user_id) === parseInt(userId)) {
              // Показываем все посты пользователя (и публичные и приватные)
            } else {
              // Для других пользователей показываем только публичные посты
              query += ' AND p.is_public = TRUE';
            }
            
            query += ' ORDER BY p.created_at DESC';

            console.log('Executing user posts query:', query);
            console.log('With params:', params);

            const [posts] = await db.execute(query, params);

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

  app.put('/api/users/:userId/profile', (req, res, next) => {
    console.log('=== MULTER UPLOAD START ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Content-Length:', req.headers['content-length']);
    
    uploadProfile(req, res, function (err) {
      if (err) {
        console.error('Multer error:', err);
        console.error('Multer error code:', err.code);
        console.error('Multer error field:', err.field);
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: `Unexpected field: ${err.field}. Only 'avatar' and 'banner' are allowed.` });
        }
        return res.status(400).json({ error: err.message });
      }
      console.log('Multer processing completed');
      console.log('Files processed:', req.files);
      console.log('Body fields:', req.body);
      next();
    });
  }, async (req, res) => {
    let connection;
    try {
      const { userId } = req.params;
      const { name, bio } = req.body;
      const files = req.files;
      
      console.log('=== PROFILE UPDATE START ===');
      console.log('User ID:', userId);
      console.log('Name:', name);
      console.log('Bio:', bio);
      console.log('Files object:', files);
      
      if (files) {
        if (files.avatar) {
          console.log('Avatar file details:', {
            filename: files.avatar[0].filename,
            originalname: files.avatar[0].originalname,
            size: files.avatar[0].size,
            mimetype: files.avatar[0].mimetype,
            path: files.avatar[0].path
          });
        }
        if (files.banner) {
          console.log('Banner file details:', {
            filename: files.banner[0].filename,
            originalname: files.banner[0].originalname,
            size: files.banner[0].size,
            mimetype: files.banner[0].mimetype,
            path: files.banner[0].path
          });
        }
      }

      // Проверяем существование пользователя
      const [existingUsers] = await db.execute('SELECT user_id FROM users WHERE user_id = ?', [userId]);
      if (existingUsers.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      // Начинаем транзакцию
      connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        let updateFields = ['updated_at = NOW()'];
        let params = [];

        if (name !== undefined) {
          updateFields.push('name = ?');
          params.push(name);
        }
        
        if (bio !== undefined) {
          updateFields.push('bio = ?');
          params.push(bio);
        }
        
        // Обработка аватара
        if (files?.avatar) {
          const avatarUrl = `/uploads/avatars/${files.avatar[0].filename}`;
          updateFields.push('avatar_url = ?');
          params.push(avatarUrl);
          console.log('Setting avatar_url to:', avatarUrl);
        }
        
        // Обработка баннера
        if (files?.banner) {
          const bannerUrl = `/uploads/banners/${files.banner[0].filename}`;
          updateFields.push('banner_url = ?');
          params.push(bannerUrl);
          console.log('Setting banner_url to:', bannerUrl);
        }
        
        if (updateFields.length === 0) {
          await connection.rollback();
          return res.status(400).json({ error: 'Нет данных для обновления' });
        }
        
        params.push(userId);
        
        const query = `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`;
        console.log('Executing SQL:', query);
        console.log('With parameters:', params);
        
        const [result] = await connection.execute(query, params);
        console.log('Database update result:', result);
        console.log('Affected rows:', result.affectedRows);

        // Получаем обновленные данные пользователя
        const [users] = await connection.execute(`
          SELECT 
            user_id, 
            name, 
            email, 
            role, 
            created_at, 
            is_online, 
            last_seen, 
            avatar_url, 
            banner_url, 
            bio
          FROM users 
          WHERE user_id = ?
        `, [userId]);

        if (users.length === 0) {
          await connection.rollback();
          return res.status(404).json({ error: 'Пользователь не найден после обновления' });
        }

        const updatedUser = users[0];
        console.log('Final user data from database:', {
          user_id: updatedUser.user_id,
          name: updatedUser.name,
          avatar_url: updatedUser.avatar_url,
          banner_url: updatedUser.banner_url,
          bio: updatedUser.bio
        });
        
        // Фиксируем транзакцию
        await connection.commit();
        console.log('Transaction committed successfully');
        
        // Проверяем существование файлов на диске
        if (files?.avatar) {
          const avatarPath = path.join(__dirname, 'uploads/avatars', files.avatar[0].filename);
          const avatarExists = fs.existsSync(avatarPath);
          console.log('Avatar file exists on disk:', avatarExists, 'at path:', avatarPath);
        }
        
        if (files?.banner) {
          const bannerPath = path.join(__dirname, 'uploads/banners', files.banner[0].filename);
          const bannerExists = fs.existsSync(bannerPath);
          console.log('Banner file exists on disk:', bannerExists, 'at path:', bannerPath);
        }

        res.json(updatedUser);

      } catch (transactionError) {
        console.error('Transaction error:', transactionError);
        await connection.rollback();
        throw transactionError;
      }

    } catch (error) {
      console.error('Profile update error:', error);
      if (connection) await connection.rollback();
      res.status(500).json({ error: 'Database error: ' + error.message });
    } finally {
      if (connection) {
        connection.release();
        console.log('Database connection released');
      }
      console.log('=== PROFILE UPDATE END ===');
    }
  });

  // Добавьте этот endpoint для диагностики
  app.get('/api/debug/files', async (req, res) => {
    try {
      const avatarsDir = path.join(__dirname, 'uploads/avatars');
      const bannersDir = path.join(__dirname, 'uploads/banners');
      
      const avatarFiles = fs.existsSync(avatarsDir) ? fs.readdirSync(avatarsDir) : [];
      const bannerFiles = fs.existsSync(bannersDir) ? fs.readdirSync(bannersDir) : [];
      
      res.json({
        avatars: {
          directory: avatarsDir,
          exists: fs.existsSync(avatarsDir),
          files: avatarFiles
        },
        banners: {
          directory: bannersDir,
          exists: fs.existsSync(bannersDir),
          files: bannerFiles
        }
      });
    } catch (error) {
      console.error('Debug files error:', error);
      res.status(500).json({ error: error.message });
    }
  });

      // =========================== API ДЛЯ АВАТАРОВ ============================
  // Исправленный endpoint для получения аватара
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

      // Отправляем файл как статический
      res.sendFile(avatarPath);
    } catch (error) {
      console.error('Error getting avatar:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Вспомогательная функция для определения MIME типа
  function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // Обновленный endpoint поиска пользователей с аватарами
  app.get('/users/search/:query', async (req, res) => {
    try {
      const query = `%${req.params.query}%`;
      
      const [users] = await db.execute(
        'SELECT user_id, name, email, avatar_url, is_online, last_seen FROM users WHERE name LIKE ? OR email LIKE ?',
        [query, query]
      );

      res.json(users);
    } catch(error) {
      console.error(error);
      res.status(500).json({error: 'Database error'});
    }
  });

  // Обновленный endpoint чатов с информацией об аватарах
  app.get('/chats/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      
      const [chats] = await db.execute(`
        SELECT c.*, 
              GROUP_CONCAT(u.user_id) as participant_ids,
              GROUP_CONCAT(u.name) as participant_names,
              GROUP_CONCAT(u.avatar_url) as participant_avatars,
              (SELECT content FROM messages WHERE chat_id = c.chat_id ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT created_at FROM messages WHERE chat_id = c.chat_id ORDER BY created_at DESC LIMIT 1) as last_message_time,
              (SELECT user_id FROM messages WHERE chat_id = c.chat_id ORDER BY created_at DESC LIMIT 1) as last_message_sender_id,
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