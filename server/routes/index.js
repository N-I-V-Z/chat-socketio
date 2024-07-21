const chatRouter = require("./chatRouter");
const userRouter = require('./userRouter');
const initRouters = (app) => {
  
  app.use("/api/v1/chat", chatRouter);

  app.use("/api/v1/user", userRouter);

  app.get("/", (req, res) => {
    res.send("Server on");
  });

  return app;
};

module.exports = initRouters;
