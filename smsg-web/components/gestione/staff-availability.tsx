"use client";

import { useQuery } from "@tanstack/react-query";
import { Loading } from "@/components/ui/bits";
import { api, call } from "@/lib/api/call";
import { fmtDate, fmtTime, WEEKDAYS } from "@/lib/dates";

export function StaffAvailability() {
  const q = useQuery({
    queryKey: ["availability"],
    queryFn: () => call(api.GET("/availability")),
  });
  return (
    <>
      <Loading query={q} />
      {q.data?.items.length === 0 && (
        <p className="mt-4">Nessun volontario attivo.</p>
      )}
      <ul className="mt-4 space-y-3">
        {q.data?.items.map((v) => (
          <li
            key={v.volunteerId}
            className="rounded-xl border-2 border-ink p-4"
          >
            <p className="text-xl font-extrabold">
              {v.firstName} {v.lastName}
            </p>
            {v.rules.length === 0 ? (
              <p>Non ha ancora indicato le disponibilità.</p>
            ) : (
              <ul>
                {[...v.rules]
                  .sort(
                    (a, b) =>
                      a.weekday - b.weekday ||
                      a.startTime.localeCompare(b.startTime),
                  )
                  .map((r, i) => (
                    <li key={i}>
                      <span className="font-bold">
                        {WEEKDAYS[r.weekday - 1]}
                      </span>{" "}
                      dalle {fmtTime(r.startTime)} alle {fmtTime(r.endTime)}
                    </li>
                  ))}
              </ul>
            )}
            {v.absences.map((a) => (
              <p key={a.id} className="mt-1 font-bold text-bordeaux">
                Assente dal {fmtDate(a.startsOn)} al {fmtDate(a.endsOn)}
                {a.note && ` (${a.note})`}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}
