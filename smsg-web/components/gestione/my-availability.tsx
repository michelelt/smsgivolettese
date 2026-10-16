"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormError, Loading } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { fmtDate, fmtTime, today, WEEKDAYS } from "@/lib/dates";

type Rule = components["schemas"]["AvailabilityRule"];
const SLOTS = [
  ["Mattina", "08:00", "12:00"],
  ["Pomeriggio", "14:00", "18:00"],
] as const;
const norm = (r: Rule): Rule => ({
  ...r,
  startTime: fmtTime(r.startTime),
  endTime: fmtTime(r.endTime),
});
const same = (r: Rule, d: number, s: string, e: string) =>
  r.weekday === d && r.startTime === s && r.endTime === e;
const isGrid = (r: Rule) =>
  r.weekday <= 6 && SLOTS.some(([, s, e]) => same(r, r.weekday, s, e));

function Weekly() {
  const toast = useToast();
  const q = useQuery({
    queryKey: ["me", "availability"],
    queryFn: () => call(api.GET("/me/availability")),
  });
  const qc = useQueryClient();
  const [edited, setEdited] = useState<Rule[] | null>(null);
  const dirty = edited !== null;
  const rules = edited ?? q.data?.rules.map(norm) ?? [];
  const change = (f: (r: Rule[]) => Rule[]) => setEdited(f(rules));
  const save = useMutation({
    meta: { inline: true },
    mutationFn: () => call(api.PUT("/me/availability", { body: { rules } })),
    onSuccess: (saved) => {
      qc.setQueryData(["me", "availability"], saved);
      setEdited(null);
      toast("Disponibilità salvate");
    },
  });
  const toggle = (d: number, s: string, e: string) =>
    change((r) =>
      r.some((x) => same(x, d, s, e))
        ? r.filter((x) => !same(x, d, s, e))
        : [...r, { weekday: d, startTime: s, endTime: e }],
    );
  const custom = rules
    .filter((r) => !isGrid(r))
    .sort(
      (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
    );
  const f = useForm({
    defaultValues: { weekday: "1", startTime: "", endTime: "" },
  });
  return (
    <>
      <Loading query={q} />
      <p className="mt-4 text-xl">
        Tocca i riquadri nei quali sei di solito libero. Valgono ogni settimana.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {WEEKDAYS.slice(0, 6).map((name, i) => (
          <fieldset key={name} className="rounded-xl border-2 border-ink p-3">
            <legend className="px-1 text-xl font-extrabold">{name}</legend>
            <div className="grid grid-cols-2 gap-3">
              {SLOTS.map(([label, s, e]) => {
                const on = rules.some((r) => same(r, i + 1, s, e));
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(i + 1, s, e)}
                    className={`min-h-16 rounded-xl border-2 border-blu px-2 text-lg font-bold ${on ? "bg-blu text-white" : "text-blu"}`}
                  >
                    {on ? "✓ " : ""}
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <h2 className="mt-8 text-2xl font-extrabold text-blu">Altri orari</h2>
      {custom.length === 0 && (
        <p className="mt-2">Nessun orario personalizzato.</p>
      )}
      <ul className="mt-2 space-y-2">
        {custom.map((r) => (
          <li
            key={`${r.weekday}${r.startTime}${r.endTime}`}
            className="flex flex-wrap items-center gap-3"
          >
            <span className="font-bold">
              {WEEKDAYS[r.weekday - 1]} dalle {r.startTime} alle {r.endTime}
            </span>
            <Button
              auto
              variant="danger"
              aria-label={`Togli ${WEEKDAYS[r.weekday - 1]} dalle ${r.startTime} alle ${r.endTime}`}
              onClick={() => change((l) => l.filter((x) => x !== r))}
            >
              Togli
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 rounded-xl border-2 border-ink p-3"
        noValidate
        onSubmit={f.handleSubmit((v) => {
          change((l) => [
            ...l,
            {
              weekday: Number(v.weekday),
              startTime: v.startTime,
              endTime: v.endTime,
            },
          ]);
          f.reset({ weekday: v.weekday, startTime: "", endTime: "" });
        })}
      >
        <Select label="Giorno" {...f.register("weekday")}>
          {WEEKDAYS.map((n, i) => (
            <option key={n} value={i + 1}>
              {n}
            </option>
          ))}
        </Select>
        <Field
          label="Dalle"
          type="time"
          {...f.register("startTime", { required: "scriva l'ora di inizio" })}
          error={f.formState.errors.startTime?.message}
        />
        <Field
          label="Alle"
          type="time"
          {...f.register("endTime", {
            required: "scriva l'ora di fine",
            validate: (v) =>
              v > f.getValues("startTime") || "deve essere dopo l'inizio",
          })}
          error={f.formState.errors.endTime?.message}
        />
        <Button auto variant="secondary" type="submit" className="mt-4">
          Aggiungi orario
        </Button>
      </form>

      <FormError message={save.error?.message} />
      <div className="mt-6">
        <Button
          auto
          disabled={save.isPending || !dirty}
          onClick={() => save.mutate()}
        >
          Salva le disponibilità
        </Button>
        {dirty && <p className="mt-2 font-bold">Hai modifiche non salvate.</p>}
      </div>
    </>
  );
}

function Absences() {
  const toast = useToast();
  const q = useQuery({
    queryKey: ["me", "absences"],
    queryFn: () => call(api.GET("/me/absences")),
  });
  const f = useForm({
    defaultValues: { startsOn: today(), endsOn: today(), note: "" },
  });
  const add = useMutation({
    meta: { inline: true },
    mutationFn: (v: { startsOn: string; endsOn: string; note: string }) =>
      call(
        api.POST("/me/absences", {
          body: { ...v, note: v.note.trim() || null },
        }),
      ),
    onSuccess: (r) => {
      toast(
        r.conflictingCommitments > 0
          ? `Segnato. Attenzione: hai ${r.conflictingCommitments} ${r.conflictingCommitments === 1 ? "impegno" : "impegni"} in quei giorni, avvisa lo staff.`
          : "Assenza segnata",
        r.conflictingCommitments > 0,
      );
      f.reset({ startsOn: today(), endsOn: today(), note: "" });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) =>
      call(api.DELETE("/me/absences/{id}", { params: { path: { id } } })),
    onSuccess: () => toast("Assenza tolta"),
  });
  return (
    <>
      <h2 className="mt-10 text-2xl font-extrabold text-blu">Non ci sono</h2>
      <p className="mt-2">Segna ferie e giorni in cui non puoi aiutare.</p>
      <Loading query={q} />
      <ul className="mt-2 space-y-2">
        {q.data?.items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3">
            <span className="font-bold">
              Dal {fmtDate(a.startsOn)} al {fmtDate(a.endsOn)}
              {a.note && ` · ${a.note}`}
            </span>
            <Button
              auto
              variant="danger"
              aria-label={`Togli assenza dal ${fmtDate(a.startsOn)} al ${fmtDate(a.endsOn)}`}
              disabled={del.isPending}
              onClick={() => del.mutate(a.id)}
            >
              Togli
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 rounded-xl border-2 border-ink p-3"
        noValidate
        onSubmit={f.handleSubmit((v) => add.mutate(v))}
      >
        <Field
          label="Dal giorno"
          type="date"
          min={today()}
          {...f.register("startsOn", { required: "scelga la data" })}
          error={f.formState.errors.startsOn?.message}
        />
        <Field
          label="Al giorno"
          type="date"
          min={today()}
          {...f.register("endsOn", {
            required: "scelga la data",
            validate: (v) =>
              v >= f.getValues("startsOn") ||
              "non può essere prima dell'inizio",
          })}
          error={f.formState.errors.endsOn?.message}
        />
        <Field
          label="Nota (facoltativa)"
          maxLength={200}
          hint="Non scriva informazioni sulla salute."
          {...f.register("note")}
        />
        <FormError message={add.error?.message} />
        <Button auto type="submit" className="mt-4" disabled={add.isPending}>
          Segna assenza
        </Button>
      </form>
    </>
  );
}

export function MyAvailability() {
  return (
    <>
      <Weekly />
      <Absences />
    </>
  );
}
