import { useEffect } from "react";
import { queryKeys } from "../../../shared/api/queryKeys";
import {
  appendSocketMessage,
  applyConversationRead,
} from "../utils/chatQueryCache";

function useChatRealtimeMessages({ socket, queryClient, currentUserIdRef }) {
  useEffect(() => {
    const handleReceiveMessage = (event) => {
      appendSocketMessage(queryClient, currentUserIdRef.current, event);
      if (Number(event.senderId) !== currentUserIdRef.current) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.unreadSummary(currentUserIdRef.current),
        });
      }
    };
    const handleConversationRead = (event) => {
      applyConversationRead(
        queryClient,
        event.conversationId,
        event.readerId,
        event.upToMessageId,
        event.readAt,
      );
    };
    const handlePresenceChanged = (event) => {
      const userId = Number(event?.userId);
      if (
        !Number.isSafeInteger(userId) ||
        userId < 1 ||
        typeof event?.isOnline !== "boolean" ||
        userId === currentUserIdRef.current
      ) {
        return;
      }
      const queryKey = queryKeys.chatUsers(currentUserIdRef.current);
      queryClient.setQueryData(queryKey, (users) =>
        Array.isArray(users)
          ? users.map((user) =>
              Number(user.userId) === userId
                ? { ...user, isOnline: event.isOnline }
                : user,
            )
          : users,
      );
      queryClient.invalidateQueries({ queryKey });
    };

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("conversationRead", handleConversationRead);
    socket.on("presenceChanged", handlePresenceChanged);
    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("conversationRead", handleConversationRead);
      socket.off("presenceChanged", handlePresenceChanged);
    };
  }, [currentUserIdRef, queryClient, socket]);
}

export default useChatRealtimeMessages;
