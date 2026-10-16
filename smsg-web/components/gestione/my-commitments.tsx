"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormError, Loading, Pill } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { dayLabel, fmtTime, today } from "@/lib/dates";

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
    <div className="mt-3 flex flex-wrap gap-3">
      {status !== "confermato" && (
        <Button auto onClick={onAccept}>
          Confermo
        </Button>
      )}
      <Button auto variant="danger" onClick={onRefuse}>
        Non posso
      </Button>
    </div>
  );
}

function CompleteBody({ t, onClose }: { t: Transport; onClose: () => void }) {
  const toast = useToast();
  const f = useForm<{ km: string; driverNotes: string }>({
    defaultValues: { km: "", driverNotes: "" },
  });
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: { km: string; driverNotes: string }) =>
      call(
        api.POST("/me/transports/{id}/complete", {
          params: { path: { id: t.id } },
          body: {
            km: Number(v.km.replace(",", ".")),
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
        label="Chilometri percorsi"
        inputMode="decimal"
        autoComplete="off"
        {...f.register("km", {
          validate: (v) => {
            const n = Number(v.replace(",", "."));
            return (
              (v.trim() !== "" && n >= 0 && n <= 9999.9) ||
              "scriva i chilometri, per esempio 25,5"
            );
          },
        })}
        error={f.formState.errors.km?.message}
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
    <li className="rounded-xl border-2 border-ink p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-extrabold">
          Trasporto · {dayLabel(t.travelDate)}
        </p>
        <Pill>{STATUS[t.status]}</Pill>
      </div>
      <p className="mt-1 font-bold">
        Partenza {fmtTime(t.departureTime)}
        {t.appointmentTime && ` · Appuntamento ${fmtTime(t.appointmentTime)}`}
        {t.returnTime && ` · Ritorno ${fmtTime(t.returnTime)}`}
      </p>
      <p>
        {t.clientFirstName} {t.clientLastName} · {t.clientPhone}
      </p>
      <p>
        Da: {t.fromAddress ?? "—"}
        <br />
        A: {t.toAddress ?? "—"}
      </p>
      {(t.wheelchair || t.companion || t.vehiclePlate) && (
        <p>
          {[
            t.wheelchair && "Con carrozzina",
            t.companion && "Con accompagnatore",
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
            className="inline-flex min-h-12 items-center font-bold text-blu underline"
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
              <Button auto variant="secondary" onClick={onDone}>
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

  const shifts = (q.data?.shifts ?? []).filter((s) => s.status !== "rifiutato");
  const transports = q.data?.transports ?? [];
  const empty = q.data && shifts.length === 0 && transports.length === 0;
  return (
    <>
      <Loading query={q} />
      {empty && (
        <p className="mt-4 text-xl">Non hai impegni nei prossimi giorni.</p>
      )}
      {shifts.length > 0 && (
        <>
          <h2 className="mt-6 text-2xl font-extrabold text-blu">Turni</h2>
          <ul className="mt-3 space-y-3">
            {shifts.map((s: Shift) => (
              <li
                key={s.assignmentId}
                className="rounded-xl border-2 border-ink p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xl font-extrabold">{dayLabel(s.day)}</p>
                  <Pill>{STATUS[s.status]}</Pill>
                </div>
                <p className="font-bold">
                  {s.shiftType} · dalle {fmtTime(s.startTime)} alle{" "}
                  {fmtTime(s.endTime)}
                </p>
                {s.notes && <p>{s.notes}</p>}
                <Answer
                  status={s.status}
                  onAccept={() =>
                    go({ kind: "shift", id: s.assignmentId, accept: true })
                  }
                  onRefuse={() =>
                    go({ kind: "shift", id: s.assignmentId, accept: false })
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {transports.length > 0 && (
        <>
          <h2 className="mt-6 text-2xl font-extrabold text-blu">Trasporti</h2>
          <ul className="mt-3 space-y-3">
            {transports.map((t) => (
              <TransportCard
                key={t.id}
                t={t}
                onAnswer={(accept) =>
                  go({ kind: "transport", id: t.id, accept })
                }
                onDone={() => setClosing(t)}
              />
            ))}
          </ul>
        </>
      )}
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
