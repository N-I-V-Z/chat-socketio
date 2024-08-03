const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const initRouters = require('./routes'); // Đảm bảo initRouters tồn tại và được cấu hình đúng
require('dotenv').config();
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.use(express.static('public'));

// CORS Configuration
app.use(cors({
  origin: process.env.CLIENT_URL,
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

// Session Configuration
app.use(session({
  secret: "MusicPlayer",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' } // Chỉ bật secure cookie khi ở môi trường sản xuất
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

initRouters(app);

let users = {}; // Lưu trữ socket ID của người dùng

io.on("connection", (socket) => {
  // Đăng ký người dùng với socket ID của họ
  socket.on("register", (userId) => {
    users[userId] = socket.id;
  });

  // Xử lý gửi tin nhắn
  socket.on("sendMessage", ({ senderId, receiverId, message }) => {
    // Gửi tin nhắn đến người nhận
    if (users[receiverId]) {
      io.to(users[receiverId]).emit("receiveMessage", { senderId, message });
    }
    // Gửi tin nhắn đến người gửi
    io.to(users[senderId]).emit("receiveMessage", { senderId, message });
  });

  // Xử lý ngắt kết nối
  socket.on("disconnect", () => {
    // Xóa người dùng khỏi danh sách khi họ ngắt kết nối
    for (const [key, value] of Object.entries(users)) {
      if (value === socket.id) {
        delete users[key];
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000; // Sử dụng PORT từ biến môi trường nếu có
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
