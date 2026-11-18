const assert = require("node:assert/strict");
const test = require("node:test");
const db = require("../models");
const adminService = require("../services/adminService");
const presenceService = require("../services/presenceService");

test("admin user listing exposes safe fields and current socket presence", async () => {
  const originalFindAll = db.Users.findAll;
  const originalGetOnline = presenceService.getOnlineUserIds;
  let queryOptions;
  db.Users.findAll = async (options) => {
    queryOptions = options;
    return [
      { userId: 1, userName: "admin", role: "admin", password: "hash" },
      { userId: 2, userName: "member", role: "user", password: "hash" },
    ];
  };
  presenceService.getOnlineUserIds = async () => new Set([2]);

  try {
    const users = await adminService.getUsers();
    assert.deepEqual(queryOptions.attributes, [
      "userId",
      "userName",
      "role",
      "isActive",
    ]);
    assert.deepEqual(users, [
      {
        userId: 1,
        userName: "admin",
        role: "admin",
        isActive: true,
        isOnline: false,
      },
      {
        userId: 2,
        userName: "member",
        role: "user",
        isActive: true,
        isOnline: true,
      },
    ]);
    assert.equal(JSON.stringify(users).includes("password"), false);
  } finally {
    presenceService.getOnlineUserIds = originalGetOnline;
    db.Users.findAll = originalFindAll;
  }
});

test("audit log listing applies pagination and event filters without message bodies", async () => {
  const originalFindAndCountAll = db.AuditLog.findAndCountAll;
  let queryOptions;
  const rows = [{ eventId: 1, eventType: "message.sent" }];
  db.AuditLog.findAndCountAll = async (options) => {
    queryOptions = options;
    return { count: 1, rows };
  };

  try {
    const result = await adminService.getAuditLogs({
      page: 2,
      pageSize: 10,
      eventType: "message.sent",
    });

    assert.deepEqual(queryOptions.where, { eventType: "message.sent" });
    assert.equal(queryOptions.limit, 10);
    assert.equal(queryOptions.offset, 10);
    assert.ok(queryOptions.attributes.includes("targetUserId"));
    assert.equal(queryOptions.attributes.includes("MessageText"), false);
    assert.deepEqual(result, { items: rows, total: 1 });
  } finally {
    db.AuditLog.findAndCountAll = originalFindAndCountAll;
  }
});
