"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Filters, FormError, Loading, Pager, Pill } from "@/components/ui/bits";
import { PageHeader } from "@/components/ui/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import { useDebounced } from "@/lib/api/hooks";
import type { components } from "@/lib/api/schema";
import { fmtDate } from "@/lib/dates";

type Volunteer = components["schemas"]["Volunteer"];
const nul = (s: string) => s.trim() || null;

const editSchema = z.object({
  phone: z.string().max(30, "al massimo 30 caratteri"),
  canDrive: z.boolean(),
  licenseNumber: z.string().max(50, "al massimo 50 caratteri"),
  licenseExpiresOn: z.string(),
  notes: z.string().max(1000, "al massimo 1000 caratteri"),
  active: z.boolean(),
});
type EditValues = z.infer<typeof editSchema>;

function EditBody({ v, onClose }: { v: Volunteer; onClose: () => void }) {
  const toast = useToast();
  const f = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      phone: v.phone ?? "",
      canDrive: v.canDrive,
      licenseNumber: v.licenseNumber ?? "",
      licenseExpiresOn: v.licenseExpiresOn ?? "",
      notes: v.notes ?? "",
      active: v.active,
    },
  });
  const e = f.formState.errors;
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (x: EditValues) =>
      call(
        api.PATCH("/volunteers/{id}", {
          params: { path: { id: v.id } },
          body: {
            ...x,
            phone: nul(x.phone),
            licenseNumber: nul(x.licenseNumber),
            licenseExpiresOn: nul(x.licenseExpiresOn),
            notes: nul(x.notes),
          },
        }),
      ),
    onSuccess: () => {
      toast("Dati del volontario salvati");
      onClose();
    },
  });
  return (
    <form onSubmit={f.handleSubmit((x) => m.mutate(x))} noValidate>
      <Field
        label="Telefono"
        type="tel"
        {...f.register("phone")}
        error={e.phone?.message}
      />
      <Checkbox label="Può guidare (trasporti)" {...f.register("canDrive")} />
      <Field
        label="Numero di patente"
        {...f.register("licenseNumber")}
        error={e.licenseNumber?.message}
      />
      <Field
        label="Scadenza della patente"
        type="date"
        {...f.register("licenseExpiresOn")}
      />
      <Textarea
        label="Note"
        {...f.register("notes")}
        error={e.notes?.message}
      />
      <Checkbox label="Attivo" {...f.register("active")} />
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

const inviteSchema = z.object({
  firstName: z.string().trim().min(1, "scrivi il nome").max(100),
  lastName: z.string().trim().min(1, "scrivi il cognome").max(100),
  email: z.string().trim().email("scrivi un indirizzo email valido"),
});
type InviteValues = z.infer<typeof inviteSchema>;

function InviteBody({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const f = useForm<InviteValues>({ resolver: zodResolver(inviteSchema) });
  const e = f.formState.errors;
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (x: InviteValues) =>
      call(api.POST("/users/invite", { body: { ...x, role: "volontario" } })),
    onSuccess: (_d, x) => {
      toast(`Invito inviato a ${x.email}`);
      onClose();
    },
  });
  return (
    <form onSubmit={f.handleSubmit((x) => m.mutate(x))} noValidate>
      <p className="mt-2">
        Il volontario riceve un&apos;email per scegliere la password.
      </p>
      <Field
        label="Nome"
        autoComplete="off"
        {...f.register("firstName")}
        error={e.firstName?.message}
      />
      <Field
        label="Cognome"
        autoComplete="off"
        {...f.register("lastName")}
        error={e.lastName?.message}
      />
      <Field
        label="Email"
        type="email"
        autoComplete="off"
        {...f.register("email")}
        error={e.email?.message}
      />
      <FormError message={m.error?.message} />
      <DialogActions>
        <Button auto type="submit" disabled={m.isPending}>
          Invia l&apos;invito
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Annulla
        </Button>
      </DialogActions>
    </form>
  );
}

export default function Volontari() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<"true" | "false">("true");
  const [page, setPage] = useState(1);
  const [dlg, setDlg] = useState<{ edit: Volunteer } | "invite" | null>(null);
  const dq = useDebounced(q);
  const list = useQuery({
    queryKey: ["volunteers", { q: dq, active, page }],
    queryFn: () =>
      call(
        api.GET("/volunteers", {
          params: { query: { q: dq || undefined, active, page } },
        }),
      ),
  });
  const close = () => setDlg(null);
  return (
    <>
      <PageHeader
        title="Volontari"
        actions={
          <Button onClick={() => setDlg("invite")}>Invita un volontario</Button>
        }
      />
      <Filters
        label="Stato dei volontari"
        value={active}
        onChange={(v) => {
          setActive(v);
          setPage(1);
        }}
        options={[
          ["true", "Attivi"],
          ["false", "Non attivi"],
        ]}
      />
      <Field
        label="Cerca per nome o email"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      <Loading query={list} />
      {list.data?.items.length === 0 && (
        <p className="mt-4">Nessun volontario.</p>
      )}
      <ul className="mt-4 space-y-3">
        {list.data?.items.map((v) => (
          <li key={v.id} className="rounded-xl border-2 border-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xl font-extrabold">
                {v.firstName} {v.lastName}
              </p>
              <Pill>{v.active ? "Attivo" : "Non attivo"}</Pill>
            </div>
            <p>
              {v.email}
              {v.phone && ` · ${v.phone}`}
            </p>
            <p>
              {v.canDrive
                ? `Può guidare · patente ${v.licenseNumber ?? "—"} fino al ${fmtDate(v.licenseExpiresOn)}`
                : "Non guida"}
            </p>
            <div className="mt-3 flex justify-end">
              <Button
                variant="secondary"
                className="w-full! sm:w-auto!"
                aria-label={`Modifica ${v.firstName} ${v.lastName}`}
                onClick={() => setDlg({ edit: v })}
              >
                Modifica
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {list.data && (
        <Pager page={page} total={list.data.total} onPage={setPage} />
      )}
      <Dialog
        open={dlg === "invite"}
        onClose={close}
        title="Invita un volontario"
      >
        <InviteBody onClose={close} />
      </Dialog>
      <Dialog
        open={typeof dlg === "object" && dlg !== null}
        onClose={close}
        title={
          typeof dlg === "object" && dlg
            ? `${dlg.edit.firstName} ${dlg.edit.lastName}`
            : ""
        }
      >
        {typeof dlg === "object" && dlg && (
          <EditBody v={dlg.edit} onClose={close} />
        )}
      </Dialog>
    </>
  );
}
