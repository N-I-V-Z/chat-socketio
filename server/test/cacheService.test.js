const assert = require("node:assert/strict");
const test = require("node:test");
const { createCacheService } = require("../services/cacheService");

function createFakeClient(overrides = {}) {
  const values = new Map();
  const calls = [];
  return {
    values,
    calls,
    isReady: true,
    async get(key) {
      calls.push(["get", key]);
      return values.get(key) ?? null;
    },
    async set(key, value, options) {
      calls.push(["set", key, value, options]);
      values.set(key, value);
    },
    async del(key) {
      calls.push(["del", key]);
      values.delete(key);
    },
    ...overrides,
  };
}

test("cache-aside loads on miss and stores JSON with the requested TTL", async () => {
  const client = createFakeClient();
  const cache = createCacheService({
    connection: { getClient: () => client },
  });
  let loadCount = 0;

  const result = await cache.getOrLoad("users:list:v1", 60, async () => {
    loadCount += 1;
    return [{ userId: 3, userName: "member" }];
  });

  assert.deepEqual(result, [{ userId: 3, userName: "member" }]);
  assert.equal(loadCount, 1);
  assert.deepEqual(client.calls[1], [
    "set",
    "users:list:v1",
    '[{"userId":3,"userName":"member"}]',
    { EX: 60 },
  ]);
});

test("cache-aside serves a hit without querying the database", async () => {
  const client = createFakeClient();
  client.values.set("messages:room:v1:3:7", '[{"MessageText":"hello"}]');
  const cache = createCacheService({
    connection: { getClient: () => client },
  });
  let loaderCalled = false;

  const result = await cache.getOrLoad(
    "messages:room:v1:3:7",
    30,
    async () => {
      loaderCalled = true;
      return [];
    }
  );

  assert.deepEqual(result, [{ MessageText: "hello" }]);
  assert.equal(loaderCalled, false);
});

test("cache-aside falls back to the database when Redis is unavailable", async () => {
  let loadCount = 0;
  const cache = createCacheService({
    connection: { getClient: () => null },
  });

  const result = await cache.getOrLoad("users:list:v1", 60, async () => {
    loadCount += 1;
    return ["database"];
  });

  assert.deepEqual(result, ["database"]);
  assert.equal(loadCount, 1);
});

test("cache read failure logs only an error code and falls back to the database", async () => {
  const warnings = [];
  const client = createFakeClient({
    async get() {
      throw Object.assign(new Error("redis://user:secret@host"), {
        code: "ECONNRESET",
      });
    },
  });
  const cache = createCacheService({
    connection: { getClient: () => client },
    logger: { warn: (warning) => warnings.push(warning) },
  });

  const result = await cache.getOrLoad("private:key", 30, async () => [
    "database",
  ]);

  assert.deepEqual(result, ["database"]);
  assert.match(warnings[0], /ECONNRESET/);
  assert.equal(warnings[0].includes("secret"), false);
  assert.equal(warnings[0].includes("private:key"), false);
});

test("cache write failure still returns the database result", async () => {
  const warnings = [];
  const client = createFakeClient({
    async set() {
      throw Object.assign(new Error("Redis write failed"), {
        code: "ECONNRESET",
      });
    },
  });
  const cache = createCacheService({
    connection: { getClient: () => client },
    logger: { warn: (warning) => warnings.push(warning) },
  });

  const result = await cache.getOrLoad("users:list:v1", 60, async () => [
    "database",
  ]);

  assert.deepEqual(result, ["database"]);
  assert.match(warnings[0], /ECONNRESET/);
});

test("invalid cached JSON is evicted before loading from the database", async () => {
  const client = createFakeClient();
  client.values.set("users:list:v1", "{invalid");
  const cache = createCacheService({
    connection: { getClient: () => client },
    logger: { warn() {} },
  });

  const result = await cache.getOrLoad("users:list:v1", 60, async () => ["db"]);

  assert.deepEqual(result, ["db"]);
  assert.deepEqual(
    client.calls.filter(([operation]) => operation === "del"),
    [["del", "users:list:v1"]]
  );
});

test("cache invalidation is best-effort and returns false while Redis is offline", async () => {
  const cache = createCacheService({
    connection: { getClient: () => null },
  });

  assert.equal(await cache.invalidate("users:list:v1"), false);
});
