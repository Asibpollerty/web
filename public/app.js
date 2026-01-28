// ==================== GLOBAL STATE ====================
const state = {
    currentUser: null,
    currentChat: null,
    chats: [],
    socket: null,
    selectedImage: null
};

// ==================== DOM ELEMENTS ====================
const elements = {
    // Screens
    loginScreen: document.getElementById('login-screen'),
    chatScreen: document.getElementById('chat-screen'),
    
    // Login
    loginForm: document.getElementById('login-form'),
    usernameInput: document.getElementById('username-input'),
    
    // Sidebar
    currentAvatar: document.getElementById('current-avatar'),
    currentUsername: document.getElementById('current-username'),
    searchInput: document.getElementById('search-input'),
    searchResults: document.getElementById('search-results'),
    chatsList: document.getElementById('chats-list'),
    settingsBtn: document.getElementById('settings-btn'),
    
    // Chat area
    chatEmpty: document.getElementById('chat-empty'),
    chatActive: document.getElementById('chat-active'),
    chatAvatar: document.getElementById('chat-avatar'),
    chatUsername: document.getElementById('chat-username'),
    chatStatus: document.getElementById('chat-status'),
    messagesContainer: document.getElementById('messages-container'),
    messagesList: document.getElementById('messages-list'),
    typingIndicator: document.getElementById('typing-indicator'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    attachBtn: document.getElementById('attach-btn'),
    imageInput: document.getElementById('image-input'),
    imagePreview: document.getElementById('image-preview'),
    previewImage: document.getElementById('preview-image'),
    removeImageBtn: document.getElementById('remove-image-btn'),
    backBtn: document.getElementById('back-btn'),
    chatProfileBtn: document.getElementById('chat-profile-btn'),
    
    // Settings modal
    settingsModal: document.getElementById('settings-modal'),
    closeSettings: document.getElementById('close-settings'),
    bannerContainer: document.getElementById('banner-container'),
    bannerPlaceholder: document.getElementById('banner-placeholder'),
    bannerImage: document.getElementById('banner-image'),
    bannerInput: document.getElementById('banner-input'),
    settingsAvatar: document.getElementById('settings-avatar'),
    changeAvatarBtn: document.getElementById('change-avatar-btn'),
    avatarInput: document.getElementById('avatar-input'),
    settingsUsername: document.getElementById('settings-username'),
    
    // Profile modal
    profileModal: document.getElementById('profile-modal'),
    closeProfile: document.getElementById('close-profile'),
    profileBannerContainer: document.getElementById('profile-banner-container'),
    profileBannerPlaceholder: document.getElementById('profile-banner-placeholder'),
    profileBannerImage: document.getElementById('profile-banner-image'),
    profileModalAvatar: document.getElementById('profile-modal-avatar'),
    profileModalUsername: document.getElementById('profile-modal-username'),
    profileModalStatus: document.getElementById('profile-modal-status'),
    
    // Sidebar element
    sidebar: document.querySelector('.sidebar')
};

// ==================== API FUNCTIONS ====================
const api = {
    async register(username) {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        return res.json();
    },
    
    async getUser(username) {
        const res = await fetch(`/api/user/${username}`);
        return res.json();
    },
    
    async searchUsers(query) {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&exclude=${state.currentUser.username}`);
        return res.json();
    },
    
    async getChats(username) {
        const res = await fetch(`/api/chats/${username}`);
        return res.json();
    },
    
    async getMessages(user1, user2) {
        const res = await fetch(`/api/messages/${user1}/${user2}`);
        return res.json();
    },
    
    async uploadAvatar(file) {
        const formData = new FormData();
        formData.append('avatar', file);
        formData.append('username', state.currentUser.username);
        
        const res = await fetch('/api/upload/avatar', {
            method: 'POST',
            body: formData
        });
        return res.json();
    },
    
    async uploadBanner(file) {
        const formData = new FormData();
        formData.append('banner', file);
        formData.append('username', state.currentUser.username);
        
        const res = await fetch('/api/upload/banner', {
            method: 'POST',
            body: formData
        });
        return res.json();
    },
    
    async uploadChatImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        
        const res = await fetch('/api/upload/chat-image', {
            method: 'POST',
            body: formData
        });
        return res.json();
    }
};

// ==================== SOCKET FUNCTIONS ====================
function initSocket() {
    state.socket = io();
    
    state.socket.on('connect', () => {
        console.log('Connected to server');
        if (state.currentUser) {
            state.socket.emit('user:login', state.currentUser.username);
        }
    });
    
    state.socket.on('message:receive', (message) => {
        handleNewMessage(message);
    });
    
    state.socket.on('user:online', ({ username, isOnline }) => {
        updateUserOnlineStatus(username, isOnline);
    });
    
    state.socket.on('typing:show', ({ from }) => {
        if (state.currentChat && state.currentChat.username === from) {
            elements.typingIndicator.classList.remove('hidden');
            scrollToBottom();
        }
    });
    
    state.socket.on('typing:hide', ({ from }) => {
        if (state.currentChat && state.currentChat.username === from) {
            elements.typingIndicator.classList.add('hidden');
        }
    });
    
    state.socket.on('chat:update', ({ username, lastMessage }) => {
        loadChats();
    });
}

// ==================== UI FUNCTIONS ====================
function showScreen(screen) {
    elements.loginScreen.classList.remove('active');
    elements.chatScreen.classList.remove('active');
    screen.classList.add('active');
}

function updateCurrentUserUI() {
    elements.currentUsername.textContent = state.currentUser.username;
    updateAvatar(elements.currentAvatar, state.currentUser.avatar);
    updateAvatar(elements.settingsAvatar, state.currentUser.avatar);
    elements.settingsUsername.textContent = '@' + state.currentUser.username;
    
    if (state.currentUser.banner) {
        elements.bannerImage.src = state.currentUser.banner;
        elements.bannerImage.classList.remove('hidden');
        elements.bannerPlaceholder.classList.add('hidden');
    }
}

function updateAvatar(element, avatarUrl) {
    if (avatarUrl) {
        element.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
    } else {
        element.innerHTML = '<i class="fas fa-user"></i>';
    }
}

async function loadChats() {
    const result = await api.getChats(state.currentUser.username);
    if (result.success) {
        state.chats = result.chats;
        renderChatsList();
    }
}

function renderChatsList() {
    if (state.chats.length === 0) {
        elements.chatsList.innerHTML = `
            <div class="empty-chats">
                <i class="fas fa-comments"></i>
                <p>Нет активных чатов</p>
                <span>Найдите пользователя, чтобы начать общение</span>
            </div>
        `;
        return;
    }
    
    elements.chatsList.innerHTML = state.chats.map(chat => {
        const lastMsg = chat.lastMessage;
        let lastMessageText = 'Нет сообщений';
        let timeText = '';
        
        if (lastMsg) {
            if (lastMsg.type === 'image') {
                lastMessageText = `<span class="last-message image"><i class="fas fa-image"></i> Фото</span>`;
            } else {
                lastMessageText = `<span class="last-message">${escapeHtml(lastMsg.content.substring(0, 30))}${lastMsg.content.length > 30 ? '...' : ''}</span>`;
            }
            timeText = formatTime(lastMsg.timestamp);
        }
        
        return `
            <div class="chat-item ${state.currentChat?.username === chat.username ? 'active' : ''}" data-username="${chat.username}">
                <div class="avatar">
                    ${chat.avatar ? `<img src="${chat.avatar}" alt="">` : '<i class="fas fa-user"></i>'}
                    ${chat.isOnline ? '<div class="online-badge"></div>' : ''}
                </div>
                <div class="chat-info">
                    <div class="chat-header">
                        <span class="username">${chat.username}</span>
                        <span class="time">${timeText}</span>
                    </div>
                    ${lastMessageText}
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const username = item.dataset.username;
            openChat(username);
        });
    });
}

async function openChat(username) {
    const userResult = await api.getUser(username);
    if (!userResult.success) return;
    
    state.currentChat = userResult.user;
    
    // Update UI
    elements.chatEmpty.classList.add('hidden');
    elements.chatActive.classList.remove('hidden');
    
    elements.chatUsername.textContent = state.currentChat.username;
    updateAvatar(elements.chatAvatar, state.currentChat.avatar);
    
    updateChatStatus(state.currentChat.isOnline);
    
    // Load messages
    const messagesResult = await api.getMessages(state.currentUser.username, username);
    if (messagesResult.success) {
        renderMessages(messagesResult.messages);
    }
    
    // Update chat list active state
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', item.dataset.username === username);
    });
    
    // Mobile: hide sidebar
    if (window.innerWidth <= 768) {
        elements.sidebar.classList.add('hidden');
    }
    
    elements.messageInput.focus();
}

function updateChatStatus(isOnline) {
    elements.chatStatus.textContent = isOnline ? 'онлайн' : 'оффлайн';
    elements.chatStatus.classList.toggle('online', isOnline);
}

function renderMessages(messages) {
    elements.messagesList.innerHTML = messages.map(msg => createMessageHTML(msg)).join('');
    scrollToBottom();
}

function createMessageHTML(message) {
    const isOutgoing = message.from === state.currentUser.username;
    const time = formatTime(message.timestamp);
    
    let content = '';
    if (message.type === 'image' && message.fileUrl) {
        content = `<img src="${message.fileUrl}" alt="Image" onclick="openImageFullscreen('${message.fileUrl}')">`;
        if (message.content) {
            content += `<p>${escapeHtml(message.content)}</p>`;
        }
    } else {
        content = `<p>${escapeHtml(message.content)}</p>`;
    }
    
    return `
        <div class="message ${isOutgoing ? 'outgoing' : 'incoming'}">
            <div class="message-content">${content}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
}

function handleNewMessage(message) {
    // If message is for current chat, add it to the list
    if (state.currentChat && 
        (message.from === state.currentChat.username || message.to === state.currentChat.username)) {
        elements.messagesList.insertAdjacentHTML('beforeend', createMessageHTML(message));
        scrollToBottom();
    }
    
    // Reload chats list
    loadChats();
}

function sendMessage() {
    const content = elements.messageInput.value.trim();
    
    if (!content && !state.selectedImage) return;
    if (!state.currentChat) return;
    
    if (state.selectedImage) {
        // Send image first
        sendImageMessage(content);
    } else {
        // Send text message
        state.socket.emit('message:send', {
            from: state.currentUser.username,
            to: state.currentChat.username,
            content,
            type: 'text'
        });
        
        elements.messageInput.value = '';
        elements.sendBtn.disabled = true;
    }
}

async function sendImageMessage(caption = '') {
    if (!state.selectedImage) return;
    
    try {
        const result = await api.uploadChatImage(state.selectedImage);
        if (result.success) {
            state.socket.emit('message:send', {
                from: state.currentUser.username,
                to: state.currentChat.username,
                content: caption,
                type: 'image',
                fileUrl: result.url
            });
            
            // Clear image preview
            clearImagePreview();
            elements.messageInput.value = '';
            elements.sendBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        alert('Ошибка при загрузке изображения');
    }
}

function clearImagePreview() {
    state.selectedImage = null;
    elements.imagePreview.classList.add('hidden');
    elements.previewImage.src = '';
    elements.imageInput.value = '';
}

function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function updateUserOnlineStatus(username, isOnline) {
    // Update current chat status
    if (state.currentChat && state.currentChat.username === username) {
        state.currentChat.isOnline = isOnline;
        updateChatStatus(isOnline);
    }
    
    // Update chats list
    state.chats = state.chats.map(chat => {
        if (chat.username === username) {
            return { ...chat, isOnline };
        }
        return chat;
    });
    renderChatsList();
}

// ==================== SEARCH ====================
let searchTimeout;

async function handleSearch(query) {
    if (!query.trim()) {
        elements.searchResults.classList.add('hidden');
        return;
    }
    
    const result = await api.searchUsers(query);
    if (result.success && result.users.length > 0) {
        elements.searchResults.innerHTML = result.users.map(user => `
            <div class="search-result-item" data-username="${user.username}">
                <div class="avatar">
                    ${user.avatar ? `<img src="${user.avatar}" alt="">` : '<i class="fas fa-user"></i>'}
                </div>
                <div class="user-info">
                    <span class="username">${user.username}</span>
                </div>
                <div class="status-indicator ${user.isOnline ? 'online' : ''}"></div>
            </div>
        `).join('');
        
        elements.searchResults.classList.remove('hidden');
        
        // Add click handlers
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                openChat(item.dataset.username);
                elements.searchInput.value = '';
                elements.searchResults.classList.add('hidden');
            });
        });
    } else {
        elements.searchResults.innerHTML = '<div class="no-results">Пользователи не найдены</div>';
        elements.searchResults.classList.remove('hidden');
    }
}

// ==================== PROFILE MODAL ====================
async function openProfileModal(username) {
    const result = await api.getUser(username);
    if (!result.success) return;
    
    const user = result.user;
    
    elements.profileModalUsername.textContent = '@' + user.username;
    elements.profileModalStatus.textContent = user.isOnline ? 'онлайн' : 'оффлайн';
    elements.profileModalStatus.classList.toggle('online', user.isOnline);
    
    updateAvatar(elements.profileModalAvatar, user.avatar);
    
    if (user.banner) {
        elements.profileBannerImage.src = user.banner;
        elements.profileBannerImage.classList.remove('hidden');
        elements.profileBannerPlaceholder.classList.add('hidden');
    } else {
        elements.profileBannerImage.classList.add('hidden');
        elements.profileBannerPlaceholder.classList.remove('hidden');
    }
    
    elements.profileModal.classList.remove('hidden');
}

// ==================== UTILITIES ====================
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + 
           ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function openImageFullscreen(url) {
    window.open(url, '_blank');
}

// ==================== EVENT LISTENERS ====================
// Login
elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = elements.usernameInput.value.trim().toLowerCase();
    
    if (username.length < 2) {
        alert('Username должен содержать минимум 2 символа');
        return;
    }
    
    const result = await api.register(username);
    if (result.success) {
        state.currentUser = result.user;
        localStorage.setItem('chatUser', JSON.stringify(result.user));
        
        initSocket();
        state.socket.emit('user:login', state.currentUser.username);
        
        updateCurrentUserUI();
        await loadChats();
        showScreen(elements.chatScreen);
    } else {
        alert(result.error || 'Ошибка входа');
    }
});

// Search
elements.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => handleSearch(e.target.value), 300);
});

elements.searchInput.addEventListener('blur', () => {
    setTimeout(() => {
        elements.searchResults.classList.add('hidden');
    }, 200);
});

// Message input
elements.messageInput.addEventListener('input', () => {
    elements.sendBtn.disabled = !elements.messageInput.value.trim() && !state.selectedImage;
    
    // Auto-resize textarea
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 120) + 'px';
    
    // Typing indicator
    if (state.currentChat && elements.messageInput.value.trim()) {
        state.socket.emit('typing:start', {
            from: state.currentUser.username,
            to: state.currentChat.username
        });
    }
});

elements.messageInput.addEventListener('blur', () => {
    if (state.currentChat) {
        state.socket.emit('typing:stop', {
            from: state.currentUser.username,
            to: state.currentChat.username
        });
    }
});

elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

elements.sendBtn.addEventListener('click', sendMessage);

// Attach image
elements.attachBtn.addEventListener('click', () => {
    elements.imageInput.click();
});

elements.imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        state.selectedImage = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            elements.previewImage.src = e.target.result;
            elements.imagePreview.classList.remove('hidden');
            elements.sendBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }
});

elements.removeImageBtn.addEventListener('click', clearImagePreview);

// Back button (mobile)
elements.backBtn.addEventListener('click', () => {
    elements.sidebar.classList.remove('hidden');
    state.currentChat = null;
    elements.chatActive.classList.add('hidden');
    elements.chatEmpty.classList.remove('hidden');
});

// Settings modal
elements.settingsBtn.addEventListener('click', () => {
    elements.settingsModal.classList.remove('hidden');
});

elements.closeSettings.addEventListener('click', () => {
    elements.settingsModal.classList.add('hidden');
});

elements.settingsModal.querySelector('.modal-overlay').addEventListener('click', () => {
    elements.settingsModal.classList.add('hidden');
});

// Avatar upload
elements.changeAvatarBtn.addEventListener('click', () => {
    elements.avatarInput.click();
});

elements.avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        const result = await api.uploadAvatar(file);
        if (result.success) {
            state.currentUser.avatar = result.url;
            localStorage.setItem('chatUser', JSON.stringify(state.currentUser));
            updateCurrentUserUI();
        }
    }
});

// Banner upload
elements.bannerContainer.addEventListener('click', () => {
    elements.bannerInput.click();
});

elements.bannerInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        const result = await api.uploadBanner(file);
        if (result.success) {
            state.currentUser.banner = result.url;
            localStorage.setItem('chatUser', JSON.stringify(state.currentUser));
            elements.bannerImage.src = result.url;
            elements.bannerImage.classList.remove('hidden');
            elements.bannerPlaceholder.classList.add('hidden');
        }
    }
});

// Profile modal
elements.chatProfileBtn.addEventListener('click', () => {
    if (state.currentChat) {
        openProfileModal(state.currentChat.username);
    }
});

elements.closeProfile.addEventListener('click', () => {
    elements.profileModal.classList.add('hidden');
});

elements.profileModal.querySelector('.modal-overlay').addEventListener('click', () => {
    elements.profileModal.classList.add('hidden');
});

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Check for saved user
    const savedUser = localStorage.getItem('chatUser');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            const result = await api.getUser(user.username);
            
            if (result.success) {
                state.currentUser = result.user;
                initSocket();
                state.socket.emit('user:login', state.currentUser.username);
                updateCurrentUserUI();
                await loadChats();
                showScreen(elements.chatScreen);
                return;
            }
        } catch (e) {
            localStorage.removeItem('chatUser');
        }
    }
    
    showScreen(elements.loginScreen);
});
