const { randomUUID } = require("node:crypto");
const db = require("../models");
const redisConnection = require("./redisConnection");
const { getDirectPairKey } = require("./conversationService");

const RING_SECONDS = 60;
const ACTIVE_SECONDS = 7200;
const sessionKey = (id) => `call:session:${id}`;
const userKey = (id) => `call:user:${id}`;

function client() {
  const value = redisConnection.getClient();
  if (!value?.isReady)
    throw Object.assign(new Error("Call service unavailable"), {
      code: "CALL_UNAVAILABLE",
    });
  return value;
}

function callError(code) {
  return Object.assign(new Error(code), { code });
}

async function request(from, to, socketId, video) {
  if (from === to) throw callError("INVALID_RECIPIENT");
  const recipient = await db.Users.findByPk(to, {
    attributes: ["userId", "isActive"],
  });
  const conversation = await db.Conversation.findOne({
    where: { directPairKey: getDirectPairKey(from, to) },
  });
  if (!recipient || recipient.isActive === false || !conversation)
    throw callError("CALL_FORBIDDEN");
  const id = randomUUID();
  const session = {
    id,
    from,
    to,
    callerSocketId: socketId,
    calleeSocketId: null,
    video,
    state: "ringing",
  };
  const ok = await client().eval(
    `if redis.call('EXISTS', KEYS[1], KEYS[2]) > 0 then return 0 end
     redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
     redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
     redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[2])
     return 1`,
    {
      keys: [userKey(from), userKey(to), sessionKey(id)],
      arguments: [id, String(RING_SECONDS), JSON.stringify(session)],
    },
  );
  if (!ok) throw callError("CALL_BUSY");
  return session;
}

async function get(id) {
  const raw = await client().get(sessionKey(id));
  if (!raw) throw callError("CALL_NOT_FOUND");
  return JSON.parse(raw);
}

async function transition(id, userId, socketId, action) {
  const redis = client();
  const current = await get(id);
  if (![current.from, current.to].includes(userId))
    throw callError("CALL_FORBIDDEN");
  if (
    action === "accept" &&
    (current.to !== userId || current.state !== "ringing")
  )
    throw callError("INVALID_CALL_STATE");
  if (
    action === "reject" &&
    (current.to !== userId || current.state !== "ringing")
  )
    throw callError("INVALID_CALL_STATE");
  if (action === "end" && current.state === "ended")
    throw callError("INVALID_CALL_STATE");
  const next = { ...current, state: action === "accept" ? "active" : "ended" };
  if (action === "accept") next.calleeSocketId = socketId;
  const ttl = action === "accept" ? ACTIVE_SECONDS : RING_SECONDS;
  const ok = await redis.eval(
    `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
     if ARGV[3] == 'ended' then
       redis.call('DEL', KEYS[1])
       if redis.call('GET', KEYS[2]) == ARGV[4] then redis.call('DEL', KEYS[2]) end
       if redis.call('GET', KEYS[3]) == ARGV[4] then redis.call('DEL', KEYS[3]) end
     else
       redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[5])
       redis.call('EXPIRE', KEYS[2], ARGV[5])
       redis.call('EXPIRE', KEYS[3], ARGV[5])
     end
     return 1`,
    {
      keys: [sessionKey(id), userKey(current.from), userKey(current.to)],
      arguments: [
        JSON.stringify(current),
        JSON.stringify(next),
        next.state,
        id,
        String(ttl),
      ],
    },
  );
  if (!ok) throw callError("CALL_STATE_CHANGED");
  return next;
}

async function authorizeSignal(id, userId, socketId, to, kind = null) {
  const session = await get(id);
  if (
    session.state !== "active" ||
    ![session.from, session.to].includes(userId)
  )
    throw callError("CALL_FORBIDDEN");
  if (
    (userId === session.from
      ? session.callerSocketId
      : session.calleeSocketId) !== socketId
  )
    throw callError("CALL_FORBIDDEN");
  if (to !== (userId === session.from ? session.to : session.from))
    throw callError("CALL_FORBIDDEN");
  if (
    (kind === "offer" && userId !== session.from) ||
    (kind === "answer" && userId !== session.to)
  )
    throw callError("CALL_FORBIDDEN");
  return session;
}

async function heartbeat(id, userId, socketId) {
  const session = await get(id);
  const to = session.from === userId ? session.to : session.from;
  await authorizeSignal(id, userId, socketId, to);
  const redis = client();
  await redis
    .multi()
    .expire(sessionKey(id), ACTIVE_SECONDS)
    .expire(userKey(session.from), ACTIVE_SECONDS)
    .expire(userKey(session.to), ACTIVE_SECONDS)
    .exec();
}

async function endForSocket(socketId, userId) {
  const id = await client().get(userKey(userId));
  if (!id) return null;
  const session = await get(id).catch(() => null);
  if (
    !session ||
    ![session.callerSocketId, session.calleeSocketId].includes(socketId)
  )
    return null;
  return transition(id, userId, socketId, "end");
}

module.exports = {
  request,
  get,
  transition,
  authorizeSignal,
  heartbeat,
  endForSocket,
};
