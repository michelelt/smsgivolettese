const eur = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

/** 1250 -> "1.250,00 €" */
export const formatEuro = (cents: number) => eur.format(cents / 100);

/** "12,50" / "12.50" / "1.250,5" / "€ 12" -> integer cents; null when not a valid amount. */
export function parseEuro(input: string): number | null {
  let s = input.replace(/[€\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** 1250 -> "12,50" (for prefilling inputs). */
export const centsToInput = (cents: number) =>
  (cents / 100).toFixed(2).replace(".", ",");
