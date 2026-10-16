"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Loading, SaveErrors } from "@/components/ui/bits";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { useClient, useGuardedMutation } from "@/lib/api/hooks";
import { fmtDate } from "@/lib/dates";
import { METHODS, orNull } from "@/lib/forms";
import { formatEuro } from "@/lib/money";

type Detail = components["schemas"]["ClientDetail"];
type Method = components["schemas"]["InvoicePay"]["method"];
type Values = { taxCode: string; address: string; method: "" | Method };

export const invoiceable = (c: Detail) =>
  c.bookings.filter((b) => b.status === "eseguita" && !b.invoiceId);

function Form({
  client,
  preselect,
  onClose,
}: {
  client: Detail;
  preselect?: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const list = invoiceable(client);
  const [picked, setPicked] = useState(
    () => new Set(preselect ? [preselect] : list.map((b) => b.id)),
  );
  const f = useForm<Values>({
    defaultValues: {
      taxCode: client.taxCode ?? "",
      address: client.address ?? "",
      method: "",
    },
  });
  const g = useGuardedMutation(
    (v: Values & { taxCodeConfirmed?: boolean }) =>
      call(
        api.POST("/invoices", {
          body: {
            clientId: client.id,
            bookingIds: [...picked],
            customerTaxCode: orNull(v.taxCode),
            customerAddress: orNull(v.address),
            ...(v.method && { paymentMethod: v.method }),
            ...(v.taxCodeConfirmed && { taxCodeConfirmed: true }),
          },
        }),
      ),
    (inv) => {
      toast(`Fattura n. ${inv.number}/${inv.year} emessa`);
      onClose();
    },
  );
  const total = list
    .filter((b) => picked.has(b.id))
    .reduce((s, b) => s + b.priceAppliedCents, 0);
  return (
    <form onSubmit={f.handleSubmit(g.submit)} noValidate>
      <p className="mt-2 font-bold">
        {client.firstName} {client.lastName}
      </p>
      <fieldset className="mt-4">
        <legend className="font-bold">Prestazioni da fatturare</legend>
        {list.length === 0 && <p>Nessuna prestazione eseguita da fatturare.</p>}
        {list.map((b) => (
          <Checkbox
            key={b.id}
            label={`${fmtDate(b.day)} · ${b.serviceName} · ${formatEuro(b.priceAppliedCents)}`}
            checked={picked.has(b.id)}
            onChange={(e) =>
              setPicked((s) => {
                const n = new Set(s);
                if (e.target.checked) n.add(b.id);
                else n.delete(b.id);
                return n;
              })
            }
          />
        ))}
      </fieldset>
      <p className="mt-2 font-bold">Totale prestazioni: {formatEuro(total)}</p>
      <Field
        label="Codice fiscale del cliente"
        autoComplete="off"
        {...f.register("taxCode")}
      />
      <Field
        label="Indirizzo del cliente"
        autoComplete="off"
        {...f.register("address")}
      />
      <Select label="Già pagata?" {...f.register("method")}>
        <option value="">No, da incassare</option>
        {METHODS.map(([v, l]) => (
          <option key={v} value={v}>
            Sì, pagata: {l}
          </option>
        ))}
      </Select>
      <SaveErrors g={g} />
      <DialogActions>
        <Button auto type="submit" disabled={g.pending || picked.size === 0}>
          Emetti fattura
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Annulla
        </Button>
      </DialogActions>
    </form>
  );
}

function Body(props: {
  clientId: string;
  preselect?: string;
  onClose: () => void;
}) {
  const q = useClient(props.clientId);
  return (
    <>
      <Loading query={q} />
      {q.data && (
        <Form
          client={q.data}
          preselect={props.preselect}
          onClose={props.onClose}
        />
      )}
    </>
  );
}

export function IssueInvoiceDialog({
  clientId,
  preselect,
  onClose,
}: {
  clientId: string | null;
  preselect?: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!clientId} onClose={onClose} title="Emetti fattura">
      {clientId && (
        <Body clientId={clientId} preselect={preselect} onClose={onClose} />
      )}
    </Dialog>
  );
}
