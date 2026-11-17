const { QueryTypes } = require("sequelize");
const db = require("../models");
const httpError = require("../utils/httpError");

function parseId(value, code, message) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw httpError(400, code, message);
  }
  return parsed;
}

async function getUnreadSummary(userId) {
  const currentUserId = parseId(
    userId,
    "INVALID_USER_ID",
    "A valid user is required",
  );
  const rows = await db.sequelize.query(
    `SELECT [self].[conversationId] AS [conversationId],
      [peer].[userId] AS [peerUserId],
      COUNT([m].[MessageId]) AS [unreadCount]
    FROM [dbo].[ConversationParticipants] AS [self]
    INNER JOIN [dbo].[ConversationParticipants] AS [peer]
      ON [peer].[conversationId] = [self].[conversationId]
      AND [peer].[userId] <> [self].[userId]
    LEFT JOIN [dbo].[Message] AS [m]
      ON [m].[ConversationId] = [self].[conversationId]
      AND [m].[SenderId] <> [self].[userId]
    LEFT JOIN [dbo].[MessageReadReceipts] AS [receipt]
      ON [receipt].[MessageId] = [m].[MessageId]
      AND [receipt].[UserId] = [self].[userId]
    WHERE [self].[userId] = :userId
      AND [receipt].[MessageId] IS NULL
    GROUP BY [self].[conversationId], [peer].[userId]
    HAVING COUNT([m].[MessageId]) > 0;`,
    {
      replacements: { userId: currentUserId },
      type: QueryTypes.SELECT,
    },
  );

  return rows.map(({ conversationId, peerUserId, unreadCount }) => ({
    conversationId: Number(conversationId),
    peerUserId: Number(peerUserId),
    unreadCount: Number(unreadCount),
  }));
}

async function markConversationRead(userId, conversationId, upToMessageId) {
  const currentUserId = parseId(
    userId,
    "INVALID_USER_ID",
    "A valid user is required",
  );
  const currentConversationId = parseId(
    conversationId,
    "INVALID_CONVERSATION_ID",
    "A valid conversation is required",
  );
  const cursorMessageId = parseId(
    upToMessageId,
    "INVALID_MESSAGE_CURSOR",
    "A valid message cursor is required",
  );

  return db.sequelize.transaction(async (transaction) => {
    const membership = await db.ConversationParticipant.findOne({
      attributes: ["conversationId"],
      where: { conversationId: currentConversationId, userId: currentUserId },
      transaction,
    });
    if (!membership) {
      throw httpError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    }

    const cursor = await db.Message.findOne({
      attributes: ["MessageId"],
      where: {
        MessageId: cursorMessageId,
        ConversationId: currentConversationId,
      },
      transaction,
    });
    if (!cursor) {
      throw httpError(
        400,
        "INVALID_MESSAGE_CURSOR",
        "Message cursor does not belong to this conversation",
      );
    }

    const participantRows = await db.ConversationParticipant.findAll({
      attributes: ["userId"],
      where: { conversationId: currentConversationId },
      transaction,
    });

    await db.sequelize.query(
      `INSERT INTO [dbo].[MessageReadReceipts] ([MessageId], [UserId], [readAt])
      SELECT [m].[MessageId], :userId, GETDATE()
      FROM [dbo].[Message] AS [m] WITH (UPDLOCK, HOLDLOCK)
      WHERE [m].[ConversationId] = :conversationId
        AND [m].[MessageId] <= :upToMessageId
        AND [m].[SenderId] <> :userId
        AND NOT EXISTS (
          SELECT 1
          FROM [dbo].[MessageReadReceipts] AS [existing] WITH (UPDLOCK, HOLDLOCK)
          WHERE [existing].[MessageId] = [m].[MessageId]
            AND [existing].[UserId] = :userId
        );`,
      {
        replacements: {
          userId: currentUserId,
          conversationId: currentConversationId,
          upToMessageId: cursorMessageId,
        },
        transaction,
        type: QueryTypes.INSERT,
      },
    );

    const [clock] = await db.sequelize.query("SELECT GETDATE() AS [readAt];", {
      transaction,
      type: QueryTypes.SELECT,
    });

    return {
      conversationId: currentConversationId,
      upToMessageId: cursorMessageId,
      readerId: currentUserId,
      participantUserIds: participantRows.map(({ userId: id }) => Number(id)),
      readAt: clock.readAt,
    };
  });
}

module.exports = {
  getUnreadSummary,
  markConversationRead,
};
