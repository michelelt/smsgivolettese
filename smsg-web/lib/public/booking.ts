import { z } from "zod";

const ROME = "Europe/Rome";

/** Next `count` non-Sunday days starting tomorrow in Europe/Rome (ADR-041), as YYYY-MM-DD. */
export function bookingDays(now = new Date(), count = 12): string[] {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: ROME })
    .format(now)
    .split("-")
    .map(Number);
  const out: string[] = [];
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  while (out.length < count) {
    if (t.getUTCDay() !== 0) out.push(t.toISOString().slice(0, 10));
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return out;
}

export const formatDay = (
  day: string,
  opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
  },
) =>
  new Intl.DateTimeFormat("it-IT", { ...opts, timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );

/** Same rule as the API (ADR-039): strip separators and +39/0039, then national format. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s.\-/()]/g, "").replace(/^(\+39|0039)/, "");
}

export const bookingFormSchema = z.object({
  firstName: z.string().trim().min(1, "scriva il nome").max(80),
  lastName: z.string().trim().min(1, "scriva il cognome").max(80),
  phone: z
    .string()
    .refine(
      (v) => /^(0\d{5,10}|3\d{8,9})$/.test(normalizePhone(v)),
      "numero non valido: ad esempio 333 1234567",
    ),
  declaredMember: z.enum(["si", "no"]),
  notes: z.string().max(600, "massimo 600 caratteri"),
});
export type BookingForm = z.infer<typeof bookingFormSchema>;

export const eur = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );

export const SLOTS = { mattina: "Mattina", pomeriggio: "Pomeriggio" } as const;

export function bookingErrorMessage(code: string | undefined, phone?: string) {
  const call = phone ? ` Oppure ci chiami al ${phone}.` : "";
  switch (code) {
    case "TURNSTILE_FAILED":
      return `Non siamo riusciti a completare la verifica di sicurezza. Riprovi tra un momento.${call}`;
    case "RATE_LIMITED":
      return `Ha inviato troppe richieste in poco tempo. Attenda qualche minuto e riprovi.${call}`;
    case "INVALID_DAY":
      return "Il giorno scelto non è disponibile. Torni indietro e ne scelga un altro.";
    case "SERVICE_NOT_BOOKABLE":
      return `Questo servizio non si può prenotare online.${call}`;
    case "VALIDATION_ERROR":
      return "Alcuni dati non sono corretti. Torni indietro e li controlli.";
    default:
      return `Non è stato possibile inviare la richiesta. Riprovi tra poco.${call}`;
  }
}
