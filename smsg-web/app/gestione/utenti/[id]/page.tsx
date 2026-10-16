"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Loading, Pill } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { BookingList } from "@/components/gestione/booking-list";
import { ClientFormDialog } from "@/components/gestione/client-form-dialog";
import {
  invoiceable,
  IssueInvoiceDialog,
} from "@/components/gestione/issue-invoice-dialog";
import { NewBookingDialog } from "@/components/gestione/new-booking-dialog";
import { InvoiceActions } from "@/components/gestione/invoice-actions";
import { useClient } from "@/lib/api/hooks";
import { fmtDate } from "@/lib/dates";
import { formatEuro } from "@/lib/money";

export default function Utente() {
  const { id } = useParams<{ id: string }>();
  const q = useClient(id);
  const [dlg, setDlg] = useState<"edit" | "book" | "invoice" | null>(null);
  const c = q.data;
  const close = () => setDlg(null);
  return (
    <>
      <p>
        <Link className="font-bold text-blu underline" href="/gestione/utenti">
          ← Tutti gli utenti
        </Link>
      </p>
      <Loading query={q} />
      {c && (
        <>
          <h1 className="mt-2 text-4xl font-extrabold text-bordeaux">
            {c.firstName} {c.lastName}
          </h1>
          <dl className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-[max-content_1fr]">
            <dt className="font-bold">Telefono</dt>
            <dd>{c.phone}</dd>
            <dt className="font-bold">Codice fiscale</dt>
            <dd>{c.taxCode ?? "—"}</dd>
            <dt className="font-bold">Indirizzo</dt>
            <dd>{c.address ?? "—"}</dd>
            <dt className="font-bold">Note</dt>
            <dd>{c.notes ?? "—"}</dd>
            <dt className="font-bold">Socio</dt>
            <dd>
              {c.member ? (
                <Link
                  className="text-blu underline"
                  href={`/gestione/soci/${c.member.id}`}
                >
                  Tessera n. {c.member.cardNumber}
                </Link>
              ) : (
                <Link
                  className="font-bold text-blu underline"
                  href={`/gestione/soci/nuovo?clientId=${c.id}`}
                >
                  Registra nel libro soci
                </Link>
              )}
            </dd>
          </dl>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button auto variant="secondary" onClick={() => setDlg("edit")}>
              Modifica dati
            </Button>
            <Button auto onClick={() => setDlg("book")}>
              Nuova prenotazione
            </Button>
            {invoiceable(c).length > 0 && (
              <Button auto onClick={() => setDlg("invoice")}>
                Fattura {invoiceable(c).length} prestazioni eseguite
              </Button>
            )}
          </div>
          <h2 className="mt-8 text-2xl font-extrabold text-bordeaux">
            Prenotazioni
          </h2>
          <BookingList items={c.bookings} />
          <h2 className="mt-8 text-2xl font-extrabold text-bordeaux">
            Fatture
          </h2>
          {c.invoices.length === 0 && <p className="mt-2">Nessuna fattura.</p>}
          <ul className="mt-2 space-y-3">
            {c.invoices.map((i) => (
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
          <ClientFormDialog open={dlg === "edit"} onClose={close} client={c} />
          <NewBookingDialog
            open={dlg === "book"}
            onClose={close}
            clientId={c.id}
          />
          <IssueInvoiceDialog
            clientId={dlg === "invoice" ? c.id : null}
            onClose={close}
          />
        </>
      )}
    </>
  );
}
