import type { components } from "@/lib/api/schema";

type Item = components["schemas"]["AvailabilityOverview"]["items"][number];
export type DayAvailability = {
  volunteer: Item;
  slots: { startTime: string; endTime: string }[];
};

/** ISO weekday 1..7 (Monday = 1) of a YYYY-MM-DD date. */
const isoWeekday = (d: string) =>
  ((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

/** Volunteers whose weekly rules match `day`, minus those absent that day; slots sorted by start. */
export function availableOn(items: Item[], day: string): DayAvailability[] {
  const wd = isoWeekday(day);
  return items.flatMap((volunteer) => {
    if (volunteer.absences.some((a) => a.startsOn <= day && day <= a.endsOn))
      return [];
    const slots = volunteer.rules
      .filter((r) => r.weekday === wd)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return slots.length ? [{ volunteer, slots }] : [];
  });
}
