"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loading } from "@/components/ui/bits";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  AssignDialog,
  CopyWeekDialog,
  ShiftFormDialog,
  ShiftTypesDialog,
  type Shift,
} from "@/components/gestione/shift-dialogs";
import { api, call } from "@/lib/api/call";
import {
  addDays,
  dayLabel,
  fmtTime,
  isDate,
  mondayOf,
  today,
} from "@/lib/dates";

const COVERAGE = {
  scoperto: "✗ Scoperto",
  parziale: "◐ Parziale",
  coperto: "✓ Coperto",
} as const;

const SUMMARY = {
  scoperto: "Scoperti",
  parziale: "Parziali",
  coperto: "Coperti",
} as const;
// Dark text on a light tint (AA); the stripe, the icon and the label carry the state too.
const TONE = {
  scoperto: "border-red-800 bg-red-50 text-red-900",
  parziale: "border-amber-700 bg-amber-50 text-amber-950",
  coperto: "border-green-800 bg-green-50 text-green-950",
} as const;
const CHIP: Record<string, string> = {
  confermato: "✓",
  proposto: "?",
  rifiutato: "✗",
};

type Dlg =
  | { k: "new"; day: string }
  | { k: "edit"; s: Shift }
  | { k: "assign"; id: string }
  | { k: "delete"; s: Shift }
  | { k: "copy" }
  | { k: "types" }
  | null;

export default function Turni() {
  const toast = useToast();
  const param = useSearchParams().get("week");
  const week = mondayOf(isDate(param) ? param : today());
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const [sel, setSel] = useState(days.includes(today()) ? today() : week);
  const [dlg, setDlg] = useState<Dlg>(null);
  const close = () => setDlg(null);
  const track = useRef<HTMLOListElement>(null);
  const q = useQuery({
    queryKey: ["shifts", week],
    queryFn: () =>
      call(
        api.GET("/shifts", {
          params: { query: { from: week, to: addDays(week, 6) } },
        }),
      ),
  });
  const del = useMutation({
    meta: { inline: true },
    mutationFn: (id: string) =>
      call(api.DELETE("/shifts/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      toast("Turno eliminato");
      close();
    },
  });
  const items = q.data?.items ?? [];
  const ready = !!q.data;
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
  const assigning =
    dlg?.k === "assign" ? items.find((s) => s.id === dlg.id) : undefined;
  const nav = (w: string) => `/gestione/turni?week=${w}`;
  const todayD = today();
  const showSun = items.some((s) => s.day === days[6]);
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("it-IT", {
      ...o,
      timeZone: "UTC",
    });
  const last = days[6];
  const range =
    week.slice(0, 7) === last.slice(0, 7)
      ? `${fmt(week, { day: "numeric" })}–${fmt(last, { day: "numeric", month: "long", year: "numeric" })}`
      : `${fmt(week, { day: "numeric", month: "long" })} – ${fmt(last, { day: "numeric", month: "long", year: "numeric" })}`;
  const count = (c: keyof typeof COVERAGE) =>
    items.filter((s) => s.coverage === c).length;
  const arrow =
    "inline-flex size-12 items-center justify-center rounded-xl border-2 border-blu bg-white text-blu shadow-sm";
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold text-bordeaux">Turni</h1>
        <div className="flex flex-wrap gap-3">
          <Button auto onClick={() => setDlg({ k: "new", day: sel })}>
            Nuovo turno
          </Button>
          <Button
            auto
            variant="secondary"
            onClick={() => setDlg({ k: "copy" })}
          >
            Copia la settimana
          </Button>
          <Button
            auto
            variant="secondary"
            onClick={() => setDlg({ k: "types" })}
          >
            Tipi di turno
          </Button>
        </div>
      </div>
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
      <Loading query={q} />
      {q.data && (
        <dl
          className="mt-4 grid grid-cols-3 gap-2 sm:gap-3"
          aria-label="Riepilogo della settimana"
        >
          {(Object.keys(COVERAGE) as (keyof typeof COVERAGE)[]).map((c) => (
            <div
              key={c}
              className={`min-w-0 rounded-2xl border-l-8 p-2 shadow-sm sm:p-3 ${TONE[c]}`}
            >
              <dt className="text-base font-bold">{SUMMARY[c]}</dt>
              <dd className="text-3xl font-extrabold">{count(c)}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-4 lg:hidden">
        <div
          role="group"
          aria-label="Giorno"
          className="flex min-w-0 flex-1 gap-1"
        >
          {days.map((d) => {
            const open = items.some(
              (s) => s.day === d && s.coverage !== "coperto",
            );
            return (
              <button
                key={d}
                type="button"
                aria-pressed={d === sel}
                aria-label={`${dayLabel(d)}${d === todayD ? ", oggi" : ""}${open ? ", turni da coprire" : ""}`}
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
            aria-label="Giorno precedente"
            className="min-h-12 min-w-0 rounded-xl border-2 border-blu bg-white font-bold text-blu"
          >
            ← Giorno prima
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Giorno successivo"
            className="min-h-12 min-w-0 rounded-xl border-2 border-blu bg-white font-bold text-blu"
          >
            Giorno dopo →
          </button>
        </div>
      </div>
      {q.data && (
        <div
          role="region"
          aria-roledescription="carosello"
          aria-label="Calendario dei turni"
          className="mt-4"
        >
          <ol
            ref={track}
            tabIndex={0}
            className={`relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:grid lg:snap-none lg:overflow-visible ${showSun ? "lg:grid-cols-7" : "lg:grid-cols-6"}`}
          >
            {days.map((d) => {
              const list = items.filter((s) => s.day === d);
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
                    {list.map((s) => {
                      const label = `${s.shiftType} ${fmtTime(s.startTime)} ${dayLabel(d)}`;
                      return (
                        <li
                          key={s.id}
                          className={`min-w-0 rounded-xl border-l-8 bg-white p-2 text-base shadow lg:text-sm xl:p-3 2xl:text-base ${TONE[s.coverage]}`}
                        >
                          <p className="font-extrabold">{s.shiftType}</p>
                          <p className="flex items-center gap-1 whitespace-nowrap">
                            <span className="lg:max-2xl:hidden">
                              <Icon name="clock" />
                            </span>
                            {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
                          </p>
                          <p className="mt-1 flex flex-wrap gap-x-2">
                            <span className="font-bold">
                              {COVERAGE[s.coverage]}
                            </span>
                            <span>
                              {s.filled}/{s.requiredSlots} posti
                            </span>
                          </p>
                          <div
                            aria-hidden="true"
                            className="mt-1 h-2 overflow-hidden rounded-full bg-ink/15"
                          >
                            <div
                              className="h-full bg-current"
                              style={{
                                width: `${Math.min(100, (s.filled / Math.max(1, s.requiredSlots)) * 100)}%`,
                              }}
                            />
                          </div>
                          {s.assignments.length > 0 && (
                            <ul className="mt-2 flex flex-wrap gap-1 text-base text-ink">
                              {s.assignments.map((a) => (
                                <li
                                  key={a.id}
                                  className={`max-w-full rounded-md border border-ink/30 bg-white px-1.5 text-sm ${a.status === "rifiutato" ? "text-ink/70 line-through" : ""}`}
                                >
                                  {CHIP[a.status] ?? "•"}{" "}
                                  <span className="lg:hidden">
                                    {a.firstName} {a.lastName}
                                  </span>
                                  <span
                                    className="hidden lg:inline"
                                    title={`${a.firstName} ${a.lastName}`}
                                  >
                                    {a.firstName} {a.lastName.slice(0, 1)}.
                                  </span>
                                  <span className="sr-only">
                                    {a.status === "proposto"
                                      ? " (da confermare)"
                                      : a.status === "rifiutato"
                                        ? " (rifiutato)"
                                        : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {s.notes && (
                            <p className="mt-1 break-words text-ink">
                              {s.notes}
                            </p>
                          )}
                          <Button
                            className="mt-2 min-w-0 !px-1 lg:!min-h-10 lg:!text-sm 2xl:!text-base"
                            onClick={() => setDlg({ k: "assign", id: s.id })}
                            aria-label={`Assegna volontari: ${label}`}
                          >
                            Assegna
                          </Button>
                          <div className="mt-2 grid grid-cols-2 gap-2 ">
                            <Button
                              variant="secondary"
                              className="inline-flex !min-h-11 min-w-0 items-center justify-center gap-1 !px-1 lg:!text-sm 2xl:!text-base"
                              onClick={() => setDlg({ k: "edit", s })}
                              aria-label={`Modifica turno ${label}`}
                              title="Modifica"
                            >
                              <Icon name="edit" />
                              <span className="lg:sr-only">Modifica</span>
                            </Button>
                            <Button
                              variant="danger"
                              className="inline-flex !min-h-11 min-w-0 items-center justify-center gap-1 !px-1 lg:!text-sm 2xl:!text-base"
                              onClick={() => setDlg({ k: "delete", s })}
                              aria-label={`Elimina turno ${label}`}
                              title="Elimina"
                            >
                              <Icon name="trash" />
                              <span className="lg:sr-only">Elimina</span>
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {list.length === 0 && (
                    <p className="mt-2 px-1 text-ink/70">Nessun turno.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setDlg({ k: "new", day: d })}
                    aria-label={`Aggiungi turno ${dayLabel(d)}`}
                    className="mt-2 min-h-11 w-full rounded-xl border-2 border-dashed border-blu/50 font-bold text-blu"
                  >
                    + Aggiungi
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <ShiftFormDialog
        open={dlg?.k === "new" || dlg?.k === "edit"}
        onClose={close}
        shift={dlg?.k === "edit" ? dlg.s : undefined}
        day={dlg?.k === "new" ? dlg.day : sel}
      />
      <AssignDialog shift={assigning} onClose={close} />
      <CopyWeekDialog open={dlg?.k === "copy"} onClose={close} week={week} />
      <ShiftTypesDialog open={dlg?.k === "types"} onClose={close} />
      <ConfirmDialog
        open={dlg?.k === "delete"}
        onClose={() => {
          close();
          del.reset();
        }}
        title="Eliminare il turno?"
        confirmLabel="Elimina turno"
        pending={del.isPending}
        error={del.error?.message}
        onConfirm={() => dlg?.k === "delete" && del.mutate(dlg.s.id)}
      >
        <p>I volontari già avvisati ricevono un&apos;email di annullamento.</p>
      </ConfirmDialog>
    </>
  );
}
