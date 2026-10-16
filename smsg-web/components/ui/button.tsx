import type { ButtonHTMLAttributes } from "react";

const styles = {
  primary: "bg-bordeaux text-white border-bordeaux",
  secondary: "bg-white text-blu border-blu",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof styles;
}) {
  return (
    <button
      {...props}
      className={`min-h-12 w-full rounded-xl border-2 px-5 text-lg font-bold disabled:opacity-60 ${styles[variant]} ${className}`}
    />
  );
}
