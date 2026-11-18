const assert = require("node:assert/strict");
const test = require("node:test");
const db = require("../models");
const redisConnection = require("../services/redisConnection");
const calls = require("../services/callSessionService");

test("call session binds signaling to the accepted sockets", async () => {
  const original = {
    user: db.Users.findByPk,
    conversation: db.Conversation.findOne,
    redis: redisConnection.getClient,
  };
  const values = new Map();
  db.Users.findByPk = async () => ({ userId: 2, isActive: true });
  db.Conversation.findOne = async () => ({ conversationId: 9 });
  redisConnection.getClient = () => ({
    isReady: true,
    async get(key) {
      return values.get(key) ?? null;
    },
    async eval(_script, { keys, arguments: args }) {
      if (args.length === 3) {
        if (values.has(keys[0]) || values.has(keys[1])) return 0;
        values.set(keys[0], args[0]);
        values.set(keys[1], args[0]);
        values.set(keys[2], args[2]);
        return 1;
      }
      if (values.get(keys[0]) !== args[0]) return 0;
      if (args[2] === "ended") for (const key of keys) values.delete(key);
      else values.set(keys[0], args[1]);
      return 1;
    },
  });
  try {
    const session = await calls.request(1, 2, "caller-socket", true);
    await assert.rejects(
      calls.transition(session.id, 1, "caller-socket", "accept"),
      { code: "INVALID_CALL_STATE" },
    );
    await calls.transition(session.id, 2, "callee-socket", "accept");
    await assert.rejects(
      calls.authorizeSignal(session.id, 1, "wrong-socket", 2),
      { code: "CALL_FORBIDDEN" },
    );
    await assert.rejects(
      calls.authorizeSignal(session.id, 1, "caller-socket", 3),
      { code: "CALL_FORBIDDEN" },
    );
    await assert.rejects(
      calls.authorizeSignal(session.id, 1, "caller-socket", 2, "answer"),
      { code: "CALL_FORBIDDEN" },
    );
    await calls.authorizeSignal(session.id, 1, "caller-socket", 2);
    await calls.transition(session.id, 1, "caller-socket", "end");
    await assert.rejects(calls.get(session.id), { code: "CALL_NOT_FOUND" });
  } finally {
    db.Users.findByPk = original.user;
    db.Conversation.findOne = original.conversation;
    redisConnection.getClient = original.redis;
  }
});
