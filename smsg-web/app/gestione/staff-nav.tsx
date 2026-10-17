"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { backdropClose } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { api, call } from "@/lib/api/call";

type IconName = React.ComponentProps<typeof Icon>["name"];
export type NavGroup = {
  name: string;
  items: { href: string; label: string; desc?: string; icon: IconName }[];
};

const focus = "focus-visible:outline-3 focus-visible:outline-offset-2";
const pill =
  "inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-lg font-bold";

/** Disclosure: plain button + panel; Esc and outside click close it and give focus back. */
function Disclosure({
  label,
  icon,
  active,
  align = "left",
  children,
}: {
  label: string;
  icon?: IconName;
  active?: boolean;
  align?: "left" | "right";
  children: (close: () => void) => React.ReactNode;
}) {
  const path = usePathname();
  // Stores the page it was opened on, so navigating closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (v: boolean) => setOpenAt(v ? path : null);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpenAt(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenAt(null);
        btn.current?.focus();
      }
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={`${pill} ${focus} ${active ? "bg-bordeaux/10 text-bordeaux underline decoration-2 underline-offset-4" : "text-ink hover:bg-black/5"}`}
      >
        {icon && <Icon name={icon} />}
        {label}
        <span
          className={`inline-flex transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        >
          <Icon name="down" />
        </span>
      </button>
      {open && (
        <div
          id={id}
          className={`absolute top-full z-30 mt-2 w-80 rounded-2xl border border-black/10 bg-white p-2 shadow-[0_1px_2px_rgba(26,29,43,.06),0_12px_32px_rgba(26,29,43,.16)] ${align === "right" ? "right-0" : "left-0"}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** Full-height native dialog anchored right: Esc, focus trap and focus return come from the browser. */
function MobilePanel({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label="Menu"
      onClose={onClose}
      {...backdropClose()}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-md overflow-y-auto bg-white p-0 text-ink backdrop:bg-black/60"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white px-4 py-2">
        <h2 className="text-xl font-extrabold text-bordeaux">Menu</h2>
        <button
          type="button"
          onClick={onClose}
          className={`${pill} ${focus} border-2 border-blu text-blu`}
        >
          <Icon name="close" />
          Chiudi
        </button>
      </div>
      {open && children}
    </dialog>
  );
}

/** Proposals waiting for review, as text next to "Bacheca" (fetched when the menu opens, not cached). */
function Waiting() {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    void call(
      api.GET("/proposals", {
        params: { query: { status: "attesa", pageSize: 1 } },
      }),
    )
      .then((r) => setTotal(r.total))
      .catch(() => {});
  }, []);
  return total ? (
    <span className="ml-2 rounded-full border-2 border-current px-2 text-base font-bold">
      {total} da guardare
    </span>
  ) : null;
}

function Item({
  item,
  onClick,
}: {
  item: NavGroup["items"][number];
  onClick?: () => void;
}) {
  const active = usePathname() === item.href;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 ${focus} ${active ? "bg-blu text-white" : "text-ink hover:bg-blu/10"}`}
    >
      <Icon name={item.icon} />
      <span className="flex flex-col leading-tight">
        <span className="font-bold">
          {item.label}
          {item.href === "/gestione/bacheca" && <Waiting />}
        </span>
        {item.desc && (
          <span
            className={`text-base ${active ? "text-white" : "text-ink/75"}`}
          >
            {item.desc}
          </span>
        )}
      </span>
    </Link>
  );
}

function Account({
  roleLabel,
  superAdmin,
}: {
  roleLabel: string;
  superAdmin: boolean;
}) {
  return (
    <Disclosure label="Account" icon="user" align="right">
      {() => (
        <>
          <p className="px-3 py-2 text-base">
            Ruolo: <strong>{roleLabel}</strong>
          </p>
          <Item
            item={{
              href: "/gestione/account/password",
              label: "Cambia password",
              icon: "key",
            }}
          />
          {superAdmin && (
            <Item
              item={{
                href: "/gestione/account/sicurezza",
                label: "Sicurezza (due fattori)",
                icon: "shield",
              }}
            />
          )}
          <form action="/auth/esci" method="post">
            <button
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left font-bold text-bordeaux hover:bg-bordeaux/10 ${focus}`}
            >
              <Icon name="out" />
              Esci
            </button>
          </form>
        </>
      )}
    </Disclosure>
  );
}

export function GestioneNav({
  groups,
  roleLabel,
  superAdmin,
  volunteer,
}: {
  groups: NavGroup[];
  roleLabel: string;
  superAdmin: boolean;
  volunteer: boolean;
}) {
  const path = usePathname();
  const [mobileAt, setMobileAt] = useState<string | null>(null);
  const mobile = mobileAt === path;
  const setMobile = (v: boolean) => setMobileAt(v ? path : null);
  const bar =
    "border-b border-black/10 bg-white shadow-[0_1px_2px_rgba(26,29,43,.06),0_6px_20px_rgba(26,29,43,.07)]";
  const brand = (
    <Link
      href="/gestione"
      className={`min-w-0 shrink rounded-lg text-xl font-extrabold text-bordeaux ${focus}`}
    >
      SMS Givolettese
      <span className="block text-base font-bold text-blu">Gestione</span>
    </Link>
  );

  if (volunteer)
    return (
      <header className={bar}>
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-6 lg:px-8">
          {brand}
          <nav aria-label="Sezioni di gestione">
            <ul className="flex flex-wrap items-center gap-1">
              {[
                { href: "/gestione", label: "I miei impegni" },
                {
                  href: "/gestione/disponibilita",
                  label: "Le mie disponibilità",
                },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={path === l.href ? "page" : undefined}
                    className={`${pill} ${focus} ${path === l.href ? "bg-blu text-white" : "text-blu hover:bg-blu/10"}`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Account roleLabel={roleLabel} superAdmin={superAdmin} />
              </li>
            </ul>
          </nav>
        </div>
      </header>
    );

  return (
    <header className={bar}>
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-2 px-4 py-2 md:px-6 lg:px-8">
        {brand}
        <nav
          aria-label="Sezioni di gestione"
          className="ml-4 hidden min-w-0 xl:block"
        >
          <ul className="flex flex-wrap items-center gap-1">
            {groups.map((g) => (
              <li key={g.name}>
                <Disclosure
                  label={g.name}
                  active={g.items.some((i) => path.startsWith(i.href))}
                >
                  {(close) =>
                    g.items.map((i) => (
                      <Item key={i.href} item={i} onClick={close} />
                    ))
                  }
                </Disclosure>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setMobile(true)}
            className={`${pill} ${focus} bg-blu text-white xl:hidden`}
          >
            <Icon name="menu" />
            Menu
          </button>
          <div className="hidden xl:block">
            <Account roleLabel={roleLabel} superAdmin={superAdmin} />
          </div>
        </div>
      </div>
      <MobilePanel open={mobile} onClose={() => setMobile(false)}>
        <nav aria-label="Menu di gestione" className="space-y-4 p-4">
          {groups.map((g) => (
            <section key={g.name} aria-label={g.name}>
              <h3 className="px-3 text-base font-extrabold uppercase tracking-wide text-blu">
                {g.name}
              </h3>
              {g.items.map((i) => (
                <Item key={i.href} item={i} />
              ))}
            </section>
          ))}
          <section aria-label="Account">
            <h3 className="px-3 text-base font-extrabold uppercase tracking-wide text-blu">
              Account · {roleLabel}
            </h3>
            <Item
              item={{
                href: "/gestione/account/password",
                label: "Cambia password",
                icon: "key",
              }}
            />
            {superAdmin && (
              <Item
                item={{
                  href: "/gestione/account/sicurezza",
                  label: "Sicurezza (due fattori)",
                  icon: "shield",
                }}
              />
            )}
            <form action="/auth/esci" method="post">
              <button
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 font-bold text-bordeaux ${focus}`}
              >
                <Icon name="out" />
                Esci
              </button>
            </form>
          </section>
        </nav>
      </MobilePanel>
    </header>
  );
}
