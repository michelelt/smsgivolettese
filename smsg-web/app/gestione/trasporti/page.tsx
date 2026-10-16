"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loading, Pill } from "@/components/ui/bits";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api, call, saveBlob } from "@/lib/api/call";
import {
  addDays,
  dayLabel,
  fmtTime,
  isDate,
  mondayOf,
  today,
} from "@/lib/dates";
import { TRANSPORT_STATUS } from "@/components/gestione/transport-panel";

export default function Trasporti() {
  const sp = useSearchParams();
  const toast = useToast();
  const weekMode = sp.get("week") !== null;
  const base = weekMode ? sp.get("week") : sp.get("day");
  const anchor = isDate(base) ? base : today();
  const from = weekMode ? mondayOf(anchor) : anchor;
  const to = weekMode ? addDays(from, 6) : anchor;
  const step = weekMode ? 7 : 1;
  const href = (d: string, w = weekMode) =>
    `/gestione/trasporti?${w ? "week" : "day"}=${d}`;
  const [month, setMonth] = useState(today().slice(0, 7));
  const q = useQuery({
    queryKey: ["transports", from, to],
    queryFn: () =>
      call(api.GET("/transports", { params: { query: { from, to } } })),
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
    onSuccess: () => toast("Riepilogo scaricato"),
  });
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">Trasporti</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        <ButtonLink href="/gestione/trasporti/nuovo">
          Nuovo trasporto
        </ButtonLink>
        <ButtonLink
          variant="secondary"
          href={href(weekMode ? from : mondayOf(anchor), !weekMode)}
        >
          {weekMode ? "Vedi un giorno" : "Vedi la settimana"}
        </ButtonLink>
      </div>
      <nav
        aria-label="Periodo"
        className="mt-4 flex flex-wrap items-center gap-3"
      >
        <ButtonLink variant="secondary" href={href(addDays(from, -step))}>
          ← Prima
        </ButtonLink>
        <span className="font-bold">
          {weekMode
            ? `Dal ${dayLabel(from)} al ${dayLabel(to)}`
            : dayLabel(from)}
        </span>
        <ButtonLink variant="secondary" href={href(addDays(from, step))}>
          Dopo →
        </ButtonLink>
        <ButtonLink variant="secondary" href={href(today())}>
          Oggi
        </ButtonLink>
      </nav>
      <Loading query={q} />
      {q.data?.items.length === 0 && (
        <p className="mt-4">Nessun trasporto in questo periodo.</p>
      )}
      <ul className="mt-4 space-y-3">
        {q.data?.items.map((t) => (
          <li key={t.id} className="rounded-xl border-2 border-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xl font-extrabold">
                {weekMode && `${dayLabel(t.travelDate)} · `}
                {fmtTime(t.departureTime)} ·{" "}
                <Link
                  className="text-blu underline"
                  href={`/gestione/trasporti/${t.id}`}
                >
                  {t.memberName}
                </Link>
              </p>
              <Pill>{TRANSPORT_STATUS[t.status]}</Pill>
            </div>
            <p>
              {t.fromAddress ?? "—"} → {t.toAddress ?? "—"}
            </p>
            <p>
              Autista: {t.driverName ?? "da assegnare"}
              {t.vehiclePlate && ` · ${t.vehiclePlate}`}
              {t.wheelchair && " · carrozzina"}
              {t.companion && " · accompagnatore"}
            </p>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-2xl font-extrabold text-blu">
        Riepilogo mensile
      </h2>
      <Field
        label="Mese"
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
      />
      <div className="mt-3">
        <Button
          auto
          variant="secondary"
          disabled={csv.isPending || !month}
          onClick={() => csv.mutate()}
        >
          Scarica il riepilogo (CSV)
        </Button>
      </div>
    </>
  );
}
