require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../.env"),
});

if (
  !process.env.JWT_ACCESS_SECRET ||
  Buffer.byteLength(process.env.JWT_ACCESS_SECRET) < 32
) {
  throw new Error("JWT_ACCESS_SECRET must be at least 32 bytes.");
}

const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const initRouters = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const { failure } = require("./utils/apiResponse");
const authService = require("./services/authService");
const auditLogService = require("./services/auditLogService");
const presenceService = require("./services/presenceService");
const redisConnection = require("./services/redisConnection");
const db = require("./models");

const app = express();
const server = http.createServer(app);
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
const io = new Server(server, {
  cors: {
    origin: clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.use(express.static("public"));
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);
app.use(cookieParser());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "1mb" }));

initRouters(app);
app.use((req, res) =>
  failure(res, 404, "ROUTE_NOT_FOUND", "Route not found")
);
app.use(errorHandler);

function userRoom(userId) {
  return `user:${userId}`;
}

function parseUserId(value) {
  const userId = Number(value);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    const error = new Error("Authentication required");
    error.data = { code: "UNAUTHORIZED" };
    return next(error);
  }

  try {
    const auth = authService.verifyAccessToken(token);
    const user = await db.Users.findByPk(auth.userId, {
      attributes: ["userId", "userName", "role"],
    });
    if (!user) {
      const error = new Error("Authentication required");
      error.data = { code: "INVALID_ACCESS_TOKEN" };
      return next(error);
    }

    socket.data.userId = user.userId;
    socket.data.userName = user.userName;
    socket.data.role = user.role;
    socket.data.accessTokenExpiresAt = auth.expiresAt;
    return next();
  } catch (error) {
    const authError = new Error("Authentication required");
    if (error.name === "TokenExpiredError") {
      authError.data = { code: "ACCESS_TOKEN_EXPIRED" };
    } else if (error.name === "JsonWebTokenError") {
      authError.data = { code: "INVALID_ACCESS_TOKEN" };
    } else {
      console.error("Socket authentication failed:", error);
      authError.data = { code: "AUTHENTICATION_UNAVAILABLE" };
    }
    return next(authError);
  }
});

io.on("connection", (socket) => {
  const { userId, userName, accessTokenExpiresAt } = socket.data;
  socket.join(userRoom(userId));
  presenceService.connect(userId, socket.id);
  auditLogService
    .recordEvent({
      eventType: auditLogService.EVENT_TYPES.PRESENCE_CONNECTED,
      actorUserId: userId,
      actorUserName: userName,
    })
    .catch((error) => {
      console.error("Could not record user connection:", error);
    });

  const remainingTokenLifetime =
    accessTokenExpiresAt * 1000 - Date.now();
  const expiryTimer = setTimeout(
    () => socket.disconnect(true),
    Math.max(remainingTokenLifetime, 0)
  );
  socket.on("disconnect", () => {
    clearTimeout(expiryTimer);
    presenceService.disconnect(userId, socket.id);
    auditLogService
      .recordEvent({
        eventType: auditLogService.EVENT_TYPES.PRESENCE_DISCONNECTED,
        actorUserId: userId,
        actorUserName: userName,
      })
      .catch((error) => {
        console.error("Could not record user disconnection:", error);
      });
  });

  socket.on("sendMessage", (payload = {}) => {
    const { receiverId, message, messageId } = payload || {};
    const recipientId = parseUserId(receiverId);
    if (
      !recipientId ||
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 4000
    ) {
      return;
    }

    const messageEvent = {
      senderId: userId,
      receiverId: recipientId,
      messageId: parseUserId(messageId),
      message: message.trim(),
    };
    io.to(userRoom(recipientId)).emit("receiveMessage", messageEvent);
    io.to(userRoom(userId)).emit("receiveMessage", messageEvent);
  });

  socket.on("videoCallRequest", (payload = {}) => {
    const { to, video } = payload || {};
    const recipientId = parseUserId(to);
    if (!recipientId) return;

    io.to(userRoom(recipientId)).emit("videoCallRequest", {
      from: userId,
      name: userName,
      video: Boolean(video),
    });
  });

  socket.on("callAccepted", (payload = {}) => {
    const { to, video } = payload || {};
    const recipientId = parseUserId(to);
    if (!recipientId) return;

    io.to(userRoom(recipientId)).emit("callAccepted", {
      from: userId,
      video: Boolean(video),
    });
  });

  socket.on("callRejected", (payload = {}) => {
    const { to } = payload || {};
    const recipientId = parseUserId(to);
    if (recipientId) io.to(userRoom(recipientId)).emit("callRejected");
  });

  socket.on("callEnded", (payload = {}) => {
    const { to } = payload || {};
    const recipientId = parseUserId(to);
    if (recipientId) io.to(userRoom(recipientId)).emit("callEnded");
  });

  socket.on("offer", (payload = {}) => {
    const { offer, to } = payload || {};
    const recipientId = parseUserId(to);
    if (recipientId) io.to(userRoom(recipientId)).emit("offer", { offer });
  });

  socket.on("answer", (payload = {}) => {
    const { answer, to } = payload || {};
    const recipientId = parseUserId(to);
    if (recipientId) io.to(userRoom(recipientId)).emit("answer", { answer });
  });

  socket.on("ice-candidate", (payload = {}) => {
    const { iceCandidate, to } = payload || {};
    const recipientId = parseUserId(to);
    if (recipientId) {
      io.to(userRoom(recipientId)).emit("ice-candidate", { iceCandidate });
    }
  });
});

const PORT = process.env.PORT || 5000;
auditLogService.startRetentionCleanup();
redisConnection.connect();
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
