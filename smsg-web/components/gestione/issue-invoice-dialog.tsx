"use client";

import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Loading, SaveErrors } from "@/components/ui/bits";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { useMember, useGuardedMutation, useOrgInfo } from "@/lib/api/hooks";
import { fmtDate } from "@/lib/dates";
import { METHODS, orNull } from "@/lib/forms";
import { centsToInput, parseEuro } from "@/lib/money";

type Transport = components["schemas"]["Transport"];
type Detail = components["schemas"]["MemberDetail"];
type Method = components["schemas"]["InvoicePay"]["method"];
type Values = {
  amount: string;
  taxCode: string;
  address: string;
  method: "" | Method;
};

function Form({
  t,
  member,
  kmRateCents,
  onClose,
}: {
  t: Transport;
  member: Detail;
  kmRateCents: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const f = useForm<Values>({
    defaultValues: {
      // km and rate are integers: the prefill is exact, staff may change it.
      amount: centsToInput((t.km ?? 0) * kmRateCents),
      taxCode: member.taxCode ?? "",
      address: member.address ?? "",
      method: "",
    },
  });
  const g = useGuardedMutation(
    (v: Values & { taxCodeConfirmed?: boolean }) =>
      call(
        api.POST("/invoices", {
          body: {
            transportId: t.id,
            amountCents: parseEuro(v.amount)!,
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
  return (
    <form onSubmit={f.handleSubmit(g.submit)} noValidate>
      <p className="mt-2 font-bold">
        {member.firstName} {member.lastName}
      </p>
      <p>
        Trasporto del {fmtDate(t.travelDate)} · {t.km ?? 0} km
      </p>
      <Field
        label="Importo (euro)"
        hint={`${t.km ?? 0} km × ${centsToInput(kmRateCents)} euro al km. Si può cambiare.`}
        inputMode="decimal"
        {...f.register("amount", {
          validate: (v) =>
            parseEuro(v) !== null || "scrivi un importo, per esempio 12,50",
        })}
        error={f.formState.errors.amount?.message}
      />
      <Field
        label="Codice fiscale del socio"
        autoComplete="off"
        {...f.register("taxCode")}
      />
      <Field
        label="Indirizzo del socio"
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
        <Button auto type="submit" disabled={g.pending}>
          Emetti fattura
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Annulla
        </Button>
      </DialogActions>
    </form>
  );
}

function Body({ t, onClose }: { t: Transport; onClose: () => void }) {
  const q = useMember(t.memberId);
  const org = useOrgInfo();
  return (
    <>
      <Loading query={q} />
      <Loading query={org} />
      {q.data && org.data && (
        <Form
          t={t}
          member={q.data}
          kmRateCents={org.data.kmRateCents}
          onClose={onClose}
        />
      )}
    </>
  );
}

export function IssueInvoiceDialog({
  transport,
  onClose,
}: {
  transport: Transport | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!transport} onClose={onClose} title="Emetti fattura">
      {transport && <Body t={transport} onClose={onClose} />}
    </Dialog>
  );
}
