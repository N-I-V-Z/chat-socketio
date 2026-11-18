const redisConnection = require("./redisConnection");

function createCacheService({
  connection = redisConnection,
  logger = require("./logger"),
} = {}) {
  function logCacheFailure(operation, error) {
    const code = error?.code || error?.name || "UNKNOWN";
    logger.warn(
      `Redis cache ${operation} failed (${code}); database remains available.`,
    );
  }

  function getReadyClient(operation) {
    try {
      const client = connection.getClient();
      if (!client || !client.isReady) {
        return null;
      }
      return client;
    } catch (error) {
      logCacheFailure(operation, error);
      return null;
    }
  }

  async function getOrLoad(key, ttlSeconds, loader) {
    const client = getReadyClient("read");
    if (!client) {
      return loader();
    }

    let cached;
    try {
      cached = await client.get(key);
    } catch (error) {
      logCacheFailure("read", error);
      return loader();
    }

    if (cached !== null && cached !== undefined) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        logCacheFailure("decode", error);
        try {
          await client.del(key);
        } catch (deleteError) {
          logCacheFailure("delete", deleteError);
        }
      }
    }

    const value = await loader();
    let serialized;
    try {
      serialized = JSON.stringify(value);
    } catch (error) {
      logCacheFailure("encode", error);
      return value;
    }

    if (serialized === undefined) {
      return value;
    }

    try {
      await client.set(key, serialized, { EX: ttlSeconds });
    } catch (error) {
      logCacheFailure("write", error);
    }
    return value;
  }

  async function invalidate(key) {
    const client = getReadyClient("invalidate");
    if (!client) {
      return false;
    }
    try {
      await client.del(key);
      return true;
    } catch (error) {
      logCacheFailure("invalidate", error);
      return false;
    }
  }

  return {
    getOrLoad,
    invalidate,
  };
}

module.exports = {
  createCacheService,
  ...createCacheService(),
};
