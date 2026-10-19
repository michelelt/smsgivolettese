"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FormError, Loading } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { MemberPicker, type PickedMember } from "./member-picker";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import { useMember } from "@/lib/api/hooks";
import type { components } from "@/lib/api/schema";
import { fmtTime, today } from "@/lib/dates";

type Transport = components["schemas"]["Transport"];

const time = z
  .string()
  .refine((v) => v === "" || /^\d{2}:\d{2}$/.test(v), "orario non valido");
const schema = z
  .object({
    travelDate: z.string().min(1, "scegli la data"),
    departureTime: time,
    appointmentTime: time,
    returnTime: time,
    fromAddress: z.string().max(200, "al massimo 200 caratteri"),
    toAddress: z.string().max(200, "al massimo 200 caratteri"),
    contactPhone: z.string().trim().max(40, "al massimo 40 caratteri"),
    wheelchair: z.boolean(),
    mobilityAids: z.boolean(),
    companions: z
      .string()
      .refine((v) => /^[0-8]$/.test(v.trim()), "scrivi un numero da 0 a 8"),
    notes: z.string().max(500, "al massimo 500 caratteri"),
  })
  .refine((v) => v.departureTime !== "" || v.appointmentTime !== "", {
    path: ["departureTime"],
    message: "Indica l'ora di partenza da casa o l'ora dell'appuntamento",
  });
type Values = z.infer<typeof schema>;
const nul = (s: string) => s.trim() || null;

export const NO_HEALTH =
  "Non scrivi informazioni sulla salute (malattie, diagnosi, terapie).";

export function TransportForm({
  transport,
  initialMember,
}: {
  transport?: Transport;
  initialMember?: PickedMember;
}) {
  const router = useRouter();
  const toast = useToast();
  const [memberId, setMemberId] = useState(
    transport?.memberId ?? initialMember?.id ?? "",
  );
  const [memberErr, setMemberErr] = useState<string>();
  const f = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      travelDate: transport?.travelDate ?? today(),
      departureTime: transport?.departureTime
        ? fmtTime(transport.departureTime)
        : "",
      appointmentTime: transport?.appointmentTime
        ? fmtTime(transport.appointmentTime)
        : "",
      returnTime: transport?.returnTime ? fmtTime(transport.returnTime) : "",
      fromAddress: transport?.fromAddress ?? initialMember?.address ?? "",
      toAddress: transport?.toAddress ?? "",
      contactPhone: transport?.contactPhone ?? initialMember?.phone ?? "",
      wheelchair: transport?.wheelchair ?? false,
      mobilityAids: transport?.mobilityAids ?? false,
      companions: String(transport?.companions ?? 0),
      notes: transport?.notes ?? "",
    },
  });
  const e = f.formState.errors;
  const [dep, appt] = useWatch({
    control: f.control,
    name: ["departureTime", "appointmentTime"],
  });
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: Values) => {
      const body = {
        travelDate: v.travelDate,
        departureTime: nul(v.departureTime),
        appointmentTime: nul(v.appointmentTime),
        returnTime: nul(v.returnTime),
        fromAddress: nul(v.fromAddress),
        toAddress: nul(v.toAddress),
        contactPhone: nul(v.contactPhone),
        wheelchair: v.wheelchair,
        mobilityAids: v.mobilityAids,
        companions: Number(v.companions),
        notes: nul(v.notes),
      };
      return transport
        ? call(
            api.PATCH("/transports/{id}", {
              params: { path: { id: transport.id } },
              body,
            }),
          )
        : call(api.POST("/transports", { body: { memberId, ...body } }));
    },
    onSuccess: (t) => {
      toast(transport ? "Trasporto salvato" : "Trasporto registrato");
      if (!transport) router.push(`/gestione/trasporti/${t.id}`);
    },
  });
  return (
    <form
      noValidate
      onSubmit={f.handleSubmit((v) => {
        if (!transport && !memberId)
          return setMemberErr("scegli il socio dall'elenco");
        setMemberErr(undefined);
        m.mutate(v);
      })}
    >
      {transport ? (
        <p className="mt-4 text-xl font-bold">{transport.memberName}</p>
      ) : (
        <>
          <MemberPicker
            initial={initialMember}
            onPick={(m) => {
              setMemberId(m.id);
              // Prefill from the member card; both stay editable.
              f.setValue("fromAddress", m.address ?? "");
              f.setValue("contactPhone", m.phone ?? "");
            }}
          />
          <FormError message={memberErr} />
        </>
      )}
      <Field
        label="Data"
        type="date"
        {...f.register("travelDate")}
        error={e.travelDate?.message}
      />
      <Field
        label="Ora di partenza da casa"
        hint="Indica almeno l'ora di partenza o quella dell'appuntamento."
        type="time"
        {...f.register("departureTime")}
        error={e.departureTime?.message}
      />
      <Field
        label="Ora dell'appuntamento"
        type="time"
        {...f.register("appointmentTime")}
        error={e.appointmentTime?.message}
      />
      <p aria-live="polite" className="mt-2 font-bold">
        {!dep && appt && "Per assegnare l'autista serve l'ora di partenza."}
      </p>
      <Field
        label="Ora di ritorno"
        type="time"
        {...f.register("returnTime")}
        error={e.returnTime?.message}
      />
      <Field
        label="Indirizzo di partenza"
        autoComplete="off"
        {...f.register("fromAddress")}
        error={e.fromAddress?.message}
      />
      <Field
        label="Destinazione"
        autoComplete="off"
        {...f.register("toAddress")}
        error={e.toAddress?.message}
      />
      <Field
        label="Telefono per contattare il socio"
        type="tel"
        autoComplete="off"
        {...f.register("contactPhone")}
        error={e.contactPhone?.message}
      />
      <Checkbox label="Serve la carrozzina" {...f.register("wheelchair")} />
      <Checkbox
        label="Usa deambulatore o stampelle"
        {...f.register("mobilityAids")}
      />
      <Field
        label="Numero di accompagnatori"
        inputMode="numeric"
        {...f.register("companions")}
        error={e.companions?.message}
      />
      <Textarea
        label="Note per lo staff (facoltative)"
        hint={NO_HEALTH}
        {...f.register("notes")}
        error={e.notes?.message}
      />
      <FormError message={m.error?.message} />
      <div className="mt-6">
        <Button auto type="submit" disabled={m.isPending}>
          {transport ? "Salva le modifiche" : "Registra trasporto"}
        </Button>
      </div>
    </form>
  );
}

/** New transport preselecting a member (link from the member card); inactive members are ignored. */
export function TransportFormForMember({ memberId }: { memberId: string }) {
  const q = useMember(memberId);
  if (q.isPending || q.error) return <Loading query={q} />;
  const m = q.data.status === "attivo" ? q.data : undefined;
  return (
    <>
      {!m && (
        <p role="status" className="mt-4">
          Il socio non è attivo: ne scegli un altro.
        </p>
      )}
      <TransportForm
        initialMember={
          m && {
            id: m.id,
            name: `${m.firstName} ${m.lastName}`,
            address: m.address,
            phone: m.phone,
          }
        }
      />
    </>
  );
}
