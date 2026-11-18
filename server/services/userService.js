const db = require("../models");
const { serializeUser } = require("./authService");
const cacheService = require("./cacheService");
const { USER_DIRECTORY_KEY } = require("./cacheKeys");
const presenceService = require("./presenceService");
const logger = require("./logger");

const userService = {
  getUserByUserId: async (userId) => {
    const user = await db.Users.findByPk(userId);
    return user ? serializeUser(user) : null;
  },
  getAll: async (userId) => {
    const users = await cacheService.getOrLoad(USER_DIRECTORY_KEY, 60, () =>
      db.Users.findAll({
        attributes: ["userId", "userName"],
      }),
    );
    const visibleUsers = users.filter(
      (user) => Number(user.userId) !== Number(userId),
    );
    let onlineUserIds = new Set();
    try {
      onlineUserIds = await presenceService.getOnlineUserIds(
        visibleUsers.map((user) => user.userId),
      );
    } catch (error) {
      logger.warn({ err: error }, "Could not load contact presence");
    }
    return visibleUsers.map((user) => ({
      userId: user.userId,
      userName: user.userName,
      isOnline: onlineUserIds.has(Number(user.userId)),
    }));
  },
};

module.exports = userService;
