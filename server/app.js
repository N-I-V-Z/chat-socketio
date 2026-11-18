const path = require("node:path");
const { timingSafeEqual } = require("node:crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const initRouters = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const { failure } = require("./utils/apiResponse");
const metrics = require("./services/metrics");
const logger = require("./services/logger");
const writeRateLimiter = require("./middleware/writeRateLimiter");

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
  app.use((req, res, next) => {
    req.requestId =
      req.get("x-request-id") || require("node:crypto").randomUUID();
    res.setHeader("x-request-id", req.requestId);
    const started = Date.now();
    res.on("finish", () =>
      logger.info(
        {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Date.now() - started,
        },
        "HTTP request",
      ),
    );
    next();
  });
  app.get("/metrics", async (req, res, next) => {
    const token = process.env.METRICS_TOKEN;
    if (!token) return res.sendStatus(404);
    const supplied = (req.get("authorization") || "").replace(/^Bearer /, "");
    const actual = Buffer.from(supplied);
    const expected = Buffer.from(token);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return res.sendStatus(401);
    try {
      if (readiness) await readiness();
      res
        .type(metrics.register.contentType)
        .send(await metrics.register.metrics());
    } catch (error) {
      next(error);
    }
  });
  app.get("/livez", (_req, res) => res.status(200).json({ status: "alive" }));
  app.get("/readyz", async (_req, res) => {
    const ready = readiness ? await readiness() : false;
    res
      .status(ready ? 200 : 503)
      .json({ status: ready ? "ready" : "unavailable" });
  });
  app.use("/api/v1", writeRateLimiter);
  initRouters(app);
  app.use((_req, res) =>
    failure(res, 404, "ROUTE_NOT_FOUND", "Route not found"),
  );
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
