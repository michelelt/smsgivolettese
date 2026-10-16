import { forwardRef, type InputHTMLAttributes } from "react";

export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }
>(function Checkbox({ label, ...props }, ref) {
  return (
    <label className="mt-4 flex min-h-12 items-center gap-3 font-bold">
      <input
        {...props}
        ref={ref}
        type="checkbox"
        className="size-7 flex-none accent-bordeaux"
      />
      {label}
    </label>
  );
});
