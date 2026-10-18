import { forwardRef, useId, type SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, error, hint, children, ...props },
  ref,
) {
  const id = useId();
  const describedBy = [hint && `${id}-h`, error && `${id}-e`]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block font-bold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-h`} className="text-base">
          {hint}
        </p>
      )}
      <select
        {...props}
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        className="mt-1 min-h-12 w-full rounded-xl border-2 border-ink bg-white px-3 text-lg"
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-e`} role="alert" className="mt-1 font-bold text-bordeaux">
          Attenzione: {error}
        </p>
      )}
    </div>
  );
});
