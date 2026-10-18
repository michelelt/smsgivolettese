"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loading } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { addDays, dayLabel, isDate, mondayOf, today } from "@/lib/dates";

/** Week (Monday) from `?week=`, its 7 days and the selected day (today when in the week). */
export function useWeek() {
  const param = useSearchParams().get("week");
  const week = mondayOf(isDate(param) ? param : today());
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const [sel, setSel] = useState(days.includes(today()) ? today() : week);
  return { week, days, sel, setSel };
}

/** Base class of an item card (tone classes are added by the page: border-l-8 tint). */
export const CARD =
  "min-w-0 rounded-xl border-l-8 bg-white p-2 text-base shadow lg:text-sm xl:p-3 2xl:text-base";

const fmt = (d: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("it-IT", {
    ...o,
    timeZone: "UTC",
  });

/**
 * The week calendar shell shared by Turni, Trasporti, Disponibilità and "I miei impegni":
 * week navigation, mobile day picker + swipe slider, day columns. Pages supply the items
 * (`renderItem` returns the keyed <li> card) and an optional summary and "+ Aggiungi".
 */
export function WeekCalendar<T>({
  basePath,
  label,
  query,
  ready,
  state,
  itemsOf,
  renderItem,
  empty,
  summary,
  flagged,
  flagText,
  onAdd,
  addLabel,
}: {
  basePath: string;
  /** Accessible name of the calendar region. */
  label: string;
  query: { isPending: boolean; error: Error | null };
  ready: boolean;
  state: ReturnType<typeof useWeek>;
  itemsOf: (day: string) => T[];
  renderItem: (item: T, day: string) => ReactNode;
  empty: string;
  summary?: ReactNode;
  /** Day needs attention: dot on the day button (and flagText in its name). */
  flagged?: (day: string) => boolean;
  flagText?: string;
  onAdd?: (day: string) => void;
  addLabel?: (day: string) => string;
}) {
  const { week, days, sel, setSel } = state;
  const track = useRef<HTMLOListElement>(null);
  const smooth = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const goTo = (d: string, behavior: ScrollBehavior = smooth()) => {
    const el = track.current?.querySelector<HTMLElement>(`[data-day="${d}"]`);
    if (el)
      track.current?.scrollTo({
        left: el.offsetLeft - track.current.offsetLeft,
        behavior,
      });
    setSel(d);
  };
  const step = (n: number) => {
    const i = Math.min(6, Math.max(0, days.indexOf(sel) + n));
    goTo(days[i]);
  };
  // Mobile slider: start on the selected day, then follow the visible panel.
  useEffect(() => {
    const t = track.current;
    if (!ready || !t || !matchMedia("(max-width: 1023px)").matches) return;
    const first = t.querySelector<HTMLElement>(`[data-day="${sel}"]`);
    if (first)
      t.scrollTo({ left: first.offsetLeft - t.offsetLeft, behavior: "auto" });
    const io = new IntersectionObserver(
      (es) =>
        es.forEach(
          (e) =>
            e.isIntersecting && setSel((e.target as HTMLElement).dataset.day!),
        ),
      { root: t, threshold: 0.6 },
    );
    t.querySelectorAll("[data-day]").forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per loaded week
  }, [ready, week]);
  const nav = (w: string) => `${basePath}?week=${w}`;
  const todayD = today();
  const showSun = ready && itemsOf(days[6]).length > 0;
  const last = days[6];
  const range =
    week.slice(0, 7) === last.slice(0, 7)
      ? `${fmt(week, { day: "numeric" })}–${fmt(last, { day: "numeric", month: "long", year: "numeric" })}`
      : `${fmt(week, { day: "numeric", month: "long" })} – ${fmt(last, { day: "numeric", month: "long", year: "numeric" })}`;
  const arrow =
    "inline-flex size-12 items-center justify-center rounded-xl border-2 border-blu bg-white text-blu shadow-sm";
  return (
    <>
      <nav
        aria-label="Settimana"
        className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-ink/15 bg-white p-3 shadow-sm"
      >
        <Link
          href={nav(addDays(week, -7))}
          className={arrow}
          aria-label="Settimana precedente"
        >
          <Icon name="back" />
        </Link>
        <Link
          href={nav(addDays(week, 7))}
          className={arrow}
          aria-label="Settimana successiva"
        >
          <Icon name="next" />
        </Link>
        <p
          className="min-w-0 flex-1 basis-40 text-xl font-extrabold"
          aria-live="polite"
        >
          {range}
        </p>
        <ButtonLink variant="secondary" href={nav(mondayOf(todayD))}>
          Oggi
        </ButtonLink>
      </nav>
      <Loading query={query} />
      {ready && summary}
      <div className="mt-4 lg:hidden">
        <div
          role="group"
          aria-label="Giorno"
          className="flex min-w-0 flex-1 gap-1"
        >
          {days.map((d) => {
            const open = !!flagged?.(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={d === sel}
                aria-label={`${dayLabel(d)}${d === todayD ? ", oggi" : ""}${open ? `, ${flagText}` : ""}`}
                onClick={() => goTo(d)}
                className={`relative flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center rounded-xl border-2 px-0 font-bold ${d === todayD ? "ring-2 ring-bordeaux ring-offset-2" : ""} ${d === sel ? "border-blu bg-blu text-white" : "border-blu/40 bg-white text-blu"}`}
              >
                <span className="text-base capitalize">
                  {fmt(d, { weekday: "short" })}
                </span>
                <span className="text-xl leading-none">
                  {fmt(d, { day: "numeric" })}
                </span>
                <span
                  aria-hidden="true"
                  className={`mt-1 size-2.5 rounded-full ${open ? (d === sel ? "bg-white" : "bg-bordeaux") : "bg-transparent"}`}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 ">
          <button
            type="button"
            onClick={() => step(-1)}
            className="min-h-12 min-w-0 rounded-xl border-2 border-blu bg-white font-bold text-blu"
          >
            <span aria-hidden="true">←</span> Giorno prima
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="min-h-12 min-w-0 rounded-xl border-2 border-blu bg-white font-bold text-blu"
          >
            Giorno dopo <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      {ready && (
        <div role="region" aria-label={label} className="mt-4">
          <ol
            ref={track}
            className={`relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:grid lg:snap-none lg:overflow-visible ${showSun ? "lg:grid-cols-7" : "lg:grid-cols-6"}`}
          >
            {days.map((d) => {
              const list = itemsOf(d);
              return (
                <li
                  key={d}
                  data-day={d}
                  aria-label={dayLabel(d)}
                  className={`w-full flex-none snap-center lg:w-auto lg:min-w-0 ${d === days[6] && !showSun ? "lg:hidden" : "lg:block"} min-w-0 rounded-2xl border p-2 shadow-sm lg:flex-auto ${d === todayD ? "border-blu bg-blu/5 ring-2 ring-blu" : "border-ink/15 bg-white"}`}
                >
                  <h2 className="flex flex-wrap items-baseline gap-x-2 px-1 capitalize">
                    <span className="text-lg font-extrabold lg:max-xl:hidden">
                      {fmt(d, { weekday: "long" })}
                    </span>
                    <span
                      aria-hidden
                      className="hidden text-lg font-extrabold lg:max-xl:inline"
                    >
                      {fmt(d, { weekday: "short" })}
                    </span>
                    <span className="text-2xl font-extrabold text-bordeaux">
                      {fmt(d, { day: "numeric" })}
                    </span>
                    {d === todayD && (
                      <span className="rounded-full bg-blu px-2 text-base font-bold normal-case text-white">
                        oggi
                      </span>
                    )}
                  </h2>
                  <ul className="mt-2 space-y-2">
                    {list.map((it) => renderItem(it, d))}
                  </ul>
                  {list.length === 0 && (
                    <p className="mt-2 px-1 text-ink/70">{empty}</p>
                  )}
                  {onAdd && (
                    <button
                      type="button"
                      onClick={() => onAdd(d)}
                      aria-label={addLabel?.(d)}
                      className="mt-2 min-h-11 w-full rounded-xl border-2 border-dashed border-blu/50 font-bold text-blu"
                    >
                      + Aggiungi
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </>
  );
}
