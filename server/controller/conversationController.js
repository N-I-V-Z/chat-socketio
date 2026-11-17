const asyncHandler = require("../middleware/asyncHandler");
const conversationService = require("../services/conversationService");
const messageService = require("../services/messageService");
const readReceiptService = require("../services/readReceiptService");
const { success } = require("../utils/apiResponse");
const httpError = require("../utils/httpError");

function parsePositiveId(value, code, message) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw httpError(400, code, message);
  }
  if (typeof value === "string" && !/^[1-9]\d*$/.test(value)) {
    throw httpError(400, code, message);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw httpError(400, code, message);
  }
  return parsed;
}

function parseOtherUserId(value) {
  return parsePositiveId(
    value,
    "INVALID_USER_ID",
    "A valid participant is required",
  );
}

const putDirectConversation = asyncHandler(async (req, res) => {
  const otherUserId = parseOtherUserId(req.params.otherUserId);
  const conversation = await conversationService.getOrCreateDirectConversation(
    req.auth.userId,
    otherUserId,
  );

  success(res, { conversationId: conversation.conversationId });
});

const getMessages = asyncHandler(async (req, res) => {
  const conversationId = parsePositiveId(
    req.params.conversationId,
    "INVALID_CONVERSATION_ID",
    "A valid conversation is required",
  );
  const beforeMessageId =
    req.query.beforeMessageId === undefined
      ? null
      : parsePositiveId(
          req.query.beforeMessageId,
          "INVALID_MESSAGE_CURSOR",
          "A valid message cursor is required",
        );
  const page = await messageService.getMessagePage(
    req.auth.userId,
    conversationId,
    beforeMessageId,
  );

  success(res, page);
});

const addMessage = asyncHandler(async (req, res) => {
  const conversationId = parsePositiveId(
    req.params.conversationId,
    "INVALID_CONVERSATION_ID",
    "A valid conversation is required",
  );
  const message = req.body?.message;

  if (typeof message !== "string" || !message.trim() || message.length > 4000) {
    throw httpError(
      400,
      "INVALID_MESSAGE",
      "Message must contain 1-4000 characters",
    );
  }

  const savedMessage = await messageService.addMessageToConversation(
    req.auth.userId,
    conversationId,
    message.trim(),
  );
  success(res, savedMessage, 201, "Message saved");
});

const getUnreadSummary = asyncHandler(async (req, res) => {
  const unreadSummary = await readReceiptService.getUnreadSummary(
    req.auth.userId,
  );
  success(res, unreadSummary);
});

const updateConversationReadReceipt = asyncHandler(async (req, res) => {
  const conversationId = parsePositiveId(
    req.params.conversationId,
    "INVALID_CONVERSATION_ID",
    "A valid conversation is required",
  );
  const upToMessageId = parsePositiveId(
    req.body?.upToMessageId,
    "INVALID_MESSAGE_CURSOR",
    "A valid message cursor is required",
  );
  const readState = await readReceiptService.markConversationRead(
    req.auth.userId,
    conversationId,
    upToMessageId,
  );
  const io = req.app.get("io");
  const event = {
    conversationId: readState.conversationId,
    readerId: readState.readerId,
    upToMessageId: readState.upToMessageId,
    readAt: readState.readAt,
  };

  for (const participantId of readState.participantUserIds) {
    if (participantId !== readState.readerId) {
      io.to(`user:${participantId}`).emit("conversationRead", event);
    }
  }

  success(res, {
    conversationId: readState.conversationId,
    upToMessageId: readState.upToMessageId,
    readAt: readState.readAt,
  });
});

module.exports = {
  addMessage,
  getUnreadSummary,
  getMessages,
  putDirectConversation,
  updateConversationReadReceipt,
};
