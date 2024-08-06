const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const initRouters = require("./routes");
require("dotenv").config();
const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.use(express.static("public"));

// CORS Configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

// Session Configuration
app.use(
  session({
    secret: "ChatRealTime",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

initRouters(app);

let users = {}; // Lưu trữ socket ID của người dùng

io.on("connection", (socket) => {
  // lưu user khi kết nối
  socket.on("register", (userId) => {
    users[userId] = socket.id;
  });

  // xử lý việc gửi tin
  socket.on("sendMessage", ({ senderId, receiverId, message }) => {
    if (users[receiverId]) {
      io.to(users[receiverId]).emit("receiveMessage", { senderId, message });
    }
    io.to(users[senderId]).emit("receiveMessage", { senderId, message });
  });

  // gửi yêu cầu call video
  socket.on("videoCallRequest", ({ from, name, to, video }) => {
    if (users[to]) {
      io.to(users[to]).emit("videoCallRequest", { from, name, video });
    }
  });

  // chấp nhận yêu cầu call video
  socket.on("callAccepted", ({ from, to, video }) => {
    if (users[to]) {
      io.to(users[to]).emit("callAccepted", { from, video });
    }
  });

  // từ chối yêu cầu call video
  socket.on("callRejected", ({ to }) => {
    if (users[to]) {
      io.to(users[to]).emit("callRejected");
    }
  });

  // hủy cuộc gọi khi đang chờ gọi
  socket.on("callEnded", ({ to }) => {
    if (users[to]) {
      io.to(users[to]).emit("callEnded");
    }
  });
  // gửi liên kết peer cho đối phương
  socket.on("offer", ({ offer, to }) => {
    if (users[to]) {
      io.to(users[to]).emit("offer", { offer });
    }
  });
  // sau khi nhận được offer thì sẽ đưa lại liên kết peer cho đối phương
  socket.on("answer", ({ answer, to }) => {
    if (users[to]) {
      io.to(users[to]).emit("answer", { answer });
    }
  });

  socket.on("ice-candidate", ({ iceCandidate, to }) => {
    if (users[to]) {
      io.to(users[to]).emit("ice-candidate", { iceCandidate });
    }
  });

  socket.on("disconnect", () => {
    Object.keys(users).forEach((userId) => {
      if (users[userId] === socket.id) {
        delete users[userId];
      }
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
