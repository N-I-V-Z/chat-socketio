const adminService = require("../services/adminService");
const auditLogService = require("../services/auditLogService");
const asyncHandler = require("../middleware/asyncHandler");
const { success } = require("../utils/apiResponse");
const httpError = require("../utils/httpError");
const { z } = require("zod");
const { userRoom, parseUserId } = require("../utils/chatUtils");
const db = require("../models");

function parseInteger(
  value,
  defaultValue,
  minimum,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  const parsed = value === undefined ? defaultValue : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw httpError(400, "INVALID_PAGINATION", "Invalid pagination parameters");
  }
  return parsed;
}

const getUsers = asyncHandler(async (req, res) => {
  await auditLogService.recordEvent({
    eventType: auditLogService.EVENT_TYPES.ADMIN_USERS_VIEWED,
    actorUserId: req.auth.userId,
    actorUserName: req.auth.userName,
  });
  const users = await adminService.getUsers();
  success(res, users);
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const page = parseInteger(req.query?.page, 1, 1);
  const pageSize = parseInteger(req.query?.pageSize, 25, 1, 100);
  const eventType = req.query?.eventType;
  if (
    eventType !== undefined &&
    !Object.values(auditLogService.EVENT_TYPES).includes(eventType)
  ) {
    throw httpError(400, "INVALID_EVENT_TYPE", "Unsupported audit event type");
  }

  await auditLogService.recordEvent({
    eventType: auditLogService.EVENT_TYPES.ADMIN_AUDIT_LOGS_VIEWED,
    actorUserId: req.auth.userId,
    actorUserName: req.auth.userName,
  });
  const logs = await adminService.getAuditLogs({ page, pageSize, eventType });
  success(res, {
    ...logs,
    page,
    pageSize,
  });
});

module.exports = {
  getAuditLogs,
  getUsers,
  setUserStatus: asyncHandler(async (req, res) => {
    const userId = parseUserId(req.params.userId);
    const parsed = z
      .object({ isActive: z.boolean() })
      .strict()
      .safeParse(req.body);
    if (!userId || !parsed.success)
      throw httpError(400, "INVALID_ACCOUNT_STATUS", "Invalid account status");
    if (userId === req.auth.userId && !parsed.data.isActive) {
      throw httpError(
        409,
        "CANNOT_DISABLE_SELF",
        "Administrator cannot disable own account",
      );
    }
    const user = await db.Users.findByPk(userId);
    if (!user) throw httpError(404, "USER_NOT_FOUND", "User not found");
    await db.sequelize.transaction(async (transaction) => {
      await user.update(
        { isActive: parsed.data.isActive, updatedBy: req.auth.userId },
        { transaction },
      );
      if (!parsed.data.isActive) {
        await db.RefreshToken.update(
          { revokedAt: new Date() },
          { where: { userId, revokedAt: null }, transaction },
        );
      }
      await auditLogService.recordEvent(
        {
          eventType: auditLogService.EVENT_TYPES.ACCOUNT_STATUS_CHANGED,
          actorUserId: req.auth.userId,
          targetUserId: userId,
          outcome: parsed.data.isActive ? "active" : "inactive",
        },
        { transaction },
      );
    });
    if (!parsed.data.isActive)
      req.app.get("io")?.in(userRoom(userId)).disconnectSockets(true);
    success(res, { userId, isActive: parsed.data.isActive });
  }),
};
