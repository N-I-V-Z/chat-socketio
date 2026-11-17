const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const test = require("node:test");
const authRateLimiters = require("../middleware/authRateLimiter");

function post(origin, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      `${origin}${path}`,
      { method: "POST", headers },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      },
    );
    request.on("error", reject);
    request.end();
  });
}

test("auth endpoints have isolated limits and successful logins do not count", async () => {
  const app = express();
  app.post("/login", authRateLimiters.login, (req, res) => {
    res.sendStatus(req.headers["x-login-failure"] ? 401 : 200);
  });
  app.post("/register", authRateLimiters.register, (_req, res) => {
    res.sendStatus(400);
  });
  app.post("/refresh", authRateLimiters.refresh, (_req, res) => {
    res.sendStatus(401);
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;

  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.equal(await post(origin, "/register"), 400);
    }
    assert.equal(await post(origin, "/register"), 429);

    for (let attempt = 0; attempt < 12; attempt += 1) {
      assert.equal(await post(origin, "/login"), 200);
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      assert.equal(await post(origin, "/refresh"), 401);
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.equal(
        await post(origin, "/login", { "x-login-failure": "true" }),
        401,
      );
    }

    assert.equal(
      await post(origin, "/login", { "x-login-failure": "true" }),
      429,
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
