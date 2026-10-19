"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ActionBar, PageHeader } from "@/components/ui/actions";
import { FormError, Loading, Pill } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import { useServices } from "@/lib/api/hooks";
import type { components } from "@/lib/api/schema";
import { optText, orNull } from "@/lib/forms";

type Service = components["schemas"]["StaffService"];

const schema = z.object({
  name: z.string().trim().min(1, "scrivi il nome").max(120),
  description: optText(1000),
  scheduleNote: optText(200),
  active: z.boolean(),
  sortOrder: z
    .string()
    .refine((v) => /^\d{1,4}$/.test(v), "scrivi un numero intero"),
});
type Values = z.infer<typeof schema>;

function Body({
  service,
  onClose,
}: {
  service?: Service;
  onClose: () => void;
}) {
  const toast = useToast();
  const f = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: service?.name ?? "",
      description: service?.description ?? "",
      scheduleNote: service?.scheduleNote ?? "",
      active: service?.active ?? true,
      sortOrder: String(service?.sortOrder ?? 0),
    },
  });
  const e = f.formState.errors;
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: Values) => {
      const body = {
        name: v.name,
        description: orNull(v.description),
        scheduleNote: orNull(v.scheduleNote),
        active: v.active,
        sortOrder: Number(v.sortOrder),
      };
      return service
        ? call(
            api.PATCH("/services/{id}", {
              params: { path: { id: service.id } },
              body,
            }),
          )
        : call(api.POST("/services", { body }));
    },
    onSuccess: () => {
      toast("Servizio salvato");
      onClose();
    },
  });
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} noValidate>
      <Field
        label="Nome del servizio"
        {...f.register("name")}
        error={e.name?.message}
      />
      <Textarea
        label="Descrizione (sul sito)"
        {...f.register("description")}
        error={e.description?.message}
      />
      <Field
        label="Quando (sul sito)"
        hint="Per esempio: martedì mattina"
        {...f.register("scheduleNote")}
        error={e.scheduleNote?.message}
      />
      <Field
        label="Posizione nell'elenco"
        inputMode="numeric"
        {...f.register("sortOrder")}
        error={e.sortOrder?.message}
      />
      <Checkbox label="Attivo (visibile sul sito)" {...f.register("active")} />
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

export default function Servizi() {
  const q = useServices();
  const [edit, setEdit] = useState<Service | "new" | null>(null);
  const close = () => setEdit(null);
  return (
    <>
      <PageHeader
        title="Servizi"
        actions={<Button onClick={() => setEdit("new")}>Nuovo servizio</Button>}
      />
      <Loading query={q} />
      <ul className="mt-4 space-y-3">
        {q.data?.items.map((s) => (
          <li key={s.id} className="rounded-xl border-2 border-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xl font-extrabold">{s.name}</p>
              <Pill>{s.active ? "Attivo" : "Non attivo"}</Pill>
            </div>
            {s.scheduleNote && <p>{s.scheduleNote}</p>}
            <ActionBar label={`Azioni su ${s.name}`} compact>
              <Button
                variant="secondary"
                aria-label={`Modifica ${s.name}`}
                onClick={() => setEdit(s)}
              >
                Modifica
              </Button>
            </ActionBar>
          </li>
        ))}
      </ul>
      <Dialog
        open={edit !== null}
        onClose={close}
        title={edit === "new" ? "Nuovo servizio" : "Modifica servizio"}
      >
        {edit && (
          <Body service={edit === "new" ? undefined : edit} onClose={close} />
        )}
      </Dialog>
    </>
  );
}
