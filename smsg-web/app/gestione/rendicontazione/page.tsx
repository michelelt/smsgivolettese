"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/actions";
import { Kpis, Loading } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { BandDot } from "@/components/gestione/price-band";
import { api, call, saveBlob } from "@/lib/api/call";
import { addDays, fmtDate, today } from "@/lib/dates";
import { formatEuro } from "@/lib/money";

/** "2026-02" -> "2026-03-01" (day 1 + 31 always lands in the next month). */
const nextMonth = (m: string) => addDays(`${m}-01`, 31).slice(0, 7) + "-01";

export default function Rendicontazione() {
  const toast = useToast();
  const [month, setMonth] = useState(today().slice(0, 7));
  const q = useQuery({
    queryKey: ["transports", "svolti", month],
    enabled: !!month,
    queryFn: () =>
      call(
        api.GET("/transports", {
          params: {
            query: {
              from: `${month}-01`,
              to: addDays(nextMonth(month), -1),
              status: "svolto",
            },
          },
        }),
      ),
  });
  const csv = useMutation({
    mutationFn: () =>
      saveBlob(
        api.GET("/transports/export.csv", {
          params: { query: { month } },
          parseAs: "blob",
        }),
        `trasporti-${month}.csv`,
      ),
    onSuccess: () => toast("Rendicontazione scaricata"),
  });
  const items = q.data?.items ?? [];
  const sum = (f: (t: (typeof items)[number]) => number | null) =>
    items.reduce((a, t) => a + (f(t) ?? 0), 0);
  return (
    <>
      <PageHeader
        title="Rendicontazione"
        actions={
          <Button
            variant="secondary"
            disabled={csv.isPending || !month}
            onClick={() => csv.mutate()}
          >
            Scarica il mese (CSV)
          </Button>
        }
      />
      <p>
        Trasporti svolti nel mese, con la fascia di prezzo e quanto ha incassato
        l&apos;autista. Il pro forma per il socio si scarica dalla pagina del
        trasporto e non mostra prezzi.
      </p>
      <Field
        label="Mese"
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
      />
      <Loading query={q} />
      {q.data && (
        <>
          <Kpis
            items={[
              ["Trasporti svolti", items.length],
              [
                "Totale prezzi di fascia",
                formatEuro(sum((t) => t.bandPriceCents)),
              ],
              ["Incassato", formatEuro(sum((t) => t.collectedCents))],
              [
                "Non incassati",
                items.filter((t) => t.collectedCents == null).length,
              ],
            ]}
          />
          {items.length === 0 && (
            <p className="mt-4">Nessun trasporto svolto in questo mese.</p>
          )}
          <ul className="mt-4 space-y-3">
            {items.map((t) => (
              <li key={t.id} className="rounded-xl border-2 border-ink p-4">
                <p className="text-xl font-extrabold">
                  <Link
                    className="underline"
                    href={`/gestione/trasporti/${t.id}`}
                  >
                    {t.memberName}
                  </Link>{" "}
                  · {fmtDate(t.travelDate)}
                </p>
                <p>
                  {t.km ?? "—"} km ·{" "}
                  {t.bandColor ? (
                    <BandDot color={t.bandColor} label={t.bandLabel} />
                  ) : (
                    "nessuna fascia"
                  )}
                  {t.bandPriceCents != null &&
                    ` · prezzo fascia ${formatEuro(t.bandPriceCents)}`}
                  {" · autista "}
                  {t.driverName ?? "—"}
                </p>
                <p>
                  Incassato:{" "}
                  <b>
                    {t.collectedCents != null
                      ? formatEuro(t.collectedCents)
                      : "non incassato"}
                  </b>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
