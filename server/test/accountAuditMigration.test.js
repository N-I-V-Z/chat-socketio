const assert = require("node:assert/strict");
const test = require("node:test");
const migration = require("../migrations/20261118000001-add-account-status-audit-fields");

test("account and audit migration adds shared fields without replacing existing keys or timestamps", async () => {
  const tables = new Map([
    ["Users", { userId: {} }],
    ["Message", { MessageId: {} }],
    ["Conversations", { conversationId: {}, createdAt: {} }],
    ["ConversationParticipants", { conversationId: {}, userId: {} }],
    ["RefreshTokens", { tokenId: {}, createdAt: {} }],
    ["AuditLogs", { eventId: {} }],
    ["MessageReadReceipts", { MessageId: {}, UserId: {} }],
    ["OutboxEvents", { eventId: {}, createdAt: {} }],
  ]);
  const queryInterface = {
    async describeTable({ tableName }) {
      return tables.get(tableName);
    },
    async addColumn({ tableName }, name, definition) {
      tables.get(tableName)[name] = definition;
    },
    async removeColumn({ tableName }, name) {
      delete tables.get(tableName)[name];
    },
  };
  await migration.up(queryInterface);
  for (const columns of tables.values()) {
    for (const name of [
      "createdAt",
      "updatedAt",
      "createdBy",
      "updatedBy",
      "isDeleted",
    ])
      assert.ok(columns[name]);
  }
  assert.equal(tables.get("Users").isActive.defaultValue, true);
  await migration.down(queryInterface);
  assert.ok(tables.get("Conversations").createdAt);
  assert.ok(tables.get("RefreshTokens").createdAt);
  assert.ok(tables.get("OutboxEvents").createdAt);
  assert.ok(tables.get("Users").userId);
  assert.equal(tables.get("Users").isActive, undefined);
});
