const db = require("../models");
const { USER_ROLES } = require("../constants/userRole");
const { failure } = require("../utils/apiResponse");

module.exports = async (req, res, next) => {
  try {
    const user = await db.Users.findByPk(req.auth?.userId, {
      attributes: ["userId", "userName", "role"],
    });

    if (!user) {
      return failure(res, 401, "UNAUTHORIZED", "Authentication required");
    }

    if (user.role !== USER_ROLES.ADMIN) {
      return failure(res, 403, "FORBIDDEN", "Administrator access required");
    }

    req.auth.role = user.role;
    req.auth.userName = user.userName;
    return next();
  } catch (error) {
    return next(error);
  }
};
