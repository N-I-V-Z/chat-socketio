const assert = require("node:assert/strict");
const test = require("node:test");
const { Op } = require("sequelize");
const db = require("../models");
const auditLogService = require("../services/auditLogService");
const cacheService = require("../services/cacheService");
const messageService = require("../services/messageService");

function replace(target, key, value) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

function createRows(ids) {
  return ids.map((MessageId) => ({
    MessageId,
    ConversationId: 8,
    SenderId: MessageId % 2 ? 3 : 7,
    MessageText: `message-${MessageId}`,
    Timestamp: null,
  }));
}

test("latest message page queries 31 rows and returns 30 in chronological order", async () => {
  const restores = [
    replace(db.ConversationParticipant, "findOne", async (options) => {
      assert.deepEqual(options.where, { conversationId: 8, userId: 7 });
      return { conversationId: 8 };
    }),
  ];
  const rows = createRows(Array.from({ length: 31 }, (_, index) => 50 - index));
  let queryOptions;
  let cacheRequest;
  restores.push(
    replace(db.Message, "findAll", async (options) => {
      queryOptions = options;
      return rows;
    }),
    replace(cacheService, "getOrLoad", async (key, ttl, loader) => {
      cacheRequest = { key, ttl };
      return loader();
    }),
  );

  try {
    const page = await messageService.getMessagePage(7, 8);

    assert.deepEqual(cacheRequest, {
      key: "messages:conversation:v1:8:latest",
      ttl: 30,
    });
    assert.deepEqual(queryOptions.where, { ConversationId: 8 });
    assert.deepEqual(queryOptions.order, [["MessageId", "DESC"]]);
    assert.equal(queryOptions.limit, 31);
    assert.equal(page.items.length, 30);
    assert.equal(page.items[0].MessageId, 21);
    assert.equal(page.items[29].MessageId, 50);
    assert.equal(page.hasMore, true);
    assert.equal(page.nextCursor, 21);
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("older message pages use an exclusive cursor and report no further pages", async () => {
  const restores = [
    replace(db.ConversationParticipant, "findOne", async () => ({
      conversationId: 8,
    })),
  ];
  const rows = createRows([10, 9]);
  let queryOptions;
  let cacheKey;
  restores.push(
    replace(db.Message, "findAll", async (options) => {
      queryOptions = options;
      return rows;
    }),
    replace(cacheService, "getOrLoad", async (key, _ttl, loader) => {
      cacheKey = key;
      return loader();
    }),
  );

  try {
    const page = await messageService.getMessagePage(7, 8, 11);

    assert.equal(cacheKey, "messages:conversation:v1:8:before:11");
    assert.equal(queryOptions.where.MessageId[Op.lt], 11);
    assert.equal(queryOptions.limit, 31);
    assert.deepEqual(
      page.items.map(({ MessageId }) => MessageId),
      [9, 10],
    );
    assert.equal(page.hasMore, false);
    assert.equal(page.nextCursor, null);
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("message pages do not read cache or data for nonparticipants", async () => {
  const restores = [
    replace(db.ConversationParticipant, "findOne", async () => null),
    replace(cacheService, "getOrLoad", async () => {
      assert.fail("nonparticipants must not reach the cache");
    }),
  ];

  try {
    await assert.rejects(
      messageService.getMessagePage(7, 8),
      (error) =>
        error.statusCode === 404 && error.code === "CONVERSATION_NOT_FOUND",
    );
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("direct conversation writes commit before invalidating latest and legacy pages", async () => {
  const restores = [
    replace(db.sequelize, "transaction", async (callback) =>
      callback({ id: "transaction" }),
    ),
  ];
  const invalidatedKeys = [];
  let transactionCommitted = false;
  restores.push(
    replace(db.ConversationParticipant, "findAll", async (options) => {
      assert.equal(options.where.conversationId, 8);
      assert.equal(options.transaction.id, "transaction");
      return [{ userId: 3 }, { userId: 7 }];
    }),
    replace(db.Message, "create", async (values, options) => {
      assert.equal(options.transaction.id, "transaction");
      assert.deepEqual(values, {
        ConversationId: 8,
        SenderId: 7,
        MessageText: "hello",
      });
      return { MessageId: 51, ...values };
    }),
    replace(db.MessageReadReceipt, "create", async (values, options) => {
      assert.deepEqual(values, { MessageId: 51, UserId: 7 });
      assert.equal(options.transaction.id, "transaction");
    }),
    replace(db.OutboxEvent, "create", async (values, options) => {
      assert.equal(options.transaction.id, "transaction");
      assert.match(
        values.eventId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      assert.equal(values.eventType, "chat.message.created");
      assert.deepEqual(JSON.parse(values.payload), {
        eventId: values.eventId,
        conversationId: 8,
        messageId: 51,
        senderId: 7,
        recipientUserIds: [3],
      });
    }),
    replace(auditLogService, "recordEvent", async (event, options) => {
      assert.equal(options.transaction.id, "transaction");
      assert.equal(event.targetUserId, 3);
    }),
    replace(cacheService, "invalidate", async (key) => {
      assert.equal(transactionCommitted, true);
      invalidatedKeys.push(key);
      return true;
    }),
  );

  const originalTransaction = db.sequelize.transaction;
  db.sequelize.transaction = async (callback) => {
    const value = await callback({ id: "transaction" });
    transactionCommitted = true;
    return value;
  };

  try {
    const message = await messageService.addMessageToConversation(
      7,
      8,
      "hello",
    );

    assert.equal(message.MessageId, 51);
    assert.deepEqual(invalidatedKeys.sort(), [
      "messages:conversation:v1:8:latest",
      "messages:room:v1:3:7",
    ]);
  } finally {
    db.sequelize.transaction = originalTransaction;
    restores.reverse().forEach((restore) => restore());
  }
});

test("message creation fails atomically when its outbox event cannot be saved", async () => {
  const restores = [
    replace(db.sequelize, "transaction", async (callback) => {
      try {
        const result = await callback({ id: "transaction" });
        transactionCommitted = true;
        return result;
      } catch (error) {
        transactionRolledBack = true;
        throw error;
      }
    }),
    replace(db.ConversationParticipant, "findAll", async () => [
      { userId: 3 },
      { userId: 7 },
    ]),
    replace(db.Message, "create", async () => ({ MessageId: 52 })),
    replace(db.MessageReadReceipt, "create", async () => undefined),
    replace(db.OutboxEvent, "create", async () => {
      throw new Error("outbox insert failed");
    }),
    replace(cacheService, "invalidate", async () => {
      assert.fail("cache invalidation must wait for the transaction");
    }),
  ];
  let transactionCommitted = false;
  let transactionRolledBack = false;

  try {
    await assert.rejects(
      messageService.addMessageToConversation(7, 8, "hello"),
      /outbox insert failed/,
    );
    assert.equal(transactionCommitted, false);
    assert.equal(transactionRolledBack, true);
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("conversation writes reject participants outside the direct-chat scope", async () => {
  const restores = [
    replace(db.sequelize, "transaction", async (callback) =>
      callback({ id: "transaction" }),
    ),
    replace(db.ConversationParticipant, "findAll", async () => [
      { userId: 3 },
      { userId: 7 },
      { userId: 9 },
    ]),
  ];
  const originalMessageCreate = db.Message.create;
  db.Message.create = async () => {
    assert.fail("group messages are not enabled");
  };
  restores.push(() => {
    db.Message.create = originalMessageCreate;
  });

  try {
    await assert.rejects(
      messageService.addMessageToConversation(7, 8, "hello"),
      (error) =>
        error.statusCode === 409 && error.code === "GROUP_MESSAGES_UNSUPPORTED",
    );
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});
