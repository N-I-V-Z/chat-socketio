const db = require("../models");
const { serializeUser } = require("./authService");
const cacheService = require("./cacheService");
const { USER_DIRECTORY_KEY } = require("./cacheKeys");

const userService = {
  getUserByUserId: async (userId) => {
    const user = await db.Users.findByPk(userId);
    return user ? serializeUser(user) : null;
  },
  getAll: async (userId) => {
    const users = await cacheService.getOrLoad(
      USER_DIRECTORY_KEY,
      60,
      () =>
        db.Users.findAll({
          attributes: ["userId", "userName"],
        })
    );
    return users.filter((user) => Number(user.userId) !== Number(userId));
  },
};

module.exports = userService;
