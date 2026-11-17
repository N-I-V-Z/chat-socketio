const { Op } = require("sequelize");
const db = require("../models");
const auditLogService = require("./auditLogService");

const messageService = {
  getAllMessageOfRoom: async (userId, receiverId) =>
    db.Message.findAll({
      where: {
        [Op.or]: [
          { SenderId: userId, ReceiverId: receiverId },
          { SenderId: receiverId, ReceiverId: userId },
        ],
      },
      order: [["Timestamp", "ASC"]],
    }),

  addMessage: async (senderId, receiverId, message) =>
    db.sequelize.transaction(async (transaction) => {
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
    }),
};

module.exports = messageService;
