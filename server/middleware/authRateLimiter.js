const { rateLimit } = require("express-rate-limit");
const { failure } = require("../utils/apiResponse");

const windowMs = 15 * 60 * 1000;

function createAuthRateLimiter(limit, options = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      failure(
        res,
        429,
        "RATE_LIMITED",
        "Too many authentication attempts. Try again later.",
      ),
    ...options,
  });
}

module.exports = {
  login: createAuthRateLimiter(10, { skipSuccessfulRequests: true }),
  register: createAuthRateLimiter(10),
  refresh: createAuthRateLimiter(120),
};
