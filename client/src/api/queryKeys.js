export const queryKeys = {
  chatUsers: (userId) => ["chat-users", Number(userId)],
  directConversation: (firstUserId, secondUserId) => {
    const [lowerId, higherId] = [
      Number(firstUserId),
      Number(secondUserId),
    ].sort((first, second) => first - second);
    return ["direct-conversation", lowerId, higherId];
  },
  conversation: (conversationId) => ["conversation", Number(conversationId)],
  adminUsers: ["admin", "users"],
  adminLogs: (page, pageSize, eventType) => [
    "admin",
    "logs",
    { page, pageSize, eventType: eventType || null },
  ],
};
