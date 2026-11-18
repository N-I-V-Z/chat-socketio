const authService = require("../services/authService");
const auditLogService = require("../services/auditLogService");
const presenceService = require("../services/presenceService");
const redisConnection = require("../services/redisConnection");
const db = require("../models");
const { userRoom } = require("../utils/chatUtils");
const registerCallHandlers = require("./callHandlers");

function authError(code) {
  const error = new Error("Authentication required");
  error.data = { code };
  return error;
}

function registerSockets(io, { isReady, logger = console }) {
  const recordPresence = (eventType, userId, userName) => {
    void auditLogService
      .recordEvent({ eventType, actorUserId: userId, actorUserName: userName })
      .catch((error) => logger.error({ err: error }, "Presence audit failed"));
  };
  io.use(async (socket, next) => {
    if (!isReady() || !redisConnection.getClient()?.isReady)
      return next(authError("REALTIME_UNAVAILABLE"));
    const token = socket.handshake.auth?.token;
    if (!token) return next(authError("UNAUTHORIZED"));
    try {
      const auth = authService.verifyAccessToken(token);
      const user = await db.Users.findByPk(auth.userId, {
        attributes: ["userId", "userName", "role", "isActive"],
      });
      if (!user || user.isActive === false)
        return next(authError("INVALID_ACCESS_TOKEN"));
      Object.assign(socket.data, {
        userId: user.userId,
        userName: user.userName,
        role: user.role,
        accessTokenExpiresAt: auth.expiresAt,
      });
      return next();
    } catch (error) {
      if (error.name === "TokenExpiredError")
        return next(authError("ACCESS_TOKEN_EXPIRED"));
      if (error.name === "JsonWebTokenError")
        return next(authError("INVALID_ACCESS_TOKEN"));
      logger.error({ err: error }, "Socket authentication failed");
      return next(authError("AUTHENTICATION_UNAVAILABLE"));
    }
  });

  io.on("connection", (socket) => {
    const { userId, userName, accessTokenExpiresAt } = socket.data;
    socket.join(userRoom(userId));
    const connectPromise = presenceService
      .connect(userId, socket.id)
      .then((becameOnline) => {
        if (becameOnline)
          recordPresence(
            auditLogService.EVENT_TYPES.PRESENCE_CONNECTED,
            userId,
            userName,
          );
      })
      .catch((error) =>
        logger.error({ err: error }, "Presence connect failed"),
      );
    const expiryTimer = setTimeout(
      () => socket.disconnect(true),
      Math.min(
        Math.max(accessTokenExpiresAt * 1000 - Date.now(), 0),
        2_147_483_647,
      ),
    );
    const heartbeat = setInterval(() => {
      void presenceService
        .heartbeat(userId, socket.id)
        .catch((error) =>
          logger.error({ err: error }, "Presence heartbeat failed"),
        );
    }, 20000);
    heartbeat.unref?.();
    socket.use(async (_packet, next) => {
      try {
        if (Date.now() >= accessTokenExpiresAt * 1000) {
          socket.disconnect(true);
          return;
        }
        const user = await db.Users.findByPk(userId, {
          attributes: ["userId", "isActive"],
        });
        if (!user || user.isActive === false) {
          socket.disconnect(true);
          return;
        }
        return next();
      } catch (error) {
        return next(error);
      }
    });
    socket.on("disconnect", () => {
      clearTimeout(expiryTimer);
      clearInterval(heartbeat);
      void connectPromise
        .then(() => presenceService.disconnect(userId, socket.id))
        .then((becameOffline) => {
          if (becameOffline)
            recordPresence(
              auditLogService.EVENT_TYPES.PRESENCE_DISCONNECTED,
              userId,
              userName,
            );
        })
        .catch((error) =>
          logger.error({ err: error }, "Presence disconnect failed"),
        );
    });
    registerCallHandlers(io, socket);
  });
}

module.exports = registerSockets;
