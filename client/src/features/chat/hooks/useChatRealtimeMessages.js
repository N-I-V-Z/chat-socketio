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

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("conversationRead", handleConversationRead);
    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("conversationRead", handleConversationRead);
    };
  }, [currentUserIdRef, queryClient, socket]);
}

export default useChatRealtimeMessages;
