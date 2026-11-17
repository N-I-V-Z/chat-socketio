const userRouter = require("./userRouter");
const authRouter = require("./authRouter");
const messageRouter = require("./messageRouter");
const conversationRouter = require("./conversationRouter");
const adminRouter = require("./adminRouter");
const { success } = require("../utils/apiResponse");
const initRouters = (app) => {
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/messages", messageRouter);
  app.use("/api/v1/conversations", conversationRouter);
  app.use("/api/v1/admin", adminRouter);

  app.get("/", (req, res) => {
    success(res, { status: "ok" }, 200, "Server is running");
  });

  return app;
};

module.exports = initRouters;
