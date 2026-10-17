"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

const ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/chi-siamo", label: "Chi siamo", icon: "hands" },
  { href: "/servizi", label: "Servizi", icon: "heart" },
  { href: "/notizie", label: "Eventi e novità", icon: "news" },
  { href: "/galleria", label: "Galleria", icon: "doc" },
  { href: "/convenzioni", label: "Convenzioni", icon: "check" },
  { href: "/dove-siamo", label: "Dove siamo", icon: "pin" },
  { href: "/accedi", label: "Area riservata", icon: "lock" },
] as const;

export function MainNav() {
  const path = usePathname();
  return (
    <nav aria-label="Menu principale">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {ITEMS.map((i) => {
          const active =
            path === i.href ||
            (i.href !== "/" && path.startsWith(`${i.href}/`));
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-blu px-3 text-center font-bold ${active ? "bg-blu text-white underline" : "bg-white text-blu"}`}
              >
                <Icon name={i.icon} />
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
