const userService = require("../services/userService");

const getUserByUserId = async (req, res) => {
  try {
    const { userId } = req.body;
    const response = await userService.getUserByUserId(userId);

    res
      .status(response ? 200 : 404)
      .send({ err: response ? 0 : 1, data: response ?? null });
  } catch (error) {
    console.log("Internal server error:", error);
    res.status(500).send("Internal server error"); // Status 500 for internal server error
  }
};

const getAll = async (req, res) => {
  try {
    const { userId } = req.body;
    const response = await userService.getAll(userId);

    res
      .status(response ? 200 : 404)
      .send({ err: response ? 0 : 1, data: response ?? null });
  } catch (error) {
    console.log("Internal server error:", error);
    res.status(500).send("Internal server error"); // Status 500 for internal server error
  }
};

const login = async (req, res) => {
  try {
    const { userName, password } = req.body;
    const response = await userService.login(userName, password);
    if (response !== null) {
      res
        .status(200)
        .send({ err: 0, data: response, mes: "Đăng nhập thành công" });
    } else {
      res.status(404).send({ err: 1, data: null, mes: "Đăng nhập thất bại" });
    }
  } catch (error) {
    console.log("Internal server error:", error);
    res.status(500).send("Internal server error"); // Status 500 for internal server error
  }
};

const register = async (req, res) => {
  try {
    const { userName, password } = req.body;
    const checkUserName = await userService.checkUserName(userName);
    if (checkUserName === null) {
      const response = await userService.register(userName, password);
      if (response !== null) {
        res
          .status(200)
          .send({ err: 0, data: response, mes: "Đăng kí thành công" });
      } else {
        res.status(500).send({ err: 1, data: null, mes: "Đăng kí thất bại" });
      }
    } else
      res.status(500).send({ err: 1, data: null, mes: "Tài khoản đã tồn tại" });
  } catch (error) {
    console.log("Internal server error:", error);
    res.status(500).send("Internal server error"); // Status 500 for internal server error
  }
};

module.exports = {
  login,
  register,
  getAll,
  getUserByUserId,
};
