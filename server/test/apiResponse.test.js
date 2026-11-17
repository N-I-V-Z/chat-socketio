const assert = require("node:assert/strict");
const test = require("node:test");
const { failure, success } = require("../utils/apiResponse");

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("success responses use the standard envelope", () => {
  const res = createResponse();
  success(res, { userId: 7 }, 201, "Created");

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, {
    success: true,
    data: { userId: 7 },
    message: "Created",
  });
});

test("error responses use the standard envelope", () => {
  const res = createResponse();
  failure(res, 401, "UNAUTHORIZED", "Authentication required");

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    success: false,
    data: null,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required",
    },
  });
});
