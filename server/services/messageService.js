const db = require("../models");
const auditLogService = require("./auditLogService");
const cacheService = require("./cacheService");
const conversationService = require("./conversationService");
const { conversationKey } = require("./cacheKeys");

const MESSAGE_HISTORY_TTL_SECONDS = 30;

const messageService = {
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
