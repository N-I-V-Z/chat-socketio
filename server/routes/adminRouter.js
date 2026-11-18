const router = require("express").Router();
const adminController = require("../controller/adminController");
const requireAccessToken = require("../middleware/requireAccessToken");
const requireAdmin = require("../middleware/requireAdmin");

router.use(requireAccessToken, requireAdmin);
router.get("/users", adminController.getUsers);
router.get("/logs", adminController.getAuditLogs);
router.patch("/users/:userId/status", adminController.setUserStatus);

module.exports = router;
