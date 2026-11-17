const { Op } = require("sequelize");
const db = require("../models");
const { serializeUser } = require("./authService");

const userService = {
  getUserByUserId: async (userId) => {
    const user = await db.Users.findByPk(userId);
    return user ? serializeUser(user) : null;
  },
  getAll: async (userId) => {
    const users = await db.Users.findAll({
      attributes: ["userId", "userName"],
      where: {
        userId: {
          [Op.ne]: userId,
        },
      },
    });
    return users;
  },
};

module.exports = userService;
