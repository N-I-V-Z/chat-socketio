import { queryKeys } from "../../api/queryKeys";

function appendUniqueMessage(messages, message) {
  if (
    message.MessageId !== null &&
    message.MessageId !== undefined &&
    messages.some(
      (existing) => String(existing.MessageId) === String(message.MessageId)
    )
  ) {
    return messages;
  }
  return [...messages, message];
}

function appendSocketMessage(queryClient, currentUserId, event) {
  const userId = Number(currentUserId);
  const senderId = Number(event.senderId);
  const receiverId = Number(event.receiverId);
  const otherUserId =
    senderId === userId ? receiverId : senderId;

  if (
    !Number.isSafeInteger(userId) ||
    userId < 1 ||
    !Number.isSafeInteger(senderId) ||
    senderId < 1 ||
    !Number.isSafeInteger(otherUserId) ||
    otherUserId < 1 ||
    typeof event.message !== "string"
  ) {
    return false;
  }

  if (
    senderId !== userId &&
    Number.isSafeInteger(receiverId) &&
    receiverId !== userId
  ) {
    return false;
  }

  const queryKey = queryKeys.conversation(userId, otherUserId);
  const currentMessages = queryClient.getQueryData(queryKey);
  if (!Array.isArray(currentMessages)) {
    return false;
  }

  const nextMessages = appendUniqueMessage(currentMessages, {
    MessageId: event.messageId ?? null,
    senderId,
    message: event.message,
  });
  if (nextMessages !== currentMessages) {
    queryClient.setQueryData(queryKey, nextMessages);
  }
  return true;
}

export { appendSocketMessage, appendUniqueMessage };
