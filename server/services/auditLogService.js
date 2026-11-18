const { Op } = require("sequelize");
const db = require("../models");

const RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const EVENT_TYPES = Object.freeze({
  USER_REGISTERED: "user.registered",
  LOGIN_SUCCEEDED: "auth.login.succeeded",
  LOGIN_FAILED: "auth.login.failed",
  LOGOUT: "auth.logout",
  PRESENCE_CONNECTED: "presence.connected",
  PRESENCE_DISCONNECTED: "presence.disconnected",
  MESSAGE_SENT: "message.sent",
  ADMIN_USERS_VIEWED: "admin.users.viewed",
  ADMIN_AUDIT_LOGS_VIEWED: "admin.audit_logs.viewed",
  ACCOUNT_STATUS_CHANGED: "admin.account_status.changed",
});
const ALLOWED_EVENT_TYPES = new Set(Object.values(EVENT_TYPES));

async function recordEvent(
  {
    eventType,
    actorUserId = null,
    actorUserName = null,
    targetUserId = null,
    outcome = null,
  },
  options = {},
) {
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    throw new Error("Unsupported audit event type.");
  }

  return db.AuditLog.create(
    {
      eventType,
      actorUserId,
      actorUserName,
      targetUserId,
      outcome,
    },
    options,
  );
}

async function pruneExpiredLogs(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return db.AuditLog.destroy({
    where: {
      occurredAt: {
        [Op.lt]: cutoff,
      },
    },
  });
}

function startRetentionCleanup() {
  const cleanup = () => {
    pruneExpiredLogs().catch((error) => {
      console.error("Audit log retention cleanup failed:", error);
    });
  };

  cleanup();
  const timer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = {
  EVENT_TYPES,
  RETENTION_DAYS,
  pruneExpiredLogs,
  recordEvent,
  startRetentionCleanup,
};
