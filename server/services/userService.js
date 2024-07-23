const db = require("../models");

const userService = {
  getUserByUserId: async (userId) => {
    try {
      const response = await db.Users.findByPk(parseInt(userId));
      return response;
    } catch (error) {
      console.log("Error at userService.getUserByUserId()", error);
      return null;
    }
  },
  getAll: async (userId) => {
    try {
      const response = await db.Users.findAll({
        where: {
          userId: {
            [db.Sequelize.Op.not]: userId,
          },
        },
      });
      return response;
    } catch (error) {
      console.log("Error at userService.getAll()", error);
      return null;
    }
  },
  login: async (userName, password) => {
    try {
      const response = await db.Users.findOne({
        where: { userName, password },
      });
      return response;
    } catch (error) {
      console.log("Error at userService.login()", error);
      return null;
    }
  },
  register: async (userName, password) => {
    try {
      const response = await db.Users.create({
        userName,
        password,
      });
      return response;
    } catch (error) {
      console.log("Error at userService.register()");
      return null;
    }
  },
  checkUserName: async (userName) => {
    try {
      const response = await db.Users.findOne({ where: { userName } });
      return response;
    } catch (error) {
      console.log("Error at userService.register()");
      return null;
    }
  },
};

module.exports = userService;
