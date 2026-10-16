"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { MemberPicker } from "./member-picker";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { fmtTime, today } from "@/lib/dates";

type Transport = components["schemas"]["Transport"];

const time = z
  .string()
  .refine((v) => v === "" || /^\d{2}:\d{2}$/.test(v), "orario non valido");
const schema = z.object({
  travelDate: z.string().min(1, "scelga la data"),
  departureTime: time,
  appointmentTime: time,
  returnTime: time,
  fromAddress: z.string().max(200, "al massimo 200 caratteri"),
  toAddress: z.string().max(200, "al massimo 200 caratteri"),
  requestedBy: z.string().max(200, "al massimo 200 caratteri"),
  reason: z.string().max(300, "al massimo 300 caratteri"),
  wheelchair: z.boolean(),
  companion: z.boolean(),
  notes: z.string().max(1000, "al massimo 1000 caratteri"),
});
type Values = z.infer<typeof schema>;
const nul = (s: string) => s.trim() || null;

export const NO_HEALTH =
  "Non scriva informazioni sulla salute (malattie, diagnosi, terapie): il motivo può essere solo, per esempio, «visita in ospedale».";

export function TransportForm({ transport }: { transport?: Transport }) {
  const router = useRouter();
  const toast = useToast();
  const [memberId, setMemberId] = useState(transport?.memberId ?? "");
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
      fromAddress: transport?.fromAddress ?? "",
      toAddress: transport?.toAddress ?? "",
      requestedBy: transport?.requestedBy ?? "",
      reason: transport?.reason ?? "",
      wheelchair: transport?.wheelchair ?? false,
      companion: transport?.companion ?? false,
      notes: transport?.notes ?? "",
    },
  });
  const e = f.formState.errors;
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
        requestedBy: nul(v.requestedBy),
        reason: nul(v.reason),
        wheelchair: v.wheelchair,
        companion: v.companion,
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
          return setMemberErr("scelga il socio dall'elenco");
        setMemberErr(undefined);
        m.mutate(v);
      })}
    >
      {transport ? (
        <p className="mt-4 text-xl font-bold">
          {transport.memberName}
          {transport.memberPhone && ` · ${transport.memberPhone}`}
        </p>
      ) : (
        <>
          <MemberPicker onPick={setMemberId} />
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
        label="Ora di partenza"
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
        label="Chi lo ha richiesto (facoltativo)"
        autoComplete="off"
        {...f.register("requestedBy")}
        error={e.requestedBy?.message}
      />
      <Field
        label="Motivo (facoltativo)"
        hint={NO_HEALTH}
        autoComplete="off"
        {...f.register("reason")}
        error={e.reason?.message}
      />
      <Checkbox label="Serve la carrozzina" {...f.register("wheelchair")} />
      <Checkbox
        label="Viaggia con un accompagnatore"
        {...f.register("companion")}
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
