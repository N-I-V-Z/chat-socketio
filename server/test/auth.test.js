const assert = require("node:assert/strict");
const test = require("node:test");
const authService = require("../services/authService");
const {
  hashPassword,
  verifyAndUpgradePassword,
} = require("../services/passwordService");
const authMigration = require("../migrations/20261117000002-add-refresh-token-storage");

const originalSecret = process.env.JWT_ACCESS_SECRET;
process.env.JWT_ACCESS_SECRET = "test-secret-with-at-least-thirty-two-bytes";

test.after(() => {
  if (originalSecret === undefined) {
    delete process.env.JWT_ACCESS_SECRET;
  } else {
    process.env.JWT_ACCESS_SECRET = originalSecret;
  }
});

test("new passwords are hashed and can be verified", async () => {
  const password = "correct horse battery staple";
  const hash = await hashPassword(password);
  let updatedPassword;
  const user = {
    password: hash,
    update: async (values) => {
      updatedPassword = values.password;
    },
  };

  assert.notEqual(hash, password);
  assert.equal(await verifyAndUpgradePassword(user, password), true);
  assert.equal(updatedPassword, undefined);
  assert.equal(await verifyAndUpgradePassword(user, "wrong password"), false);
});

test("a legacy plaintext password is upgraded after a successful login", async () => {
  const user = {
    password: "legacy-password",
    update: async (values) => {
      user.password = values.password;
    },
  };

  assert.equal(await verifyAndUpgradePassword(user, "legacy-password"), true);
  assert.notEqual(user.password, "legacy-password");
  assert.equal(await verifyAndUpgradePassword(user, "legacy-password"), true);
});

test("legacy passwords longer than bcrypt's input limit remain verifiable", async () => {
  const password = "長".repeat(30);
  const user = {
    password,
    update: async (values) => {
      user.password = values.password;
    },
  };

  assert.equal(await verifyAndUpgradePassword(user, password), true);
  assert.match(user.password, /^\$bcrypt-sha256\$/);
  assert.equal(await verifyAndUpgradePassword(user, password), true);
  assert.equal(await verifyAndUpgradePassword(user, `${password}x`), false);
});

test("access tokens are signed and reject modified tokens", () => {
  const token = authService.signAccessToken({ userId: 42 });
  assert.deepEqual(authService.verifyAccessToken(token).userId, 42);
  const [header, payload, signature] = token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  claims.sub = "43";
  const modifiedPayload = Buffer.from(JSON.stringify(claims)).toString(
    "base64url",
  );
  assert.throws(() =>
    authService.verifyAccessToken(`${header}.${modifiedPayload}.${signature}`),
  );
});

test("refresh token hashes do not expose the original token", () => {
  const token = "random-refresh-token";
  const hash = authService.hashRefreshToken(token);
  assert.notEqual(hash, token);
  assert.equal(authService.hashRefreshToken(token), hash);
});

test("auth migration stores refresh tokens and hashes legacy user passwords", async () => {
  const createdTables = [];
  const updatedUsers = [];
  const indexes = [];
  await authMigration.up({
    showIndex: async () => indexes,
    addIndex: async (table, fields, options) => {
      indexes.push({ name: options.name, unique: options.unique, fields });
    },
    tableExists: async () => false,
    createTable: async (table, columns) => {
      createdTables.push({ table, columns });
    },
    sequelize: {
      query: async () => [
        { userId: 1, password: "legacy-password" },
        { userId: 2, password: await hashPassword("already-hashed") },
      ],
    },
    bulkUpdate: async (table, values, where) => {
      updatedUsers.push({ table, values, where });
    },
  });

  assert.equal(createdTables[0].table, "RefreshTokens");
  assert.ok(
    indexes.some((index) => index.unique && index.fields[0] === "userName"),
  );
  assert.equal(updatedUsers.length, 1);
  assert.equal(updatedUsers[0].where.userId, 1);
  assert.notEqual(updatedUsers[0].values.password, "legacy-password");
});
