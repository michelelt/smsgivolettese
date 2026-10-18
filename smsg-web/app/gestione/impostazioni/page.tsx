"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError, Loading } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  getOrgSettings,
  putCounters,
  putOrgSettings,
  type OrgSettings,
} from "@/lib/api/admin";
import { centsToInput, parseEuro } from "@/lib/money";

const euro = (label: string) =>
  z
    .string()
    .refine(
      (v) => parseEuro(v) !== null,
      `${label}: scriva un importo, per esempio 12,50`,
    );
const int = (min: number, max: number) =>
  z.string().refine((v) => {
    const n = Number(v);
    return /^\d+$/.test(v.trim()) && n >= min && n <= max;
  }, `scriva un numero intero tra ${min} e ${max}`);

const orgSchema = z.object({
  legalName: z
    .string()
    .trim()
    .min(1, "campo obbligatorio")
    .max(200, "al massimo 200 caratteri"),
  taxCode: z
    .string()
    .transform((v) => v.replace(/\s/g, "").toUpperCase())
    .refine(
      (v) => /^\d{11}$|^[A-Z0-9]{16}$/.test(v),
      "11 cifre oppure 16 tra lettere e numeri",
    ),
  address: z
    .string()
    .trim()
    .min(1, "campo obbligatorio")
    .max(300, "al massimo 300 caratteri"),
  vatExemptionText: z
    .string()
    .trim()
    .min(1, "campo obbligatorio")
    .max(500, "al massimo 500 caratteri"),
  stampDutyThreshold: euro("Soglia"),
  stampDutyAmount: euro("Importo"),
  membershipFee: euro("Quota"),
  kmRate: euro("Importo"),
  videoMaxMb: int(1, 50),
});
type OrgIn = z.input<typeof orgSchema>;

function OrgForm({ s }: { s: OrgSettings }) {
  const toast = useToast();
  const qc = useQueryClient();
  const f = useForm<OrgIn>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      legalName: s.legalName,
      taxCode: s.taxCode ?? "",
      address: s.address ?? "",
      vatExemptionText: s.vatExemptionText ?? "",
      stampDutyThreshold: centsToInput(s.stampDutyThresholdCents),
      stampDutyAmount: centsToInput(s.stampDutyAmountCents),
      membershipFee: centsToInput(s.membershipFeeCents),
      kmRate: centsToInput(s.kmRateCents),
      videoMaxMb: String(s.videoMaxMb),
    },
  });
  const e = f.formState.errors;
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: OrgIn) => {
      const x = orgSchema.parse(v);
      return putOrgSettings({
        legalName: x.legalName,
        taxCode: x.taxCode,
        address: x.address,
        vatExemptionText: x.vatExemptionText,
        stampDutyThresholdCents: parseEuro(x.stampDutyThreshold)!,
        stampDutyAmountCents: parseEuro(x.stampDutyAmount)!,
        membershipFeeCents: parseEuro(x.membershipFee)!,
        kmRateCents: parseEuro(x.kmRate)!,
        videoMaxMb: Number(x.videoMaxMb),
      });
    },
    onSuccess: () => {
      toast("Impostazioni salvate");
      void qc.invalidateQueries({ queryKey: ["org-settings"] });
    },
  });
  return (
    <form
      onSubmit={f.handleSubmit((v) => m.mutate(v))}
      noValidate
      aria-label="Dati dell'associazione"
    >
      <h2 className="mt-8 text-2xl font-extrabold text-bordeaux">
        Intestazione
      </h2>
      <Field
        label="Denominazione"
        {...f.register("legalName")}
        error={e.legalName?.message}
      />
      <Field
        label="Codice fiscale"
        {...f.register("taxCode")}
        error={e.taxCode?.message}
      />
      <Field
        label="Indirizzo"
        {...f.register("address")}
        error={e.address?.message}
      />
      <h2 className="mt-8 text-2xl font-extrabold text-bordeaux">
        Fatture e bollo
      </h2>
      <Textarea
        label="Testo di esenzione IVA"
        hint="Compare su ogni nuova fattura."
        {...f.register("vatExemptionText")}
        error={e.vatExemptionText?.message}
      />
      <Field
        label="Bollo dovuto sopra (euro)"
        inputMode="decimal"
        {...f.register("stampDutyThreshold")}
        error={e.stampDutyThreshold?.message}
      />
      <Field
        label="Importo del bollo (euro)"
        inputMode="decimal"
        {...f.register("stampDutyAmount")}
        error={e.stampDutyAmount?.message}
      />
      <p className="mt-2 text-base">
        Le modifiche valgono per le nuove fatture; quelle emesse non cambiano.
      </p>
      <h2 className="mt-8 text-2xl font-extrabold text-bordeaux">Quota</h2>
      <Field
        label="Quota annuale di iscrizione (euro)"
        inputMode="decimal"
        {...f.register("membershipFee")}
        error={e.membershipFee?.message}
      />
      <Field
        label="Importo per ogni chilometro dei trasporti (euro)"
        hint="Per esempio 0,35. Serve a proporre l'importo della fattura."
        inputMode="decimal"
        {...f.register("kmRate")}
        error={e.kmRate?.message}
      />
      <h2 className="mt-8 text-2xl font-extrabold text-bordeaux">Sito</h2>
      <Field
        label="Dimensione massima dei video (MB)"
        inputMode="numeric"
        {...f.register("videoMaxMb")}
        error={e.videoMaxMb?.message}
      />
      <FormError message={m.error?.message} />
      <div className="mt-6">
        <Button auto type="submit" disabled={m.isPending}>
          Salva le impostazioni
        </Button>
      </div>
    </form>
  );
}

const countersSchema = (s: OrgSettings) =>
  z.object({
    lastCardNumber: int(s.lastCardNumber, 99_999_999),
    invoiceLastNumber: int(s.invoiceCounter.lastNumber, 99_999_999),
  });
type CountersIn = { lastCardNumber: string; invoiceLastNumber: string };

function CountersForm({ s }: { s: OrgSettings }) {
  const toast = useToast();
  const qc = useQueryClient();
  const f = useForm<CountersIn>({
    resolver: zodResolver(countersSchema(s)),
    defaultValues: {
      lastCardNumber: String(s.lastCardNumber),
      invoiceLastNumber: String(s.invoiceCounter.lastNumber),
    },
  });
  const e = f.formState.errors;
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: CountersIn) => {
      const card = Number(v.lastCardNumber);
      const inv = Number(v.invoiceLastNumber);
      return putCounters({
        ...(card !== s.lastCardNumber && { lastCardNumber: card }),
        ...(inv !== s.invoiceCounter.lastNumber && {
          invoiceYear: s.invoiceCounter.year,
          invoiceLastNumber: inv,
        }),
      });
    },
    onSuccess: () => {
      toast("Numerazioni salvate");
      void qc.invalidateQueries({ queryKey: ["org-settings"] });
    },
  });
  return (
    <form
      onSubmit={f.handleSubmit((v) => m.mutate(v))}
      noValidate
      aria-label="Numerazioni"
    >
      <h2 className="mt-10 text-2xl font-extrabold text-bordeaux">
        Numerazioni
      </h2>
      <p className="mt-2 rounded-xl border-2 border-ink p-3">
        <b>I numeri possono solo aumentare.</b> Serve per partire
        dall&apos;ultimo numero usato sui registri cartacei. Non si può tornare
        indietro.
      </p>
      <Field
        label="Ultimo numero di tessera usato"
        inputMode="numeric"
        hint={`Adesso: ${s.lastCardNumber}. La prossima tessera sarà la ${s.lastCardNumber + 1} o più.`}
        {...f.register("lastCardNumber")}
        error={e.lastCardNumber?.message}
      />
      <Field
        label={`Ultimo numero di fattura del ${s.invoiceCounter.year}`}
        inputMode="numeric"
        hint={`Adesso: ${s.invoiceCounter.lastNumber}.`}
        {...f.register("invoiceLastNumber")}
        error={e.invoiceLastNumber?.message}
      />
      <FormError message={m.error?.message} />
      <div className="mt-6">
        <Button auto type="submit" disabled={m.isPending}>
          Salva le numerazioni
        </Button>
      </div>
    </form>
  );
}

export default function Impostazioni() {
  const q = useQuery({ queryKey: ["org-settings"], queryFn: getOrgSettings });
  const s = q.data;
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">Impostazioni</h1>
      <Loading query={q} />
      {s && (
        <div className="max-w-2xl">
          {/* key: remount with fresh defaults after a save */}
          <OrgForm key={`o${JSON.stringify(s)}`} s={s} />
          <CountersForm
            key={`c${s.lastCardNumber}-${s.invoiceCounter.lastNumber}`}
            s={s}
          />
        </div>
      )}
    </>
  );
}
