const assert = require("node:assert/strict");
const test = require("node:test");
const { createRedisConnection } = require("../services/redisConnection");

test("Redis connection stays disabled without a URL", async () => {
  let clientCreated = false;
  const connection = createRedisConnection({
    url: "",
    clientFactory: () => {
      clientCreated = true;
      throw new Error("Redis client should not be created");
    },
  });

  assert.equal(await connection.connect(), false);
  assert.equal(connection.getClient(), null);
  assert.equal(clientCreated, false);
});

test("Redis connection reuses one client and uses bounded reconnect settings", async () => {
  const listeners = new Map();
  let clientOptions;
  let connectCount = 0;
  const client = {
    isOpen: false,
    isReady: false,
    on(event, handler) {
      listeners.set(event, handler);
    },
    async connect() {
      connectCount += 1;
      this.isOpen = true;
      this.isReady = true;
    },
  };
  const connection = createRedisConnection({
    url: "redis://user:password@localhost:6379",
    clientFactory(options) {
      clientOptions = options;
      return client;
    },
  });

  assert.equal(await connection.connect(), true);
  assert.equal(await connection.connect(), true);
  assert.equal(connection.getClient(), client);
  assert.equal(connectCount, 1);
  assert.equal(clientOptions.socket.connectTimeout, 2000);
  assert.equal(clientOptions.socket.reconnectStrategy(30), 2000);
  assert.equal(typeof listeners.get("error"), "function");
});

test("Redis connection reports failure without exposing the configured URL", async () => {
  const warnings = [];
  const client = {
    isOpen: false,
    isReady: false,
    on() {},
    async connect() {
      throw Object.assign(new Error("connection failed"), {
        code: "ECONNREFUSED",
      });
    },
  };
  const connection = createRedisConnection({
    url: "redis://user:secret@redis.internal:6379",
    clientFactory: () => client,
    logger: {
      warn: (warning) => warnings.push(warning),
    },
  });

  assert.equal(await connection.connect(), false);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /ECONNREFUSED/);
  assert.equal(warnings[0].includes("secret"), false);
  assert.equal(warnings[0].includes("redis.internal"), false);
});
