const { z } = require("zod");
const calls = require("../services/callSessionService");
const { userRoom } = require("../utils/chatUtils");

const userId = z.coerce.number().int().positive().safe();
const callId = z.string().uuid();
const target = z.object({ callId, to: userId }).strict();
const request = z.object({ to: userId, video: z.boolean() }).strict();
const description = (type) =>
  z.object({ type: z.literal(type), sdp: z.string().max(32768) }).passthrough();
const offer = target.extend({ offer: description("offer") });
const answer = target.extend({ answer: description("answer") });
const candidate = target.extend({
  iceCandidate: z
    .object({
      candidate: z.string().max(4096),
      sdpMid: z.string().nullable().optional(),
      sdpMLineIndex: z.number().int().nonnegative().nullable().optional(),
      usernameFragment: z.string().nullable().optional(),
    })
    .passthrough(),
});

function registerCallHandlers(io, socket) {
  const actor = socket.data.userId;
  const send = (to, event, payload) => io.to(userRoom(to)).emit(event, payload);
  const handle = (name, schema, action) => {
    socket.on(name, async (payload, ack) => {
      try {
        const parsed = schema.safeParse(payload);
        if (!parsed.success)
          throw Object.assign(new Error("Invalid payload"), {
            code: "INVALID_PAYLOAD",
          });
        const result = await action(parsed.data);
        if (typeof ack === "function") ack({ ok: true, ...result });
      } catch (error) {
        if (typeof ack === "function")
          ack({ ok: false, code: error.code || "CALL_UNAVAILABLE" });
      }
    });
  };
  handle("videoCallRequest", request, async ({ to, video }) => {
    const session = await calls.request(actor, to, socket.id, video);
    send(to, "videoCallRequest", {
      from: actor,
      name: socket.data.userName,
      video,
      callId: session.id,
    });
    return { callId: session.id };
  });
  handle("callAccepted", target, async ({ callId: id, to }) => {
    if (to !== (await calls.get(id)).from)
      throw Object.assign(new Error("Wrong recipient"), {
        code: "CALL_FORBIDDEN",
      });
    const session = await calls.transition(id, actor, socket.id, "accept");
    send(to, "callAccepted", { from: actor, video: session.video, callId: id });
  });
  handle("callRejected", target, async ({ callId: id, to }) => {
    if (to !== (await calls.get(id)).from)
      throw Object.assign(new Error("Wrong recipient"), {
        code: "CALL_FORBIDDEN",
      });
    const session = await calls.transition(id, actor, socket.id, "reject");
    send(to, "callRejected", { callId: id });
  });
  handle("callEnded", target, async ({ callId: id, to }) => {
    const current = await calls.get(id);
    if (to !== (current.from === actor ? current.to : current.from))
      throw Object.assign(new Error("Wrong recipient"), {
        code: "CALL_FORBIDDEN",
      });
    const session = await calls.transition(id, actor, socket.id, "end");
    send(to, "callEnded", { callId: id });
  });
  for (const [name, schema, field] of [
    ["offer", offer, "offer"],
    ["answer", answer, "answer"],
    ["ice-candidate", candidate, "iceCandidate"],
  ]) {
    handle(name, schema, async (data) => {
      await calls.authorizeSignal(data.callId, actor, socket.id, data.to);
      send(data.to, name, { callId: data.callId, [field]: data[field] });
    });
  }
  socket.on("disconnect", () => {
    calls
      .endForSocket(socket.id, actor)
      .then((session) => {
        if (session)
          send(
            session.from === actor ? session.to : session.from,
            "callEnded",
            { callId: session.id },
          );
      })
      .catch(() => {});
  });
}

module.exports = registerCallHandlers;
