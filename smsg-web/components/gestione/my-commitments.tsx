"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormError, Pill } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import {
  CARD,
  useWeek,
  WeekCalendar,
} from "@/components/gestione/week-calendar";
import { completeSchema, type CompleteValues } from "./transport-panel";
import { fmtTime, today } from "@/lib/dates";

type Shift = components["schemas"]["MyShift"];
type Transport = components["schemas"]["MyTransport"];
type Pending =
  | { kind: "shift"; id: string; accept: boolean }
  | { kind: "transport"; id: string; accept: boolean };

const mapsUrl = (from: string | null, to: string | null) =>
  `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from ?? "")}&destination=${encodeURIComponent(to ?? "")}`;

const STATUS = {
  proposto: "Da confermare",
  assegnato: "Da confermare",
  confermato: "Confermato",
  svolto: "Svolto",
  rifiutato: "Rifiutato",
};

// Dark text on a light tint (AA); the stripe and the status text carry the state too.
const TONE = {
  proposto: "border-amber-700 bg-amber-50 text-amber-950",
  assegnato: "border-amber-700 bg-amber-50 text-amber-950",
  confermato: "border-green-800 bg-green-50 text-green-950",
  svolto: "border-blu bg-white text-ink",
  rifiutato: "border-ink/50 bg-white text-ink/70",
} as const;

type Entry =
  | { k: "shift"; day: string; s: Shift }
  | { k: "transport"; day: string; t: Transport };

function Answer({
  status,
  onAccept,
  onRefuse,
}: {
  status: string;
  onAccept: () => void;
  onRefuse: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {status !== "confermato" && <Button onClick={onAccept}>Confermo</Button>}
      <Button variant="danger" onClick={onRefuse}>
        Non posso
      </Button>
    </div>
  );
}

function CompleteBody({ t, onClose }: { t: Transport; onClose: () => void }) {
  const toast = useToast();
  const f = useForm<CompleteValues>({
    resolver: zodResolver(completeSchema),
    defaultValues: { odometerStart: "", odometerEnd: "", driverNotes: "" },
  });
  const e = f.formState.errors;
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: CompleteValues) =>
      call(
        api.POST("/me/transports/{id}/complete", {
          params: { path: { id: t.id } },
          body: {
            odometerStart: Number(v.odometerStart),
            odometerEnd: Number(v.odometerEnd),
            driverNotes: v.driverNotes.trim() || null,
          },
        }),
      ),
    onSuccess: () => {
      toast("Trasporto segnato come svolto. Grazie!");
      onClose();
    },
  });
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} noValidate>
      <Field
        label="Chilometri sul contachilometri alla partenza"
        inputMode="numeric"
        autoComplete="off"
        {...f.register("odometerStart")}
        error={e.odometerStart?.message}
      />
      <Field
        label="Chilometri sul contachilometri all'arrivo"
        inputMode="numeric"
        autoComplete="off"
        {...f.register("odometerEnd")}
        error={e.odometerEnd?.message}
      />
      <Textarea
        label="Note (facoltative)"
        hint="Non scriva informazioni sulla salute della persona."
        maxLength={500}
        {...f.register("driverNotes")}
      />
      <FormError message={m.error?.message} />
      <DialogActions>
        <Button auto type="submit" disabled={m.isPending}>
          Segna svolto
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Indietro
        </Button>
      </DialogActions>
    </form>
  );
}

function TransportCard({
  t,
  onAnswer,
  onDone,
}: {
  t: Transport;
  onAnswer: (accept: boolean) => void;
  onDone: () => void;
}) {
  const open = t.status === "assegnato" || t.status === "confermato";
  return (
    <li className={`${CARD} ${TONE[t.status]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-extrabold">Trasporto</p>
        <Pill>{STATUS[t.status]}</Pill>
      </div>
      <p className="mt-1 font-bold">
        {[
          t.departureTime && `Partenza ${fmtTime(t.departureTime)}`,
          t.appointmentTime && `Appuntamento ${fmtTime(t.appointmentTime)}`,
          t.returnTime && `Ritorno ${fmtTime(t.returnTime)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p>
        {t.memberFirstName} {t.memberLastName}
        {open && t.contactPhone && (
          <>
            {" · "}
            <a
              className="font-bold text-blu underline"
              href={`tel:${t.contactPhone}`}
            >
              Chiama {t.contactPhone}
            </a>
          </>
        )}
      </p>
      <p>
        Da: {t.fromAddress ?? "—"}
        <br />
        A: {t.toAddress ?? "—"}
      </p>
      {(t.wheelchair ||
        t.mobilityAids ||
        t.companions > 0 ||
        t.vehiclePlate) && (
        <p>
          {[
            t.wheelchair && "Con carrozzina",
            t.mobilityAids && "Con ausili (deambulatore/stampelle)",
            t.companions > 0 && `Accompagnatori: ${t.companions}`,
            t.vehiclePlate && `Mezzo ${t.vehicleModel ?? ""} ${t.vehiclePlate}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {t.status === "svolto" && t.km != null && <p>Km: {t.km}</p>}
      {t.toAddress && (
        <p className="mt-2">
          <a
            className="inline-flex min-h-12 items-center break-words font-bold text-blu underline"
            href={mapsUrl(t.fromAddress, t.toAddress)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Indicazioni su Google Maps (si apre in una nuova scheda)
          </a>
        </p>
      )}
      {open && (
        <>
          <Answer
            status={t.status}
            onAccept={() => onAnswer(true)}
            onRefuse={() => onAnswer(false)}
          />
          {t.travelDate <= today() && (
            <div className="mt-3">
              <Button variant="secondary" onClick={onDone}>
                Segna svolto
              </Button>
            </div>
          )}
        </>
      )}
    </li>
  );
}

export function MyCommitments() {
  const toast = useToast();
  const wk = useWeek();
  const q = useQuery({
    queryKey: ["me", "commitments"],
    queryFn: () => call(api.GET("/me/commitments")),
  });
  const [ask, setAsk] = useState<Pending | null>(null);
  const [closing, setClosing] = useState<Transport | null>(null);
  const respond = useMutation({
    meta: { inline: true },
    mutationFn: (v: Pending) =>
      v.kind === "shift"
        ? call(
            api.POST("/me/shift-assignments/{id}/respond", {
              params: { path: { id: v.id } },
              body: { accept: v.accept },
            }),
          )
        : call(
            api.POST("/me/transports/{id}/respond", {
              params: { path: { id: v.id } },
              body: { accept: v.accept },
            }),
          ),
    onSuccess: (_d, v) => {
      toast(
        v.accept
          ? "Grazie, impegno confermato"
          : "Impegno rifiutato: lo staff è stato avvisato",
      );
      setAsk(null);
    },
    onError: (e) => {
      toast(e.message, true);
      setAsk(null);
    },
  });
  const go = (p: Pending) => (p.accept ? respond.mutate(p) : setAsk(p));

  const entries: Entry[] = [
    ...(q.data?.shifts ?? [])
      .filter((x) => x.status !== "rifiutato")
      .map((x): Entry => ({ k: "shift", day: x.day, s: x })),
    ...(q.data?.transports ?? []).map((x): Entry => ({
      k: "transport",
      day: x.travelDate,
      t: x,
    })),
  ];
  return (
    <>
      <WeekCalendar
        basePath="/gestione"
        label="Calendario dei miei impegni"
        state={wk}
        query={q}
        ready={!!q.data}
        itemsOf={(d) => entries.filter((e) => e.day === d)}
        empty="Nessun impegno."
        renderItem={(e) =>
          e.k === "transport" ? (
            <TransportCard
              key={e.t.id}
              t={e.t}
              onAnswer={(accept) =>
                go({ kind: "transport", id: e.t.id, accept })
              }
              onDone={() => setClosing(e.t)}
            />
          ) : (
            <li
              key={e.s.assignmentId}
              className={`${CARD} ${TONE[e.s.status]}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xl font-extrabold">Turno</p>
                <Pill>{STATUS[e.s.status]}</Pill>
              </div>
              <p className="font-bold">
                {e.s.shiftType} · dalle {fmtTime(e.s.startTime)} alle{" "}
                {fmtTime(e.s.endTime)}
              </p>
              {e.s.notes && <p className="break-words">{e.s.notes}</p>}
              <Answer
                status={e.s.status}
                onAccept={() =>
                  go({ kind: "shift", id: e.s.assignmentId, accept: true })
                }
                onRefuse={() =>
                  go({ kind: "shift", id: e.s.assignmentId, accept: false })
                }
              />
            </li>
          )
        }
      />
      <ConfirmDialog
        open={!!ask}
        onClose={() => setAsk(null)}
        title="Non puoi fare questo impegno?"
        confirmLabel="Sì, non posso"
        pending={respond.isPending}
        onConfirm={() => ask && respond.mutate(ask)}
      >
        <p>Lo staff riceve un avviso. Non potrai più cambiare idea da qui.</p>
      </ConfirmDialog>
      <Dialog
        open={!!closing}
        onClose={() => setClosing(null)}
        title="Trasporto svolto"
      >
        {closing && (
          <CompleteBody t={closing} onClose={() => setClosing(null)} />
        )}
      </Dialog>
    </>
  );
}
