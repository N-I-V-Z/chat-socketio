import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const ToastContext = createContext(null);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (content, variant = "info") => {
      const id = ++nextId.current;
      setToasts((current) => [...current, { id, content, variant }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 4500),
      );
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    [],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed right-4 top-[calc(1rem+env(safe-area-inset-top))] z-[70] grid w-[min(24rem,calc(100vw-2rem))] gap-3">
        {toasts.map(({ id, content, variant }) => (
          <div
            key={id}
            role={variant === "error" ? "alert" : "status"}
            className={[
              "pointer-events-auto flex items-start justify-between gap-4 rounded-xl border",
              "border-line bg-surface px-4 py-3 text-sm text-ink shadow-float",
              "animate-fade-up",
              variant === "error" ? "border-danger/40" : "",
              variant === "success" ? "border-success/40" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="leading-5">{content}</span>
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => dismiss(id)}
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used within a ToastProvider.");
  }
  return value;
}

export { ToastProvider, useToast };
