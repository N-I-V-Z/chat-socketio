const assert = require("node:assert/strict");
const test = require("node:test");
const { DataTypes, Op, QueryTypes, Sequelize } = require("sequelize");
const migration = require("../migrations/20261119000000-constrain-user-role-enum");
const { USER_ROLES, USER_ROLE_VALUES } = require("../constants/userRole");

function createQueryInterface(existingRoles = []) {
  const calls = { constraints: [], removedConstraints: [] };
  const queryInterface = {
    calls,
    sequelize: {
      async query(sql, options) {
        calls.query = { sql, options };
        return existingRoles;
      },
    },
    async tableExists(table) {
      return table === "Users";
    },
    async describeTable() {
      return { role: { allowNull: false } };
    },
    async addConstraint(table, options) {
      calls.constraints.push({ table, options });
    },
    async removeConstraint(table, name) {
      calls.removedConstraints.push({ table, name });
    },
  };
  return queryInterface;
}

test("user role model restricts values and defaults to user", async () => {
  const sequelize = new Sequelize("database", "username", "password", {
    dialect: "mssql",
    logging: false,
  });

  try {
    const Users = require("../models/Users")(sequelize, DataTypes);
    const role = Users.rawAttributes.role;

    assert.equal(role.type.key, "ENUM");
    assert.deepEqual(role.type.values, USER_ROLE_VALUES);
    assert.equal(role.defaultValue, USER_ROLES.USER);
    assert.equal(role.allowNull, false);
  } finally {
    await sequelize.close();
  }
});

test("role migration adds a named check for the supported roles", async () => {
  const queryInterface = createQueryInterface([
    { role: USER_ROLES.USER },
    { role: USER_ROLES.ADMIN },
  ]);

  await migration.up(queryInterface);

  assert.deepEqual(queryInterface.calls.query, {
    sql: "SELECT DISTINCT [role] AS [role] FROM [dbo].[Users]",
    options: { type: QueryTypes.SELECT },
  });
  assert.equal(queryInterface.calls.constraints.length, 1);
  assert.equal(queryInterface.calls.constraints[0].table, "Users");
  assert.equal(
    queryInterface.calls.constraints[0].options.name,
    "CK_Users_Role",
  );
  assert.deepEqual(
    queryInterface.calls.constraints[0].options.where.role[Op.in],
    USER_ROLE_VALUES,
  );
});

test("role migration rejects unsupported data without adding the constraint", async () => {
  const queryInterface = createQueryInterface([
    { role: USER_ROLES.USER },
    { role: "moderator" },
  ]);

  await assert.rejects(
    migration.up(queryInterface),
    /Users\.role contains unsupported values \(moderator\)/,
  );
  assert.equal(queryInterface.calls.constraints.length, 0);
});

test("role migration rollback removes only its check constraint", async () => {
  const queryInterface = createQueryInterface();

  await migration.down(queryInterface);

  assert.deepEqual(queryInterface.calls.removedConstraints, [
    { table: "Users", name: "CK_Users_Role" },
  ]);
});
