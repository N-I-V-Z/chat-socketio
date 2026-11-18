import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import api from "../../../api/client";
import { queryKeys } from "../../../api/queryKeys";
import { applyConversationRead } from "../utils/chatQueryCache";

const READ_RECEIPT_DEBOUNCE_MS = 200;
const READ_INTERSECTION_THRESHOLD = 0.6;

function useReadReceipts({
  conversationId,
  currentUserId,
  hasValidConversationId,
  messageListRef,
  queryClient,
  toast,
}) {
  const pendingReadMessageIdRef = useRef(0);
  const requestedReadMessageIdRef = useRef(0);
  const acknowledgedReadMessageIdRef = useRef(0);
  const readReceiptTimerRef = useRef(null);

  useEffect(() => {
    pendingReadMessageIdRef.current = 0;
    requestedReadMessageIdRef.current = 0;
    acknowledgedReadMessageIdRef.current = 0;
    if (readReceiptTimerRef.current) {
      clearTimeout(readReceiptTimerRef.current);
      readReceiptTimerRef.current = null;
    }

    return () => {
      if (readReceiptTimerRef.current) {
        clearTimeout(readReceiptTimerRef.current);
        readReceiptTimerRef.current = null;
      }
    };
  }, [conversationId]);

  const { mutate: markRead } = useMutation({
    mutationFn: async ({ targetConversationId, upToMessageId }) => {
      const response = await api.put(
        `/api/v1/conversations/${targetConversationId}/read-receipt`,
        { upToMessageId },
      );
      return response.data.data;
    },
    retry: 1,
    onSuccess: (readState, variables) => {
      acknowledgedReadMessageIdRef.current = Math.max(
        acknowledgedReadMessageIdRef.current,
        Number(readState.upToMessageId),
      );
      applyConversationRead(
        queryClient,
        variables.targetConversationId,
        currentUserId,
        readState.upToMessageId,
        readState.readAt,
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.unreadSummary(currentUserId),
      });
    },
    onError: (_error, variables) => {
      requestedReadMessageIdRef.current = acknowledgedReadMessageIdRef.current;
      pendingReadMessageIdRef.current = Math.max(
        pendingReadMessageIdRef.current,
        variables.upToMessageId,
      );
      toast("Không thể cập nhật trạng thái đã đọc.", "error");
    },
  });

  const queueReadReceipt = useCallback(
    (messageId) => {
      const parsedMessageId = Number(messageId);
      if (
        !hasValidConversationId ||
        !Number.isSafeInteger(parsedMessageId) ||
        parsedMessageId < 1 ||
        parsedMessageId <=
          Math.max(
            requestedReadMessageIdRef.current,
            pendingReadMessageIdRef.current,
          )
      ) {
        return;
      }

      pendingReadMessageIdRef.current = parsedMessageId;
      if (readReceiptTimerRef.current) return;

      readReceiptTimerRef.current = setTimeout(() => {
        readReceiptTimerRef.current = null;
        const upToMessageId = pendingReadMessageIdRef.current;
        pendingReadMessageIdRef.current = 0;
        if (upToMessageId <= requestedReadMessageIdRef.current) return;

        requestedReadMessageIdRef.current = upToMessageId;
        markRead({
          targetConversationId: conversationId,
          upToMessageId,
        });
      }, READ_RECEIPT_DEBOUNCE_MS);
    },
    [conversationId, hasValidConversationId, markRead],
  );

  useEffect(() => {
    const container = messageListRef.current;
    if (!container) return undefined;

    const markVisibleMessages = (messageElements) => {
      const containerBounds = container.getBoundingClientRect();
      let highestVisibleMessageId = 0;
      messageElements.forEach((element) => {
        const bounds = element.getBoundingClientRect();
        const visibleHeight =
          Math.min(bounds.bottom, containerBounds.bottom) -
          Math.max(bounds.top, containerBounds.top);
        if (
          visibleHeight > 0 &&
          visibleHeight / Math.max(bounds.height, 1) >=
            READ_INTERSECTION_THRESHOLD
        ) {
          highestVisibleMessageId = Math.max(
            highestVisibleMessageId,
            Number(element.dataset.messageId) || 0,
          );
        }
      });
      if (highestVisibleMessageId > 0) {
        queueReadReceipt(highestVisibleMessageId);
      }
    };

    if (typeof IntersectionObserver === "undefined") {
      const handleScroll = () => {
        const messageElements = container.querySelectorAll(
          "[data-chat-message][data-message-id]",
        );
        markVisibleMessages(messageElements);
      };
      handleScroll();
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const highestVisibleMessageId = entries.reduce(
          (highestId, entry) =>
            entry.isIntersecting &&
            entry.intersectionRatio >= READ_INTERSECTION_THRESHOLD
              ? Math.max(highestId, Number(entry.target.dataset.messageId) || 0)
              : highestId,
          0,
        );
        if (highestVisibleMessageId > 0) {
          queueReadReceipt(highestVisibleMessageId);
        }
      },
      {
        root: container,
        threshold: [0, READ_INTERSECTION_THRESHOLD],
      },
    );

    const observeElements = () => {
      const messageElements = container.querySelectorAll(
        "[data-chat-message][data-message-id]",
      );
      messageElements.forEach((element) => observer.observe(element));
    };

    observeElements();

    const mutationObserver = new MutationObserver(observeElements);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, [conversationId, messageListRef, queueReadReceipt]);
}

export default useReadReceipts;
