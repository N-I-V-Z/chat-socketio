const router = require("express").Router();
const conversationController = require("../controller/conversationController");
const requireAccessToken = require("../middleware/requireAccessToken");

router.use(requireAccessToken);
router.put(
  "/direct/:otherUserId",
  conversationController.putDirectConversation,
);
router.get("/unread-summary", conversationController.getUnreadSummary);
router.get("/:conversationId/messages", conversationController.getMessages);
router.post("/:conversationId/messages", conversationController.addMessage);
router.put(
  "/:conversationId/read-receipt",
  conversationController.updateConversationReadReceipt,
);

module.exports = router;
