"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Filters, FormError, Loading } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  getOrgSettings,
  putCounters,
  putOrgSettings,
  type OrgSettings,
} from "@/lib/api/admin";
import { centsToInput, formatEuro, parseEuro } from "@/lib/money";

const euro = (label: string) =>
  z
    .string()
    .refine(
      (v) => parseEuro(v) !== null,
      `${label}: scrivi un importo, per esempio 12,50`,
    );
const int = (min: number, max: number) =>
  z.string().refine((v) => {
    const n = Number(v);
    return /^\d+$/.test(v.trim()) && n >= min && n <= max;
  }, `scrivi un numero intero tra ${min} e ${max}`);

/** PUT /org-settings takes the whole record: each tab sends what it edits over the saved values. */
const saveOrg = (
  s: OrgSettings,
  patch: Partial<Parameters<typeof putOrgSettings>[0]>,
) =>
  putOrgSettings({
    legalName: s.legalName,
    taxCode: s.taxCode,
    address: s.address,
    membershipFeeCents: s.membershipFeeCents,
    priceBands: s.priceBands,
    videoMaxMb: s.videoMaxMb,
    ...patch,
  });

function useSave<V>(fn: (v: V) => Promise<unknown>, done: string) {
  const toast = useToast();
  const qc = useQueryClient();
  return useMutation({
    meta: { inline: true },
    mutationFn: fn,
    onSuccess: () => {
      toast(done);
      void qc.invalidateQueries({ queryKey: ["org-settings"] });
    },
  });
}

function SaveBar({
  label,
  pending,
  error,
}: {
  label: string;
  pending: boolean;
  error?: string;
}) {
  return (
    <>
      <FormError message={error} />
      <div className="mt-6">
        <Button auto type="submit" disabled={pending}>
          {label}
        </Button>
      </div>
    </>
  );
}

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
  membershipFee: euro("Quota"),
  videoMaxMb: int(1, 50),
});
type OrgIn = z.input<typeof orgSchema>;

function OrgForm({ s }: { s: OrgSettings }) {
  const f = useForm<OrgIn>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      legalName: s.legalName,
      taxCode: s.taxCode ?? "",
      address: s.address ?? "",
      membershipFee: centsToInput(s.membershipFeeCents),
      videoMaxMb: String(s.videoMaxMb),
    },
  });
  const e = f.formState.errors;
  const m = useSave((v: OrgIn) => {
    const x = orgSchema.parse(v);
    return saveOrg(s, {
      legalName: x.legalName,
      taxCode: x.taxCode,
      address: x.address,
      membershipFeeCents: parseEuro(x.membershipFee)!,
      videoMaxMb: Number(x.videoMaxMb),
    });
  }, "Impostazioni salvate");
  return (
    <form
      onSubmit={f.handleSubmit((v) => m.mutate(v))}
      noValidate
      aria-label="Dati dell'associazione"
    >
      <p className="mt-4 text-base">
        Intestazione di ricevute e pro forma, quota annuale e limiti del sito.
      </p>
      <Field
        label="Denominazione"
        {...f.register("legalName")}
        error={e.legalName?.message}
      />
      <div className="grid gap-x-4 md:grid-cols-2">
        <Field
          label="Codice fiscale"
          {...f.register("taxCode")}
          error={e.taxCode?.message}
        />
        <Field
          label="Quota annuale di iscrizione (euro)"
          inputMode="decimal"
          {...f.register("membershipFee")}
          error={e.membershipFee?.message}
        />
      </div>
      <Field
        label="Indirizzo"
        {...f.register("address")}
        error={e.address?.message}
      />
      <Field
        label="Dimensione massima dei video del sito (MB)"
        inputMode="numeric"
        {...f.register("videoMaxMb")}
        error={e.videoMaxMb?.message}
      />
      <SaveBar
        label="Salva le impostazioni"
        pending={m.isPending}
        error={m.error?.message}
      />
    </form>
  );
}

const bandsSchema = z.object({
  // upToKm is empty only on the last band ("oltre"); order checked below.
  bands: z
    .array(
      z.object({
        upToKm: z.string(),
        price: euro("Prezzo"),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "scegli un colore"),
        label: z
          .string()
          .trim()
          .min(1, "scrivi il nome")
          .max(40, "al massimo 40 caratteri"),
      }),
    )
    .min(1)
    .max(20)
    .superRefine((b, ctx) =>
      b.slice(0, -1).forEach((x, i) => {
        const n = Number(x.upToKm);
        const prev = i === 0 ? 0 : Number(b[i - 1]!.upToKm);
        if (!/^\d+$/.test(x.upToKm.trim()) || n <= prev || n > 10_000)
          ctx.addIssue({
            code: "custom",
            path: [i, "upToKm"],
            message: `km: scrivi un numero intero maggiore di ${prev}`,
          });
      }),
    ),
});
type BandsIn = z.input<typeof bandsSchema>;

const cell =
  "min-h-12 w-full rounded-xl border-2 border-ink bg-white px-3 text-lg aria-invalid:border-bordeaux";

function BandsForm({ s }: { s: OrgSettings }) {
  const f = useForm<BandsIn>({
    resolver: zodResolver(bandsSchema),
    defaultValues: {
      bands: s.priceBands.map((b) => ({
        upToKm: b.upToKm === null ? "" : String(b.upToKm),
        price: centsToInput(b.priceCents),
        color: b.color,
        label: b.label,
      })),
    },
  });
  const bands = useFieldArray({ control: f.control, name: "bands" });
  const rows = useWatch({ control: f.control, name: "bands" });
  const m = useSave(
    (v: BandsIn) =>
      saveOrg(s, {
        priceBands: v.bands.map((b, i) => ({
          upToKm: i === v.bands.length - 1 ? null : Number(b.upToKm),
          priceCents: parseEuro(b.price)!,
          color: b.color,
          label: b.label.trim(),
        })),
      }),
    "Fasce di prezzo salvate",
  );
  const errs = f.formState.errors.bands;
  const n = bands.fields.length;
  // saving sends the whole record, and the API refuses it without tax code and address
  if (!s.taxCode || !s.address)
    return (
      <p className="mt-4 font-bold">
        Prima compila codice fiscale e indirizzo nella sezione Associazione.
      </p>
    );
  return (
    <form
      onSubmit={f.handleSubmit((v) => m.mutate(v))}
      noValidate
      aria-label="Fasce di prezzo"
    >
      <p className="mt-4 text-base">
        Prezzo fisso per tutto il viaggio, in base ai km. I km uguali al limite
        stanno nella fascia più bassa; l&apos;ultima vale per tutti i km oltre.
        Gli autisti riconoscono la fascia dal colore. Le modifiche valgono per i
        trasporti chiusi da adesso in poi.
      </p>
      <div
        aria-hidden
        className="mt-4 hidden gap-3 px-1 text-base font-bold md:grid md:grid-cols-[4rem_1fr_9rem_9rem_7rem]"
      >
        <span>Colore</span>
        <span>Nome</span>
        <span>Fino a km</span>
        <span>Prezzo (€)</span>
        <span />
      </div>
      <ol className="mt-2 space-y-3">
        {bands.fields.map((b, i) => {
          const last = i === n - 1;
          // km are whole numbers and the limit belongs to the lower band
          const prevKm = rows[i - 1]?.upToKm;
          const from =
            i === 0 ? "0" : prevKm ? String(Number(prevKm) + 1) : "…";
          const be = errs?.[i];
          const msgs = [be?.label, be?.upToKm, be?.price, be?.color]
            .map((x) => x?.message)
            .filter(Boolean);
          const name = `Fascia ${i + 1}`;
          return (
            <li
              key={b.id}
              className="rounded-xl border-2 border-ink/20 p-3 md:border-0 md:p-1"
            >
              <div className="grid grid-cols-[4rem_1fr] items-center gap-3 md:grid-cols-[4rem_1fr_9rem_9rem_7rem]">
                <input
                  type="color"
                  aria-label={`${name}: colore`}
                  // RHF does not prefill colour inputs: the browser shows #000000 and that gets saved
                  defaultValue={b.color}
                  {...f.register(`bands.${i}.color`)}
                  className="h-12 w-16 cursor-pointer rounded-xl border-2 border-ink bg-white p-1"
                />
                <input
                  aria-label={`${name}: nome del colore`}
                  placeholder="es. Verde"
                  aria-invalid={!!be?.label}
                  {...f.register(`bands.${i}.label`)}
                  className={cell}
                />
                {last ? (
                  <p className="col-span-2 md:col-span-1 md:px-1">
                    oltre {prevKm || "…"} km
                  </p>
                ) : (
                  <label className="col-span-2 flex items-center gap-2 md:col-span-1">
                    <span className="whitespace-nowrap md:sr-only">
                      Da {from} a
                    </span>
                    <input
                      aria-label={`${name}: fino a km (da ${from})`}
                      inputMode="numeric"
                      aria-invalid={!!be?.upToKm}
                      {...f.register(`bands.${i}.upToKm`)}
                      className={cell}
                    />
                    <span className="md:sr-only">km</span>
                  </label>
                )}
                <label className="col-span-2 flex items-center gap-2 md:col-span-1">
                  <span className="whitespace-nowrap md:sr-only">Prezzo €</span>
                  <input
                    aria-label={`${name}: prezzo in euro`}
                    inputMode="decimal"
                    aria-invalid={!!be?.price}
                    {...f.register(`bands.${i}.price`)}
                    className={cell}
                  />
                </label>
                <div className="col-span-2 md:col-span-1">
                  {n > 1 && (
                    <Button
                      auto
                      type="button"
                      variant="secondary"
                      aria-label={`Togli la fascia ${i + 1}`}
                      onClick={() => {
                        // removing the last band makes the previous one open-ended
                        bands.remove(i);
                        if (last) f.setValue(`bands.${i - 1}.upToKm`, "");
                      }}
                    >
                      Togli
                    </Button>
                  )}
                </div>
              </div>
              {msgs.length > 0 && (
                <p role="alert" className="mt-1 font-bold text-bordeaux">
                  Attenzione ({name}): {msgs.join("; ")}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {n < 20 && (
        <div className="mt-3">
          <Button
            auto
            type="button"
            variant="secondary"
            onClick={() =>
              // the new band goes before the open-ended last one
              bands.insert(n - 1, {
                upToKm: "",
                price: "0,00",
                color: "#1565C0",
                label: "",
              })
            }
          >
            Aggiungi una fascia
          </Button>
        </div>
      )}
      <Preview rows={rows} />
      <SaveBar
        label="Salva le fasce"
        pending={m.isPending}
        error={m.error?.message}
      />
    </form>
  );
}

/** Plain-language reading of the bands as typed, before saving. */
function Preview({ rows }: { rows: BandsIn["bands"] }) {
  return (
    <div className="mt-6 rounded-xl bg-blu/10 p-3">
      <p className="font-bold">Come le vedrà l&apos;autista</p>
      <ul className="mt-1 space-y-1">
        {rows.map((r, i) => {
          const prev = Number(rows[i - 1]?.upToKm) || 0;
          const last = i === rows.length - 1;
          const from = i === 0 ? 0 : last ? prev : prev + 1;
          const price = parseEuro(r.price);
          return (
            <li key={i} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block size-4 shrink-0 rounded-full border border-ink"
                style={{ background: r.color }}
              />
              <span>
                <b>{r.label || "senza nome"}</b>:{" "}
                {last
                  ? `oltre ${from} km`
                  : `da ${from} a ${r.upToKm || "…"} km`}{" "}
                · {price === null ? "prezzo da sistemare" : formatEuro(price)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CountersForm({ s }: { s: OrgSettings }) {
  const f = useForm<{ lastCardNumber: string }>({
    resolver: zodResolver(
      z.object({ lastCardNumber: int(s.lastCardNumber, 99_999_999) }),
    ),
    defaultValues: { lastCardNumber: String(s.lastCardNumber) },
  });
  const m = useSave(
    (v: { lastCardNumber: string }) =>
      putCounters({ lastCardNumber: Number(v.lastCardNumber) }),
    "Numerazioni salvate",
  );
  return (
    <form
      onSubmit={f.handleSubmit((v) => m.mutate(v))}
      noValidate
      aria-label="Numerazioni"
    >
      <p className="mt-4 rounded-xl border-2 border-ink p-3">
        <b>Il numero può solo aumentare.</b> Serve per partire dall&apos;ultimo
        numero usato sui registri cartacei. Non si può tornare indietro.
      </p>
      <Field
        label="Ultimo numero di tessera usato"
        inputMode="numeric"
        hint={`Adesso: ${s.lastCardNumber}. La prossima tessera sarà la ${s.lastCardNumber + 1} o più.`}
        {...f.register("lastCardNumber")}
        error={f.formState.errors.lastCardNumber?.message}
      />
      <SaveBar
        label="Salva le numerazioni"
        pending={m.isPending}
        error={m.error?.message}
      />
    </form>
  );
}

const TABS = [
  ["associazione", "Associazione"],
  ["fasce", "Fasce di prezzo"],
  ["numerazioni", "Numerazioni"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function Impostazioni() {
  const q = useQuery({ queryKey: ["org-settings"], queryFn: getOrgSettings });
  const [tab, setTab] = useState<Tab>("associazione");
  const s = q.data;
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">Impostazioni</h1>
      <Filters
        label="Sezione delle impostazioni"
        value={tab}
        options={TABS}
        onChange={setTab}
      />
      <Loading query={q} />
      {s && (
        <div className={tab === "fasce" ? "max-w-4xl" : "max-w-2xl"}>
          <h2 className="mt-6 text-2xl font-extrabold text-bordeaux">
            {TABS.find(([k]) => k === tab)![1]}
          </h2>
          {/* key: remount with fresh defaults after a save */}
          {tab === "associazione" && <OrgForm key={JSON.stringify(s)} s={s} />}
          {tab === "fasce" && (
            <BandsForm key={JSON.stringify(s.priceBands)} s={s} />
          )}
          {tab === "numerazioni" && (
            <CountersForm key={s.lastCardNumber} s={s} />
          )}
        </div>
      )}
    </>
  );
}
