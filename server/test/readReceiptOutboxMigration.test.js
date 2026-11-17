const assert = require("node:assert/strict");
const test = require("node:test");
const migration = require("../migrations/20261117000006-add-message-read-receipts-outbox");

function createQueryInterface({
  existingTables = [],
  missingTable = null,
} = {}) {
  const calls = { operations: [], queries: [] };
  const queryInterface = {
    calls,
    sequelize: {
      async transaction(callback) {
        return callback({ id: "transaction" });
      },
      async query(sql, options = {}) {
        calls.queries.push({ sql, options });
        return [];
      },
    },
    async tableExists(tableName) {
      if (tableName === missingTable) return false;
      if (existingTables.includes(tableName)) return true;
      if (["MessageReadReceipts", "OutboxEvents"].includes(tableName)) {
        return false;
      }
      return tableName !== missingTable;
    },
    async createTable(tableName, columns, options) {
      calls.operations.push({
        name: "createTable",
        tableName,
        columns,
        options,
      });
    },
    async addIndex(tableName, fields, options) {
      calls.operations.push({ name: "addIndex", tableName, fields, options });
    },
    async dropTable(tableName, options) {
      calls.operations.push({ name: "dropTable", tableName, options });
    },
  };
  return queryInterface;
}

test("read receipt migration creates indexed receipts and outbox and backfills history", async () => {
  const queryInterface = createQueryInterface();

  await migration.up(queryInterface);

  const createdTables = queryInterface.calls.operations
    .filter(({ name }) => name === "createTable")
    .map(({ tableName }) => tableName);
  assert.deepEqual(createdTables, ["MessageReadReceipts", "OutboxEvents"]);

  const receipts = queryInterface.calls.operations.find(
    ({ name, tableName }) =>
      name === "createTable" && tableName === "MessageReadReceipts",
  );
  assert.equal(receipts.columns.MessageId.primaryKey, true);
  assert.equal(receipts.columns.UserId.primaryKey, true);
  assert.equal(receipts.columns.readAt.allowNull, false);

  const backfill = queryInterface.calls.queries.find(({ sql }) =>
    sql.includes("INSERT INTO [dbo].[MessageReadReceipts]"),
  );
  assert.ok(backfill);
  assert.match(
    backfill.sql,
    /INNER JOIN \[dbo\]\.\[ConversationParticipants\]/,
  );
  assert.match(backfill.sql, /GETDATE\(\)/);
  assert.doesNotMatch(backfill.sql, /Timestamp/);
  assert.equal(backfill.options.transaction.id, "transaction");

  assert.deepEqual(
    queryInterface.calls.operations
      .filter(({ name }) => name === "addIndex")
      .map(({ tableName, options }) => [tableName, options.name]),
    [
      ["MessageReadReceipts", "IX_MessageReadReceipts_UserId_MessageId"],
      [
        "OutboxEvents",
        "IX_OutboxEvents_PublishedAt_NextAttemptAt_ClaimedUntil_CreatedAt",
      ],
    ],
  );
});

test("read receipt migration refuses missing conversation dependencies", async () => {
  const queryInterface = createQueryInterface({
    missingTable: "ConversationParticipants",
  });

  await assert.rejects(
    migration.up(queryInterface),
    /ConversationParticipants must exist/,
  );
  assert.equal(queryInterface.calls.operations.length, 0);
});

test("read receipt migration rollback drops outbox before receipts", async () => {
  const queryInterface = createQueryInterface({
    existingTables: ["OutboxEvents", "MessageReadReceipts"],
  });

  await migration.down(queryInterface);

  assert.deepEqual(
    queryInterface.calls.operations.map(({ name, tableName }) => [
      name,
      tableName,
    ]),
    [
      ["dropTable", "OutboxEvents"],
      ["dropTable", "MessageReadReceipts"],
    ],
  );
});
