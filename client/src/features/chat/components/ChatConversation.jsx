import { FaVideo } from "react-icons/fa6";
import { IoArrowBack, IoCall } from "react-icons/io5";
import { IoChatbubblesOutline } from "react-icons/io5";
import { cn } from "../../../shared/ui/cn";
import Button from "../../../shared/ui/Button";
import ChatInput from "./ChatInput";
import MessageList from "./MessageList";

function ChatConversation({
  currentUserId,
  directConversationQuery,
  hasValidConversationId,
  hasValidReceiver,
  isMobileConversationOpen,
  isSocketConnected,
  latestSeenMessageId,
  loadOlderMessages,
  message,
  messageGroups,
  messageListRef,
  messages,
  messagesQuery,
  onBack,
  onMessageChange,
  onMessageKeyDown,
  onMessageListScroll,
  onRequestCall,
  onSendMessage,
  selectedUser,
  selectedUserName,
  sendMessageMutation,
}) {
  return (
    <section
      aria-label="Cuộc trò chuyện"
      className={cn(
        "min-h-0 min-w-0 flex-col overflow-hidden border-line bg-surface lg:rounded-panel lg:border lg:shadow-panel",
        isMobileConversationOpen ? "flex" : "hidden lg:flex",
      )}
    >
      <header className="flex min-h-[5.5rem] flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-3 sm:px-6 xl:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            variant="quiet"
            aria-label="Quay lại danh sách liên hệ"
            onClick={onBack}
            className="size-10 min-h-10 shrink-0 rounded-lg px-2 lg:hidden"
          >
            <IoArrowBack aria-hidden="true" className="size-5" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-[-0.025em] sm:text-lg">
              {selectedUserName}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {selectedUser
                ? "Cuộc trò chuyện riêng tư"
                : "Chọn một người để bắt đầu"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            role="status"
            className="mr-1 inline-flex items-center gap-2 text-xs font-medium text-muted"
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                isSocketConnected ? "bg-success" : "bg-danger",
              )}
            />
            {isSocketConnected ? "Đã kết nối" : "Đang kết nối lại"}
          </span>
          {hasValidReceiver && (
            <>
              <Button
                variant="secondary"
                onClick={() => onRequestCall(false)}
                disabled={!isSocketConnected}
                aria-label={`Gọi thoại cho ${selectedUserName}`}
                className="min-h-10 rounded-lg px-3"
              >
                <IoCall aria-hidden="true" />
                <span className="hidden sm:inline">Gọi thoại</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => onRequestCall(true)}
                disabled={!isSocketConnected}
                aria-label={`Gọi video cho ${selectedUserName}`}
                className="min-h-10 rounded-lg px-3"
              >
                <FaVideo aria-hidden="true" />
                <span className="hidden sm:inline">Gọi video</span>
              </Button>
            </>
          )}
        </div>
      </header>

      {hasValidReceiver ? (
        <>
          {(directConversationQuery.isError ||
            (messagesQuery.isError && !messagesQuery.data)) && (
            <div
              className="flex items-center justify-between gap-3 border-b border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger sm:px-6"
              role="alert"
            >
              <span>
                {directConversationQuery.isError
                  ? "Không thể mở cuộc trò chuyện."
                  : "Không thể tải tin nhắn."}
              </span>
              <button
                type="button"
                onClick={() =>
                  directConversationQuery.isError
                    ? directConversationQuery.refetch()
                    : messagesQuery.refetch()
                }
                className="shrink-0 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              >
                Thử lại
              </button>
            </div>
          )}
          <MessageList
            currentUserId={currentUserId}
            directConversationQuery={directConversationQuery}
            loadOlderMessages={loadOlderMessages}
            messageGroups={messageGroups}
            messageListRef={messageListRef}
            messages={messages}
            messagesQuery={messagesQuery}
            onScroll={onMessageListScroll}
            selectedUserName={selectedUserName}
            latestSeenMessageId={latestSeenMessageId}
          />
          <ChatInput
            canSend={hasValidConversationId}
            isSending={sendMessageMutation.isPending}
            message={message}
            onChange={onMessageChange}
            onKeyDown={onMessageKeyDown}
            onSend={onSendMessage}
          />
        </>
      ) : (
        <div className="grid flex-1 place-items-center px-6 py-12 text-center">
          <div className="max-w-sm">
            <span
              aria-hidden="true"
              className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-accent/10 text-accent"
            >
              <IoChatbubblesOutline className="size-8" />
            </span>
            <p className="text-xl font-bold tracking-[-0.035em]">
              Chọn một người để trò chuyện
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              Chọn một liên hệ để bắt đầu cuộc trò chuyện riêng tư.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export default ChatConversation;
