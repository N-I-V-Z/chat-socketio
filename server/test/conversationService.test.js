const assert = require("node:assert/strict");
const test = require("node:test");
const db = require("../models");
const conversationService = require("../services/conversationService");

function replace(target, key, value) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("direct conversation keys are canonical and support self conversations", () => {
  assert.equal(conversationService.getDirectPairKey(9, 3), "3:9");
  assert.equal(conversationService.getDirectPairKey(3, 9), "3:9");
  assert.equal(conversationService.getDirectPairKey(7, 7), "7:7");
  assert.throws(
    () => conversationService.getDirectPairKey(0, 9),
    /valid user ID/,
  );
});

test("get-or-create stores one direct conversation and unique participants", async () => {
  const restores = [
    replace(db.sequelize, "transaction", async (callback) =>
      callback({ id: "transaction" }),
    ),
  ];
  const calls = { participants: [], conversation: null };
  restores.push(
    replace(db.Conversation, "findOne", async ({ where, transaction }) => {
      assert.deepEqual(where, { directPairKey: "3:9" });
      assert.equal(transaction.id, "transaction");
      return null;
    }),
    replace(db.Users, "findAll", async ({ where, transaction }) => {
      assert.deepEqual(where.userId, [9, 3]);
      assert.equal(transaction.id, "transaction");
      return [{ userId: 3 }, { userId: 9 }];
    }),
    replace(db.Conversation, "findOrCreate", async (options) => {
      calls.conversation = options;
      return [{ conversationId: 44 }, true];
    }),
    replace(db.ConversationParticipant, "findOrCreate", async (options) => {
      calls.participants.push(options);
      return [{ ...options.defaults }, true];
    }),
  );

  try {
    const conversation =
      await conversationService.getOrCreateDirectConversation(9, 3);

    assert.equal(conversation.conversationId, 44);
    assert.deepEqual(calls.conversation.where, { directPairKey: "3:9" });
    assert.deepEqual(
      calls.participants.map(({ where }) => where.userId),
      [9, 3],
    );
    assert.ok(
      calls.participants.every(
        ({ where }) => where.conversationId === conversation.conversationId,
      ),
    );
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("get-or-create rejects missing users instead of creating orphan conversations", async () => {
  const restores = [
    replace(db.sequelize, "transaction", async (callback) =>
      callback({ id: "transaction" }),
    ),
    replace(db.Conversation, "findOne", async () => null),
    replace(db.Users, "findAll", async () => [{ userId: 9 }]),
  ];
  const originalFindOrCreate = db.Conversation.findOrCreate;
  db.Conversation.findOrCreate = async () => {
    assert.fail("conversation must not be created for a missing participant");
  };
  restores.push(() => {
    db.Conversation.findOrCreate = originalFindOrCreate;
  });

  try {
    await assert.rejects(
      conversationService.getOrCreateDirectConversation(9, 3),
      (error) => error.statusCode === 404 && error.code === "USER_NOT_FOUND",
    );
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("self conversations add only one participant", async () => {
  const restores = [
    replace(db.sequelize, "transaction", async (callback) =>
      callback({ id: "transaction" }),
    ),
    replace(db.Conversation, "findOne", async () => null),
    replace(db.Users, "findAll", async ({ where }) => {
      assert.deepEqual(where.userId, [7]);
      return [{ userId: 7 }];
    }),
    replace(db.Conversation, "findOrCreate", async () => [
      { conversationId: 70 },
      true,
    ]),
  ];
  const participantUsers = [];
  restores.push(
    replace(db.ConversationParticipant, "findOrCreate", async ({ where }) => {
      participantUsers.push(where.userId);
      return [{ ...where }, true];
    }),
  );

  try {
    await conversationService.getOrCreateDirectConversation(7, 7);
    assert.deepEqual(participantUsers, [7]);
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});
