const router = require("express").Router();
const conversationController = require("../controller/conversationController");
const requireAccessToken = require("../middleware/requireAccessToken");

router.use(requireAccessToken);
router.post("/direct", conversationController.getOrCreateDirectConversation);
router.get("/:conversationId/messages", conversationController.getMessages);
router.post("/:conversationId/messages", conversationController.addMessage);

module.exports = router;
