const redisConnection = require("./redisConnection");
const metrics = require("./metrics");

const local = new Map();
async function allow(key, limit, seconds, kind) {
  const redis = redisConnection.getClient();
  let count;
  if (redis?.isReady) {
    count = await redis.eval(
      `local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n`,
      { keys: [`rate:${key}`], arguments: [String(seconds)] },
    );
  } else {
    const now = Date.now();
    const state = local.get(key);
    const next =
      !state || state.expiresAt <= now
        ? { count: 1, expiresAt: now + seconds * 1000 }
        : { ...state, count: state.count + 1 };
    local.set(key, next);
    count = next.count;
    if (local.size > 10000) {
      for (const [entry, value] of local)
        if (value.expiresAt <= now) local.delete(entry);
      while (local.size > 10000) local.delete(local.keys().next().value);
    }
  }
  const allowed = Number(count) <= limit;
  if (!allowed) metrics.rateLimited.inc({ kind });
  return allowed;
}

module.exports = { allow };
