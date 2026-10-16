"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-12 items-center rounded-xl border-2 border-blu px-4 font-bold ${active ? "bg-blu text-white underline" : "text-blu"}`}
    >
      {children}
    </Link>
  );
}
