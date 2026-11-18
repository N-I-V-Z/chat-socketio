const { createAdapter } = require("@socket.io/redis-adapter");

function errorCode(error) {
  return error?.code || error?.name || "UNKNOWN";
}

async function configureRedisSocketAdapter(
  io,
  redisConnection,
  logger = require("./logger"),
) {
  await redisConnection.connect();
  const redisClient = redisConnection.getClient();
  if (!redisClient?.isReady) {
    logger.warn("Socket.IO Redis adapter unavailable (REDIS_NOT_READY).");
    return null;
  }

  const pubClient = redisClient.duplicate();
  const subClient = redisClient.duplicate();
  const logRedisError = (error) => {
    logger.warn(`Socket.IO Redis adapter error (${errorCode(error)}).`);
  };
  pubClient.on("error", logRedisError);
  subClient.on("error", logRedisError);

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    return async () => {
      await Promise.all([
        pubClient.isOpen ? pubClient.quit() : Promise.resolve(),
        subClient.isOpen ? subClient.quit() : Promise.resolve(),
      ]);
    };
  } catch (error) {
    logger.warn(`Socket.IO Redis adapter unavailable (${errorCode(error)}).`);
    await Promise.allSettled([
      pubClient.isOpen ? pubClient.quit() : Promise.resolve(),
      subClient.isOpen ? subClient.quit() : Promise.resolve(),
    ]);
    return null;
  }
}

module.exports = configureRedisSocketAdapter;
