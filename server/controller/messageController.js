const messageService = require("../services/messageService");
const asyncHandler = require("../middleware/asyncHandler");
const { success } = require("../utils/apiResponse");
const httpError = require("../utils/httpError");

function parseReceiverId(value) {
  const receiverId = Number(value);
  if (!Number.isSafeInteger(receiverId) || receiverId < 1) {
    throw httpError(400, "INVALID_RECEIVER", "A valid receiver is required");
  }
  return receiverId;
}

const getAllMessageOfRoom = asyncHandler(async (req, res) => {
  const receiverId = parseReceiverId(req.body?.receiverId);
  const messages = await messageService.getAllMessageOfRoom(
    req.auth.userId,
    receiverId
  );
  success(res, messages);
});

const addMessage = asyncHandler(async (req, res) => {
  const receiverId = parseReceiverId(req.body?.receiverId);
  const message = req.body?.message;

  if (typeof message !== "string" || !message.trim() || message.length > 4000) {
    throw httpError(400, "INVALID_MESSAGE", "Message must contain 1-4000 characters");
  }

  const savedMessage = await messageService.addMessage(
    req.auth.userId,
    receiverId,
    message.trim()
  );
  success(res, savedMessage, 201, "Message saved");
});

module.exports = {
  addMessage,
  getAllMessageOfRoom,
};
