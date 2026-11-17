const assert = require("node:assert/strict");
const test = require("node:test");
const { QueryTypes } = require("sequelize");
const db = require("../models");
const readReceiptService = require("../services/readReceiptService");

function replace(target, key, value) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("unread summary is scoped to the requesting user and normalizes SQL counts", async () => {
  const originalQuery = db.sequelize.query;
  db.sequelize.query = async (sql, options) => {
    assert.match(sql, /MessageReadReceipts/);
    assert.equal(options.replacements.userId, 7);
    assert.equal(options.type, QueryTypes.SELECT);
    return [{ conversationId: "55", peerUserId: "9", unreadCount: "4" }];
  };

  try {
    assert.deepEqual(await readReceiptService.getUnreadSummary(7), [
      { conversationId: 55, peerUserId: 9, unreadCount: 4 },
    ]);
  } finally {
    db.sequelize.query = originalQuery;
  }
});

test("marking a conversation read validates membership and cursor and inserts idempotently", async () => {
  let transactionCount = 0;
  let inserted = false;
  const restores = [
    replace(db.sequelize, "transaction", async (callback) => {
      transactionCount += 1;
      return callback({ id: "transaction" });
    }),
    replace(db.ConversationParticipant, "findOne", async (options) => {
      assert.deepEqual(options.where, { conversationId: 55, userId: 7 });
      assert.equal(options.transaction.id, "transaction");
      return { conversationId: 55 };
    }),
    replace(db.Message, "findOne", async (options) => {
      assert.deepEqual(options.where, { MessageId: 18, ConversationId: 55 });
      assert.equal(options.transaction.id, "transaction");
      return { MessageId: 18 };
    }),
    replace(db.ConversationParticipant, "findAll", async (options) => {
      assert.equal(options.transaction.id, "transaction");
      return [{ userId: 7 }, { userId: 9 }];
    }),
    replace(db.sequelize, "query", async (sql, options) => {
      assert.equal(options.transaction.id, "transaction");
      if (sql.includes("INSERT INTO [dbo].[MessageReadReceipts]")) {
        assert.match(sql, /NOT EXISTS/);
        assert.match(sql, /WITH \(UPDLOCK, HOLDLOCK\)/);
        assert.deepEqual(options.replacements, {
          userId: 7,
          conversationId: 55,
          upToMessageId: 18,
        });
        inserted = true;
        return [];
      }
      assert.equal(sql, "SELECT GETDATE() AS [readAt];");
      assert.equal(inserted, true);
      return [{ readAt: new Date("2026-01-02T03:04:05Z") }];
    }),
  ];

  try {
    const result = await readReceiptService.markConversationRead(7, 55, 18);

    assert.equal(transactionCount, 1);
    assert.deepEqual(result, {
      conversationId: 55,
      upToMessageId: 18,
      readerId: 7,
      participantUserIds: [7, 9],
      readAt: new Date("2026-01-02T03:04:05Z"),
    });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("mark-read rejects nonparticipants and cursors from another conversation", async () => {
  const restores = [
    replace(db.sequelize, "transaction", async (callback) =>
      callback({ id: "transaction" }),
    ),
  ];
  try {
    restores.push(
      replace(db.ConversationParticipant, "findOne", async () => null),
    );
    await assert.rejects(
      readReceiptService.markConversationRead(7, 55, 18),
      (error) =>
        error.statusCode === 404 && error.code === "CONVERSATION_NOT_FOUND",
    );
  } finally {
    restores.reverse().forEach((restore) => restore());
  }

  const cursorRestores = [
    replace(db.sequelize, "transaction", async (callback) =>
      callback({ id: "transaction" }),
    ),
    replace(db.ConversationParticipant, "findOne", async () => ({
      conversationId: 55,
    })),
    replace(db.Message, "findOne", async () => null),
  ];
  try {
    await assert.rejects(
      readReceiptService.markConversationRead(7, 55, 18),
      (error) =>
        error.statusCode === 400 && error.code === "INVALID_MESSAGE_CURSOR",
    );
  } finally {
    cursorRestores.reverse().forEach((restore) => restore());
  }
});
