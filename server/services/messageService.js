const { Op } = require("sequelize");
const db = require("../models");
const auditLogService = require("./auditLogService");
const cacheService = require("./cacheService");
const { conversationKey } = require("./cacheKeys");

const MESSAGE_HISTORY_TTL_SECONDS = 30;

const messageService = {
  getAllMessageOfRoom: async (userId, receiverId) =>
    cacheService.getOrLoad(
      conversationKey(userId, receiverId),
      MESSAGE_HISTORY_TTL_SECONDS,
      () =>
        db.Message.findAll({
          where: {
            [Op.or]: [
              { SenderId: userId, ReceiverId: receiverId },
              { SenderId: receiverId, ReceiverId: userId },
            ],
          },
          order: [["Timestamp", "ASC"]],
        })
    ),

  addMessage: async (senderId, receiverId, message) => {
    const savedMessage = await db.sequelize.transaction(async (transaction) => {
      const savedMessage = await db.Message.create(
        {
          SenderId: senderId,
          ReceiverId: receiverId,
          MessageText: message,
        },
        { transaction }
      );
      await auditLogService.recordEvent(
        {
          eventType: auditLogService.EVENT_TYPES.MESSAGE_SENT,
          actorUserId: senderId,
          targetUserId: receiverId,
        },
        { transaction }
      );
      return savedMessage;
    });

    await cacheService.invalidate(conversationKey(senderId, receiverId));
    return savedMessage;
  },
};

module.exports = messageService;
