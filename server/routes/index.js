const userRouter = require('./userRouter');
const messageRouter = require('./messageRouter');
const initRouters = (app) => {
  
  app.use("/api/v1/user", userRouter);
  app.use("/api/v1/message", messageRouter);

  app.get("/", (req, res) => {
    res.send("Server on");
  });

  return app;
};

module.exports = initRouters;
