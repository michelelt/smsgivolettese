"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { MemberPicker } from "./member-picker";
import { FormError, Loading } from "@/components/ui/bits";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import { useServices } from "@/lib/api/hooks";
import { today } from "@/lib/dates";
import { formatEuro } from "@/lib/money";

type Values = {
  serviceId: string;
  day: string;
  slot: "mattina" | "pomeriggio";
  time: string;
  notes: string;
};

function Body({
  onClose,
  memberId,
}: {
  onClose: () => void;
  memberId?: string;
}) {
  const toast = useToast();
  const services = useServices();
  const [picked, setPicked] = useState(memberId ?? "");
  const [msg, setMsg] = useState<string>();
  const f = useForm<Values>({
    defaultValues: {
      serviceId: "",
      day: today(),
      slot: "mattina",
      time: "",
      notes: "",
    },
  });
  const e = f.formState.errors;
  const svc = services.data?.items.filter((s) => s.active);
  const save = useMutation({
    meta: { inline: true },
    mutationFn: (v: Values) => {
      return call(
        api.POST("/bookings", {
          body: {
            memberId: picked,
            serviceId: v.serviceId,
            day: v.day,
            slot: v.slot,
            ...(v.time && { time: v.time }),
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
    if (!picked) return setMsg("scelga il socio dall'elenco");
    save.mutate(v);
  });
  return (
    <form onSubmit={submit} noValidate>
      {!memberId && <MemberPicker onPick={setPicked} />}
      <Loading query={services} />
      <Select
        label="Servizio"
        {...f.register("serviceId", { required: "scelga il servizio" })}
        error={e.serviceId?.message}
      >
        <option value="">— scelga —</option>
        {svc?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({formatEuro(s.priceCents)})
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
  memberId,
}: {
  open: boolean;
  onClose: () => void;
  memberId?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Nuova prenotazione">
      <Body onClose={onClose} memberId={memberId} />
    </Dialog>
  );
}
