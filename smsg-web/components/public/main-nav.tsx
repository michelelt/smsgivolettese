"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

// Topics are sections of the home page; news and gallery keep their own pages.
const ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/#servizi", label: "Servizi", icon: "heart" },
  { href: "/notizie", label: "Notizie", icon: "news" },
  { href: "/#convenzioni", label: "Convenzioni", icon: "tag" },
  { href: "/#chi-siamo", label: "Chi siamo", icon: "hands" },
  { href: "/#dove-siamo", label: "Dove siamo", icon: "pin" },
  { href: "/galleria", label: "Galleria", icon: "photo" },
] as const;

/** One header row on wide screens; a Menu button with a panel below xl. `tools`: text size and login, shown in both. */
export function MainNav({ tools }: { tools: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const active = (href: string) =>
    path === href || (href.length > 2 && path.startsWith(`${href}/`));
  return (
    <>
      <nav
        aria-label="Menu principale"
        className="hidden flex-1 xl:block big:xl:hidden"
      >
        <ul className="flex gap-1 rounded-[14px] bg-[#edf1f8] p-[5px]">
          {ITEMS.map((i) => (
            <li key={i.href} className="flex flex-[1_1_0]">
              <Link
                href={i.href}
                aria-current={active(i.href) ? "page" : undefined}
                className="flex min-h-[62px] w-full flex-col items-center justify-center gap-1 whitespace-nowrap rounded-[10px] px-2 py-1.5 text-center text-[0.85rem] font-bold leading-tight text-blu hover:bg-white focus-visible:bg-white focus-visible:outline-offset-[-3px] aria-[current=page]:bg-blu aria-[current=page]:text-white aria-[current=page]:focus-visible:outline-white"
              >
                <Icon name={i.icon} />
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="hidden items-center gap-3 xl:ml-auto xl:flex">
        {tools}
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-bordeaux px-4 font-bold text-white xl:hidden big:xl:inline-flex"
      >
        <Icon name={open ? "close" : "menu"} />
        Menu
      </button>
      {open && (
        <div
          id={panel}
          className="absolute inset-x-0 top-full border-b-4 border-bordeaux bg-white shadow-lg xl:hidden big:xl:block"
        >
          <nav aria-label="Menu principale" className="mx-auto max-w-5xl p-4">
            <ul className="grid gap-1 sm:grid-cols-2">
              {ITEMS.map((i) => (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={() => setOpen(false)}
                    aria-current={active(i.href) ? "page" : undefined}
                    className="flex min-h-14 items-center gap-3 rounded-xl px-3 text-xl font-bold text-blu hover:bg-[#f7efe9] aria-[current=page]:bg-bordeaux aria-[current=page]:text-white"
                  >
                    <Icon name={i.icon} />
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-bordeaux/20 pt-4">
              {tools}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
