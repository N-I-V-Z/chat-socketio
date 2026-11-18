import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "./cn";

function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className = "",
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/35 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg",
            "max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-line",
            "bg-surface p-6 text-ink shadow-float outline-none sm:p-8",
            "data-[state=open]:animate-fade-in",
            className,
          )}
        >
          <header className="mb-6 flex items-start justify-between gap-4">
            <div className="grid gap-2">
              <DialogPrimitive.Title className="text-xl font-bold tracking-[-0.03em]">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="max-w-prose text-sm leading-6 text-muted">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Đóng hộp thoại"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span aria-hidden="true">×</span>
              </button>
            </DialogPrimitive.Close>
          </header>
          <div>{children}</div>
          {footer && (
            <footer className="mt-7 flex flex-wrap justify-end gap-3">
              {footer}
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default Dialog;
