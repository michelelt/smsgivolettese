"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

const ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/chi-siamo", label: "Chi siamo", icon: "hands" },
  { href: "/servizi", label: "Servizi", icon: "heart" },
  { href: "/notizie", label: "Eventi e novità", icon: "news" },
  { href: "/galleria", label: "Galleria", icon: "photo" },
  { href: "/convenzioni", label: "Convenzioni", icon: "tag" },
  { href: "/dove-siamo", label: "Dove siamo", icon: "pin" },
] as const;

export function MainNav() {
  const path = usePathname();
  return (
    <nav aria-label="Menu principale">
      {/* Scrolls sideways when labels do not fit (narrow screens, A++) instead of clipping. */}
      <ul className="flex gap-1 overflow-x-auto rounded-[14px] bg-[#edf1f8] p-[5px]">
        {ITEMS.map((i) => {
          const active =
            path === i.href ||
            (i.href !== "/" && path.startsWith(`${i.href}/`));
          return (
            <li key={i.href} className="flex flex-[1_1_0]">
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[62px] w-full flex-col items-center justify-center gap-1 rounded-[10px] px-3 py-1.5 text-center font-bold leading-tight max-[700px]:whitespace-nowrap focus-visible:outline-offset-[-3px] ${active ? "bg-blu text-white focus-visible:outline-white" : "text-blu hover:bg-white focus-visible:bg-white"}`}
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
