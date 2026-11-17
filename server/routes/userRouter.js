const authController = require("../controller/authController");
const userController = require("../controller/userController");
const requireAccessToken = require("../middleware/requireAccessToken");
const requireTrustedOrigin = require("../middleware/requireTrustedOrigin");
const authRateLimiter = require("../middleware/authRateLimiter");
const router = require("express").Router();

router.post(
  "/login",
  requireTrustedOrigin,
  authRateLimiter,
  authController.login
);

router.post(
  "/register",
  requireTrustedOrigin,
  authRateLimiter,
  authController.register
);

router.post(
  "/refresh",
  requireTrustedOrigin,
  authRateLimiter,
  authController.refresh
);

router.post("/logout", requireTrustedOrigin, authController.logout);

router.use(requireAccessToken);

router.post("/getAll", userController.getAll);
router.post("/getUserByUserId", userController.getUserByUserId);

module.exports = router;
