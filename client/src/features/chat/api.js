import api from "../../shared/api/client";

export async function listChatUsers() {
  const response = await api.get("/api/v1/users");
  return response.data.data;
}

export async function getUnreadSummary() {
  const response = await api.get("/api/v1/conversations/unread-summary");
  return response.data.data;
}

export async function getDirectConversation(otherUserId) {
  const response = await api.put(`/api/v1/conversations/direct/${otherUserId}`);
  const conversationId = Number(response.data?.data?.conversationId);
  if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
    throw new Error("The direct conversation response is invalid.");
  }
  return { conversationId };
}

export async function getConversationMessages(conversationId, beforeMessageId) {
  const response = await api.get(
    `/api/v1/conversations/${conversationId}/messages`,
    { params: beforeMessageId == null ? undefined : { beforeMessageId } },
  );
  return response.data.data;
}

export async function sendConversationMessage(conversationId, message) {
  const response = await api.post(
    `/api/v1/conversations/${conversationId}/messages`,
    { message },
  );
  return response.data.data;
}

export async function markConversationRead(conversationId, upToMessageId) {
  const response = await api.put(
    `/api/v1/conversations/${conversationId}/read-receipt`,
    { upToMessageId },
  );
  return response.data.data;
}
