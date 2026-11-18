function TextField({ id, label, hint, error, className = "", ...inputProps }) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={["grid gap-2", className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {inputProps.required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        className={[
          "min-h-12 w-full rounded-xl border border-line bg-surface px-4 py-3",
          "text-sm text-ink placeholder:text-muted/80",
          "transition duration-200 ease-premium",
          "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
          error ? "border-danger focus:border-danger focus:ring-danger/20" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        {...inputProps}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-5 text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export default TextField;
