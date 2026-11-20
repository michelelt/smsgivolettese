"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
  const reg = (k: keyof Values, label: string, extra: object = {}) => (
    <Field label={label} {...extra} {...f.register(k)} error={e[k]?.message} />
  );
  return (
    <form
      onSubmit={f.handleSubmit(submit)}
      noValidate
      className="mx-auto mt-6 grid max-w-3xl gap-8"
    >
      <Group title="Persona">
        {reg("firstName", "Nome")}
        {reg("lastName", "Cognome")}
        {reg("taxCode", "Codice fiscale", { autoComplete: "off" })}
        {reg("birthDate", "Nato il", { type: "date" })}
        <div className="md:col-span-2">{reg("birthPlace", "Nato a")}</div>
      </Group>
      <Group title="Contatti">
        <div className="md:col-span-2">{reg("address", "Indirizzo")}</div>
        {reg("postalCode", "CAP", { inputMode: "numeric" })}
        {reg("city", "Comune")}
        {reg("phone", "Telefono", { type: "tel" })}
        {reg("email", "Email", { type: "email" })}
      </Group>
      <Group title="Iscrizione">
        <Select label="Tipo" {...f.register("memberType")}>
          {TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        {!member ? (
          <Select
            label="Quota"
            hint={org ? formatEuro(org.membershipFeeCents) : undefined}
            {...f.register("feeMethod")}
          >
            <option value="">Da pagare</option>
            {METHODS.map(([v, l]) => (
              <option key={v} value={v}>
                Pagata: {l}
              </option>
            ))}
          </Select>
        ) : (
          <span className="hidden md:block" />
        )}
        {reg("joinedOn", "Iscritto il", { type: "date" })}
        {reg("privacySignedOn", "Privacy firmata il", { type: "date" })}
        <div className="md:col-span-2">
          <Textarea
            label="Note"
            {...f.register("notes")}
            error={e.notes?.message}
          />
        </div>
      </Group>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-ink/10 bg-paper/85 px-4 py-3 backdrop-blur-md">
        <SaveErrors g={g} />
        <div className="mx-auto grid max-w-3xl grid-cols-[auto_1fr] gap-3 sm:flex sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            auto
            className="px-4 sm:min-w-36"
            onClick={() => router.back()}
          >
            Annulla
          </Button>
          <Button
            type="submit"
            auto
            className="whitespace-nowrap px-3 sm:min-w-48"
            disabled={g.pending}
          >
            {member ? "Salva" : "Registra socio"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Apple-style grouped section: quiet caption above a white rounded card. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 ml-1 text-sm font-bold uppercase tracking-wider text-ink/55">
        {title}
      </legend>
      <div className="grid gap-x-5 rounded-3xl bg-white px-5 pb-5 pt-1 shadow-sm ring-1 ring-ink/10 md:grid-cols-2">
        {children}
      </div>
    </fieldset>
  );
}
