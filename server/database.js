// In-memory database simulation
// В продакшене можно заменить на MongoDB

const database = {
    // Хранилище пользователей
    users: new Map(),
    
    // Хранилище сообщений (ключ - ID чата, значение - массив сообщений)
    messages: new Map(),
    
    // Онлайн пользователи (socketId -> username)
    onlineUsers: new Map(),
    
    // Username -> socketId
    userSockets: new Map()
};

// Генерация уникального ID чата между двумя пользователями
function getChatId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// Функции для работы с пользователями
const userDB = {
    // Создание нового пользователя
    create(username, data = {}) {
        if (this.exists(username)) {
            return null;
        }
        const user = {
            username,
            avatar: data.avatar || null,
            banner: data.banner || null,
            createdAt: new Date().toISOString(),
            chats: [] // Список username с кем есть чаты
        };
        database.users.set(username, user);
        return user;
    },
    
    // Проверка существования пользователя
    exists(username) {
        return database.users.has(username);
    },
    
    // Получение пользователя
    get(username) {
        return database.users.get(username) || null;
    },
    
    // Обновление данных пользователя
    update(username, data) {
        const user = this.get(username);
        if (!user) return null;
        
        Object.assign(user, data);
        database.users.set(username, user);
        return user;
    },
    
    // Поиск пользователей по username
    search(query, excludeUsername = '') {
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        database.users.forEach((user, username) => {
            if (username !== excludeUsername && 
                username.toLowerCase().includes(lowerQuery)) {
                results.push({
                    username: user.username,
                    avatar: user.avatar,
                    isOnline: database.userSockets.has(username)
                });
            }
        });
        
        return results;
    },
    
    // Получение всех пользователей
    getAll(excludeUsername = '') {
        const results = [];
        database.users.forEach((user, username) => {
            if (username !== excludeUsername) {
                results.push({
                    username: user.username,
                    avatar: user.avatar,
                    isOnline: database.userSockets.has(username)
                });
            }
        });
        return results;
    },
    
    // Добавление чата в список пользователя
    addChat(username, chatWith) {
        const user = this.get(username);
        if (user && !user.chats.includes(chatWith)) {
            user.chats.push(chatWith);
        }
    },
    
    // Получение списка чатов пользователя
    getChats(username) {
        const user = this.get(username);
        if (!user) return [];
        
        return user.chats.map(chatUsername => {
            const chatUser = this.get(chatUsername);
            const chatId = getChatId(username, chatUsername);
            const messages = messageDB.getMessages(chatId);
            const lastMessage = messages[messages.length - 1] || null;
            
            return {
                username: chatUsername,
                avatar: chatUser?.avatar || null,
                isOnline: database.userSockets.has(chatUsername),
                lastMessage: lastMessage
            };
        });
    }
};

// Функции для работы с сообщениями
const messageDB = {
    // Отправка сообщения
    send(from, to, content, type = 'text', fileUrl = null) {
        const chatId = getChatId(from, to);
        
        if (!database.messages.has(chatId)) {
            database.messages.set(chatId, []);
        }
        
        const message = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            from,
            to,
            content,
            type, // 'text' или 'image'
            fileUrl,
            timestamp: new Date().toISOString(),
            read: false
        };
        
        database.messages.get(chatId).push(message);
        
        // Добавляем чат обоим пользователям
        userDB.addChat(from, to);
        userDB.addChat(to, from);
        
        return message;
    },
    
    // Получение сообщений чата
    getMessages(chatId, limit = 100) {
        const messages = database.messages.get(chatId) || [];
        return messages.slice(-limit);
    },
    
    // Получение истории чата между двумя пользователями
    getChatHistory(user1, user2, limit = 100) {
        const chatId = getChatId(user1, user2);
        return this.getMessages(chatId, limit);
    }
};

// Функции для работы с онлайн-статусом
const onlineDB = {
    // Пользователь онлайн
    setOnline(socketId, username) {
        database.onlineUsers.set(socketId, username);
        database.userSockets.set(username, socketId);
    },
    
    // Пользователь оффлайн
    setOffline(socketId) {
        const username = database.onlineUsers.get(socketId);
        if (username) {
            database.onlineUsers.delete(socketId);
            database.userSockets.delete(username);
        }
        return username;
    },
    
    // Получение socketId пользователя
    getSocketId(username) {
        return database.userSockets.get(username) || null;
    },
    
    // Проверка онлайн-статуса
    isOnline(username) {
        return database.userSockets.has(username);
    },
    
    // Получение username по socketId
    getUsername(socketId) {
        return database.onlineUsers.get(socketId) || null;
    }
};

module.exports = {
    database,
    userDB,
    messageDB,
    onlineDB,
    getChatId
};
