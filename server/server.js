const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const initRouters = require('./routes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.use(express.static('public'));

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

app.use(session({
  secret: "MusicPlayer",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' } 
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

initRouters(app);

const users = {}; 

io.on('connection', (socket) => {
  console.log('a user connected', socket.id);

  socket.on('register', (userId) => {
    users[userId] = socket.id;
    console.log(`User registered: ${userId}`);
  });

  // Xử lý gửi tin nhắn
  socket.on('chat message', ({ senderId, receiverId, message }) => {
    const receiverSocketId = users[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('chat message', { senderId, message });
    }
  });

  // Xử lý ngắt kết nối
  socket.on('disconnect', () => {
    console.log('user disconnected', socket.id);
    for (const userId in users) {
      if (users[userId] === socket.id) {
        delete users[userId];
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000; // Sử dụng PORT từ biến môi trường nếu có
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
