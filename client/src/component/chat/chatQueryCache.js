import { queryKeys } from "../../api/queryKeys";

function appendUniqueMessage(messages, message) {
  if (
    message.MessageId !== null &&
    message.MessageId !== undefined &&
    messages.some(
      (existing) => String(existing.MessageId) === String(message.MessageId),
    )
  ) {
    return messages;
  }
  return [...messages, message];
}

function appendInfiniteMessage(queryData, message) {
  if (
    !queryData ||
    !Array.isArray(queryData.pages) ||
    queryData.pages.length === 0
  ) {
    return queryData;
  }

  if (
    queryData.pages.some(
      (page) =>
        Array.isArray(page.items) &&
        page.items.some(
          (existing) =>
            existing.MessageId !== null &&
            existing.MessageId !== undefined &&
            String(existing.MessageId) === String(message.MessageId),
        ),
    )
  ) {
    return queryData;
  }

  const lastPageIndex = queryData.pages.length - 1;
  const lastPage = queryData.pages[lastPageIndex];
  if (!Array.isArray(lastPage.items)) {
    return queryData;
  }

  const pages = [...queryData.pages];
  pages[lastPageIndex] = {
    ...lastPage,
    items: appendUniqueMessage(lastPage.items, message),
  };
  return { ...queryData, pages };
}

function appendConversationMessage(queryClient, conversationId, message) {
  const queryKey = queryKeys.conversation(conversationId);
  const currentData = queryClient.getQueryData(queryKey);
  if (!currentData || !Array.isArray(currentData.pages)) {
    return false;
  }

  const nextData = appendInfiniteMessage(currentData, message);
  if (nextData !== currentData) {
    queryClient.setQueryData(queryKey, nextData);
  }
  return true;
}

function appendSocketMessage(queryClient, currentUserId, event) {
  const userId = Number(currentUserId);
  const senderId = Number(event.senderId);
  const receiverId = Number(event.receiverId);
  const conversationId = Number(event.conversationId);

  if (
    !Number.isSafeInteger(userId) ||
    userId < 1 ||
    !Number.isSafeInteger(senderId) ||
    senderId < 1 ||
    !Number.isSafeInteger(receiverId) ||
    receiverId < 1 ||
    !Number.isSafeInteger(conversationId) ||
    conversationId < 1 ||
    typeof event.message !== "string"
  ) {
    return false;
  }

  if (senderId !== userId && receiverId !== userId) {
    return false;
  }

  return appendConversationMessage(queryClient, conversationId, {
    MessageId: event.messageId ?? null,
    ConversationId: conversationId,
    SenderId: senderId,
    MessageText: event.message,
    Timestamp: event.timestamp ?? null,
  });
}

export { appendConversationMessage, appendSocketMessage, appendUniqueMessage };
