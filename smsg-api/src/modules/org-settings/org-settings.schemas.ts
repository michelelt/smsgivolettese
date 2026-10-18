import { z } from '@hono/zod-openapi';

const cents = z.number().int().min(0).max(1_000_000);

export const OrgSettingsInput = z
  .strictObject({
    legalName: z.string().trim().min(1).max(200),
    taxCode: z
      .string()
      .trim()
      .regex(/^(\d{11}|[A-Z0-9]{16})$/, 'Codice fiscale o partita IVA non valido'),
    address: z.string().trim().min(1).max(300),
    vatExemptionText: z.string().trim().min(1).max(500),
    stampDutyThresholdCents: cents,
    stampDutyAmountCents: cents,
    membershipFeeCents: cents,
    kmRateCents: z.number().int().min(0).max(100_000),
    videoMaxMb: z.number().int().min(1).max(50),
  })
  .openapi('OrgSettingsInput');

export const OrgSettings = OrgSettingsInput.extend({
  taxCode: z.string().nullable(),
  address: z.string().nullable(),
  lastCardNumber: z.number().int(),
  invoiceCounter: z.strictObject({ year: z.number().int(), lastNumber: z.number().int() }),
}).openapi('OrgSettings');
export type OrgSettings = z.infer<typeof OrgSettings>;

export const CountersInput = z
  .strictObject({
    lastCardNumber: z.number().int().min(0).max(2_000_000_000).optional(),
    invoiceYear: z.number().int().min(2000).max(2100).optional(),
    invoiceLastNumber: z.number().int().min(0).max(2_000_000_000).optional(),
  })
  .refine((v) => (v.invoiceYear === undefined) === (v.invoiceLastNumber === undefined), {
    message: 'Indica sia anno sia numero della fattura',
  })
  .refine((v) => v.lastCardNumber !== undefined || v.invoiceYear !== undefined, {
    message: 'Nessuna modifica',
  })
  .openapi('CountersInput');
export type CountersInput = z.infer<typeof CountersInput>;
