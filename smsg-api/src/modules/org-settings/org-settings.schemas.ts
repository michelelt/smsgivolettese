import { z } from '@hono/zod-openapi';

const cents = z.number().int().min(0).max(1_000_000);

export const PriceBand = z
  .strictObject({
    upToKm: z.number().int().min(1).max(10_000).nullable(),
    priceCents: cents,
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Colore non valido'),
    label: z.string().trim().min(1).max(40),
  })
  .openapi('PriceBand');
/** Ascending upToKm, last one open-ended (null): every km falls in exactly one band. */
export const PriceBands = z
  .array(PriceBand)
  .min(1)
  .max(20)
  .refine(
    (b) =>
      b.at(-1)?.upToKm === null && // refine runs even when min(1) failed
      b
        .slice(0, -1)
        .every((x, i) => x.upToKm !== null && (i === 0 || x.upToKm > b[i - 1]!.upToKm!)),
    { message: "Fasce in ordine crescente di km; l'ultima vale per tutti i km oltre" },
  )
  .openapi('PriceBands');
export type PriceBands = z.infer<typeof PriceBands>;

export const OrgSettingsInput = z
  .strictObject({
    legalName: z.string().trim().min(1).max(200),
    taxCode: z
      .string()
      .trim()
      .regex(/^(\d{11}|[A-Z0-9]{16})$/, 'Codice fiscale o partita IVA non valido'),
    address: z.string().trim().min(1).max(300),
    membershipFeeCents: cents,
    priceBands: PriceBands,
    videoMaxMb: z.number().int().min(1).max(50),
  })
  .openapi('OrgSettingsInput');

export const OrgSettings = OrgSettingsInput.extend({
  taxCode: z.string().nullable(),
  address: z.string().nullable(),
  lastCardNumber: z.number().int(),
}).openapi('OrgSettings');
export type OrgSettings = z.infer<typeof OrgSettings>;

export const CountersInput = z
  .strictObject({
    lastCardNumber: z.number().int().min(0).max(2_000_000_000),
  })
  .openapi('CountersInput');
export type CountersInput = z.infer<typeof CountersInput>;
