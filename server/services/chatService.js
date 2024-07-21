const db = require("../models");

const chatService = {
  getAll: async () => {
    try {
      const response = await db.Chat.findAll();
      return response;
    } catch (error) {
      console.log("Error at chatService.getAll()");
    }
  },
};

module.exports = chatService;
