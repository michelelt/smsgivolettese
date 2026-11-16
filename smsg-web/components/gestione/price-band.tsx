import { z } from "zod";
import type { components } from "@/lib/api/schema";
import { parseEuro } from "@/lib/money";

type Band = components["schemas"]["PriceBand"];

/** Bands are sorted ascending with an open-ended last one (ADR-075); km on the limit stays in the lower band. */
export const bandFor = (bands: Band[], km: number) =>
  bands.find((b) => b.upToKm === null || km <= b.upToKm);

export function BandDot({
  color,
  label,
}: {
  color: string | null;
  label: string | null;
}) {
  if (!color) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block size-4 shrink-0 rounded-full border border-ink"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

/** Amount collected by the driver: empty = not collected. */
export const collectedInput = z
  .string()
  .refine(
    (v) => !v.trim() || parseEuro(v) !== null,
    "scrivi un importo, per esempio 12,50, oppure lascia vuoto",
  );
export const collectedCents = (v: string) => (v.trim() ? parseEuro(v)! : null);
