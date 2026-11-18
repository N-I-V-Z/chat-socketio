import React from "react";
import { formatMessageTime, toValidDate } from "../utils/messageDateFormat";

function MessageList({
  currentUserId,
  directConversationQuery,
  loadOlderMessages,
  messageGroups,
  messageListRef,
  messages,
  messagesQuery,
  onScroll,
  selectedUserName,
  latestSeenMessageId,
}) {
  return (
    <div
      ref={messageListRef}
      onScroll={onScroll}
      className="flex-1 space-y-3 overflow-y-auto bg-canvas/65 px-4 py-5 sm:px-7 sm:py-7 xl:px-10"
      role="log"
      aria-label={`Tin nhắn với ${selectedUserName}`}
      aria-live="polite"
      aria-relevant="additions"
    >
      {messagesQuery.isFetchingPreviousPage && (
        <div className="py-2 text-center text-xs text-muted" role="status">
          Đang tải tin nhắn cũ hơn...
        </div>
      )}
      {messagesQuery.isFetchPreviousPageError && (
        <div
          className="flex items-center justify-center gap-2 py-2 text-sm text-danger"
          role="alert"
        >
          <span>Không thể tải tin nhắn cũ hơn.</span>
          <button
            type="button"
            onClick={loadOlderMessages}
            className="font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          >
            Thử lại
          </button>
        </div>
      )}
      {(directConversationQuery.isPending ||
        (directConversationQuery.isSuccess && messagesQuery.isPending)) && (
        <div className="space-y-3" role="status">
          <span className="block h-10 w-2/3 animate-pulse rounded-2xl bg-surface-muted motion-reduce:animate-none" />
          <span className="ml-auto block h-10 w-1/2 animate-pulse rounded-2xl bg-accent/10 motion-reduce:animate-none" />
          <span className="sr-only">Đang tải tin nhắn</span>
        </div>
      )}
      {!messagesQuery.isPending &&
        directConversationQuery.isSuccess &&
        messages.length === 0 && (
          <div className="grid min-h-full place-items-center py-10 text-center">
            <div className="max-w-sm">
              <p className="text-base font-bold">Chưa có tin nhắn</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Gửi lời chào đầu tiên để bắt đầu cuộc trò chuyện.
              </p>
            </div>
          </div>
        )}
      {messageGroups.map((group) => (
        <React.Fragment key={group.key}>
          <div
            className="flex items-center justify-center py-2"
            role="separator"
            aria-label={group.label}
            data-message-day
          >
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted">
              {group.label}
            </span>
          </div>
          {group.messages.map((msg, index) => {
            const isSent = Number(msg.senderId) === currentUserId;
            const date = toValidDate(msg.Timestamp);
            const time = formatMessageTime(msg.Timestamp);
            const isLatestSeen =
              isSent && Number(msg.MessageId) === latestSeenMessageId;

            return (
              <div
                key={msg.MessageId ?? `${msg.senderId}-${index}`}
                data-chat-message
                data-message-id={msg.MessageId}
                className={`flex ${isSent ? "justify-end" : "justify-start"}`}
              >
                <div className="flex max-w-[85%] flex-col sm:max-w-[68%]">
                  <p
                    className={[
                      "whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-sm",
                      isSent
                        ? "rounded-br-md bg-accent text-accent-foreground"
                        : "rounded-bl-md bg-surface-muted text-ink",
                    ].join(" ")}
                  >
                    {msg.message}
                  </p>
                  {(time || isLatestSeen) && (
                    <div
                      className={`mt-1 flex items-center gap-2 text-xs tabular-nums text-muted ${isSent ? "justify-end" : "justify-start"}`}
                    >
                      {time && date && (
                        <time dateTime={date.toISOString()}>{time}</time>
                      )}
                      {isLatestSeen && <span>Đã xem</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

export default MessageList;
