const assert = require("node:assert/strict");
const test = require("node:test");
const db = require("../models");
const authService = require("../services/authService");
const cacheService = require("../services/cacheService");
const cacheKeys = require("../services/cacheKeys");
const conversationService = require("../services/conversationService");
const messageService = require("../services/messageService");
const userService = require("../services/userService");

test("conversation cache keys are stable regardless of participant order", () => {
  assert.equal(cacheKeys.conversationKey(7, 3), "messages:room:v1:3:7");
  assert.equal(
    cacheKeys.conversationKey(3, 7),
    cacheKeys.conversationKey(7, 3),
  );
  assert.throws(() => cacheKeys.conversationKey(0, 7), /valid user IDs/);
});

test("conversation page keys separate the latest page from cursor pages", () => {
  assert.equal(
    cacheKeys.conversationPageKey(12),
    "messages:conversation:v1:12:latest",
  );
  assert.equal(
    cacheKeys.conversationPageKey(12, 45),
    "messages:conversation:v1:12:before:45",
  );
  assert.throws(
    () => cacheKeys.conversationPageKey(12, 0),
    /valid message cursor/,
  );
});

test("user list cache stores shared user data and filters the current user", async () => {
  const originalGetOrLoad = cacheService.getOrLoad;
  const originalFindAll = db.Users.findAll;
  let cacheRequest;
  db.Users.findAll = async (options) => {
    assert.deepEqual(options.attributes, ["userId", "userName"]);
    return [
      { userId: 3, userName: "member" },
      { userId: 7, userName: "nivz" },
    ];
  };
  cacheService.getOrLoad = async (key, ttl, loader) => {
    cacheRequest = { key, ttl };
    return loader();
  };

  try {
    const users = await userService.getAll("7");
    assert.deepEqual(cacheRequest, { key: "users:list:v1", ttl: 60 });
    assert.deepEqual(users, [{ userId: 3, userName: "member" }]);
  } finally {
    db.Users.findAll = originalFindAll;
    cacheService.getOrLoad = originalGetOrLoad;
  }
});

test("message history uses a symmetric 30-second room cache key", async () => {
  const originalGetOrLoad = cacheService.getOrLoad;
  const originalFindAll = db.Message.findAll;
  const originalGetOrCreateDirectConversation =
    conversationService.getOrCreateDirectConversation;
  const requests = [];
  db.Message.findAll = async (options) => {
    assert.deepEqual(options.where, { ConversationId: 33 });
    return [];
  };
  conversationService.getOrCreateDirectConversation = async () => ({
    conversationId: 33,
  });
  cacheService.getOrLoad = async (key, ttl, loader) => {
    requests.push({ key, ttl });
    return loader();
  };

  try {
    await messageService.getAllMessageOfRoom(7, 3);
    await messageService.getAllMessageOfRoom(3, 7);
    assert.deepEqual(requests, [
      { key: "messages:room:v1:3:7", ttl: 30 },
      { key: "messages:room:v1:3:7", ttl: 30 },
    ]);
  } finally {
    db.Message.findAll = originalFindAll;
    cacheService.getOrLoad = originalGetOrLoad;
    conversationService.getOrCreateDirectConversation =
      originalGetOrCreateDirectConversation;
  }
});

test("message history cache invalidates only after the write transaction commits", async () => {
  const originalTransaction = db.sequelize.transaction;
  const originalMessageCreate = db.Message.create;
  const originalReadReceiptCreate = db.MessageReadReceipt.create;
  const originalOutboxEventCreate = db.OutboxEvent.create;
  const originalAuditCreate = db.AuditLog.create;
  const originalInvalidate = cacheService.invalidate;
  const originalGetOrCreateDirectConversation =
    conversationService.getOrCreateDirectConversation;
  let transactionCommitted = false;
  const invalidatedKeys = [];
  db.sequelize.transaction = async (callback) => {
    const result = await callback({ id: "transaction" });
    transactionCommitted = true;
    return result;
  };
  db.Message.create = async (values, options) => {
    assert.equal(options.transaction.id, "transaction");
    assert.equal(values.ConversationId, 33);
    assert.equal(values.ReceiverId, undefined);
    return { MessageId: 11, ...values };
  };
  db.MessageReadReceipt.create = async (values, options) => {
    assert.equal(options.transaction.id, "transaction");
    assert.deepEqual(values, { MessageId: 11, UserId: 7 });
    return values;
  };
  db.OutboxEvent.create = async (values, options) => {
    assert.equal(options.transaction.id, "transaction");
    assert.deepEqual(JSON.parse(values.payload).recipientUserIds, [3]);
    return values;
  };
  db.AuditLog.create = async (values, options) => {
    assert.equal(options.transaction.id, "transaction");
    return values;
  };
  conversationService.getOrCreateDirectConversation = async (
    senderId,
    receiverId,
    options,
  ) => {
    assert.equal(senderId, 7);
    assert.equal(receiverId, 3);
    assert.equal(options.transaction.id, "transaction");
    return { conversationId: 33 };
  };
  cacheService.invalidate = async (key) => {
    assert.equal(transactionCommitted, true);
    invalidatedKeys.push(key);
    return true;
  };

  try {
    const saved = await messageService.addMessage(7, 3, "hello");
    assert.equal(saved.MessageText, "hello");
    assert.deepEqual(invalidatedKeys.sort(), [
      "messages:conversation:v1:33:latest",
      "messages:room:v1:3:7",
    ]);
  } finally {
    db.sequelize.transaction = originalTransaction;
    db.Message.create = originalMessageCreate;
    db.MessageReadReceipt.create = originalReadReceiptCreate;
    db.OutboxEvent.create = originalOutboxEventCreate;
    db.AuditLog.create = originalAuditCreate;
    cacheService.invalidate = originalInvalidate;
    conversationService.getOrCreateDirectConversation =
      originalGetOrCreateDirectConversation;
  }
});

test("register invalidates the user directory after its transaction commits", async () => {
  const originalTransaction = db.sequelize.transaction;
  const originalUserCreate = db.Users.create;
  const originalAuditCreate = db.AuditLog.create;
  const originalInvalidate = cacheService.invalidate;
  let transactionCommitted = false;
  let invalidatedKey;
  db.sequelize.transaction = async (callback) => {
    const result = await callback({ id: "transaction" });
    transactionCommitted = true;
    return result;
  };
  db.Users.create = async (values, options) => {
    assert.equal(options.transaction.id, "transaction");
    return {
      userId: 22,
      userName: values.userName,
      role: "user",
    };
  };
  db.AuditLog.create = async (values, options) => {
    assert.equal(options.transaction.id, "transaction");
    return values;
  };
  cacheService.invalidate = async (key) => {
    assert.equal(transactionCommitted, true);
    invalidatedKey = key;
    return true;
  };

  try {
    const user = await authService.register("new-user", "strong-password");
    assert.equal(user.userName, "new-user");
    assert.equal(user.role, "user");
    assert.equal(invalidatedKey, "users:list:v1");
  } finally {
    db.sequelize.transaction = originalTransaction;
    db.Users.create = originalUserCreate;
    db.AuditLog.create = originalAuditCreate;
    cacheService.invalidate = originalInvalidate;
  }
});
