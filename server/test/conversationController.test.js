const assert = require("node:assert/strict");
const test = require("node:test");
const conversationController = require("../controller/conversationController");
const readReceiptService = require("../services/readReceiptService");

function replace(target, key, value) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

function invoke(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      status(status) {
        this.statusCode = status;
        return this;
      },
      json(body) {
        resolve({ statusCode: this.statusCode, body });
      },
    };
    handler(req, res, reject);
  });
}

test("mark-read emits conversation state to other participants only", async () => {
  const emitted = [];
  const restores = [
    replace(readReceiptService, "markConversationRead", async (...args) => {
      assert.deepEqual(args, [7, 55, 18]);
      return {
        conversationId: 55,
        upToMessageId: 18,
        readerId: 7,
        participantUserIds: [7, 9, 10],
        readAt: new Date("2026-01-02T03:04:05Z"),
      };
    }),
  ];

  try {
    const response = await invoke(conversationController.markConversationRead, {
      auth: { userId: 7 },
      params: { conversationId: "55" },
      body: { upToMessageId: 18 },
      app: {
        get(name) {
          assert.equal(name, "io");
          return {
            to(room) {
              return {
                emit(eventName, payload) {
                  emitted.push({ room, eventName, payload });
                },
              };
            },
          };
        },
      },
    });

    assert.deepEqual(
      emitted.map(({ room, eventName }) => [room, eventName]),
      [
        ["user:9", "conversationRead"],
        ["user:10", "conversationRead"],
      ],
    );
    assert.deepEqual(response.body.data, {
      conversationId: 55,
      upToMessageId: 18,
      readAt: new Date("2026-01-02T03:04:05Z"),
    });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("unread summary returns data for the authenticated user", async () => {
  const restore = replace(
    readReceiptService,
    "getUnreadSummary",
    async (userId) => [
      { conversationId: 55, peerUserId: userId, unreadCount: 2 },
    ],
  );
  try {
    const response = await invoke(conversationController.getUnreadSummary, {
      auth: { userId: 9 },
    });
    assert.deepEqual(response.body.data, [
      { conversationId: 55, peerUserId: 9, unreadCount: 2 },
    ]);
  } finally {
    restore();
  }
});
