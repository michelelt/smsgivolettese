"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MoreActions, PageHeader } from "@/components/ui/actions";
import { Button } from "@/components/ui/button";
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
import {
  CARD,
  useWeek,
  WeekCalendar,
} from "@/components/gestione/week-calendar";
import { api, call } from "@/lib/api/call";
import { addDays, dayLabel, fmtTime } from "@/lib/dates";

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
  const wk = useWeek();
  const { week, sel } = wk;
  const [dlg, setDlg] = useState<Dlg>(null);
  const close = () => setDlg(null);
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
  const assigning =
    dlg?.k === "assign" ? items.find((s) => s.id === dlg.id) : undefined;
  const count = (c: keyof typeof COVERAGE) =>
    items.filter((s) => s.coverage === c).length;
  return (
    <>
      <PageHeader
        title="Turni"
        actions={
          <>
            <Button onClick={() => setDlg({ k: "new", day: sel })}>
              Nuovo turno
            </Button>
            <Button variant="secondary" onClick={() => setDlg({ k: "copy" })}>
              Copia la settimana
            </Button>
            <MoreActions>
              <Button
                variant="secondary"
                onClick={() => setDlg({ k: "types" })}
              >
                Tipi di turno
              </Button>
            </MoreActions>
          </>
        }
      />
      <WeekCalendar
        basePath="/gestione/turni"
        label="Calendario dei turni"
        state={wk}
        query={q}
        ready={!!q.data}
        itemsOf={(d) => items.filter((s) => s.day === d)}
        empty="Nessun turno."
        flagged={(d) =>
          items.some((s) => s.day === d && s.coverage !== "coperto")
        }
        flagText="turni da coprire"
        onAdd={(d) => setDlg({ k: "new", day: d })}
        addLabel={(d) => `Aggiungi turno ${dayLabel(d)}`}
        summary={
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
        }
        renderItem={(s, d) => {
          const label = `${s.shiftType} ${fmtTime(s.startTime)} ${dayLabel(d)}`;
          return (
            <li key={s.id} className={`${CARD} ${TONE[s.coverage]}`}>
              <p className="font-extrabold">{s.shiftType}</p>
              <p className="flex items-center gap-1 whitespace-nowrap">
                <span className="lg:max-2xl:hidden">
                  <Icon name="clock" />
                </span>
                {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-2">
                <span className="font-bold">{COVERAGE[s.coverage]}</span>
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
                <p className="mt-1 break-words text-ink">{s.notes}</p>
              )}
              <Button
                className="mt-2 min-h-11 min-w-0 !px-1 lg:!text-sm 2xl:!text-base"
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
        }}
      />
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
