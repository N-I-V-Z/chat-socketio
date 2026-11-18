const { verifyAccessToken } = require("../services/authService");
const { failure } = require("../utils/apiResponse");
const db = require("../models");

module.exports = async (req, res, next) => {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer ([^\s]+)$/);

  if (!match) {
    return failure(res, 401, "UNAUTHORIZED", "Authentication required");
  }

  try {
    req.auth = verifyAccessToken(match[1]);
    const user = await db.Users.findByPk(req.auth.userId, {
      attributes: ["userId", "isActive"],
    });
    if (!user || user.isActive === false) {
      return failure(res, 401, "ACCOUNT_INACTIVE", "Authentication required");
    }
    return next();
  } catch (error) {
    if (
      error.name !== "TokenExpiredError" &&
      error.name !== "JsonWebTokenError"
    ) {
      return next(error);
    }
    const code =
      error.name === "TokenExpiredError"
        ? "ACCESS_TOKEN_EXPIRED"
        : "INVALID_ACCESS_TOKEN";
    return failure(res, 401, code, "Authentication required");
  }
};
