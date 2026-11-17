const { failure } = require("../utils/apiResponse");

module.exports = (req, res, next) => {
  const allowedOrigin = process.env.CLIENT_URL || "http://localhost:3000";
  if (req.get("origin") !== allowedOrigin) {
    return failure(res, 403, "INVALID_ORIGIN", "Request origin is not allowed");
  }
  return next();
};
