const { Kafka } = require("kafkajs");
const { QueryTypes } = require("sequelize");
const OUTBOX_EVENT_TYPES = require("../constants/outboxEventTypes");

const CHAT_EVENTS_TOPIC = "chat.events";
const OUTBOX_BATCH_SIZE = 25;
const OUTBOX_LEASE_SECONDS = 30;
const MAX_RETRY_DELAY_SECONDS = 300;

function userRoom(userId) {
  return `user:${userId}`;
}

function parseUserId(value) {
  const userId = Number(value);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

function errorCode(error) {
  const code = error?.code || error?.name || "UNKNOWN";
  return String(code).slice(0, 100);
}

function createChatEventPipeline({
  db,
  io,
  kafka,
  logger = console,
  pollIntervalMs = 1000,
  brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean),
  groupId = process.env.KAFKA_CONSUMER_GROUP || "chat-notifications-v1",
} = {}) {
  if (!db || !io) {
    throw new Error("Chat event pipeline requires database and Socket.IO.");
  }

  const kafkaClient =
    kafka ||
    new Kafka({
      clientId: "chat-socketio",
      brokers,
    });
  const producer = kafkaClient.producer();
  const consumer = kafkaClient.consumer({ groupId });
  let producerConnected = false;
  let consumerConnected = false;
  let timer = null;
  let tickInProgress = false;
  let unavailableWarningLogged = false;

  async function claimPendingEvents() {
    return db.sequelize.query(
      `WITH [PendingOutboxEvents] AS (
        SELECT TOP (${OUTBOX_BATCH_SIZE}) [eventId], [eventType], [payload],
          [claimedUntil], [attempts]
        FROM [dbo].[OutboxEvents] WITH (UPDLOCK, READPAST, ROWLOCK)
        WHERE [publishedAt] IS NULL
          AND [nextAttemptAt] <= GETDATE()
          AND ([claimedUntil] IS NULL OR [claimedUntil] <= GETDATE())
        ORDER BY [createdAt], [eventId]
      )
      UPDATE [PendingOutboxEvents]
      SET [claimedUntil] = DATEADD(SECOND, :leaseSeconds, GETDATE()),
          [attempts] = [attempts] + 1
      OUTPUT INSERTED.[eventId], INSERTED.[eventType], INSERTED.[payload],
        INSERTED.[attempts];`,
      {
        replacements: { leaseSeconds: OUTBOX_LEASE_SECONDS },
        type: QueryTypes.SELECT,
      },
    );
  }

  async function markPublished(eventId) {
    await db.sequelize.query(
      `UPDATE [dbo].[OutboxEvents]
      SET [publishedAt] = GETDATE(), [claimedUntil] = NULL, [lastErrorCode] = NULL
      WHERE [eventId] = :eventId AND [publishedAt] IS NULL;`,
      { replacements: { eventId }, type: QueryTypes.UPDATE },
    );
  }

  async function scheduleRetry(event, error) {
    const attempts = Math.max(1, Number(event.attempts) || 1);
    const delaySeconds = Math.min(
      2 ** Math.min(attempts - 1, 8),
      MAX_RETRY_DELAY_SECONDS,
    );
    const code = errorCode(error);
    await db.sequelize.query(
      `UPDATE [dbo].[OutboxEvents]
      SET [nextAttemptAt] = DATEADD(SECOND, :delaySeconds, GETDATE()),
          [claimedUntil] = NULL,
          [lastErrorCode] = :lastErrorCode
      WHERE [eventId] = :eventId AND [publishedAt] IS NULL;`,
      {
        replacements: {
          delaySeconds,
          eventId: event.eventId,
          lastErrorCode: code,
        },
        type: QueryTypes.UPDATE,
      },
    );
    logger.warn(`Kafka outbox delivery deferred (${code}).`);
  }

  async function relayPendingEvents() {
    const events = await claimPendingEvents();
    for (const event of events) {
      try {
        const payload = JSON.parse(event.payload);
        const conversationId = parseUserId(payload.conversationId);
        if (!conversationId || payload.eventId !== event.eventId) {
          throw Object.assign(new Error("Invalid outbox payload"), {
            code: "INVALID_OUTBOX_PAYLOAD",
          });
        }
        await producer.send({
          topic: CHAT_EVENTS_TOPIC,
          messages: [
            {
              key: String(conversationId),
              value: JSON.stringify({ ...payload, eventType: event.eventType }),
            },
          ],
        });
        await markPublished(event.eventId);
      } catch (error) {
        try {
          await scheduleRetry(event, error);
        } catch (retryError) {
          logger.error(
            `Could not schedule Kafka outbox retry (${errorCode(retryError)}).`,
          );
        }
      }
    }
  }

  async function consumeMessage(value) {
    let event;
    try {
      if (!value || typeof value.toString !== "function") {
        throw new Error("Missing Kafka message value");
      }
      event = JSON.parse(value.toString());
    } catch {
      logger.warn("Ignoring malformed Kafka chat event.");
      return;
    }

    if (!event || typeof event !== "object" || Array.isArray(event)) {
      logger.warn("Ignoring invalid Kafka chat event.");
      return;
    }

    const messageId = parseUserId(event.messageId);
    const conversationId = parseUserId(event.conversationId);
    const senderId = parseUserId(event.senderId);
    const recipientUserIds = Array.isArray(event.recipientUserIds)
      ? [...new Set(event.recipientUserIds.map(parseUserId).filter(Boolean))]
      : [];
    if (
      event.eventType !== OUTBOX_EVENT_TYPES.CHAT_MESSAGE_CREATED ||
      typeof event.eventId !== "string" ||
      !messageId ||
      !conversationId ||
      !senderId
    ) {
      logger.warn("Ignoring invalid Kafka chat event.");
      return;
    }

    const message = await db.Message.findByPk(messageId, {
      attributes: [
        "MessageId",
        "ConversationId",
        "SenderId",
        "MessageText",
        "Timestamp",
      ],
      include: [
        {
          model: db.Users,
          as: "Sender",
          attributes: ["userName"],
        },
      ],
    });
    if (!message) return;

    const plainMessage =
      typeof message.get === "function"
        ? message.get({ plain: true })
        : message;
    if (
      Number(plainMessage.ConversationId) !== conversationId ||
      Number(plainMessage.SenderId) !== senderId
    ) {
      logger.warn("Ignoring mismatched Kafka chat event.");
      return;
    }

    const receiverId =
      recipientUserIds.find((userId) => userId !== senderId) ?? senderId;
    const messageEvent = {
      senderId,
      receiverId,
      conversationId,
      messageId,
      message: plainMessage.MessageText,
      timestamp: plainMessage.Timestamp,
      senderName: plainMessage.Sender?.userName,
      eventId: event.eventId,
    };
    const targetUserIds = new Set([senderId, ...recipientUserIds]);
    for (const userId of targetUserIds) {
      io.to(userRoom(userId)).emit("receiveMessage", messageEvent);
    }
  }

  async function ensureKafkaConnected() {
    if (!consumerConnected) {
      await consumer.connect();
      await consumer.subscribe({
        topic: CHAT_EVENTS_TOPIC,
        fromBeginning: false,
      });
      const runPromise = consumer.run({
        eachMessage: async ({ message }) => {
          await consumeMessage(message.value);
        },
      });
      runPromise.catch((error) => {
        consumerConnected = false;
        logger.error(`Kafka consumer stopped (${errorCode(error)}).`);
      });
      consumerConnected = true;
    }
    if (!producerConnected) {
      await producer.connect();
      producerConnected = true;
    }
  }

  async function tick() {
    if (tickInProgress) return;
    tickInProgress = true;
    try {
      await ensureKafkaConnected();
      unavailableWarningLogged = false;
      await relayPendingEvents();
    } catch (error) {
      if (!unavailableWarningLogged) {
        logger.warn(`Kafka pipeline unavailable (${errorCode(error)}).`);
        unavailableWarningLogged = true;
      }
    } finally {
      tickInProgress = false;
    }
  }

  async function start() {
    if (timer) return;
    timer = setInterval(() => {
      void tick();
    }, pollIntervalMs);
    timer.unref?.();
    await tick();
  }

  async function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    const disconnects = [];
    if (producerConnected) disconnects.push(producer.disconnect());
    if (consumerConnected) disconnects.push(consumer.disconnect());
    producerConnected = false;
    consumerConnected = false;
    await Promise.all(disconnects);
  }

  return { consumeMessage, relayPendingEvents, start, stop };
}

module.exports = {
  CHAT_EVENTS_TOPIC,
  createChatEventPipeline,
};
