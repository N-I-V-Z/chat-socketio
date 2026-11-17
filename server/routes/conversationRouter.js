const router = require("express").Router();
const conversationController = require("../controller/conversationController");
const requireAccessToken = require("../middleware/requireAccessToken");

router.use(requireAccessToken);
router.post("/direct", conversationController.getOrCreateDirectConversation);
router.get("/unread", conversationController.getUnreadSummary);
router.get("/:conversationId/messages", conversationController.getMessages);
router.post("/:conversationId/messages", conversationController.addMessage);
router.post(
  "/:conversationId/read",
  conversationController.markConversationRead,
);

module.exports = router;
