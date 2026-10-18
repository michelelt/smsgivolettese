"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SaveErrors } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { api, call } from "@/lib/api/call";
import { useDebounced, useGuardedMutation } from "@/lib/api/hooks";
import { orNull, taxCodeField } from "@/lib/forms";

const schema = z.object({
  firstName: z.string().trim().min(1, "scriva il nome").max(100),
  lastName: z.string().trim().min(1, "scriva il cognome").max(100),
  phone: z.string().trim().min(5, "scriva il numero di telefono").max(30),
  taxCode: taxCodeField,
});
type Values = z.infer<typeof schema>;

function NewMemberBody({
  onDone,
  onClose,
}: {
  onDone: (m: PickedMember) => void;
  onClose: () => void;
}) {
  const f = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", phone: "", taxCode: "" },
  });
  const e = f.formState.errors;
  const g = useGuardedMutation(
    (v: Values & { taxCodeConfirmed?: boolean }) =>
      call(
        api.POST("/members", {
          body: { ...v, taxCode: orNull(v.taxCode) },
        }),
      ),
    (m) => {
      onDone({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`,
        address: m.address,
        phone: m.phone,
      });
    },
  );
  return (
    <form
      noValidate
      onSubmit={(ev) => {
        // The dialog is portaled out of the DOM form but React still bubbles submit to it.
        ev.stopPropagation();
        return f.handleSubmit(g.submit)(ev);
      }}
    >
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
      <SaveErrors g={g} />
      <DialogActions>
        <Button auto type="submit" disabled={g.pending}>
          Registra socio
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Annulla
        </Button>
      </DialogActions>
    </form>
  );
}

/** Search active members by name, card, tax code or phone, or enrol a new one inline (ADR-060). */
export type PickedMember = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
};

export function MemberPicker({
  onPick,
  initial,
}: {
  onPick: (m: PickedMember) => void;
  initial?: PickedMember;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<PickedMember | undefined>(initial);
  const [adding, setAdding] = useState(false);
  const dq = useDebounced(q);
  const list = useQuery({
    queryKey: ["members", { q: dq, picker: true }],
    queryFn: () =>
      call(
        api.GET("/members", {
          params: { query: { filter: "attivi", q: dq, pageSize: 8 } },
        }),
      ),
  });
  const pick = (m: PickedMember) => {
    setPicked(m);
    onPick(m);
  };
  return (
    <fieldset className="mt-4">
      <legend className="font-bold">Socio</legend>
      <Field
        label="Cerca per nome, tessera, codice fiscale o telefono"
        type="search"
        value={q}
        onChange={(ev) => setQ(ev.target.value)}
        autoComplete="off"
      />
      <div role="radiogroup" aria-label="Soci trovati" className="mt-2">
        {list.data?.items.map((m) => (
          <label
            key={m.id}
            className="flex min-h-12 items-center gap-3 font-bold"
          >
            <input
              type="radio"
              name="member"
              className="size-6 accent-bordeaux"
              checked={picked?.id === m.id}
              onChange={() =>
                pick({
                  id: m.id,
                  name: `${m.firstName} ${m.lastName}`,
                  address: m.address,
                  phone: m.phone,
                })
              }
            />
            {m.firstName} {m.lastName} · tessera n. {m.cardNumber}
            {m.phone && ` · ${m.phone}`}
          </label>
        ))}
      </div>
      <p aria-live="polite" className="mt-2">
        {picked
          ? `Socio scelto: ${picked.name}`
          : list.data?.items.length === 0 && "Nessun socio trovato."}
      </p>
      <div className="mt-2">
        <Button
          auto
          type="button"
          variant="secondary"
          onClick={() => setAdding(true)}
        >
          Nuovo socio
        </Button>
      </div>
      {adding &&
        createPortal(
          <Dialog open onClose={() => setAdding(false)} title="Nuovo socio">
            <NewMemberBody
              onClose={() => setAdding(false)}
              onDone={(m) => {
                pick(m);
                setAdding(false);
              }}
            />
          </Dialog>,
          document.body,
        )}
    </fieldset>
  );
}
