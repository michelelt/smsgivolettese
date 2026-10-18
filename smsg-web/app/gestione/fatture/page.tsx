"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/ui/actions";
import { Filters, Kpis, Loading, Pager, Pill } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { InvoiceActions } from "@/components/gestione/invoice-actions";
import { api, call, saveBlob } from "@/lib/api/call";
import { useDebounced } from "@/lib/api/hooks";
import { currentYear, fmtDate } from "@/lib/dates";
import { formatEuro } from "@/lib/money";

const FILTERS = [
  ["tutte", "Tutte"],
  ["emessa", "Da incassare"],
  ["pagata", "Pagate"],
  ["annullata", "Annullate"],
] as const;
type Status = (typeof FILTERS)[number][0];
const LABEL = {
  emessa: "Da incassare",
  pagata: "Pagata",
  annullata: "Annullata",
};

export default function Fatture() {
  const now = currentYear();
  const [year, setYear] = useState(now);
  const [status, setStatus] = useState<Status>("tutte");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const kpis = useQuery({
    queryKey: ["invoices", "kpis", year],
    queryFn: () =>
      call(api.GET("/invoices/kpis", { params: { query: { year } } })),
  });
  const list = useQuery({
    queryKey: ["invoices", { year, status, q: dq, page }],
    queryFn: () =>
      call(
        api.GET("/invoices", {
          params: { query: { year, status, q: dq || undefined, page } },
        }),
      ),
  });
  const csv = useMutation({
    mutationFn: () =>
      saveBlob(
        api.GET("/invoices/export.csv", {
          params: { query: { year } },
          parseAs: "blob",
        }),
        `fatture-${year}.csv`,
      ),
  });
  const k = kpis.data;
  return (
    <>
      <PageHeader
        title="Fatture"
        actions={
          <Button
            variant="secondary"
            disabled={csv.isPending}
            onClick={() => csv.mutate()}
          >
            Esporta CSV per il commercialista
          </Button>
        }
      />
      <Select
        label="Anno"
        value={year}
        onChange={(e) => {
          setYear(Number(e.target.value));
          setPage(1);
        }}
      >
        {Array.from({ length: 6 }, (_, n) => now - n).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
      <Loading query={kpis} />
      {k && (
        <Kpis
          items={[
            ["Fatture emesse", k.count],
            ["Totale fatturato", formatEuro(k.totalCents)],
            ["Incassato", formatEuro(k.collectedCents)],
            ["Da incassare", formatEuro(k.toCollectCents)],
          ]}
        />
      )}
      <Filters
        label="Filtro fatture"
        value={status}
        options={FILTERS}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />
      <Field
        label="Cerca per socio o numero"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      <Loading query={list} />
      {list.data && (
        <>
          {list.data.items.length === 0 && (
            <p className="mt-4">
              Nessuna fattura. Si emettono dai trasporti segnati come svolti.
            </p>
          )}
          <ul className="mt-4 space-y-3">
            {list.data.items.map((i) => (
              <li key={i.id} className="rounded-xl border-2 border-ink p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xl font-extrabold">
                    Fattura n. {i.number}/{i.year}
                  </p>
                  <Pill>{LABEL[i.status]}</Pill>
                </div>
                <p>
                  {i.customerName} · {fmtDate(i.issuedOn)} ·{" "}
                  <b>{formatEuro(i.totalCents)}</b>
                  {i.paidOn && ` · pagata il ${fmtDate(i.paidOn)}`}
                  {i.voidedOn && ` · annullata il ${fmtDate(i.voidedOn)}`}
                </p>
                <InvoiceActions invoice={i} />
              </li>
            ))}
          </ul>
          <Pager page={page} total={list.data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
