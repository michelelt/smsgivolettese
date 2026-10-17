"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActionBar } from "@/components/ui/actions";
import { FormError, Loading, Pill } from "@/components/ui/bits";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { api, call, saveBlob } from "@/lib/api/call";
import { useMember, useOrgInfo } from "@/lib/api/hooks";
import type { components } from "@/lib/api/schema";
import { currentYear, fmtDate, today } from "@/lib/dates";
import { METHODS } from "@/lib/forms";
import { formatEuro } from "@/lib/money";
import {
  invoiceable,
  IssueInvoiceDialog,
} from "@/components/gestione/issue-invoice-dialog";
import { NewBookingDialog } from "@/components/gestione/new-booking-dialog";
import { BookingList } from "@/components/gestione/booking-list";
import { InvoiceActions } from "@/components/gestione/invoice-actions";
import { TYPES } from "@/components/gestione/member-form";

type Member = components["schemas"]["MemberDetail"];
type Method = components["schemas"]["FeeCreate"]["method"];
type Reason = components["schemas"]["MemberEnd"]["endReason"];
const REASONS: [Reason, string][] = [
  ["dimissioni", "Dimissioni"],
  ["decesso", "Decesso"],
  ["mancato_pagamento", "Mancato pagamento della quota"],
  ["esclusione", "Esclusione"],
  ["trasferimento", "Trasferimento"],
];

function FeeBody({ m, onClose }: { m: Member; onClose: () => void }) {
  const toast = useToast();
  const org = useOrgInfo().data;
  const { register, handleSubmit } = useForm<{ method: Method }>({
    defaultValues: { method: "contanti" },
  });
  const mut = useMutation({
    meta: { inline: true },
    mutationFn: (v: { method: Method }) =>
      call(
        api.POST("/members/{id}/fees", {
          params: { path: { id: m.id } },
          body: v,
        }),
      ),
    onSuccess: () => {
      toast("Quota registrata");
      onClose();
    },
  });
  return (
    <form onSubmit={handleSubmit((v) => mut.mutate(v))}>
      {org && (
        <p className="mt-3">
          Importo della quota: {formatEuro(org.membershipFeeCents)}
        </p>
      )}
      <Select label="Come ha pagato?" {...register("method")}>
        {METHODS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <FormError message={mut.error?.message} />
      <DialogActions>
        <Button auto type="submit" disabled={mut.isPending}>
          Registra quota
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Indietro
        </Button>
      </DialogActions>
    </form>
  );
}

function EndBody({ m, onClose }: { m: Member; onClose: () => void }) {
  const toast = useToast();
  const { register, handleSubmit } = useForm<{
    endReason: Reason;
    endedOn: string;
  }>({
    defaultValues: { endReason: "dimissioni", endedOn: today() },
  });
  const mut = useMutation({
    meta: { inline: true },
    mutationFn: (v: { endReason: Reason; endedOn: string }) =>
      call(
        api.POST("/members/{id}/end", {
          params: { path: { id: m.id } },
          body: {
            endReason: v.endReason,
            ...(v.endedOn && { endedOn: v.endedOn }),
          },
        }),
      ),
    onSuccess: () => {
      toast("Iscrizione cessata. Il numero di tessera resta nel libro soci.");
      onClose();
    },
  });
  return (
    <form onSubmit={handleSubmit((v) => mut.mutate(v))}>
      <p className="mt-3">
        Il socio resta nel libro soci, con la tessera n. {m.cardNumber}.
      </p>
      <Select label="Motivo" {...register("endReason")}>
        {REASONS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <Field label="Dal giorno" type="date" {...register("endedOn")} />
      <FormError message={mut.error?.message} />
      <DialogActions>
        <Button auto type="submit" variant="danger" disabled={mut.isPending}>
          Cessa iscrizione
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Indietro
        </Button>
      </DialogActions>
    </form>
  );
}

export default function Socio() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const q = useMember(id);
  const [dlg, setDlg] = useState<"fee" | "end" | "book" | "invoice" | null>(
    null,
  );
  const close = () => setDlg(null);
  const reactivate = useMutation({
    mutationFn: () =>
      call(api.POST("/members/{id}/reactivate", { params: { path: { id } } })),
    onSuccess: () => toast("Socio riattivato"),
  });
  const receipt = useMutation({
    mutationFn: (feeId: string) =>
      saveBlob(
        api.GET("/members/{id}/fees/{feeId}/receipt.pdf", {
          params: { path: { id, feeId } },
          parseAs: "blob",
        }),
        "ricevuta.pdf",
      ),
  });
  const m = q.data;
  const year = currentYear();
  const paid = m?.fees.some((f) => f.year === year);
  return (
    <>
      <p>
        <Link className="font-bold text-blu underline" href="/gestione/soci">
          ← Tutti i soci
        </Link>
      </p>
      <Loading query={q} />
      {m && (
        <>
          <h1 className="mt-2 text-4xl font-extrabold text-bordeaux">
            {m.firstName} {m.lastName}
          </h1>
          <p className="mt-1">
            <b>Tessera n. {m.cardNumber}</b>{" "}
            {m.status === "cessato" ? (
              <Pill>Cessato</Pill>
            ) : (
              <Pill>
                Quota {year} {paid ? "pagata" : "da pagare"}
              </Pill>
            )}
          </p>
          {m.status === "cessato" && (
            <p className="mt-3 rounded-xl border-2 border-ink p-3">
              <b>Socio cessato</b> dal {fmtDate(m.endedOn)}
              {m.endReason &&
                ` · ${REASONS.find((r) => r[0] === m.endReason)?.[1]}`}
            </p>
          )}
          <ActionBar
            label="Azioni sul socio"
            danger={
              m.status === "attivo" ? (
                <Button variant="danger" onClick={() => setDlg("end")}>
                  Cessa iscrizione
                </Button>
              ) : undefined
            }
          >
            {m.status === "attivo" && !paid && (
              <Button onClick={() => setDlg("fee")}>
                Registra quota {year}
              </Button>
            )}
            {m.status === "attivo" && (
              <Button
                variant={paid ? "primary" : "secondary"}
                onClick={() => setDlg("book")}
              >
                Nuova prenotazione
              </Button>
            )}
            {invoiceable(m).length > 0 && (
              <Button variant="secondary" onClick={() => setDlg("invoice")}>
                Fattura {invoiceable(m).length} prestazioni eseguite
              </Button>
            )}
            <ButtonLink
              variant="secondary"
              href={`/gestione/soci/${m.id}/modifica`}
            >
              Modifica dati
            </ButtonLink>
            {m.status !== "attivo" && (
              <Button
                variant="secondary"
                disabled={reactivate.isPending}
                onClick={() => reactivate.mutate()}
              >
                Riattiva
              </Button>
            )}
          </ActionBar>
          <dl className="mt-6 grid gap-x-6 gap-y-1 sm:grid-cols-[max-content_1fr]">
            {(
              [
                ["Tipo", TYPES.find((t) => t[0] === m.memberType)?.[1]],
                ["Codice fiscale", m.taxCode],
                [
                  "Nato il",
                  m.birthDate
                    ? `${fmtDate(m.birthDate)}${m.birthPlace ? ` a ${m.birthPlace}` : ""}`
                    : m.birthPlace,
                ],
                [
                  "Indirizzo",
                  [m.address, m.postalCode, m.city].filter(Boolean).join(", "),
                ],
                ["Telefono", m.phone],
                ["Email", m.email],
                ["Iscritto il", fmtDate(m.joinedOn)],
                ["Privacy firmata il", fmtDate(m.privacySignedOn)],
                ["Note", m.notes],
              ] as [string, string | null | undefined][]
            ).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-bold">{k}</dt>
                <dd>{v || "—"}</dd>
              </div>
            ))}
          </dl>
          <h2 className="mt-8 text-2xl font-extrabold text-bordeaux">
            Quote versate
          </h2>
          {m.fees.length === 0 && (
            <p className="mt-2">Nessuna quota registrata.</p>
          )}
          <ul className="mt-2 space-y-3">
            {m.fees.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-ink p-4"
              >
                <span className="font-bold">
                  Quota {f.year} · {formatEuro(f.amountCents)} ·{" "}
                  {fmtDate(f.paidOn)} ·{" "}
                  {METHODS.find((x) => x[0] === f.method)?.[1]}
                </span>
                <Button
                  variant="secondary"
                  className="w-full! sm:w-auto!"
                  disabled={receipt.isPending}
                  onClick={() => receipt.mutate(f.id)}
                >
                  Ricevuta PDF
                </Button>
              </li>
            ))}
          </ul>
          <h2 className="mt-8 text-2xl font-extrabold text-bordeaux">
            Prenotazioni
          </h2>
          <BookingList items={m.bookings} />
          <h2 className="mt-8 text-2xl font-extrabold text-bordeaux">
            Trasporti
          </h2>
          {m.transports.length === 0 && (
            <p className="mt-2">Nessun trasporto.</p>
          )}
          <ul className="mt-2 space-y-3">
            {m.transports.map((t) => (
              <li key={t.id} className="rounded-xl border-2 border-ink p-4">
                <Link
                  className="font-bold text-blu underline"
                  href={`/gestione/trasporti/${t.id}`}
                >
                  {fmtDate(t.travelDate)}
                  {t.toAddress && ` · ${t.toAddress}`}
                </Link>{" "}
                <Pill>{t.status}</Pill>
              </li>
            ))}
          </ul>
          <h2 className="mt-8 text-2xl font-extrabold text-bordeaux">
            Fatture
          </h2>
          {m.invoices.length === 0 && <p className="mt-2">Nessuna fattura.</p>}
          <ul className="mt-2 space-y-3">
            {m.invoices.map((i) => (
              <li key={i.id} className="rounded-xl border-2 border-ink p-4">
                <p className="font-bold">
                  Fattura n. {i.number}/{i.year} del {fmtDate(i.issuedOn)} ·{" "}
                  {formatEuro(i.totalCents)}{" "}
                  <Pill>
                    {i.status === "emessa"
                      ? "Da incassare"
                      : i.status === "pagata"
                        ? "Pagata"
                        : "Annullata"}
                  </Pill>
                </p>
                <InvoiceActions invoice={i} />
              </li>
            ))}
          </ul>
          <Dialog
            open={dlg === "fee"}
            onClose={close}
            title={`Registra quota ${year}`}
          >
            <FeeBody m={m} onClose={close} />
          </Dialog>
          <NewBookingDialog
            open={dlg === "book"}
            onClose={close}
            memberId={m.id}
          />
          <IssueInvoiceDialog
            memberId={dlg === "invoice" ? m.id : null}
            onClose={close}
          />
          <Dialog
            open={dlg === "end"}
            onClose={close}
            title={`Cessare l'iscrizione di ${m.firstName} ${m.lastName}?`}
          >
            <EndBody m={m} onClose={close} />
          </Dialog>
        </>
      )}
    </>
  );
}
