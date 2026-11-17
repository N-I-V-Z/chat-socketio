const router = require("express").Router();
const conversationController = require("../controller/conversationController");
const requireAccessToken = require("../middleware/requireAccessToken");

router.use(requireAccessToken);
router.post("/direct", conversationController.getOrCreateDirectConversation);

module.exports = router;
