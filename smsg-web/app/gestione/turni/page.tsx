"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Filters, Loading, Pill } from "@/components/ui/bits";
import { Button, ButtonLink } from "@/components/ui/button";
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
  const uncovered = items.filter((s) => s.coverage === "scoperto").length;
  const assigning =
    dlg?.k === "assign" ? items.find((s) => s.id === dlg.id) : undefined;
  const nav = (w: string) => `/gestione/turni?week=${w}`;
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">Turni</h1>
      <nav
        aria-label="Settimana"
        className="mt-4 flex flex-wrap items-center gap-3"
      >
        <ButtonLink variant="secondary" href={nav(addDays(week, -7))}>
          ← Settimana prima
        </ButtonLink>
        <span className="font-bold">
          Dal {dayLabel(week)} al {dayLabel(addDays(week, 6))}
        </span>
        <ButtonLink variant="secondary" href={nav(addDays(week, 7))}>
          Settimana dopo →
        </ButtonLink>
        <ButtonLink variant="secondary" href={nav(mondayOf(today()))}>
          Questa settimana
        </ButtonLink>
      </nav>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button auto onClick={() => setDlg({ k: "new", day: sel })}>
          Nuovo turno
        </Button>
        <Button auto variant="secondary" onClick={() => setDlg({ k: "copy" })}>
          Copia la settimana
        </Button>
        <Button auto variant="secondary" onClick={() => setDlg({ k: "types" })}>
          Tipi di turno
        </Button>
      </div>
      <p className="mt-4 font-bold" role="status">
        {q.data && `Turni scoperti in questa settimana: ${uncovered}`}
      </p>
      <Loading query={q} />
      <div className="md:hidden">
        <Filters
          label="Giorno"
          value={sel}
          onChange={setSel}
          options={days.map(
            (d) => [d, dayLabel(d).split(" ").slice(0, 2).join(" ")] as const,
          )}
        />
      </div>
      {q.data && (
        <ol className="mt-4 grid gap-3 md:grid-cols-7">
          {days.map((d) => (
            <li
              key={d}
              className={`${d === sel ? "" : "hidden"} min-w-0 rounded-xl border-2 border-ink p-2 md:block`}
            >
              <h2 className="text-lg font-extrabold capitalize">
                {dayLabel(d)}
              </h2>
              <ul className="mt-2 space-y-2">
                {items
                  .filter((s) => s.day === d)
                  .map((s) => (
                    <li
                      key={s.id}
                      className="rounded-xl border-2 border-blu p-2"
                    >
                      <p className="font-bold">{s.shiftType}</p>
                      <p>
                        {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
                      </p>
                      <p>
                        <Pill>{COVERAGE[s.coverage]}</Pill>
                      </p>
                      <p>
                        {s.filled}/{s.requiredSlots} posti
                      </p>
                      {s.assignments.length > 0 && (
                        <ul className="text-base">
                          {s.assignments.map((a) => (
                            <li key={a.id}>
                              {a.firstName} {a.lastName}
                              {a.status !== "confermato" &&
                                ` (${a.status === "proposto" ? "da confermare" : "rifiutato"})`}
                            </li>
                          ))}
                        </ul>
                      )}
                      {s.notes && <p className="text-base">{s.notes}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          auto
                          onClick={() => setDlg({ k: "assign", id: s.id })}
                          aria-label={`Assegna volontari: ${s.shiftType} ${fmtTime(s.startTime)} ${dayLabel(d)}`}
                        >
                          Assegna
                        </Button>
                        <Button
                          auto
                          variant="secondary"
                          onClick={() => setDlg({ k: "edit", s })}
                          aria-label={`Modifica turno ${s.shiftType} ${fmtTime(s.startTime)} ${dayLabel(d)}`}
                        >
                          Modifica
                        </Button>
                        <Button
                          auto
                          variant="danger"
                          onClick={() => setDlg({ k: "delete", s })}
                          aria-label={`Elimina turno ${s.shiftType} ${fmtTime(s.startTime)} ${dayLabel(d)}`}
                        >
                          Elimina
                        </Button>
                      </div>
                    </li>
                  ))}
              </ul>
              {items.every((s) => s.day !== d) && <p>Nessun turno.</p>}
            </li>
          ))}
        </ol>
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
