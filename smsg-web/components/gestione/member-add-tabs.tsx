"use client";

import Link from "next/link";
import { useOrgInfo } from "@/lib/api/hooks";

const TABS = [
  ["/gestione/soci/nuovo", "Un socio"],
  ["/gestione/soci/importa", "Da Excel"],
] as const;

/** Title, next card number and the one-or-many switch shared by "Nuovo socio" and the Excel import. */
export function MemberAddHeader({
  current,
}: {
  current: (typeof TABS)[number][0];
}) {
  const org = useOrgInfo().data;
  return (
    <header className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold text-bordeaux">Nuovi soci</h1>
        {org && (
          <span className="rounded-full bg-blu/10 px-4 py-1.5 font-bold text-blu">
            Prossima tessera n. {org.nextCardNumber}
          </span>
        )}
      </div>
      <nav
        aria-label="Come aggiungere i soci"
        className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-blu/10 p-1 sm:inline-grid sm:min-w-96"
      >
        {TABS.map(([href, label]) => {
          const on = href === current;
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-12 items-center justify-center rounded-xl px-5 font-bold text-blu transition ${on ? "bg-white shadow-md ring-1 ring-blu/20" : "hover:bg-white/60"}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
