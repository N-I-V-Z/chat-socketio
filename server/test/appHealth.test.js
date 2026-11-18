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
