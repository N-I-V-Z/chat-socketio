const { rateLimit } = require("express-rate-limit");
const { failure } = require("../utils/apiResponse");

module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    failure(
      res,
      429,
      "RATE_LIMITED",
      "Too many authentication attempts. Try again later."
    ),
});
