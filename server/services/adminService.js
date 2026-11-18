const db = require("../models");
const presenceService = require("./presenceService");

async function getUsers() {
  const onlineUserIds = presenceService.getOnlineUserIds();
  const users = await db.Users.findAll({
    attributes: ["userId", "userName", "role", "isActive"],
    order: [["userName", "ASC"]],
  });

  return users.map((user) => ({
    userId: user.userId,
    userName: user.userName,
    role: user.role,
    isActive: user.isActive !== false,
    isOnline: onlineUserIds.has(user.userId),
  }));
}

async function getAuditLogs({ page, pageSize, eventType }) {
  const where = eventType ? { eventType } : undefined;
  const result = await db.AuditLog.findAndCountAll({
    attributes: [
      "eventId",
      "eventType",
      "actorUserId",
      "actorUserName",
      "targetUserId",
      "outcome",
      "occurredAt",
    ],
    where,
    order: [
      ["occurredAt", "DESC"],
      ["eventId", "DESC"],
    ],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return {
    items: result.rows,
    total: result.count,
  };
}

module.exports = {
  getAuditLogs,
  getUsers,
};
