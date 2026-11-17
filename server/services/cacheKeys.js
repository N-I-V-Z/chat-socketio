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

module.exports = {
  USER_DIRECTORY_KEY,
  conversationKey,
};
