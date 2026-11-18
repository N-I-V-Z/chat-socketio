require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../.env"),
});

if (
  !process.env.JWT_ACCESS_SECRET ||
  Buffer.byteLength(process.env.JWT_ACCESS_SECRET) < 32
) {
  throw new Error("JWT_ACCESS_SECRET must be at least 32 bytes.");
}

const http = require("node:http");
const { Server } = require("socket.io");
const createApp = require("./app");
const registerSockets = require("./sockets");
const db = require("./models");
const redisConnection = require("./services/redisConnection");
const configureRedisSocketAdapter = require("./services/redisSocketAdapter");
const { createChatEventPipeline } = require("./services/kafkaChatPipeline");
const auditLogService = require("./services/auditLogService");

let adapterReady = false;
let stopAdapter = null;
let stopRetention = null;
let adapterRetry = null;
let adapterConnecting = null;
let shuttingDown = false;
const app = createApp({
  readiness: async () => {
    if (
      !adapterReady ||
      !redisConnection.getClient()?.isReady ||
      !chatEventPipeline.isReady() ||
      shuttingDown
    )
      return false;
    try {
      await db.sequelize.authenticate();
      return true;
    } catch {
      return false;
    }
  },
});
const server = http.createServer(app);
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
const io = new Server(server, {
  maxHttpBufferSize: 65536,
  cors: { origin: clientUrl, credentials: true, methods: ["GET", "POST"] },
});
app.set("io", io);
const chatEventPipeline = createChatEventPipeline({ db, io });
registerSockets(io, { isReady: () => adapterReady && !shuttingDown });

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

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (adapterRetry) clearInterval(adapterRetry);
  stopRetention?.();
  io.disconnectSockets(true);
  if (server.listening) await new Promise((resolve) => server.close(resolve));
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
      server.listen(process.env.PORT || 5000, () => {
        server.off("error", reject);
        resolve();
      });
    });
    console.log(`Server is running on port ${process.env.PORT || 5000}`);
  } catch (error) {
    await shutdown();
    throw error;
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

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Could not start chat services:", error);
    process.exitCode = 1;
  });
}

module.exports = { app, server, io, startServer, shutdown };
