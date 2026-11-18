const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const initRouters = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const { failure } = require("./utils/apiResponse");

function createApp({ io, readiness } = {}) {
  const app = express();
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  if (io) app.set("io", io);
  app.use(express.static(path.resolve(__dirname, "public")));
  app.use(
    cors({
      origin: clientUrl,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.get("/livez", (_req, res) => res.status(200).json({ status: "alive" }));
  app.get("/readyz", async (_req, res) => {
    const ready = readiness ? await readiness() : false;
    res
      .status(ready ? 200 : 503)
      .json({ status: ready ? "ready" : "unavailable" });
  });
  initRouters(app);
  app.use((_req, res) =>
    failure(res, 404, "ROUTE_NOT_FOUND", "Route not found"),
  );
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
