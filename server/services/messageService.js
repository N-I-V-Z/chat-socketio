const { Op } = require("sequelize");
const db = require("../models");

const messageService = {
    getAllMessageOfRoom: async (senderId, receiverId) => {
        try {
          const response = await db.Message.findAll({
            where: {
              [Op.or]: [
                {
                  SenderId: senderId,
                  ReceiverId: receiverId
                },
                {
                  SenderId: receiverId,
                  ReceiverId: senderId
                }
              ]
            },
            order: [['Timestamp', 'ASC']] // Sắp xếp tin nhắn theo thời gian gửi
          });
          return response;
        } catch (error) {
          console.log("Error at messageService.getAllMessageOfRoom()", error);
          return null;
        }
      },
  addMessage: async (senderId, receiverId, message) => {
    try {
      // Truy vấn để lấy tất cả các tin nhắn giữa senderId và receiverId
      const response = await db.Message.create({
        SenderId: senderId,
        ReceiverId: receiverId,
        MessageText: message
      })
      console.log(response);
      return response;
    } catch (error) {
      console.log("Error at messageService.getAllMessageOfRoom()", error);
      return null;
    }
  },
};

module.exports = messageService;
