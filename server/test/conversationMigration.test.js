const assert = require("node:assert/strict");
const test = require("node:test");
const { QueryTypes } = require("sequelize");
const migration = require("../migrations/20261117000005-add-conversations");

function createQueryInterface({
  unmappedCount = 0,
  missingCount = 0,
  groupConversations = [],
  invalidMessages = [],
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
        if (sql.includes("[unmappedCount]")) {
          return [{ unmappedCount }];
        }
        if (sql.includes("[missingCount]")) {
          return [{ missingCount }];
        }
        if (sql.includes("[dbo].[Conversations] AS [c]")) {
          return groupConversations;
        }
        if (sql.includes("[m].[MessageId]") && sql.includes("NOT EXISTS")) {
          return invalidMessages;
        }
        return [];
      },
    },
    async tableExists() {
      return true;
    },
    async describeTable() {
      return { MessageId: {}, SenderId: {}, ReceiverId: {} };
    },
    async createTable(table, definition, options) {
      calls.operations.push({
        name: "createTable",
        table,
        definition,
        options,
      });
    },
    async addColumn(table, column, definition, options) {
      calls.operations.push({
        name: "addColumn",
        table,
        column,
        definition,
        options,
      });
    },
    async changeColumn(table, column, definition, options) {
      calls.operations.push({
        name: "changeColumn",
        table,
        column,
        definition,
        options,
      });
    },
    async addConstraint(table, options) {
      calls.operations.push({ name: "addConstraint", table, options });
    },
    async addIndex(table, fields, options) {
      calls.operations.push({ name: "addIndex", table, fields, options });
    },
    async removeConstraint(table, name, options) {
      calls.operations.push({
        name: "removeConstraint",
        table,
        constraintName: name,
        options,
      });
    },
    async removeColumn(table, column, options) {
      calls.operations.push({ name: "removeColumn", table, column, options });
    },
    async dropTable(table, options) {
      calls.operations.push({ name: "dropTable", table, options });
    },
  };
  return queryInterface;
}

test("conversation migration backfills direct pairs before dropping receiver IDs", async () => {
  const queryInterface = createQueryInterface();

  await migration.up(queryInterface);

  const operationNames = queryInterface.calls.operations.map(
    ({ name, column }) => (column ? `${name}:${column}` : name),
  );
  assert.ok(operationNames.indexOf("addColumn:ConversationId") >= 0);
  assert.ok(
    operationNames.indexOf("removeColumn:ReceiverId") >
      operationNames.indexOf("addConstraint"),
  );
  assert.equal(
    queryInterface.calls.operations.filter(
      ({ name, table }) => name === "createTable" && table === "Conversations",
    ).length,
    1,
  );
  assert.ok(
    queryInterface.calls.queries.some(({ sql }) =>
      sql.includes("INSERT INTO [dbo].[Conversations] ([directPairKey])"),
    ),
  );
  assert.ok(
    queryInterface.calls.queries.some(({ sql }) =>
      sql.includes("INSERT INTO [dbo].[ConversationParticipants]"),
    ),
  );
  assert.ok(
    queryInterface.calls.queries.some(
      ({ sql }) =>
        sql.includes("UPDATE [m]") && sql.includes("[ConversationId]"),
    ),
  );
  assert.ok(
    queryInterface.calls.queries.some(({ sql }) =>
      sql.includes("WHERE [directPairKey] IS NOT NULL"),
    ),
  );
  const receiverConstraintDrop = queryInterface.calls.queries.find(({ sql }) =>
    sql.includes("[sys].[foreign_keys]"),
  ).sql;
  assert.match(receiverConstraintDrop, /QUOTENAME\(@foreignKeyName\)/);
  assert.match(
    receiverConstraintDrop,
    /EXEC sys\.sp_executesql @dropForeignKeySql/,
  );
  assert.doesNotMatch(receiverConstraintDrop, /EXEC\(N'ALTER TABLE/);
  assert.equal(
    queryInterface.calls.queries.find(({ sql }) =>
      sql.includes("[unmappedCount]"),
    ).options.type,
    QueryTypes.SELECT,
  );
});

test("conversation migration rolls back if any message cannot be mapped", async () => {
  const queryInterface = createQueryInterface({ unmappedCount: 2 });

  await assert.rejects(
    migration.up(queryInterface),
    /2 message\(s\) could not be assigned to a conversation/,
  );
  assert.ok(
    !queryInterface.calls.operations.some(
      ({ name, column }) => name === "removeColumn" && column === "ReceiverId",
    ),
  );
});

test("conversation rollback refuses group conversations", async () => {
  const queryInterface = createQueryInterface({
    groupConversations: [{ conversationId: 44 }],
  });

  await assert.rejects(
    migration.down(queryInterface),
    /more than two participants/,
  );
  assert.equal(
    queryInterface.calls.operations.some(({ name }) => name === "addColumn"),
    false,
  );
});

test("conversation rollback restores receivers before dropping conversation tables", async () => {
  const queryInterface = createQueryInterface();

  await migration.down(queryInterface);

  const operations = queryInterface.calls.operations;
  const receiverColumn = operations.findIndex(
    ({ name, column }) => name === "addColumn" && column === "ReceiverId",
  );
  const receiverConstraint = operations.findIndex(
    ({ name, options }) =>
      name === "addConstraint" && options.name === "FK_Message_ReceiverId",
  );
  const conversationConstraint = operations.findIndex(
    ({ name, constraintName }) =>
      name === "removeConstraint" &&
      constraintName === "FK_Message_Conversation",
  );
  const dropParticipants = operations.findIndex(
    ({ name, table }) =>
      name === "dropTable" && table === "ConversationParticipants",
  );

  assert.ok(receiverColumn >= 0);
  assert.ok(receiverConstraint > receiverColumn);
  assert.ok(conversationConstraint > receiverConstraint);
  assert.ok(dropParticipants > conversationConstraint);
  assert.ok(
    queryInterface.calls.queries.some(({ sql }) =>
      sql.includes("SET [ReceiverId] = CASE"),
    ),
  );
});
