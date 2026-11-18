function userRoom(userId) {
  return `user:${userId}`;
}

function parseUserId(value, httpErrorFn = null) {
  const userId = Number(value);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    if (httpErrorFn) {
      throw httpErrorFn(400, "INVALID_USER_ID", "A valid user ID is required");
    }
    return null;
  }
  return userId;
}

module.exports = {
  userRoom,
  parseUserId,
};
