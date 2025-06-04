const socket = io();
const encryptionKey = 'your-secure-key-123'; // Replace with a secure key

function encryptMessage(message) {
  return CryptoJS.AES.encrypt(message, encryptionKey).toString();
}

function decryptMessage(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, encryptionKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

if (document.getElementById('joinForm')) {
  const joinForm = document.getElementById('joinForm');
  const error = document.getElementById('error');

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const room = document.getElementById('room').value;
    const password = document.getElementById('password').value;

    socket.emit('joinRoom', { room, password, username });

    socket.on('joined', ({ success, message }) => {
      if (success) {
        localStorage.setItem('chatData', JSON.stringify({ room, username }));
        window.location.href = 'chat.html';
      } else {
        error.textContent = message;
      }
    });
  });
}

if (document.getElementById('createForm')) {
  const createForm = document.getElementById('createForm');
  const error = document.getElementById('error');

  createForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const room = document.getElementById('room').value;
    const password = document.getElementById('password').value;

    socket.emit('createRoom', { room, password, username });

    socket.on('created', ({ success, message }) => {
      if (success) {
        localStorage.setItem('chatData', JSON.stringify({ room, username }));
        window.location.href = 'chat.html';
      } else {
        error.textContent = message;
      }
    });
  });
}

if (document.getElementById('messageForm')) {
  const messageForm = document.getElementById('messageForm');
  const messages = document.getElementById('messages');
  const userList = document.getElementById('userList');
  const typing = document.getElementById('typing');
  const chatData = JSON.parse(localStorage.getItem('chatData'));
  const { room, username } = chatData;

  if (!room || !username) {
    window.location.href = 'index.html';
    return;
  }

  socket.emit('joinRoom', { room, password: '', username });

  socket.on('joined', ({ success, message }) => {
    if (!success) {
      window.location.href = 'index.html';
    }
  });

  socket.on('message', ({ username: sender, message, seen }) => {
    const decryptedMessage = decryptMessage(message);
    const div = document.createElement('div');
    div.classList.add('message');
    if (sender === username) div.classList.add('me');
    if (seen) div.classList.add('seen');
    div.innerHTML = `<strong>${sender}</strong>: ${decryptedMessage}`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  });

  socket.on('messages', (msgs) => {
    messages.innerHTML = '';
    msgs.forEach(({ username: sender, message, seen }) => {
      const decryptedMessage = decryptMessage(message);
      const div = document.createElement('div');
      div.classList.add('message');
      if (sender === username) div.classList.add('me');
      if (seen) div.classList.add('seen');
      div.innerHTML = `<strong>${sender}</strong>: ${decryptedMessage}`;
      messages.appendChild(div);
    });
    messages.scrollTop = messages.scrollHeight;
  });

  socket.on('userList', (users) => {
    userList.innerHTML = '';
    users.forEach(user => {
      const li = document.createElement('li');
      li.textContent = user.username;
      if (user.seen) li.classList.add('seen');
      userList.appendChild(li);
    });
    socket.emit('seen', { room, username });
  });

  socket.on('typing', ({ username: typer }) => {
    typing.textContent = `${typer} is typing...`;
  });

  socket.on('stopTyping', () => {
    typing.textContent = '';
  });

  let typingTimeout;
  document.getElementById('message').addEventListener('input', () => {
    socket.emit('typing', { room, username });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('stopTyping', { room });
    }, 1000);
  });

  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = document.getElementById('message').value;
    if (message.trim()) {
      const encryptedMessage = encryptMessage(message);
      socket.emit('chatMessage', { room, message: encryptedMessage, username });
      document.getElementById('message').value = '';
      socket.emit('stopTyping', { room });
    }
  });
}
