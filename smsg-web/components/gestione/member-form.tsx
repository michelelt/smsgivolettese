"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ActionBar } from "@/components/ui/actions";
import { SaveErrors } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import { useGuardedMutation, useOrgInfo } from "@/lib/api/hooks";
import type { components } from "@/lib/api/schema";
import { today } from "@/lib/dates";
import { dateField, METHODS, optText, orNull, taxCodeField } from "@/lib/forms";
import { formatEuro } from "@/lib/money";

type Member = components["schemas"]["Member"];

export const TYPES = [
  ["ordinario", "Ordinario"],
  ["familiare", "Familiare"],
  ["sostenitore", "Sostenitore"],
  ["onorario", "Onorario"],
] as const;

const schema = z.object({
  firstName: z.string().trim().min(1, "scrivi il nome").max(100),
  lastName: z.string().trim().min(1, "scrivi il cognome").max(100),
  taxCode: taxCodeField,
  birthDate: dateField,
  birthPlace: optText(100),
  address: optText(200),
  postalCode: optText(10),
  city: optText(100),
  phone: optText(30),
  email: z.union([z.literal(""), z.email("indirizzo email non valido")]),
  memberType: z.enum(["ordinario", "familiare", "sostenitore", "onorario"]),
  joinedOn: dateField,
  privacySignedOn: dateField,
  notes: optText(1000),
  feeMethod: z.enum(["", "contanti", "pos", "bonifico"]),
});
type Values = z.infer<typeof schema>;
const NULLABLE = [
  "taxCode",
  "birthDate",
  "birthPlace",
  "address",
  "postalCode",
  "city",
  "phone",
  "email",
  "privacySignedOn",
  "notes",
] as const;

/** Create or edit; edit sends only changed fields. */
export function MemberForm({ member }: { member?: Member }) {
  const router = useRouter();
  const toast = useToast();
  const org = useOrgInfo().data;
  const f = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: member?.firstName ?? "",
      lastName: member?.lastName ?? "",
      taxCode: member?.taxCode ?? "",
      birthDate: member?.birthDate ?? "",
      birthPlace: member?.birthPlace ?? "",
      address: member?.address ?? "",
      postalCode: member?.postalCode ?? "",
      city: member?.city ?? "",
      phone: member?.phone ?? "",
      email: member?.email ?? "",
      memberType: member?.memberType ?? "ordinario",
      joinedOn: member?.joinedOn ?? today(),
      privacySignedOn: member?.privacySignedOn ?? "",
      notes: member?.notes ?? "",
      feeMethod: "",
    },
  });
  const e = f.formState.errors;
  const g = useGuardedMutation(
    (v: Values & { taxCodeConfirmed?: boolean }) => {
      const { feeMethod, ...rest } = v;
      const body = { ...rest } as Record<string, unknown>;
      for (const k of NULLABLE) body[k] = orNull(v[k]);
      if (member) {
        // PATCH is partial and strict: only changed fields, never cardNumber/feeMethod.
        const dirty = f.formState.dirtyFields;
        const patch: Record<string, unknown> = v.taxCodeConfirmed
          ? { taxCodeConfirmed: true }
          : {};
        for (const k of Object.keys(dirty))
          if (k in body && k !== "feeMethod") patch[k] = body[k];
        return call(
          api.PATCH("/members/{id}", {
            params: { path: { id: member.id } },
            body: patch,
          }),
        );
      }
      return call(
        api.POST("/members", {
          body: {
            ...body,
            ...(feeMethod && { feeMethod }),
          } as components["schemas"]["MemberCreate"],
        }),
      );
    },
    (m) => {
      toast(
        member
          ? "Dati del socio salvati"
          : `Socio registrato: tessera n. ${m.cardNumber}`,
      );
      router.push(`/gestione/soci/${m.id}`);
    },
  );
  const submit = (v: Values) => {
    if (member && Object.keys(f.formState.dirtyFields).length === 0)
      return router.push(`/gestione/soci/${member.id}`);
    g.submit(v);
  };
  return (
    <form onSubmit={f.handleSubmit(submit)} noValidate className="max-w-xl">
      <Field
        label="Nome"
        {...f.register("firstName")}
        error={e.firstName?.message}
      />
      <Field
        label="Cognome"
        {...f.register("lastName")}
        error={e.lastName?.message}
      />
      <Field
        label="Codice fiscale"
        autoComplete="off"
        {...f.register("taxCode")}
        error={e.taxCode?.message}
      />
      <Field
        label="Data di nascita"
        type="date"
        {...f.register("birthDate")}
        error={e.birthDate?.message}
      />
      <Field
        label="Luogo di nascita"
        {...f.register("birthPlace")}
        error={e.birthPlace?.message}
      />
      <Field
        label="Indirizzo"
        {...f.register("address")}
        error={e.address?.message}
      />
      <Field
        label="CAP"
        inputMode="numeric"
        {...f.register("postalCode")}
        error={e.postalCode?.message}
      />
      <Field label="Comune" {...f.register("city")} error={e.city?.message} />
      <Field
        label="Telefono"
        type="tel"
        {...f.register("phone")}
        error={e.phone?.message}
      />
      <Field
        label="Email"
        type="email"
        {...f.register("email")}
        error={e.email?.message}
      />
      <Select label="Tipo di socio" {...f.register("memberType")}>
        {TYPES.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <Field
        label="Data di iscrizione"
        type="date"
        {...f.register("joinedOn")}
        error={e.joinedOn?.message}
      />
      <Field
        label="Privacy firmata il"
        type="date"
        {...f.register("privacySignedOn")}
        error={e.privacySignedOn?.message}
      />
      <Textarea
        label="Note"
        {...f.register("notes")}
        error={e.notes?.message}
      />
      {!member && (
        <Select
          label="Quota di iscrizione"
          hint={
            org
              ? `Quota ${formatEuro(org.membershipFeeCents)}. Prossima tessera: n. ${org.nextCardNumber}.`
              : undefined
          }
          {...f.register("feeMethod")}
        >
          <option value="">Non ancora pagata</option>
          {METHODS.map(([v, l]) => (
            <option key={v} value={v}>
              Pagata: {l}
            </option>
          ))}
        </Select>
      )}
      <SaveErrors g={g} />
      <ActionBar label="Azioni sulla scheda del socio" sticky>
        <Button type="submit" disabled={g.pending}>
          {member ? "Salva le modifiche" : "Registra socio"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Indietro
        </Button>
      </ActionBar>
    </form>
  );
}
