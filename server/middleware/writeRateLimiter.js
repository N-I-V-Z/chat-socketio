const { failure } = require("../utils/apiResponse");
const { verifyAccessToken } = require("../services/authService");
const rateLimiter = require("../services/rateLimiter");

module.exports = async (req, res, next) => {
  if (
    !["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ||
    req.originalUrl.startsWith("/api/v1/auth/")
  )
    return next();
  try {
    const token = (req.get("authorization") || "").match(
      /^Bearer ([^\s]+)$/,
    )?.[1];
    let userId = null;
    try {
      if (token) userId = verifyAccessToken(token).userId;
    } catch {
      /* Authentication middleware handles invalid tokens. */
    }
    const key = userId ? `http:user:${userId}` : `http:ip:${req.ip}`;
    if (!(await rateLimiter.allow(key, 120, 60, "http_write"))) {
      return failure(res, 429, "RATE_LIMITED", "Too many requests");
    }
    return next();
  } catch (error) {
    return next(error);
  }
};
