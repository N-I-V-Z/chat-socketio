import { cn } from "./cn";

const variants = {
  primary:
    "bg-accent text-accent-foreground shadow-sm hover:bg-accent-hover focus-visible:ring-accent",
  secondary:
    "border border-line bg-surface text-ink hover:bg-surface-muted focus-visible:ring-accent",
  quiet:
    "text-muted hover:bg-surface-muted hover:text-ink focus-visible:ring-accent",
  danger: "bg-danger text-white hover:brightness-95 focus-visible:ring-danger",
};

function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        "group inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.625rem] px-4 py-2",
        "text-sm font-semibold tracking-[-0.01em] transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-premium",
        "active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        variants[variant] || variants.primary,
        className,
      )}
      {...props}
    />
  );
}

export default Button;
