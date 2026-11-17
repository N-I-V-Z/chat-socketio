const { UniqueConstraintError } = require("sequelize");
const authService = require("../services/authService");
const asyncHandler = require("../middleware/asyncHandler");
const { success } = require("../utils/apiResponse");
const httpError = require("../utils/httpError");

function validateCredentials(userName, password, isRegistration) {
  if (
    typeof userName !== "string" ||
    !userName.trim() ||
    userName.trim().length > 255 ||
    typeof password !== "string" ||
    !password ||
    Buffer.byteLength(password, "utf8") > 1024
  ) {
    throw httpError(400, "INVALID_CREDENTIALS", "Invalid username or password");
  }

  if (
    isRegistration &&
    (password.length < 8 || Buffer.byteLength(password, "utf8") > 72)
  ) {
    throw httpError(
      400,
      "INVALID_PASSWORD",
      "Password must be at least 8 characters and no more than 72 bytes"
    );
  }

  return { userName: userName.trim(), password };
}

const login = asyncHandler(async (req, res) => {
  const { userName, password } = validateCredentials(
    req.body?.userName,
    req.body?.password,
    false
  );
  const user = await authService.authenticate(userName, password);

  if (!user) {
    throw httpError(401, "INVALID_CREDENTIALS", "Invalid username or password");
  }

  const session = await authService.createRefreshSession(user.userId, res);
  success(res, session, 200, "Đăng nhập thành công");
});

const register = asyncHandler(async (req, res) => {
  const { userName, password } = validateCredentials(
    req.body?.userName,
    req.body?.password,
    true
  );

  try {
    const user = await authService.register(userName, password);
    success(res, user, 201, "Đăng kí thành công");
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw httpError(409, "USERNAME_TAKEN", "Tài khoản đã tồn tại");
    }
    throw error;
  }
});

const refresh = asyncHandler(async (req, res) => {
  try {
    const session = await authService.refreshSession(
      req.cookies?.[authService.REFRESH_COOKIE],
      res
    );
    success(res, session, 200, "Token refreshed");
  } catch (error) {
    if (error.statusCode === 401) {
      authService.clearRefreshCookie(res);
    }
    throw error;
  }
});

const logout = asyncHandler(async (req, res) => {
  await authService.revokeRefreshSession(
    req.cookies?.[authService.REFRESH_COOKIE]
  );
  authService.clearRefreshCookie(res);
  success(res, null, 200, "Đăng xuất thành công");
});

module.exports = {
  login,
  logout,
  refresh,
  register,
};
