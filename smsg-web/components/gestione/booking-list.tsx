"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, Pill } from "@/components/ui/bits";
import { ConfirmDialog, Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { fmtDate } from "@/lib/dates";
import { formatEuro } from "@/lib/money";
import { IssueInvoiceDialog } from "./issue-invoice-dialog";

type Booking = components["schemas"]["Booking"];
const STATUS = {
  attesa: "Da confermare",
  confermata: "Confermata",
  eseguita: "Eseguita",
  annullata: "Annullata",
};

function ConfirmBody({ b, onClose }: { b: Booking; onClose: () => void }) {
  const toast = useToast();
  const { register, handleSubmit } = useForm<{ time: string }>();
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: { time: string }) =>
      call(
        api.POST("/bookings/{id}/confirm", {
          params: { path: { id: b.id } },
          body: v.time ? { time: v.time } : {},
        }),
      ),
    onSuccess: () => {
      toast("Prenotazione confermata");
      onClose();
    },
  });
  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))}>
      <p className="mt-2">
        {b.clientName} · {b.serviceName} · {fmtDate(b.day)}
      </p>
      <Field label="Orario (facoltativo)" type="time" {...register("time")} />
      <FormError message={m.error?.message} />
      <DialogActions>
        <Button auto type="submit" disabled={m.isPending}>
          Conferma
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Indietro
        </Button>
      </DialogActions>
    </form>
  );
}

type Dlg = { kind: "confirm" | "cancel" | "invoice"; b: Booking } | null;

export function BookingList({ items }: { items: Booking[] }) {
  const toast = useToast();
  const [dlg, setDlg] = useState<Dlg>(null);
  const act = useMutation({
    meta: { inline: true }, // cancel shows it in the dialog; row actions toast below
    onError: (e, v) => {
      if (v.verb !== "cancel") toast(e.message, true);
    },
    mutationFn: (v: { id: string; verb: "execute" | "restore" | "cancel" }) => {
      const p = { params: { path: { id: v.id } } };
      if (v.verb === "execute")
        return call(api.POST("/bookings/{id}/execute", p));
      if (v.verb === "restore")
        return call(api.POST("/bookings/{id}/restore", p));
      return call(
        api.POST("/bookings/{id}/cancel", { ...p, body: { by: "staff" } }),
      );
    },
    onSuccess: (_d, v) => {
      toast(
        {
          execute: "Segnata come eseguita",
          restore: "Prenotazione ripristinata",
          cancel: "Prenotazione annullata",
        }[v.verb],
      );
      close();
    },
  });
  const close = () => {
    setDlg(null);
    act.reset();
  };
  if (items.length === 0) return <p className="mt-4">Nessuna prenotazione.</p>;
  const run = (id: string, verb: "execute" | "restore") =>
    act.mutate({ id, verb });
  return (
    <>
      <ul className="mt-4 space-y-3">
        {items.map((b) => (
          <li key={b.id} className="rounded-xl border-2 border-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xl font-extrabold">
                {fmtDate(b.day)} ·{" "}
                {b.time ?? (b.slot === "mattina" ? "mattina" : "pomeriggio")}
              </p>
              <Pill>{STATUS[b.status]}</Pill>
            </div>
            <p className="font-bold">
              <Link
                className="text-blu underline"
                href={`/gestione/utenti/${b.clientId}`}
              >
                {b.clientName}
              </Link>{" "}
              · {b.clientPhone}
            </p>
            <p>
              {b.serviceName} · {formatEuro(b.priceAppliedCents)} ·{" "}
              {b.isMember ? "Socio" : "Non socio"}
              {b.invoiceNumber && ` · Fattura n. ${b.invoiceNumber}`}
            </p>
            {b.notes && <p>Note: {b.notes}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {b.status === "attesa" && (
                <Button auto onClick={() => setDlg({ kind: "confirm", b })}>
                  Conferma
                </Button>
              )}
              {(b.status === "attesa" || b.status === "confermata") && (
                <Button
                  auto
                  disabled={act.isPending}
                  onClick={() => run(b.id, "execute")}
                >
                  Eseguita
                </Button>
              )}
              {b.status === "eseguita" && !b.invoiceId && (
                <Button auto onClick={() => setDlg({ kind: "invoice", b })}>
                  Fattura
                </Button>
              )}
              {(b.status === "attesa" || b.status === "confermata") && (
                <Button
                  auto
                  variant="danger"
                  onClick={() => setDlg({ kind: "cancel", b })}
                >
                  Annulla
                </Button>
              )}
              {b.status === "annullata" && (
                <Button
                  auto
                  variant="secondary"
                  disabled={act.isPending}
                  onClick={() => run(b.id, "restore")}
                >
                  Ripristina
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Dialog
        open={dlg?.kind === "confirm"}
        onClose={close}
        title="Conferma prenotazione"
      >
        {dlg?.kind === "confirm" && <ConfirmBody b={dlg.b} onClose={close} />}
      </Dialog>
      <ConfirmDialog
        open={dlg?.kind === "cancel"}
        onClose={close}
        title="Annullare la prenotazione?"
        confirmLabel="Annulla prenotazione"
        pending={act.isPending}
        error={act.error?.message}
        onConfirm={() => dlg && act.mutate({ id: dlg.b.id, verb: "cancel" })}
      >
        {dlg && (
          <p>
            {dlg.b.clientName} · {dlg.b.serviceName} · {fmtDate(dlg.b.day)}. Si
            può ripristinare in seguito.
          </p>
        )}
      </ConfirmDialog>
      <IssueInvoiceDialog
        clientId={dlg?.kind === "invoice" ? dlg.b.clientId : null}
        preselect={dlg?.b.id}
        onClose={close}
      />
    </>
  );
}
