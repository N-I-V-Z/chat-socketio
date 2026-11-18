import { useRef } from "react";
import { IoArrowForward } from "react-icons/io5";
import Button from "../../../shared/ui/Button";

function ChatInput({
  canSend,
  isSending,
  message,
  onChange,
  onKeyDown,
  onSend,
}) {
  const textareaRef = useRef(null);

  return (
    <form
      className="border-t border-line bg-surface p-3 sm:px-6 sm:py-4 xl:px-8"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <div className="flex items-end gap-2">
        <label
          htmlFor="chat-message"
          onPointerDown={(event) => {
            if (event.target !== textareaRef.current) {
              textareaRef.current?.focus();
            }
          }}
          className="flex min-h-14 min-w-0 flex-1 cursor-text items-end rounded-xl border border-line bg-canvas p-2 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20"
        >
          <span className="sr-only">Tin nhắn mới</span>
          <textarea
            ref={textareaRef}
            id="chat-message"
            rows={1}
            value={message}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="Nhập tin nhắn..."
            className="max-h-32 min-h-10 w-full resize-y bg-transparent px-2 py-2 text-sm leading-6 text-ink placeholder:text-muted focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </label>
        <Button
          type="submit"
          aria-label="Gửi tin nhắn"
          title="Gửi tin nhắn"
          disabled={isSending || !message.trim() || !canSend}
          className="size-14 min-h-14 shrink-0 rounded-xl px-0"
        >
          <IoArrowForward aria-hidden="true" className="size-5" />
        </Button>
      </div>
      <p className="mt-2 px-2 text-xs text-muted">
        Nhấn Enter để gửi, Shift + Enter để xuống dòng
      </p>
    </form>
  );
}

export default ChatInput;
