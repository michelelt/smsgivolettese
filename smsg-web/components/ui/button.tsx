import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

const styles = {
  primary: "bg-bordeaux text-white border-bordeaux",
  secondary: "bg-white text-blu border-blu",
};
const base =
  "min-h-12 w-full rounded-xl border-2 px-5 text-lg font-bold disabled:opacity-60";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof styles;
}) {
  return (
    <button {...props} className={`${base} ${styles[variant]} ${className}`} />
  );
}

/** A link that looks like a big button (never a button inside a link). */
export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof styles }) {
  return (
    <Link
      {...props}
      className={`inline-flex items-center justify-center gap-2 text-center ${base} sm:w-auto ${styles[variant]} ${className}`}
    />
  );
}
