const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const UAParser = require('ua-parser-js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
  const ip = socket.handshake.address;
  const parser = new UAParser(socket.handshake.headers['user-agent']);
  const device = parser.getDevice();
  const isMobile = device.type === 'mobile' || device.type === 'tablet';
  console.log(`New connection: IP=${ip}, Mobile=${isMobile}`);

  socket.on('joinRoom', ({ room, password, username }) => {
    if (rooms[room] && rooms[room].password === password) {
      socket.join(room);
      socket.username = username;
      socket.room = room;

      if (!rooms[room].users) rooms[room].users = [];
      rooms[room].users.push({ id: socket.id, username, seen: false });
      io.to(room).emit('userList', rooms[room].users);
      io.to(room).emit('activeCount', rooms[room].users.length);

      socket.emit('joined', { success: true });
    } else {
      socket.emit('joined', { success: false, message: 'Invalid room or password' });
    }
  });

  socket.on('createRoom', ({ room, password, username }) => {
    if (rooms[room]) {
      socket.emit('created', { success: false, message: 'Room already exists' });
    } else {
      rooms[room] = { password, users: [{ id: socket.id, username, seen: false }], messages: [] };
      socket.join(room);
      socket.username = username;
      socket.room = room;
      socket.emit('created', { success: true });
      io.to(room).emit('userList', rooms[room].users);
      io.to(room).emit('activeCount', rooms[room].users.length);
    }
  });

  socket.on('chatMessage', ({ room, message, username }) => {
    if (rooms[room]) {
      const msg = { username, message, timestamp: new Date(), seen: false };
      rooms[room].messages.push(msg);
      io.to(room).emit('message', msg);
    }
  });

  socket.on('typing', ({ room, username }) => {
    socket.to(room).emit('typing', { username });
  });

  socket.on('stopTyping', ({ room }) => {
    socket.to(room).emit('stopTyping');
  });

  socket.on('seen', ({ room, username }) => {
    if (rooms[room]) {
      const user = rooms[room].users.find(u => u.username === username);
      if (user) user.seen = true;
      rooms[room].messages.forEach(msg => msg.seen = true);
      io.to(room).emit('userList', rooms[room].users);
      io.to(room).emit('messages', rooms[room].messages);
      io.to(room).emit('activeCount', rooms[room].users.length);
    }
  });

  socket.on('disconnect', () => {
    const { room, username } = socket;
    if (room && rooms[room]) {
      rooms[room].users = rooms[room].users.filter(u => u.username !== username);
      io.to(room).emit('userList', rooms[room].users);
      io.to(room).emit('activeCount', rooms[room].users.length);
      console.log(`Disconnected: IP=${ip}, Mobile=${isMobile}, Username=${username}`);
      if (rooms[room].users.length === 0) {
        delete rooms[room];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
