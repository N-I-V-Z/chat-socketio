const authController = require("../controller/authController");
const requireTrustedOrigin = require("../middleware/requireTrustedOrigin");
const authRateLimiters = require("../middleware/authRateLimiter");
const router = require("express").Router();

router.post(
  "/login",
  requireTrustedOrigin,
  authRateLimiters.login,
  authController.login,
);

router.post(
  "/register",
  requireTrustedOrigin,
  authRateLimiters.register,
  authController.register,
);

router.post(
  "/refresh",
  requireTrustedOrigin,
  authRateLimiters.refresh,
  authController.refresh,
);

router.post("/logout", requireTrustedOrigin, authController.logout);

module.exports = router;
