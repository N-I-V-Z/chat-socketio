export const queryKeys = {
  chatUsers: (userId) => ["chat-users", Number(userId)],
  conversation: (firstUserId, secondUserId) => {
    const [lowerId, higherId] = [Number(firstUserId), Number(secondUserId)].sort(
      (first, second) => first - second
    );
    return ["conversation", lowerId, higherId];
  },
  adminUsers: ["admin", "users"],
  adminLogs: (page, pageSize, eventType) => [
    "admin",
    "logs",
    { page, pageSize, eventType: eventType || null },
  ],
};
