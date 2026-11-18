const { failure } = require("../utils/apiResponse");
const logger = require("../services/logger");

module.exports = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const status = Number(error.statusCode || error.status) || 500;
  if (status >= 500) {
    logger.error(
      { err: error, requestId: req.requestId },
      "HTTP request failed",
    );
  }

  if (error.type === "entity.parse.failed") {
    return failure(res, 400, "INVALID_JSON", "Malformed JSON request");
  }
  if (error.type === "entity.too.large") {
    return failure(res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }

  const code =
    status >= 500 ? "INTERNAL_SERVER_ERROR" : error.code || "REQUEST_ERROR";
  const message =
    status >= 500 ? "Internal server error" : error.message || "Request failed";
  return failure(res, status, code, message);
};
