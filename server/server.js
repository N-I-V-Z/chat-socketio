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

const { userRoom } = require("./utils/chatUtils");
const registerCallHandlers = require("./sockets/callHandlers");

const authService = require("./services/authService");
const auditLogService = require("./services/auditLogService");
const presenceService = require("./services/presenceService");

const redisConnection = require("./services/redisConnection");
const configureRedisSocketAdapter = require("./services/redisSocketAdapter");
const { createChatEventPipeline } = require("./services/kafkaChatPipeline");
const db = require("./models");

const app = express();
const server = http.createServer(app);
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
const io = new Server(server, {
  maxHttpBufferSize: 65536,
  cors: {
    origin: clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});
app.set("io", io);
let adapterReady = false;
let stopAdapter = null;
let stopRetention = null;
let adapterRetry = null;
let adapterConnecting = null;
let shuttingDown = false;

app.use(express.static("public"));
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);
app.use(cookieParser());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "1mb" }));

initRouters(app);
app.use((req, res) => failure(res, 404, "ROUTE_NOT_FOUND", "Route not found"));
app.use(errorHandler);

const chatEventPipeline = createChatEventPipeline({ db, io });

io.use(async (socket, next) => {
  if (!adapterReady || !redisConnection.getClient()?.isReady || shuttingDown) {
    const error = new Error("Realtime unavailable");
    error.data = { code: "REALTIME_UNAVAILABLE" };
    return next(error);
  }
  const token = socket.handshake.auth?.token;
  if (!token) {
    const error = new Error("Authentication required");
    error.data = { code: "UNAUTHORIZED" };
    return next(error);
  }

  try {
    const auth = authService.verifyAccessToken(token);
    const user = await db.Users.findByPk(auth.userId, {
      attributes: ["userId", "userName", "role", "isActive"],
    });
    if (!user || user.isActive === false) {
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

  const remainingTokenLifetime = accessTokenExpiresAt * 1000 - Date.now();
  const expiryTimer = setTimeout(
    () => socket.disconnect(true),
    Math.min(Math.max(remainingTokenLifetime, 0), 2_147_483_647),
  );
  socket.use(async (_packet, next) => {
    try {
      if (Date.now() >= accessTokenExpiresAt * 1000) {
        socket.disconnect(true);
        return;
      }
      const user = await db.Users.findByPk(userId, {
        attributes: ["userId", "isActive"],
      });
      if (!user || user.isActive === false) {
        socket.disconnect(true);
        return;
      }
      return next();
    } catch (error) {
      return next(error);
    }
  });
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

  registerCallHandlers(io, socket);
});

const PORT = process.env.PORT || 5000;

async function ensureAdapter() {
  if (adapterReady || shuttingDown) return;
  if (adapterConnecting) return adapterConnecting;
  adapterConnecting = configureRedisSocketAdapter(io, redisConnection)
    .then((cleanup) => {
      stopAdapter = cleanup;
      adapterReady = Boolean(cleanup);
    })
    .finally(() => {
      adapterConnecting = null;
    });
  return adapterConnecting;
}

async function startServer() {
  try {
    await db.sequelize.authenticate();
    await ensureAdapter();
    adapterRetry = setInterval(() => {
      void ensureAdapter().catch((error) =>
        console.error("Redis adapter retry failed:", error),
      );
    }, 5000);
    adapterRetry.unref?.();
    await chatEventPipeline.start();
    stopRetention = auditLogService.startRetentionCleanup();
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(PORT, () => {
        server.off("error", reject);
        resolve();
      });
    });
    console.log(`Server is running at http://localhost:${PORT}`);
  } catch (error) {
    await shutdown();
    throw error;
  }
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (adapterRetry) clearInterval(adapterRetry);
  stopRetention?.();
  io.disconnectSockets(true);
  if (server.listening) {
    await new Promise((resolve) => server.close(() => resolve()));
  }
  const results = await Promise.allSettled([
    chatEventPipeline.stop(),
    stopAdapter?.(),
    redisConnection.quit(),
    db.sequelize.close(),
  ]);
  for (const result of results) {
    if (result.status === "rejected")
      console.error("Shutdown cleanup failed:", result.reason);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    const timeout = setTimeout(() => {
      process.exitCode = 1;
      process.exit();
    }, 10000);
    void shutdown()
      .catch((error) => {
        console.error("Shutdown failed:", error);
        process.exitCode = 1;
      })
      .finally(() => clearTimeout(timeout));
  });
}

startServer().catch((error) => {
  console.error("Could not start chat services:", error);
  process.exitCode = 1;
});
