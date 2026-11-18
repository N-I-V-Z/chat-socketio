const redisConnection = require("./redisConnection");

const TTL_SECONDS = 60;
const key = (userId) => `presence:user:${userId}`;

function client() {
  const value = redisConnection.getClient();
  if (!value?.isReady)
    throw Object.assign(new Error("Presence unavailable"), {
      code: "PRESENCE_UNAVAILABLE",
    });
  return value;
}

async function heartbeat(userId, socketId) {
  const redis = client();
  const now = Date.now();
  const result = await redis
    .multi()
    .zRemRangeByScore(key(userId), 0, now)
    .zAdd(key(userId), { score: now + TTL_SECONDS * 1000, value: socketId })
    .expire(key(userId), TTL_SECONDS * 2)
    .zCard(key(userId))
    .exec();
  return Number(result[3]);
}

async function connect(userId, socketId) {
  return (await heartbeat(userId, socketId)) === 1;
}

async function disconnect(userId, socketId) {
  const result = await client()
    .multi()
    .zRem(key(userId), socketId)
    .zCard(key(userId))
    .exec();
  return Number(result[0]) === 1 && Number(result[1]) === 0;
}

async function getOnlineUserIds(userIds) {
  const ids = [...new Set(userIds.map(Number))];
  if (!ids.length) return new Set();
  const pipeline = client().multi();
  const now = Date.now();
  for (const id of ids) {
    pipeline.zRemRangeByScore(key(id), 0, now);
    pipeline.zCard(key(id));
  }
  const results = await pipeline.exec();
  return new Set(
    ids.filter((_id, index) => Number(results[index * 2 + 1]) > 0),
  );
}

module.exports = { connect, disconnect, heartbeat, getOnlineUserIds };
