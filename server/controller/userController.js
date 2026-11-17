const userService = require("../services/userService");
const asyncHandler = require("../middleware/asyncHandler");
const { failure, success } = require("../utils/apiResponse");

const getUserByUserId = asyncHandler(async (req, res) => {
  const user = await userService.getUserByUserId(req.auth.userId);
  if (!user) {
    return failure(res, 404, "USER_NOT_FOUND", "User not found");
  }
  return success(res, user);
});

const getAll = asyncHandler(async (req, res) => {
  const users = await userService.getAll(req.auth.userId);
  success(res, users);
});

module.exports = {
  getAll,
  getUserByUserId,
};
