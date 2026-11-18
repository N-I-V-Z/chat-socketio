const assert = require("node:assert/strict");
const test = require("node:test");
const calls = require("../services/callSessionService");
const registerCallHandlers = require("../sockets/callHandlers");

test("call signaling rejects malformed payloads without forwarding", async () => {
  const handlers = new Map();
  const events = [];
  const socket = {
    id: "socket-1",
    data: { userId: 1, userName: "one" },
    on: (name, fn) => handlers.set(name, fn),
  };
  const io = {
    to: (room) => ({ emit: (name, data) => events.push({ room, name, data }) }),
  };
  registerCallHandlers(io, socket);
  let reply;
  await handlers.get("offer")(
    { to: 2, callId: "bad", offer: { type: "offer", sdp: "x" } },
    (value) => {
      reply = value;
    },
  );
  assert.deepEqual(reply, { ok: false, code: "INVALID_PAYLOAD" });
  assert.equal(events.length, 0);
});

test("call signaling checks session membership before forwarding", async () => {
  const original = calls.authorizeSignal;
  const handlers = new Map();
  const events = [];
  calls.authorizeSignal = async () => {
    throw Object.assign(new Error("forbidden"), { code: "CALL_FORBIDDEN" });
  };
  try {
    registerCallHandlers(
      { to: (room) => ({ emit: (name) => events.push([room, name]) }) },
      {
        id: "socket-1",
        data: { userId: 1 },
        on: (name, fn) => handlers.set(name, fn),
      },
    );
    let reply;
    await handlers.get("offer")(
      {
        to: 2,
        callId: "8a65ec09-f34b-41fd-9e4e-1d6652abdf20",
        offer: { type: "offer", sdp: "v=0" },
      },
      (value) => {
        reply = value;
      },
    );
    assert.deepEqual(reply, { ok: false, code: "CALL_FORBIDDEN" });
    assert.equal(events.length, 0);
  } finally {
    calls.authorizeSignal = original;
  }
});
