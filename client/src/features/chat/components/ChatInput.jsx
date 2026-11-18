import Button from "../../../shared/ui/Button";

function ChatInput({
  canSend,
  isSending,
  message,
  onChange,
  onKeyDown,
  onSend,
}) {
  return (
    <form
      className="border-t border-line p-3 sm:px-6 sm:py-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <label className="sr-only" htmlFor="chat-message">
        Tin nhắn mới
      </label>
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-canvas p-2 focus-within:ring-2 focus-within:ring-accent">
        <textarea
          id="chat-message"
          rows={1}
          value={message}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder="Nhập tin nhắn..."
          className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-3 py-2 text-sm leading-6 text-ink placeholder:text-muted focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Button
          type="submit"
          disabled={isSending || !message.trim() || !canSend}
          className="min-h-10 shrink-0 rounded-xl px-4"
        >
          Gửi
        </Button>
      </div>
      <p className="mt-2 px-2 text-xs text-muted">
        Nhấn Enter để gửi, Shift + Enter để xuống dòng
      </p>
    </form>
  );
}

export default ChatInput;
