const assert = require("node:assert/strict");
const test = require("node:test");
const db = require("../models");
const auditLogService = require("../services/auditLogService");

test("audit records persist only the approved event fields", async () => {
  const originalCreate = db.AuditLog.create;
  let savedValues;
  db.AuditLog.create = async (values) => {
    savedValues = values;
    return values;
  };

  try {
    await auditLogService.recordEvent({
      eventType: auditLogService.EVENT_TYPES.MESSAGE_SENT,
      actorUserId: 7,
      targetUserId: 9,
      message: "private message text",
      password: "secret",
      accessToken: "secret-token",
      cookie: "secret-cookie",
    });
  } finally {
    db.AuditLog.create = originalCreate;
  }

  assert.deepEqual(savedValues, {
    eventType: "message.sent",
    actorUserId: 7,
    actorUserName: null,
    targetUserId: 9,
    outcome: null,
  });
  assert.equal(JSON.stringify(savedValues).includes("private message text"), false);
});

test("audit records reject unrecognized event types", async () => {
  await assert.rejects(
    auditLogService.recordEvent({ eventType: "message.body" }),
    /Unsupported audit event type/
  );
});

test("retention cleanup deletes records older than 30 days", async () => {
  const originalDestroy = db.AuditLog.destroy;
  let destroyOptions;
  db.AuditLog.destroy = async (options) => {
    destroyOptions = options;
    return 3;
  };

  try {
    const now = new Date("2026-01-31T12:00:00.000Z");
    assert.equal(await auditLogService.pruneExpiredLogs(now), 3);
    const cutoffCondition = destroyOptions.where.occurredAt;
    const cutoffOperator = Object.getOwnPropertySymbols(cutoffCondition)[0];
    assert.equal(cutoffCondition[cutoffOperator].toISOString(), "2026-01-01T12:00:00.000Z");
  } finally {
    db.AuditLog.destroy = originalDestroy;
  }
});
