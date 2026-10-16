import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

const styles = {
  primary: "bg-bordeaux text-white border-bordeaux",
  secondary: "bg-white text-blu border-blu",
  danger: "bg-white text-bordeaux border-bordeaux",
};
const base =
  "min-h-12 rounded-xl border-2 px-5 text-lg font-bold disabled:opacity-60";

export function Button({
  variant = "primary",
  auto = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof styles;
  /** Natural width (toolbars, table rows) instead of full width. */
  auto?: boolean;
}) {
  return (
    <button
      {...props}
      className={`${base} ${auto ? "w-auto" : "w-full"} ${styles[variant]} ${className}`}
    />
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
      className={`inline-flex w-full items-center justify-center gap-2 text-center ${base} sm:w-auto ${styles[variant]} ${className}`}
    />
  );
}
