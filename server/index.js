const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { userDB, messageDB, onlineDB, getChatId } = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Создаем папку uploads если её нет
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Разрешены только изображения!'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(uploadsDir));

// ==================== REST API ====================

// Регистрация пользователя
app.post('/api/register', (req, res) => {
    const { username } = req.body;
    
    if (!username || username.trim().length < 2) {
        return res.status(400).json({ 
            success: false, 
            error: 'Username должен содержать минимум 2 символа' 
        });
    }
    
    const cleanUsername = username.trim().toLowerCase();
    
    if (userDB.exists(cleanUsername)) {
        // Если пользователь существует, просто логиним его
        const user = userDB.get(cleanUsername);
        return res.json({ success: true, user });
    }
    
    const user = userDB.create(cleanUsername);
    res.json({ success: true, user });
});

// Получение профиля пользователя
app.get('/api/user/:username', (req, res) => {
    const user = userDB.get(req.params.username);
    if (!user) {
        return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }
    res.json({ 
        success: true, 
        user: {
            ...user,
            isOnline: onlineDB.isOnline(user.username)
        }
    });
});

// Поиск пользователей
app.get('/api/users/search', (req, res) => {
    const { q, exclude } = req.query;
    
    if (!q || q.trim().length === 0) {
        return res.json({ success: true, users: [] });
    }
    
    const users = userDB.search(q.trim(), exclude);
    res.json({ success: true, users });
});

// Получение списка чатов пользователя
app.get('/api/chats/:username', (req, res) => {
    const chats = userDB.getChats(req.params.username);
    res.json({ success: true, chats });
});

// Получение истории сообщений
app.get('/api/messages/:user1/:user2', (req, res) => {
    const { user1, user2 } = req.params;
    const messages = messageDB.getChatHistory(user1, user2);
    res.json({ success: true, messages });
});

// Загрузка аватарки
app.post('/api/upload/avatar', upload.single('avatar'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'Файл не загружен' });
    }
    
    const { username } = req.body;
    const avatarUrl = `/uploads/${req.file.filename}`;
    
    if (username) {
        userDB.update(username, { avatar: avatarUrl });
    }
    
    res.json({ success: true, url: avatarUrl });
});

// Загрузка баннера профиля
app.post('/api/upload/banner', upload.single('banner'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'Файл не загружен' });
    }
    
    const { username } = req.body;
    const bannerUrl = `/uploads/${req.file.filename}`;
    
    if (username) {
        userDB.update(username, { banner: bannerUrl });
    }
    
    res.json({ success: true, url: bannerUrl });
});

// Загрузка фото для чата
app.post('/api/upload/chat-image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'Файл не загружен' });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: imageUrl });
});

// ==================== SOCKET.IO ====================

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);
    
    // Пользователь входит в систему
    socket.on('user:login', (username) => {
        onlineDB.setOnline(socket.id, username);
        socket.username = username;
        
        // Уведомляем всех об онлайн статусе
        io.emit('user:online', { username, isOnline: true });
        
        console.log(`${username} вошел в систему`);
    });
    
    // Отправка сообщения
    socket.on('message:send', (data) => {
        const { from, to, content, type, fileUrl } = data;
        
        // Сохраняем сообщение в БД
        const message = messageDB.send(from, to, content, type || 'text', fileUrl);
        
        // Отправляем сообщение отправителю
        socket.emit('message:receive', message);
        
        // Отправляем сообщение получателю если онлайн
        const recipientSocketId = onlineDB.getSocketId(to);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('message:receive', message);
            io.to(recipientSocketId).emit('chat:update', {
                username: from,
                lastMessage: message
            });
        }
    });
    
    // Пользователь печатает
    socket.on('typing:start', ({ from, to }) => {
        const recipientSocketId = onlineDB.getSocketId(to);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('typing:show', { from });
        }
    });
    
    socket.on('typing:stop', ({ from, to }) => {
        const recipientSocketId = onlineDB.getSocketId(to);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('typing:hide', { from });
        }
    });
    
    // Отключение пользователя
    socket.on('disconnect', () => {
        const username = onlineDB.setOffline(socket.id);
        if (username) {
            io.emit('user:online', { username, isOnline: false });
            console.log(`${username} вышел из системы`);
        }
    });
});

// Запуск сервера
server.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║   🔥 Chat Messenger запущен!              ║
    ║   📍 http://localhost:${PORT}               ║
    ╚═══════════════════════════════════════════╝
    `);
});
