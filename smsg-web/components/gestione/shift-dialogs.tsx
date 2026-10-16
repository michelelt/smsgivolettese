"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError, Loading, Pill } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { addDays, fmtTime, mondayOf } from "@/lib/dates";

export type Shift = components["schemas"]["Shift"];
type Candidate = components["schemas"]["Candidate"];

export const useShiftTypes = () =>
  useQuery({
    queryKey: ["shift-types"],
    queryFn: () => call(api.GET("/shift-types")),
  });

const schema = z
  .object({
    shiftTypeId: z.string().min(1, "scelga il tipo di turno"),
    day: z.string().min(1, "scelga il giorno"),
    startTime: z.string().min(1, "scriva l'ora di inizio"),
    endTime: z.string().min(1, "scriva l'ora di fine"),
    requiredSlots: z.coerce
      .number<string>("scriva un numero")
      .int("scriva un numero intero")
      .min(1, "almeno 1 posto")
      .max(50, "al massimo 50 posti"),
    notes: z.string().max(500, "al massimo 500 caratteri"),
  })
  .refine((v) => !v.startTime || !v.endTime || v.endTime > v.startTime, {
    path: ["endTime"],
    message: "deve essere dopo l'inizio",
  });
type Values = z.input<typeof schema>;

function FormBody({
  shift,
  day,
  onClose,
}: {
  shift?: Shift;
  day: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const types = useShiftTypes();
  const f = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      shiftTypeId: shift?.shiftTypeId ?? "",
      day: shift?.day ?? day,
      startTime: fmtTime(shift?.startTime ?? "09:00"),
      endTime: fmtTime(shift?.endTime ?? "12:00"),
      requiredSlots: String(shift?.requiredSlots ?? 1),
      notes: shift?.notes ?? "",
    },
  });
  const e = f.formState.errors;
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: z.output<typeof schema>) => {
      const body = { ...v, notes: v.notes.trim() || null };
      return shift
        ? call(
            api.PATCH("/shifts/{id}", {
              params: { path: { id: shift.id } },
              body,
            }),
          )
        : call(api.POST("/shifts", { body }));
    },
    onSuccess: () => {
      toast(shift ? "Turno modificato" : "Turno creato");
      onClose();
    },
  });
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} noValidate>
      <Select
        label="Tipo di turno"
        {...f.register("shiftTypeId")}
        error={e.shiftTypeId?.message}
      >
        <option value="">— scelga —</option>
        {types.data?.items
          .filter((t) => t.active || t.id === shift?.shiftTypeId)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
      </Select>
      <Field
        label="Giorno"
        type="date"
        {...f.register("day")}
        error={e.day?.message}
      />
      <Field
        label="Dalle"
        type="time"
        {...f.register("startTime")}
        error={e.startTime?.message}
      />
      <Field
        label="Alle"
        type="time"
        {...f.register("endTime")}
        error={e.endTime?.message}
      />
      <Field
        label="Volontari richiesti"
        type="number"
        inputMode="numeric"
        min={1}
        {...f.register("requiredSlots")}
        error={e.requiredSlots?.message}
      />
      <Textarea
        label="Note (facoltative)"
        hint="I volontari leggono queste note: non inserisca dati personali o sanitari."
        {...f.register("notes")}
        error={e.notes?.message}
      />
      <FormError message={m.error?.message} />
      <DialogActions>
        <Button auto type="submit" disabled={m.isPending}>
          Salva
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Annulla
        </Button>
      </DialogActions>
    </form>
  );
}

export function ShiftFormDialog({
  open,
  onClose,
  shift,
  day,
}: {
  open: boolean;
  onClose: () => void;
  shift?: Shift;
  day: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={shift ? "Modifica turno" : "Nuovo turno"}
    >
      <FormBody shift={shift} day={day} onClose={onClose} />
    </Dialog>
  );
}

const LABEL: Record<Candidate["status"], string> = {
  disponibile: "Disponibile",
  non_indicata: "Disponibilità non indicata",
  non_disponibile: "Non disponibile in quell'orario",
  gia_impegnato: "Già impegnato",
  assente: "Assente",
};
const ASSIGNED = {
  proposto: "Proposto",
  confermato: "Confermato",
  rifiutato: "Ha rifiutato",
};

export function AssignDialog({
  shift,
  onClose,
}: {
  shift?: Shift;
  onClose: () => void;
}) {
  const toast = useToast();
  const q = useQuery({
    queryKey: ["shifts", "candidates", shift?.id, shift?.assignments.length],
    enabled: !!shift,
    queryFn: () =>
      call(
        api.GET("/shifts/{id}/candidates", {
          params: { path: { id: shift!.id } },
        }),
      ),
  });
  const act = useMutation({
    meta: { inline: true },
    mutationFn: (v: { volunteerId?: string; remove?: string }) =>
      v.remove
        ? call(
            api.DELETE("/shifts/{id}/assignments/{assignmentId}", {
              params: { path: { id: shift!.id, assignmentId: v.remove } },
            }),
          )
        : call(
            api.POST("/shifts/{id}/assignments", {
              params: { path: { id: shift!.id } },
              body: { volunteerId: v.volunteerId! },
            }),
          ),
    onSuccess: (_d, v) => {
      act.reset();
      toast(
        v.remove
          ? "Volontario tolto dal turno"
          : "Volontario assegnato: riceverà un'email",
      );
    },
  });
  const assigned = new Set(shift?.assignments.map((a) => a.volunteerId));
  return (
    <Dialog
      open={!!shift}
      onClose={onClose}
      title={
        shift
          ? `Assegna: ${shift.shiftType} ${fmtTime(shift.startTime)}–${fmtTime(shift.endTime)}`
          : ""
      }
    >
      {shift && (
        <>
          <p className="mt-2 font-bold">
            Coperti {shift.filled} posti su {shift.requiredSlots}
          </p>
          <ul className="mt-2 space-y-2">
            {shift.assignments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span className="font-bold">
                  {a.firstName} {a.lastName}
                </span>
                <Pill>{ASSIGNED[a.status]}</Pill>
                <Button
                  auto
                  variant="danger"
                  disabled={act.isPending}
                  aria-label={`Togli ${a.firstName} ${a.lastName}`}
                  onClick={() => act.mutate({ remove: a.id })}
                >
                  Togli
                </Button>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-xl font-extrabold">Volontari</h3>
          <Loading query={q} />
          <ul className="mt-2 space-y-2">
            {q.data?.items
              .filter((c) => !assigned.has(c.volunteerId))
              .map((c) => (
                <li
                  key={c.volunteerId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-ink p-2"
                >
                  <span>
                    <span className="font-bold">
                      {c.firstName} {c.lastName}
                    </span>
                    <br />
                    {LABEL[c.status]} · {c.commitmentsInMonth} impegni nel mese
                  </span>
                  <Button
                    auto
                    disabled={!c.selectable || act.isPending}
                    aria-label={`Assegna ${c.firstName} ${c.lastName}`}
                    onClick={() => act.mutate({ volunteerId: c.volunteerId })}
                  >
                    Assegna
                  </Button>
                </li>
              ))}
          </ul>
          <FormError message={act.error?.message} />
          <DialogActions>
            <Button auto variant="secondary" onClick={onClose}>
              Chiudi
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

export function CopyWeekDialog({
  open,
  onClose,
  week,
}: {
  open: boolean;
  onClose: () => void;
  week: string;
}) {
  const toast = useToast();
  const [to, setTo] = useState(addDays(week, 7));
  const m = useMutation({
    meta: { inline: true },
    mutationFn: () =>
      call(
        api.POST("/shifts/copy-week", {
          body: { fromWeek: week, toWeek: mondayOf(to) },
        }),
      ),
    onSuccess: (r) => {
      toast(`Turni copiati: ${r.created} nuovi, ${r.skipped} già presenti`);
      onClose();
    },
  });
  return (
    <Dialog open={open} onClose={onClose} title="Copia la settimana">
      <p className="mt-2">
        Copia i turni (senza i volontari) della settimana che inizia il{" "}
        {week.split("-").reverse().join("/")}.
      </p>
      <Field
        label="In quale settimana? (un giorno qualsiasi)"
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <FormError message={m.error?.message} />
      <DialogActions>
        <Button auto disabled={m.isPending || !to} onClick={() => m.mutate()}>
          Copia
        </Button>
        <Button auto variant="secondary" onClick={onClose}>
          Annulla
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ShiftTypesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const q = useShiftTypes();
  const f = useForm<{ name: string }>({ defaultValues: { name: "" } });
  const add = useMutation({
    meta: { inline: true },
    mutationFn: (v: { name: string }) =>
      call(api.POST("/shift-types", { body: { name: v.name.trim() } })),
    onSuccess: () => f.reset(),
  });
  const toggle = useMutation({
    meta: { inline: true },
    mutationFn: (t: { id: string; active: boolean }) =>
      call(
        api.PATCH("/shift-types/{id}", {
          params: { path: { id: t.id } },
          body: { active: !t.active },
        }),
      ),
  });
  return (
    <Dialog open={open} onClose={onClose} title="Tipi di turno">
      <Loading query={q} />
      <ul className="mt-3 space-y-2">
        {q.data?.items.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{t.name}</span>
            {!t.active && <Pill>Non attivo</Pill>}
            <Button
              auto
              variant="secondary"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate(t)}
              aria-label={`${t.active ? "Disattiva" : "Riattiva"} ${t.name}`}
            >
              {t.active ? "Disattiva" : "Riattiva"}
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={f.handleSubmit((v) => add.mutate(v))} noValidate>
        <Field
          label="Nuovo tipo di turno"
          maxLength={100}
          {...f.register("name", { required: "scriva il nome" })}
          error={f.formState.errors.name?.message}
        />
        <FormError message={add.error?.message ?? toggle.error?.message} />
        <DialogActions>
          <Button auto type="submit" disabled={add.isPending}>
            Aggiungi
          </Button>
          <Button auto type="button" variant="secondary" onClick={onClose}>
            Chiudi
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
