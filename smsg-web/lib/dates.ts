/** Today as YYYY-MM-DD in Rome time (what the API uses). */
export const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });

/** YYYY-MM-DD -> dd/mm/yyyy */
export const fmtDate = (d: string | null | undefined) =>
  d ? d.split("-").reverse().join("/") : "—";

export const currentYear = () => Number(today().slice(0, 4));

const noon = (d: string) => new Date(`${d}T12:00:00Z`); // noon UTC: no DST edge

export const addDays = (d: string, n: number) => {
  const x = noon(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Monday of the ISO week containing `d`. */
export const mondayOf = (d: string) =>
  addDays(d, -((noon(d).getUTCDay() + 6) % 7));

export const isDate = (v: string | null | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(noon(v).getTime());

/** "09:00:00" or "09:00" -> "09:00" */
export const fmtTime = (t: string | null | undefined) =>
  t ? t.slice(0, 5) : "—";

/** "lunedì 5 ottobre" */
export const dayLabel = (d: string) =>
  noon(d).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

/** ISO weekday 1..7 */
export const WEEKDAYS = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
] as const;
