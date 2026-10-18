"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loading } from "@/components/ui/bits";
import { TransportForm } from "@/components/gestione/transport-form";
import { TransportPanel } from "@/components/gestione/transport-panel";
import { api, call } from "@/lib/api/call";
import { dayLabel } from "@/lib/dates";

export default function Trasporto() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["transports", id],
    queryFn: () =>
      call(api.GET("/transports/{id}", { params: { path: { id } } })),
  });
  const t = q.data;
  const editable =
    t && ["richiesto", "assegnato", "confermato"].includes(t.status);
  return (
    <>
      <p>
        <Link
          className="font-bold text-blu underline"
          href={`/gestione/trasporti${t ? `?week=${t.travelDate}` : ""}`}
        >
          ← Calendario dei trasporti
        </Link>
      </p>
      <Loading query={q} />
      {t && (
        <>
          <h1 className="mt-2 text-4xl font-extrabold text-bordeaux">
            Trasporto di {t.memberName}
          </h1>
          <p className="text-xl">{dayLabel(t.travelDate)}</p>
          <TransportPanel t={t} />
          {editable ? (
            <>
              <h2 className="mt-8 text-2xl font-extrabold text-blu">
                Dati del viaggio
              </h2>
              <TransportForm
                key={t.id + t.status + t.travelDate}
                transport={t}
              />
            </>
          ) : (
            <p className="mt-4">
              Un trasporto chiuso o annullato non si modifica.
            </p>
          )}
        </>
      )}
    </>
  );
}
