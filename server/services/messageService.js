const { randomUUID } = require("node:crypto");
const { Op } = require("sequelize");
const db = require("../models");
const OUTBOX_EVENT_TYPES = require("../constants/outboxEventTypes");
const auditLogService = require("./auditLogService");
const cacheService = require("./cacheService");
const conversationService = require("./conversationService");
const { conversationKey, conversationPageKey } = require("./cacheKeys");
const httpError = require("../utils/httpError");

const MESSAGE_HISTORY_TTL_SECONDS = 30;
const MESSAGE_PAGE_SIZE = 30;

function toPlainMessage(message) {
  return typeof message.get === "function"
    ? message.get({ plain: true })
    : message;
}

async function recordMessageCreated({
  conversationId,
  messageId,
  senderId,
  recipientUserIds,
  transaction,
}) {
  const eventId = randomUUID();
  const payload = {
    eventId,
    conversationId: Number(conversationId),
    messageId: Number(messageId),
    senderId: Number(senderId),
    recipientUserIds: [...new Set(recipientUserIds.map(Number))].filter(
      (userId) => userId !== Number(senderId),
    ),
  };

  await db.MessageReadReceipt.create(
    { MessageId: messageId, UserId: senderId },
    { transaction },
  );
  await db.OutboxEvent.create(
    {
      eventId,
      eventType: OUTBOX_EVENT_TYPES.CHAT_MESSAGE_CREATED,
      payload: JSON.stringify(payload),
    },
    { transaction },
  );
}

/**
 * Hàm helper duy nhất xử lý trọn gói transaction, tạo tin nhắn, outbox, audit log và cache invalidation.
 */
async function sendMessageInTransaction({
  senderId,
  receiverId,
  conversationId,
  message,
}) {
  const result = await db.sequelize.transaction(async (transaction) => {
    let resolvedConversationId = conversationId;
    let resolvedReceiverId = receiverId;

    if (!resolvedConversationId) {
      const conversation =
        await conversationService.getOrCreateDirectConversation(
          senderId,
          resolvedReceiverId,
          { transaction },
        );
      resolvedConversationId = conversation.conversationId;
    } else {
      const participants = await db.ConversationParticipant.findAll({
        attributes: ["userId"],
        where: { conversationId: resolvedConversationId },
        order: [["userId", "ASC"]],
        transaction,
      });
      const participantIds = participants.map(({ userId }) => Number(userId));

      if (!participantIds.includes(Number(senderId))) {
        throw httpError(
          404,
          "CONVERSATION_NOT_FOUND",
          "Conversation not found",
        );
      }
      if (participantIds.length < 1 || participantIds.length > 2) {
        throw httpError(
          409,
          "GROUP_MESSAGES_UNSUPPORTED",
          "Group messaging is not available",
        );
      }

      resolvedReceiverId =
        participantIds.find((userId) => userId !== Number(senderId)) ??
        Number(senderId);
    }

    const savedMessage = await db.Message.create(
      {
        ConversationId: resolvedConversationId,
        SenderId: senderId,
        MessageText: message,
      },
      { transaction },
    );

    const allParticipants = await db.ConversationParticipant.findAll({
      attributes: ["userId"],
      where: { conversationId: resolvedConversationId },
      transaction,
    });
    const participantUserIds = allParticipants.map((p) => Number(p.userId));

    await recordMessageCreated({
      conversationId: resolvedConversationId,
      messageId: savedMessage.MessageId,
      senderId,
      recipientUserIds:
        participantUserIds.length > 0
          ? participantUserIds
          : [resolvedReceiverId],
      transaction,
    });

    await auditLogService.recordEvent(
      {
        eventType: auditLogService.EVENT_TYPES.MESSAGE_SENT,
        actorUserId: senderId,
        targetUserId: resolvedReceiverId,
      },
      { transaction },
    );

    return {
      savedMessage,
      conversationId: resolvedConversationId,
      receiverId: resolvedReceiverId,
    };
  });

  await Promise.all([
    cacheService.invalidate(conversationPageKey(result.conversationId)),
    cacheService.invalidate(conversationKey(senderId, result.receiverId)),
  ]);

  return result.savedMessage;
}

async function getMessagePage(userId, conversationId, beforeMessageId = null) {
  const membership = await db.ConversationParticipant.findOne({
    attributes: ["conversationId"],
    where: { conversationId, userId },
  });
  if (!membership) {
    throw httpError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
  }

  const page = await cacheService.getOrLoad(
    conversationPageKey(conversationId, beforeMessageId),
    MESSAGE_HISTORY_TTL_SECONDS,
    async () => {
      const where = { ConversationId: conversationId };
      if (beforeMessageId !== null) {
        where.MessageId = { [Op.lt]: beforeMessageId };
      }

      const rows = await db.Message.findAll({
        attributes: [
          "MessageId",
          "ConversationId",
          "SenderId",
          "MessageText",
          "Timestamp",
        ],
        where,
        order: [["MessageId", "DESC"]],
        limit: MESSAGE_PAGE_SIZE + 1,
      });
      const hasMore = rows.length > MESSAGE_PAGE_SIZE;
      const items = rows
        .slice(0, MESSAGE_PAGE_SIZE)
        .reverse()
        .map(toPlainMessage);

      return {
        items,
        hasMore,
        nextCursor:
          hasMore && items.length > 0 ? Number(items[0].MessageId) : null,
      };
    },
  );

  if (page.items.length === 0) return page;

  const receipts = await db.MessageReadReceipt.findAll({
    attributes: ["MessageId", "UserId", "readAt"],
    where: { MessageId: page.items.map(({ MessageId }) => MessageId) },
    raw: true,
  });
  const receiptsByMessageId = new Map();
  for (const receipt of receipts) {
    const key = String(receipt.MessageId);
    const messageReceipts = receiptsByMessageId.get(key) || [];
    messageReceipts.push({
      UserId: receipt.UserId,
      readAt: receipt.readAt,
    });
    receiptsByMessageId.set(key, messageReceipts);
  }

  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      readReceipts: receiptsByMessageId.get(String(item.MessageId)) || [],
    })),
  };
}

const messageService = {
  MESSAGE_PAGE_SIZE,

  addMessageToConversation: async (senderId, conversationId, message) => {
    return sendMessageInTransaction({
      senderId,
      conversationId,
      message,
    });
  },

  getAllMessageOfRoom: async (userId, receiverId) => {
    const conversation =
      await conversationService.getOrCreateDirectConversation(
        userId,
        receiverId,
      );

    return cacheService.getOrLoad(
      conversationKey(userId, receiverId),
      MESSAGE_HISTORY_TTL_SECONDS,
      () =>
        db.Message.findAll({
          where: { ConversationId: conversation.conversationId },
          order: [
            ["Timestamp", "ASC"],
            ["MessageId", "ASC"],
          ],
        }),
    );
  },

  getMessagePage,

  addMessage: async (senderId, receiverId, message) => {
    return sendMessageInTransaction({
      senderId,
      receiverId,
      message,
    });
  },
};

module.exports = messageService;
