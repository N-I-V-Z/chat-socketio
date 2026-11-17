const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CHAT_EVENTS_TOPIC,
  createChatEventPipeline,
} = require("../services/kafkaChatPipeline");

const outboxPayload = {
  eventId: "8a65ec09-f34b-41fd-9e4e-1d6652abdf20",
  conversationId: 55,
  messageId: 3,
  senderId: 7,
  recipientUserIds: [9],
};

function createPipelineFakes({ send } = {}) {
  const calls = { emits: [], marks: [], queries: [], sent: [] };
  const consumerHandlers = {};
  const db = {
    sequelize: {
      async query(sql, options) {
        calls.queries.push({ sql, options });
        if (sql.includes("WITH [PendingOutboxEvents]")) {
          return [
            {
              eventId: outboxPayload.eventId,
              eventType: "chat.message.created",
              payload: JSON.stringify(outboxPayload),
              attempts: 1,
            },
          ];
        }
        if (sql.includes("[publishedAt] = GETDATE()")) {
          calls.marks.push(options);
        }
        return [];
      },
    },
    Message: {
      async findByPk(messageId, options) {
        assert.equal(messageId, outboxPayload.messageId);
        assert.equal(options.include[0].as, "Sender");
        return {
          MessageId: messageId,
          ConversationId: outboxPayload.conversationId,
          SenderId: outboxPayload.senderId,
          MessageText: "hello",
          Timestamp: new Date("2026-01-02T03:04:05.000Z"),
          Sender: { userName: "nivz" },
        };
      },
    },
  };
  const kafka = {
    producer: () => ({
      async connect() {},
      async disconnect() {},
      async send(payload) {
        calls.sent.push(payload);
        if (send) await send(payload);
      },
    }),
    consumer: () => ({
      async connect() {},
      async disconnect() {},
      async subscribe(options) {
        consumerHandlers.subscription = options;
      },
      run(options) {
        consumerHandlers.eachMessage = options.eachMessage;
        return Promise.resolve();
      },
    }),
  };
  const io = {
    to(room) {
      return {
        emit(eventName, payload) {
          calls.emits.push({ room, eventName, payload });
        },
      };
    },
  };
  const logger = { error() {}, warn() {} };
  const pipeline = createChatEventPipeline({
    db,
    io,
    kafka,
    logger,
    pollIntervalMs: 60_000,
  });

  return { calls, consumerHandlers, pipeline };
}

test("outbox relay publishes acknowledged events and consumer fans them to user rooms", async () => {
  const { calls, consumerHandlers, pipeline } = createPipelineFakes();

  try {
    await pipeline.start();

    assert.equal(calls.sent.length, 1);
    assert.equal(calls.sent[0].topic, CHAT_EVENTS_TOPIC);
    assert.equal(calls.sent[0].messages[0].key, "55");
    assert.deepEqual(JSON.parse(calls.sent[0].messages[0].value), {
      ...outboxPayload,
      eventType: "chat.message.created",
    });
    assert.equal(calls.marks.length, 1);
    assert.equal(calls.marks[0].replacements.eventId, outboxPayload.eventId);

    await consumerHandlers.eachMessage({
      message: {
        value: Buffer.from(
          JSON.stringify({
            ...outboxPayload,
            eventType: "chat.message.created",
          }),
        ),
      },
    });

    assert.deepEqual(
      calls.emits.map(({ room, eventName }) => [room, eventName]),
      [
        ["user:7", "receiveMessage"],
        ["user:9", "receiveMessage"],
      ],
    );
    assert.deepEqual(calls.emits[0].payload, {
      senderId: 7,
      receiverId: 9,
      conversationId: 55,
      messageId: 3,
      message: "hello",
      timestamp: new Date("2026-01-02T03:04:05.000Z"),
      senderName: "nivz",
      eventId: outboxPayload.eventId,
    });
  } finally {
    await pipeline.stop();
  }
});

test("outbox failures release the claim and schedule bounded retries", async () => {
  const { calls, pipeline } = createPipelineFakes({
    send: async () => {
      throw Object.assign(new Error("broker unavailable"), { code: "E_KAFKA" });
    },
  });

  await pipeline.relayPendingEvents();

  const retry = calls.queries.find(({ sql }) =>
    sql.includes("[nextAttemptAt] = DATEADD"),
  );
  assert.ok(retry);
  assert.equal(retry.options.replacements.eventId, outboxPayload.eventId);
  assert.equal(retry.options.replacements.delaySeconds, 1);
  assert.equal(retry.options.replacements.lastErrorCode, "E_KAFKA");
  assert.equal(calls.marks.length, 0);
});
