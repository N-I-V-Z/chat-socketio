const { Op, QueryTypes } = require("sequelize");
const db = require("../models");
const redisConnection = require("./redisConnection");
const logger = require("./logger");

const RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
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
  const cleanup = async () => {
    try {
      const redis = redisConnection.getClient();
      if (!redis?.isReady) return;
      const lease = await redis.set("audit:retention:lease", "1", {
        NX: true,
        EX: 600,
      });
      if (!lease) return;
      const cutoff = new Date(
        Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );
      for (let batch = 0; batch < 10; batch++) {
        const rows = await db.sequelize.query(
          "DELETE TOP (1000) FROM [dbo].[AuditLogs] WHERE [occurredAt] < :cutoff; SELECT @@ROWCOUNT AS deleted;",
          { replacements: { cutoff }, type: QueryTypes.SELECT },
        );
        const deleted = Number(rows?.[0]?.deleted ?? 0);
        if (deleted < 1000) break;
      }
    } catch (error) {
      logger.error({ err: error }, "Audit log retention cleanup failed");
    }
  };

  void cleanup();
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
