import { forwardRef, useId, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { label, error, hint, ...props },
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
      <input
        {...props}
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        className="mt-1 min-h-12 w-full rounded-xl border-2 border-ink bg-white px-3 text-lg"
      />
      {error && (
        <p id={`${id}-e`} className="mt-1 font-bold text-bordeaux">
          Attenzione: {error}
        </p>
      )}
    </div>
  );
});
