"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Filters, FormError, Loading } from "@/components/ui/bits";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import { useDebounced, useServices } from "@/lib/api/hooks";
import { today } from "@/lib/dates";
import { formatEuro } from "@/lib/money";

type Values = {
  serviceId: string;
  day: string;
  slot: "mattina" | "pomeriggio";
  time: string;
  declaredMember: boolean;
  notes: string;
  firstName: string;
  lastName: string;
  phone: string;
};

function Body({
  onClose,
  clientId,
}: {
  onClose: () => void;
  clientId?: string;
}) {
  const toast = useToast();
  const services = useServices();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(clientId ?? "");
  const [msg, setMsg] = useState<string>();
  const dq = useDebounced(q);
  const clients = useQuery({
    queryKey: ["clients", { q: dq }],
    enabled: mode === "existing" && !clientId,
    queryFn: () =>
      call(api.GET("/clients", { params: { query: { q: dq, pageSize: 8 } } })),
  });
  const f = useForm<Values>({
    defaultValues: {
      serviceId: "",
      day: today(),
      slot: "mattina",
      time: "",
      declaredMember: false,
      notes: "",
      firstName: "",
      lastName: "",
      phone: "",
    },
  });
  const e = f.formState.errors;
  const svc = services.data?.items.filter((s) => s.active);
  const save = useMutation({
    meta: { inline: true },
    mutationFn: async (v: Values) => {
      let cid = picked;
      if (mode === "new")
        cid = (
          await call(
            api.POST("/clients", {
              body: {
                firstName: v.firstName.trim(),
                lastName: v.lastName.trim(),
                phone: v.phone.trim(),
              },
            }),
          )
        ).id;
      if (mode === "new") {
        // Keep the created client so a retry only re-sends the booking.
        setPicked(cid);
        setMode("existing");
      }
      return call(
        api.POST("/bookings", {
          body: {
            clientId: cid,
            serviceId: v.serviceId,
            day: v.day,
            slot: v.slot,
            ...(v.time && { time: v.time }),
            ...(v.declaredMember && { declaredMember: true }),
            ...(v.notes.trim() && { notes: v.notes.trim() }),
          },
        }),
      );
    },
    onSuccess: (_b, v) => {
      const transport = services.data?.items.find(
        (s) => s.id === v.serviceId,
      )?.requiresTransport;
      toast(
        "Prenotazione registrata." +
          (transport
            ? " Trasporto da completare: serve scegliere l'autista nella sezione Trasporti."
            : ""),
      );
      onClose();
    },
  });
  const submit = f.handleSubmit((v) => {
    setMsg(undefined);
    if (mode === "existing" && !picked)
      return setMsg("scelga l'utente dall'elenco");
    if (
      mode === "new" &&
      (!v.firstName.trim() || !v.lastName.trim() || v.phone.trim().length < 5)
    )
      return setMsg("scriva nome, cognome e telefono del nuovo utente");
    save.mutate(v);
  });
  return (
    <form onSubmit={submit} noValidate>
      {!clientId && (
        <fieldset className="mt-4">
          <legend className="font-bold">Utente</legend>
          <Filters
            label="Tipo di utente"
            value={mode}
            onChange={setMode}
            options={[
              ["existing", "Già registrato"],
              ["new", "Nuovo utente"],
            ]}
          />
          {mode === "existing" ? (
            <>
              <Field
                label="Cerca per nome o telefono"
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                autoComplete="off"
              />
              <div
                role="radiogroup"
                aria-label="Utenti trovati"
                className="mt-2"
              >
                {clients.data?.items.map((c) => (
                  <label
                    key={c.id}
                    className="flex min-h-12 items-center gap-3 font-bold"
                  >
                    <input
                      type="radio"
                      name="client"
                      className="size-6 accent-bordeaux"
                      checked={picked === c.id}
                      onChange={() => setPicked(c.id)}
                    />
                    {c.firstName} {c.lastName} · {c.phone}
                  </label>
                ))}
              </div>
              <p aria-live="polite" className="mt-2">
                {clients.data &&
                  (clients.data.items.length === 0
                    ? "Nessun utente trovato."
                    : `${clients.data.items.length} ${clients.data.items.length === 1 ? "utente trovato" : "utenti trovati"}`)}
              </p>
            </>
          ) : (
            <>
              <Field
                label="Nome"
                autoComplete="off"
                {...f.register("firstName")}
              />
              <Field
                label="Cognome"
                autoComplete="off"
                {...f.register("lastName")}
              />
              <Field
                label="Telefono"
                type="tel"
                autoComplete="off"
                {...f.register("phone")}
              />
            </>
          )}
        </fieldset>
      )}
      <Loading query={services} />
      <Select
        label="Servizio"
        {...f.register("serviceId", { required: "scelga il servizio" })}
        error={e.serviceId?.message}
      >
        <option value="">— scelga —</option>
        {svc?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} (socio {formatEuro(s.memberPriceCents)}, altri{" "}
            {formatEuro(s.nonMemberPriceCents)})
          </option>
        ))}
      </Select>
      <Field
        label="Giorno"
        type="date"
        {...f.register("day", { required: "scelga il giorno" })}
        error={e.day?.message}
      />
      <Select label="Fascia" {...f.register("slot")}>
        <option value="mattina">Mattina</option>
        <option value="pomeriggio">Pomeriggio</option>
      </Select>
      <Field
        label="Orario (facoltativo)"
        hint="Se lo scrive, la prenotazione è già confermata."
        type="time"
        {...f.register("time")}
      />
      <Checkbox
        label="Applica il prezzo da socio"
        {...f.register("declaredMember")}
      />
      <Textarea label="Note (facoltative)" {...f.register("notes")} />
      <FormError message={msg ?? save.error?.message} />
      <DialogActions>
        <Button auto type="submit" disabled={save.isPending}>
          Registra prenotazione
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Annulla
        </Button>
      </DialogActions>
    </form>
  );
}

export function NewBookingDialog({
  open,
  onClose,
  clientId,
}: {
  open: boolean;
  onClose: () => void;
  clientId?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Nuova prenotazione">
      <Body onClose={onClose} clientId={clientId} />
    </Dialog>
  );
}
