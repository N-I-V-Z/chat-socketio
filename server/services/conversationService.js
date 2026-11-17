const db = require("../models");
const httpError = require("../utils/httpError");

function parseUserId(value) {
  const userId = Number(value);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw httpError(400, "INVALID_USER_ID", "A valid user ID is required");
  }
  return userId;
}

function getDirectPairKey(firstUserId, secondUserId) {
  const first = parseUserId(firstUserId);
  const second = parseUserId(secondUserId);
  const [lowerId, higherId] =
    first < second ? [first, second] : [second, first];
  return `${lowerId}:${higherId}`;
}

async function getOrCreateDirectConversation(
  firstUserId,
  secondUserId,
  { transaction } = {},
) {
  const first = parseUserId(firstUserId);
  const second = parseUserId(secondUserId);

  if (!transaction) {
    return db.sequelize.transaction((activeTransaction) =>
      getOrCreateDirectConversation(first, second, {
        transaction: activeTransaction,
      }),
    );
  }

  const participantIds = [...new Set([first, second])];
  const directPairKey = getDirectPairKey(first, second);
  let conversation = await db.Conversation.findOne({
    where: { directPairKey },
    transaction,
  });

  if (!conversation) {
    const users = await db.Users.findAll({
      attributes: ["userId"],
      where: { userId: participantIds },
      transaction,
    });
    const foundUserIds = new Set(users.map(({ userId }) => Number(userId)));
    if (participantIds.some((userId) => !foundUserIds.has(userId))) {
      throw httpError(
        404,
        "USER_NOT_FOUND",
        "Conversation participant not found",
      );
    }

    [conversation] = await db.Conversation.findOrCreate({
      where: { directPairKey },
      defaults: { directPairKey },
      transaction,
    });
  }

  for (const userId of participantIds) {
    await db.ConversationParticipant.findOrCreate({
      where: { conversationId: conversation.conversationId, userId },
      defaults: { conversationId: conversation.conversationId, userId },
      transaction,
    });
  }

  return conversation;
}

module.exports = {
  getDirectPairKey,
  getOrCreateDirectConversation,
};
