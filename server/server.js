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
const logger = require("./services/logger");
const metrics = require("./services/metrics");

let adapterReady = false;
let stopAdapter = null;
let stopRetention = null;
let adapterRetry = null;
let adapterConnecting = null;
let adapterEventsAttached = false;
let shuttingDown = false;
const app = createApp({
  readiness: async () => {
    const redisReady =
      adapterReady && Boolean(redisConnection.getClient()?.isReady);
    const kafkaReady = chatEventPipeline.isReady();
    metrics.dependencyReady.set({ dependency: "redis" }, redisReady ? 1 : 0);
    metrics.dependencyReady.set({ dependency: "kafka" }, kafkaReady ? 1 : 0);
    if (!adapterReady || !redisReady || !kafkaReady || shuttingDown)
      return false;
    try {
      await db.sequelize.authenticate();
      metrics.dependencyReady.set({ dependency: "database" }, 1);
      return true;
    } catch {
      metrics.dependencyReady.set({ dependency: "database" }, 0);
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
const chatEventPipeline = createChatEventPipeline({ db, io, logger });
registerSockets(io, { isReady: () => adapterReady && !shuttingDown, logger });

async function ensureAdapter() {
  if (adapterReady || shuttingDown) return;
  if (adapterConnecting) return adapterConnecting;
  adapterConnecting = configureRedisSocketAdapter(io, redisConnection, logger)
    .then((cleanup) => {
      stopAdapter = cleanup;
      adapterReady = Boolean(cleanup);
      if (adapterReady && !adapterEventsAttached) {
        const redis = redisConnection.getClient();
        const disconnectRealtime = () => io.disconnectSockets(true);
        redis.on("reconnecting", disconnectRealtime);
        redis.on("end", disconnectRealtime);
        adapterEventsAttached = true;
      }
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
      logger.error({ err: result.reason }, "Shutdown cleanup failed");
  }
}

async function startServer() {
  try {
    await db.sequelize.authenticate();
    await ensureAdapter();
    adapterRetry = setInterval(() => {
      void ensureAdapter().catch((error) =>
        logger.error({ err: error }, "Redis adapter retry failed"),
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
    logger.info({ port: process.env.PORT || 5000 }, "Server started");
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
        logger.error({ err: error }, "Shutdown failed");
        process.exitCode = 1;
      })
      .finally(() => clearTimeout(timeout));
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.error({ err: error }, "Could not start chat services");
    process.exitCode = 1;
  });
}

module.exports = { app, server, io, startServer, shutdown };
