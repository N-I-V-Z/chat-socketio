const assert = require("node:assert/strict");
const test = require("node:test");
const migration = require("../migrations/20261117000003-add-admin-audit-logs");

function createQueryInterface() {
  const tables = new Set(["Users"]);
  const columns = { Users: { userId: {}, userName: {}, password: {} } };
  const indexes = {};
  const createdTables = [];
  const addedColumns = [];
  const updatedRows = [];
  const addedIndexes = [];
  const removedColumns = [];

  return {
    tables,
    columns,
    indexes,
    createdTables,
    addedColumns,
    updatedRows,
    addedIndexes,
    removedColumns,
    async tableExists(table) {
      return tables.has(table);
    },
    async describeTable(table) {
      return columns[table] || {};
    },
    async addColumn(table, column, definition) {
      columns[table][column] = definition;
      addedColumns.push({ table, column, definition });
    },
    async bulkUpdate(table, values, where) {
      updatedRows.push({ table, values, where });
    },
    async createTable(table, definition) {
      tables.add(table);
      columns[table] = definition;
      createdTables.push({ table, definition });
    },
    async showIndex(table) {
      return indexes[table] || [];
    },
    async addIndex(table, fields, options) {
      (indexes[table] ||= []).push({ name: options.name, fields });
      addedIndexes.push({ table, fields, options });
    },
    async dropTable(table) {
      tables.delete(table);
      delete columns[table];
    },
    async removeColumn(table, column) {
      delete columns[table][column];
      removedColumns.push({ table, column });
    },
  };
}

test("admin audit migration adds a default role, promotes nivz, and creates indexed logs", async () => {
  const queryInterface = createQueryInterface();

  await migration.up(queryInterface);

  assert.equal(queryInterface.addedColumns[0].column, "role");
  assert.equal(queryInterface.addedColumns[0].definition.defaultValue, "user");
  assert.deepEqual(queryInterface.updatedRows, [
    { table: "Users", values: { role: "admin" }, where: { userName: "nivz" } },
  ]);
  assert.equal(queryInterface.createdTables[0].table, "AuditLogs");
  const fields = queryInterface.createdTables[0].definition;
  assert.ok(fields.actorUserId);
  assert.ok(fields.targetUserId);
  assert.ok(fields.eventType);
  assert.ok(fields.occurredAt);
  assert.equal(fields.MessageText, undefined);
  assert.deepEqual(
    queryInterface.addedIndexes.map(({ options }) => options.name).sort(),
    ["IX_AuditLogs_eventType", "IX_AuditLogs_occurredAt"],
  );
});

test("admin audit migration rollback drops audit data and the added role column", async () => {
  const queryInterface = createQueryInterface();
  await migration.up(queryInterface);

  await migration.down(queryInterface);

  assert.equal(queryInterface.tables.has("AuditLogs"), false);
  assert.equal(queryInterface.columns.Users.role, undefined);
  assert.deepEqual(queryInterface.removedColumns, [
    { table: "Users", column: "role" },
  ]);
});
