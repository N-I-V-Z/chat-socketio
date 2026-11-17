const { createClient } = require("redis");

const CONNECT_TIMEOUT_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 2000;

function createRedisConnection({
  url = process.env.REDIS_URL,
  clientFactory = createClient,
  logger = console,
} = {}) {
  let client = null;
  let connectPromise = null;
  let unavailableWarningLogged = false;

  function logUnavailable(error) {
    if (unavailableWarningLogged) {
      return;
    }

    unavailableWarningLogged = true;
    const code = error?.code || error?.name || "UNKNOWN";
    logger.warn(
      `Redis unavailable (${code}); continuing with database fallback.`
    );
  }

  function getClient() {
    if (!url) {
      return null;
    }

    if (!client) {
      try {
        client = clientFactory({
          url,
          socket: {
            connectTimeout: CONNECT_TIMEOUT_MS,
            reconnectStrategy: (retries) =>
              Math.min(retries * 200, MAX_RECONNECT_DELAY_MS),
          },
        });
        client.on("error", logUnavailable);
        client.on("ready", () => {
          unavailableWarningLogged = false;
        });
      } catch (error) {
        logUnavailable(error);
        return null;
      }
    }

    return client;
  }

  function connect() {
    const redisClient = getClient();
    if (!redisClient) {
      return Promise.resolve(false);
    }
    if (redisClient.isReady) {
      return Promise.resolve(true);
    }
    if (connectPromise) {
      return connectPromise;
    }
    if (redisClient.isOpen) {
      return Promise.resolve(false);
    }

    connectPromise = redisClient
      .connect()
      .then(() => true)
      .catch((error) => {
        logUnavailable(error);
        return false;
      })
      .finally(() => {
        connectPromise = null;
      });
    return connectPromise;
  }

  async function quit() {
    if (client?.isOpen) {
      await client.quit();
    }
  }

  return {
    connect,
    getClient,
    quit,
  };
}

module.exports = {
  createRedisConnection,
  ...createRedisConnection(),
};
