"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CARD,
  useWeek,
  WeekCalendar,
} from "@/components/gestione/week-calendar";
import { Icon } from "@/components/ui/icon";
import { api, call } from "@/lib/api/call";
import { availableOn } from "@/lib/availability-days";
import { fmtTime, mondayOf, today } from "@/lib/dates";

export function StaffAvailability() {
  const wk = useWeek();
  const q = useQuery({
    queryKey: ["availability"],
    queryFn: () => call(api.GET("/availability")),
  });
  const items = q.data?.items ?? [];
  return (
    <WeekCalendar
      basePath="/gestione/disponibilita"
      label="Calendario delle disponibilità"
      state={wk}
      query={q}
      ready={!!q.data}
      itemsOf={(d) => availableOn(items, d)}
      empty="Nessun volontario disponibile."
      summary={
        wk.week < mondayOf(today()) && (
          <p className="mt-4 font-bold">
            Settimana passata: le assenze già finite non sono mostrate.
          </p>
        )
      }
      renderItem={({ volunteer: v, slots }) => (
        <li key={v.volunteerId} className={`${CARD} border-blu text-ink`}>
          <p className="font-extrabold">
            {v.firstName} {v.lastName}
          </p>
          {v.canDrive && (
            <p className="flex items-center gap-1 font-bold text-blu">
              <Icon name="car" /> Autista
            </p>
          )}
          {slots.map((s, i) => (
            <p key={i} className="whitespace-nowrap">
              {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
            </p>
          ))}
        </li>
      )}
    />
  );
}
