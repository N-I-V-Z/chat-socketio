const USER_DIRECTORY_KEY = "users:list:v1";

function conversationKey(firstUserId, secondUserId) {
  const first = Number(firstUserId);
  const second = Number(secondUserId);
  if (
    !Number.isSafeInteger(first) ||
    first < 1 ||
    !Number.isSafeInteger(second) ||
    second < 1
  ) {
    throw new Error("Conversation cache keys require valid user IDs.");
  }

  const [lowerId, higherId] =
    first < second ? [first, second] : [second, first];
  return `messages:room:v1:${lowerId}:${higherId}`;
}

function conversationPageKey(conversationId, beforeMessageId = null) {
  const id = Number(conversationId);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error("Conversation cache keys require a valid conversation ID.");
  }

  if (beforeMessageId === null || beforeMessageId === undefined) {
    return `messages:conversation:v1:${id}:latest`;
  }

  const cursor = Number(beforeMessageId);
  if (!Number.isSafeInteger(cursor) || cursor < 1) {
    throw new Error(
      "Conversation page cache keys require a valid message cursor.",
    );
  }
  return `messages:conversation:v1:${id}:before:${cursor}`;
}

module.exports = {
  USER_DIRECTORY_KEY,
  conversationKey,
  conversationPageKey,
};
