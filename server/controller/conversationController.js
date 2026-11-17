const asyncHandler = require("../middleware/asyncHandler");
const conversationService = require("../services/conversationService");
const { success } = require("../utils/apiResponse");
const httpError = require("../utils/httpError");

function parseOtherUserId(value) {
  const userId = Number(value);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw httpError(400, "INVALID_USER_ID", "A valid participant is required");
  }
  return userId;
}

const getOrCreateDirectConversation = asyncHandler(async (req, res) => {
  const otherUserId = parseOtherUserId(req.body?.otherUserId);
  const conversation = await conversationService.getOrCreateDirectConversation(
    req.auth.userId,
    otherUserId,
  );

  success(res, { conversationId: conversation.conversationId });
});

module.exports = { getOrCreateDirectConversation };
