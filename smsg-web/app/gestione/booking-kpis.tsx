"use client";

import { useQuery } from "@tanstack/react-query";
import { Kpis, Loading } from "@/components/ui/bits";
import { api, call } from "@/lib/api/call";
import { formatEuro } from "@/lib/money";

export function BookingKpis() {
  const q = useQuery({
    queryKey: ["bookings", "kpis"],
    queryFn: () => call(api.GET("/bookings/kpis")),
  });
  const k = q.data;
  return (
    <>
      <Loading query={q} />
      {k && (
        <Kpis
          items={[
            ["Da confermare", k.toConfirm],
            ["Appuntamenti oggi", k.today],
            ["Eseguite da fatturare", k.toInvoice],
            ["Fatturato del mese", formatEuro(k.invoicedMonthCents)],
            ["Da incassare", formatEuro(k.toCollectCents)],
          ]}
        />
      )}
    </>
  );
}
