const { Op } = require("sequelize");
const db = require("../models");

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
    db.Message.create({
      SenderId: senderId,
      ReceiverId: receiverId,
      MessageText: message,
    }),
};

module.exports = messageService;
