const assert = require("node:assert/strict");
const test = require("node:test");
const createApp = require("../app");

test("liveness stays available while readiness reports dependency state", async () => {
  let ready = false;
  const server = createApp({ readiness: async () => ready }).listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/livez`)).status, 200);
    assert.equal((await fetch(`${base}/readyz`)).status, 503);
    ready = true;
    assert.equal((await fetch(`${base}/readyz`)).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("metrics require a bearer token when enabled", async () => {
  const previous = process.env.METRICS_TOKEN;
  process.env.METRICS_TOKEN = "test-metrics-secret";
  const server = createApp().listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/metrics`)).status, 401);
    const response = await fetch(`${base}/metrics`, {
      headers: { authorization: "Bearer test-metrics-secret" },
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /chat_socket_connections/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previous === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = previous;
  }
});
