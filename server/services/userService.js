const { where } = require("sequelize");
const db = require("../models");

const userService = {
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
      const response = await db.Users.findOne({where: {userName}});
      return response;
    } catch (error) {
      console.log("Error at userService.register()");
      return null;
    }
  }
};

module.exports = userService;
