const { verifyAccessToken } = require("../services/authService");
const { failure } = require("../utils/apiResponse");

module.exports = (req, res, next) => {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer ([^\s]+)$/);

  if (!match) {
    return failure(res, 401, "UNAUTHORIZED", "Authentication required");
  }

  try {
    req.auth = verifyAccessToken(match[1]);
    return next();
  } catch (error) {
    const code =
      error.name === "TokenExpiredError"
        ? "ACCESS_TOKEN_EXPIRED"
        : "INVALID_ACCESS_TOKEN";
    return failure(res, 401, code, "Authentication required");
  }
};
