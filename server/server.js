const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const initRouters = require('./routes');
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
  secret: "ChatRealTime",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // process.env.NODE_ENV === 'production' để bật secure cookie khi ở môi trường sản xuất
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
    if (users[receiverId]) {
      io.to(users[receiverId]).emit("receiveMessage", { senderId, message });
    }
    io.to(users[senderId]).emit("receiveMessage", { senderId, message });
  });

  // Khi server nhận sự kiện videoCallRequest, nó gửi yêu cầu tới người nhận.
  socket.on("videoCallRequest", ({ from, to }) => {
    if (users[to]) {
      io.to(users[to]).emit("videoCallRequest", { from: from });
    }
  });

  // Khi server nhận tín hiệu từ một peer, nó gửi tín hiệu đó tới peer còn lại.
  socket.on("signal", (data) => {
    if (users[data.to]) {
      io.to(users[data.to]).emit("signal", data);
    }
  });

  socket.on("endCall", ({ to }) => {
    if (users[to]) {
      io.to(users[to]).emit("callEnded");
    }
  });

  // Xử lý ngắt kết nối
  socket.on("disconnect", () => {
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
