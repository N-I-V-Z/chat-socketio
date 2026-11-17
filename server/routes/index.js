const userRouter = require("./userRouter");
const messageRouter = require("./messageRouter");
const conversationRouter = require("./conversationRouter");
const adminRouter = require("./adminRouter");
const { success } = require("../utils/apiResponse");
const initRouters = (app) => {
  app.use("/api/v1/user", userRouter);
  app.use("/api/v1/message", messageRouter);
  app.use("/api/v1/conversations", conversationRouter);
  app.use("/api/v1/admin", adminRouter);

  app.get("/", (req, res) => {
    success(res, { status: "ok" }, 200, "Server is running");
  });

  return app;
};

module.exports = initRouters;
