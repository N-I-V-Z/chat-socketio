const assert = require("node:assert/strict");
const test = require("node:test");
const redisConnection = require("../services/redisConnection");
const rateLimiter = require("../services/rateLimiter");

test("distributed limiter rejects requests after the configured quota", async () => {
  const original = redisConnection.getClient;
  let count = 0;
  redisConnection.getClient = () => ({
    isReady: true,
    async eval() {
      return ++count;
    },
  });
  try {
    assert.equal(
      await rateLimiter.allow("test:user:1", 2, 60, "http_write"),
      true,
    );
    assert.equal(
      await rateLimiter.allow("test:user:1", 2, 60, "http_write"),
      true,
    );
    assert.equal(
      await rateLimiter.allow("test:user:1", 2, 60, "http_write"),
      false,
    );
  } finally {
    redisConnection.getClient = original;
  }
});
