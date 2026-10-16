"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError, Loading, Pill } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";

type Vehicle = components["schemas"]["Vehicle"];

const schema = z.object({
  plate: z
    .string()
    .trim()
    .min(1, "scriva la targa")
    .max(20, "al massimo 20 caratteri"),
  model: z
    .string()
    .trim()
    .min(1, "scriva il modello")
    .max(100, "al massimo 100 caratteri"),
  seats: z.coerce
    .number<string>("scriva un numero")
    .int("scriva un numero intero")
    .min(1, "almeno 1 posto")
    .max(20, "al massimo 20 posti"),
  wheelchairAccessible: z.boolean(),
});
type Values = z.input<typeof schema>;

function Body({ v, onClose }: { v?: Vehicle; onClose: () => void }) {
  const toast = useToast();
  const f = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      plate: v?.plate ?? "",
      model: v?.model ?? "",
      seats: String(v?.seats ?? 4),
      wheelchairAccessible: v?.wheelchairAccessible ?? false,
    },
  });
  const e = f.formState.errors;
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (x: z.output<typeof schema>) =>
      v
        ? call(
            api.PATCH("/vehicles/{id}", {
              params: { path: { id: v.id } },
              body: x,
            }),
          )
        : call(api.POST("/vehicles", { body: x })),
    onSuccess: () => {
      toast(v ? "Mezzo salvato" : "Mezzo aggiunto");
      onClose();
    },
  });
  return (
    <form onSubmit={f.handleSubmit((x) => m.mutate(x))} noValidate>
      <Field
        label="Targa"
        autoComplete="off"
        {...f.register("plate")}
        error={e.plate?.message}
      />
      <Field
        label="Modello"
        autoComplete="off"
        {...f.register("model")}
        error={e.model?.message}
      />
      <Field
        label="Posti"
        type="number"
        inputMode="numeric"
        min={1}
        {...f.register("seats")}
        error={e.seats?.message}
      />
      <Checkbox
        label="Adatto alla carrozzina"
        {...f.register("wheelchairAccessible")}
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

export default function Mezzi() {
  const toast = useToast();
  const q = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => call(api.GET("/vehicles")),
  });
  const [dlg, setDlg] = useState<{ v?: Vehicle } | null>(null);
  const toggle = useMutation({
    mutationFn: (v: Vehicle) =>
      call(
        api.PATCH("/vehicles/{id}", {
          params: { path: { id: v.id } },
          body: { active: !v.active },
        }),
      ),
    onSuccess: (_d, v) =>
      toast(v.active ? "Mezzo disattivato" : "Mezzo riattivato"),
  });
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">Mezzi</h1>
      <div className="mt-4">
        <Button auto onClick={() => setDlg({})}>
          Aggiungi un mezzo
        </Button>
      </div>
      <Loading query={q} />
      {q.data?.items.length === 0 && <p className="mt-4">Nessun mezzo.</p>}
      <ul className="mt-4 space-y-3">
        {q.data?.items.map((v) => (
          <li key={v.id} className="rounded-xl border-2 border-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xl font-extrabold">
                {v.model} · {v.plate}
              </p>
              <Pill>{v.active ? "In uso" : "Non in uso"}</Pill>
            </div>
            <p>
              {v.seats} posti
              {v.wheelchairAccessible && " · adatto alla carrozzina"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                auto
                variant="secondary"
                aria-label={`Modifica ${v.model} ${v.plate}`}
                onClick={() => setDlg({ v })}
              >
                Modifica
              </Button>
              <Button
                auto
                variant={v.active ? "danger" : "secondary"}
                disabled={toggle.isPending}
                aria-label={`${v.active ? "Disattiva" : "Riattiva"} ${v.model} ${v.plate}`}
                onClick={() => toggle.mutate(v)}
              >
                {v.active ? "Disattiva" : "Riattiva"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Dialog
        open={!!dlg}
        onClose={() => setDlg(null)}
        title={dlg?.v ? "Modifica mezzo" : "Nuovo mezzo"}
      >
        {dlg && <Body v={dlg.v} onClose={() => setDlg(null)} />}
      </Dialog>
    </>
  );
}
