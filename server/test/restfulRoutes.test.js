const assert = require("node:assert/strict");
const test = require("node:test");
const authRouter = require("../routes/authRouter");
const conversationRouter = require("../routes/conversationRouter");
const messageRouter = require("../routes/messageRouter");
const userRouter = require("../routes/userRouter");

function routeSignatures(router) {
  return router.stack.flatMap((layer) => {
    if (!layer.route) return [];
    return Object.entries(layer.route.methods)
      .filter(([, enabled]) => enabled)
      .map(([method]) => `${method.toUpperCase()} ${layer.route.path}`);
  });
}

test("API routes use resource paths and HTTP methods for reads and writes", () => {
  assert.deepEqual(routeSignatures(authRouter), [
    "POST /login",
    "POST /register",
    "POST /refresh",
    "POST /logout",
  ]);
  assert.deepEqual(routeSignatures(userRouter), ["GET /", "GET /me"]);
  assert.deepEqual(routeSignatures(messageRouter), ["GET /", "POST /"]);
  assert.deepEqual(routeSignatures(conversationRouter), [
    "PUT /direct/:otherUserId",
    "GET /unread-summary",
    "GET /:conversationId/messages",
    "POST /:conversationId/messages",
    "PUT /:conversationId/read-receipt",
  ]);
});
