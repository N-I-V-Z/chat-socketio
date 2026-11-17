const assert = require("node:assert/strict");
const test = require("node:test");
const db = require("../models");
const requireAdmin = require("../middleware/requireAdmin");

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("admin middleware accepts the current database admin role", async () => {
  const originalFindByPk = db.Users.findByPk;
  db.Users.findByPk = async () => ({
    userId: 7,
    userName: "nivz",
    role: "admin",
  });
  const req = { auth: { userId: 7 } };
  let nextCalled = false;

  try {
    await requireAdmin(req, createResponse(), () => {
      nextCalled = true;
    });
  } finally {
    db.Users.findByPk = originalFindByPk;
  }

  assert.equal(nextCalled, true);
  assert.equal(req.auth.role, "admin");
  assert.equal(req.auth.userName, "nivz");
});

test("admin middleware denies regular users", async () => {
  const originalFindByPk = db.Users.findByPk;
  db.Users.findByPk = async () => ({
    userId: 8,
    userName: "member",
    role: "user",
  });
  const res = createResponse();

  try {
    await requireAdmin({ auth: { userId: 8 } }, res, () => {
      assert.fail("next must not be called for a regular user");
    });
  } finally {
    db.Users.findByPk = originalFindByPk;
  }

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, "FORBIDDEN");
});

test("admin middleware rejects tokens whose user no longer exists", async () => {
  const originalFindByPk = db.Users.findByPk;
  db.Users.findByPk = async () => null;
  const res = createResponse();

  try {
    await requireAdmin({ auth: { userId: 99 } }, res, () => {
      assert.fail("next must not be called for a missing user");
    });
  } finally {
    db.Users.findByPk = originalFindByPk;
  }

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, "UNAUTHORIZED");
});
