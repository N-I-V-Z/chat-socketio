const { Op } = require("sequelize");
const db = require("../models");
const auditLogService = require("./auditLogService");
const cacheService = require("./cacheService");
const conversationService = require("./conversationService");
const { conversationKey, conversationPageKey } = require("./cacheKeys");
const httpError = require("../utils/httpError");

const MESSAGE_HISTORY_TTL_SECONDS = 30;
const MESSAGE_PAGE_SIZE = 30;

function toPlainMessage(message) {
  return typeof message.get === "function"
    ? message.get({ plain: true })
    : message;
}

async function getMessagePage(userId, conversationId, beforeMessageId = null) {
  const membership = await db.ConversationParticipant.findOne({
    attributes: ["conversationId"],
    where: { conversationId, userId },
  });
  if (!membership) {
    throw httpError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
  }

  return cacheService.getOrLoad(
    conversationPageKey(conversationId, beforeMessageId),
    MESSAGE_HISTORY_TTL_SECONDS,
    async () => {
      const where = { ConversationId: conversationId };
      if (beforeMessageId !== null) {
        where.MessageId = { [Op.lt]: beforeMessageId };
      }

      const rows = await db.Message.findAll({
        attributes: [
          "MessageId",
          "ConversationId",
          "SenderId",
          "MessageText",
          "Timestamp",
        ],
        where,
        order: [["MessageId", "DESC"]],
        limit: MESSAGE_PAGE_SIZE + 1,
      });
      const hasMore = rows.length > MESSAGE_PAGE_SIZE;
      const items = rows
        .slice(0, MESSAGE_PAGE_SIZE)
        .reverse()
        .map(toPlainMessage);

      return {
        items,
        hasMore,
        nextCursor:
          hasMore && items.length > 0 ? Number(items[0].MessageId) : null,
      };
    },
  );
}

async function addMessageToConversation(senderId, conversationId, message) {
  const saved = await db.sequelize.transaction(async (transaction) => {
    const participants = await db.ConversationParticipant.findAll({
      attributes: ["userId"],
      where: { conversationId },
      order: [["userId", "ASC"]],
      transaction,
    });
    const participantIds = participants.map(({ userId }) => Number(userId));

    if (!participantIds.includes(Number(senderId))) {
      throw httpError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    }
    if (participantIds.length < 1 || participantIds.length > 2) {
      throw httpError(
        409,
        "GROUP_MESSAGES_UNSUPPORTED",
        "Group messaging is not available",
      );
    }

    const recipientId =
      participantIds.find((userId) => userId !== Number(senderId)) ??
      Number(senderId);
    const savedMessage = await db.Message.create(
      {
        ConversationId: conversationId,
        SenderId: senderId,
        MessageText: message,
      },
      { transaction },
    );
    await auditLogService.recordEvent(
      {
        eventType: auditLogService.EVENT_TYPES.MESSAGE_SENT,
        actorUserId: senderId,
        targetUserId: recipientId,
      },
      { transaction },
    );

    return { savedMessage, recipientId };
  });

  await Promise.all([
    cacheService.invalidate(conversationPageKey(conversationId)),
    cacheService.invalidate(conversationKey(senderId, saved.recipientId)),
  ]);
  return saved.savedMessage;
}

const messageService = {
  MESSAGE_PAGE_SIZE,
  addMessageToConversation,
  getAllMessageOfRoom: async (userId, receiverId) => {
    const conversation =
      await conversationService.getOrCreateDirectConversation(
        userId,
        receiverId,
      );

    return cacheService.getOrLoad(
      conversationKey(userId, receiverId),
      MESSAGE_HISTORY_TTL_SECONDS,
      () =>
        db.Message.findAll({
          where: { ConversationId: conversation.conversationId },
          order: [
            ["Timestamp", "ASC"],
            ["MessageId", "ASC"],
          ],
        }),
    );
  },
  getMessagePage,

  addMessage: async (senderId, receiverId, message) => {
    const savedMessage = await db.sequelize.transaction(async (transaction) => {
      const conversation =
        await conversationService.getOrCreateDirectConversation(
          senderId,
          receiverId,
          { transaction },
        );
      const savedMessage = await db.Message.create(
        {
          ConversationId: conversation.conversationId,
          SenderId: senderId,
          MessageText: message,
        },
        { transaction },
      );
      await auditLogService.recordEvent(
        {
          eventType: auditLogService.EVENT_TYPES.MESSAGE_SENT,
          actorUserId: senderId,
          targetUserId: receiverId,
        },
        { transaction },
      );
      return savedMessage;
    });

    await cacheService.invalidate(conversationKey(senderId, receiverId));
    return savedMessage;
  },
};

module.exports = messageService;
