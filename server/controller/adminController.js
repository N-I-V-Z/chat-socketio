const adminService = require("../services/adminService");
const auditLogService = require("../services/auditLogService");
const asyncHandler = require("../middleware/asyncHandler");
const { success } = require("../utils/apiResponse");
const httpError = require("../utils/httpError");

function parseInteger(value, defaultValue, minimum, maximum = Number.MAX_SAFE_INTEGER) {
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
};
