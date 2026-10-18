"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import {
  CARD,
  useWeek,
  WeekCalendar,
} from "@/components/gestione/week-calendar";
import { api, call, saveBlob } from "@/lib/api/call";
import { addDays, fmtTime, today } from "@/lib/dates";
import { TRANSPORT_STATUS } from "@/components/gestione/transport-panel";

// Dark text on a light tint (AA); the stripe and the status text carry the state too.
const TONE = {
  richiesto: "border-red-800 bg-red-50 text-red-900",
  assegnato: "border-amber-700 bg-amber-50 text-amber-950",
  confermato: "border-green-800 bg-green-50 text-green-950",
  svolto: "border-blu bg-white text-ink",
  annullato: "border-ink/50 bg-white text-ink/70",
} as const;
const MARK = {
  richiesto: "✗",
  assegnato: "◐",
  confermato: "✓",
  svolto: "✓",
  annullato: "–",
} as const;

export default function Trasporti() {
  const toast = useToast();
  const wk = useWeek();
  const { week } = wk;
  const [month, setMonth] = useState(today().slice(0, 7));
  const q = useQuery({
    queryKey: ["transports", week],
    queryFn: () =>
      call(
        api.GET("/transports", {
          params: { query: { from: week, to: addDays(week, 6) } },
        }),
      ),
  });
  const items = q.data?.items ?? [];
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
      <PageHeader
        title="Trasporti"
        actions={
          <>
            <ButtonLink href="/gestione/trasporti/nuovo">
              Nuovo trasporto
            </ButtonLink>
            <ButtonLink variant="secondary" href="#riepilogo">
              Riepilogo mensile
            </ButtonLink>
          </>
        }
      />
      <WeekCalendar
        basePath="/gestione/trasporti"
        label="Calendario dei trasporti"
        state={wk}
        query={q}
        ready={!!q.data}
        itemsOf={(d) => items.filter((t) => t.travelDate === d)}
        empty="Nessun trasporto."
        flagged={(d) =>
          items.some((t) => t.travelDate === d && t.status === "richiesto")
        }
        flagText="trasporti da assegnare"
        renderItem={(t) => (
          <li key={t.id} className={`${CARD} ${TONE[t.status]}`}>
            <p className="flex items-center gap-1 whitespace-nowrap font-extrabold">
              <span className="lg:max-2xl:hidden">
                <Icon name="clock" />
              </span>
              {fmtTime(t.departureTime ?? t.appointmentTime)}
            </p>
            <p className="font-bold">
              <Link className="underline" href={`/gestione/trasporti/${t.id}`}>
                {t.memberName}
              </Link>
            </p>
            <p className="font-bold">
              {MARK[t.status]} {TRANSPORT_STATUS[t.status]}
            </p>
            <p className="break-words">
              {t.fromAddress ?? "—"} → {t.toAddress ?? "—"}
            </p>
            <p>
              Autista: {t.driverName ?? "da assegnare"}
              {t.vehiclePlate && ` · ${t.vehiclePlate}`}
              {t.wheelchair && " · carrozzina"}
              {t.mobilityAids && " · ausili"}
              {t.companions > 0 && ` · accompagnatori: ${t.companions}`}
            </p>
          </li>
        )}
      />
      <h2 id="riepilogo" className="mt-8 text-2xl font-extrabold text-blu">
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
