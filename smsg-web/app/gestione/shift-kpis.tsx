"use client";

import { useQuery } from "@tanstack/react-query";
import { Kpis, Loading } from "@/components/ui/bits";
import { api, call } from "@/lib/api/call";
import { addDays, mondayOf, today } from "@/lib/dates";

export function ShiftKpis() {
  const monday = mondayOf(today());
  const shifts = useQuery({
    queryKey: ["shifts", monday],
    queryFn: () =>
      call(
        api.GET("/shifts", {
          params: { query: { from: monday, to: addDays(monday, 6) } },
        }),
      ),
  });
  const requested = useQuery({
    queryKey: ["transports", "requested"],
    queryFn: () =>
      call(
        api.GET("/transports", {
          params: {
            query: {
              from: today(),
              to: addDays(today(), 7),
              status: "richiesto",
            },
          },
        }),
      ),
  });
  return (
    <>
      <Loading query={shifts} />
      <Loading query={requested} />
      {shifts.data && requested.data && (
        <Kpis
          items={[
            [
              "Turni scoperti questa settimana",
              shifts.data.items.filter((s) => s.coverage === "scoperto").length,
            ],
            ["Trasporti da assegnare", requested.data.total],
          ]}
        />
      )}
    </>
  );
}
