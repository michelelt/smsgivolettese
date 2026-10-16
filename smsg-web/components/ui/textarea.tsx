import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  function Textarea({ label, hint, error, ...props }, ref) {
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
        <textarea
          {...props}
          ref={ref}
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy || undefined}
          className="mt-1 min-h-28 w-full rounded-xl border-2 border-ink bg-white px-3 py-2 text-lg"
        />
        {error && (
          <p id={`${id}-e`} className="mt-1 font-bold text-bordeaux">
            Attenzione: {error}
          </p>
        )}
      </div>
    );
  },
);
