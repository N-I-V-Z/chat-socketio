const assert = require("node:assert/strict");
const test = require("node:test");
const http = require("node:http");
const { once } = require("node:events");
const { Server } = require("socket.io");
const { io: connect } = require("socket.io-client");
const createApp = require("../app");
const registerSockets = require("../sockets");
const authService = require("../services/authService");
const db = require("../models");
const redisConnection = require("../services/redisConnection");
const presence = require("../services/presenceService");
const audit = require("../services/auditLogService");
const calls = require("../services/callSessionService");
const rateLimiter = require("../services/rateLimiter");

test("real Socket.IO handshake rejects inactive users and signaling validates call access", async () => {
  const priorSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET =
    "integration-secret-at-least-thirty-two-bytes";
  const original = {
    findByPk: db.Users.findByPk,
    getClient: redisConnection.getClient,
    connect: presence.connect,
    disconnect: presence.disconnect,
    heartbeat: presence.heartbeat,
    recordEvent: audit.recordEvent,
    authorizeSignal: calls.authorizeSignal,
    allow: rateLimiter.allow,
  };
  db.Users.findByPk = async (id) => ({
    userId: Number(id),
    userName: `user-${id}`,
    role: "user",
    isActive: Number(id) !== 3,
  });
  redisConnection.getClient = () => ({ isReady: true });
  presence.connect = async () => true;
  presence.disconnect = async () => true;
  presence.heartbeat = async () => 1;
  audit.recordEvent = async () => null;
  calls.authorizeSignal = async () => {
    throw Object.assign(new Error("forbidden"), { code: "CALL_FORBIDDEN" });
  };
  rateLimiter.allow = async () => true;
  const app = createApp({ readiness: async () => true });
  const server = http.createServer(app);
  const io = new Server(server);
  registerSockets(io, { isReady: () => true, logger: { error() {} } });
  const clients = [];
  try {
    server.listen(0);
    await once(server, "listening");
    const url = `http://127.0.0.1:${server.address().port}`;
    const open = (id) => {
      const socket = connect(url, {
        transports: ["websocket"],
        reconnection: false,
        auth: { token: authService.signAccessToken({ userId: id }) },
      });
      clients.push(socket);
      return socket;
    };
    const active = open(1);
    await once(active, "connect");
    const inactive = open(3);
    const [failure] = await once(inactive, "connect_error");
    assert.equal(failure.data.code, "INVALID_ACCESS_TOKEN");
    const reply = await active.emitWithAck("offer", {
      to: 2,
      callId: "8a65ec09-f34b-41fd-9e4e-1d6652abdf20",
      offer: { type: "offer", sdp: "v=0" },
    });
    assert.deepEqual(reply, { ok: false, code: "CALL_FORBIDDEN" });
  } finally {
    for (const socket of clients) socket.disconnect();
    await new Promise((resolve) => io.close(resolve));
    db.Users.findByPk = original.findByPk;
    redisConnection.getClient = original.getClient;
    presence.connect = original.connect;
    presence.disconnect = original.disconnect;
    presence.heartbeat = original.heartbeat;
    audit.recordEvent = original.recordEvent;
    calls.authorizeSignal = original.authorizeSignal;
    rateLimiter.allow = original.allow;
    if (priorSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = priorSecret;
  }
});
