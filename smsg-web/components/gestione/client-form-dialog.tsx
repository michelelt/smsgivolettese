"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SaveErrors } from "@/components/ui/bits";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { useGuardedMutation } from "@/lib/api/hooks";
import { optText, orNull, taxCodeField } from "@/lib/forms";

type Client = components["schemas"]["Client"];

const schema = z.object({
  firstName: z.string().trim().min(1, "scriva il nome").max(100),
  lastName: z.string().trim().min(1, "scriva il cognome").max(100),
  phone: z.string().trim().min(5, "scriva il numero di telefono").max(30),
  taxCode: taxCodeField,
  address: optText(200),
  notes: optText(1000),
});
type Values = z.infer<typeof schema>;

function Body({ client, onClose }: { client?: Client; onClose: () => void }) {
  const toast = useToast();
  const f = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: client?.firstName ?? "",
      lastName: client?.lastName ?? "",
      phone: client?.phone ?? "",
      taxCode: client?.taxCode ?? "",
      address: client?.address ?? "",
      notes: client?.notes ?? "",
    },
  });
  const e = f.formState.errors;
  const g = useGuardedMutation(
    (v: Values & { taxCodeConfirmed?: boolean }) => {
      const body = {
        ...v,
        taxCode: orNull(v.taxCode),
        address: orNull(v.address),
        notes: orNull(v.notes),
      };
      return client
        ? call(
            api.PATCH("/clients/{id}", {
              params: { path: { id: client.id } },
              body,
            }),
          )
        : call(api.POST("/clients", { body }));
    },
    () => {
      toast(client ? "Dati dell'utente salvati" : "Utente registrato");
      onClose();
    },
  );
  return (
    <form onSubmit={f.handleSubmit(g.submit)} noValidate>
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
        label="Telefono"
        type="tel"
        autoComplete="off"
        {...f.register("phone")}
        error={e.phone?.message}
      />
      <Field
        label="Codice fiscale (facoltativo)"
        autoComplete="off"
        {...f.register("taxCode")}
        error={e.taxCode?.message}
      />
      <Field
        label="Indirizzo (facoltativo)"
        autoComplete="off"
        {...f.register("address")}
        error={e.address?.message}
      />
      <Textarea
        label="Note (facoltative)"
        {...f.register("notes")}
        error={e.notes?.message}
      />
      <SaveErrors g={g} />
      <DialogActions>
        <Button auto type="submit" disabled={g.pending}>
          Salva
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Annulla
        </Button>
      </DialogActions>
    </form>
  );
}

export function ClientFormDialog({
  open,
  onClose,
  client,
}: {
  open: boolean;
  onClose: () => void;
  client?: Client;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={client ? "Modifica dati" : "Nuovo utente"}
    >
      <Body client={client} onClose={onClose} />
    </Dialog>
  );
}
