import { z } from '@hono/zod-openapi';

/** ADR-039: strip separators, drop +39/0039, then national-form check. */
export const normalizePhone = (raw: string) =>
  raw.replace(/[\s.\-/()]/g, '').replace(/^(\+39|0039)/, '');

const Phone = z
  .string()
  .max(30)
  .transform(normalizePhone)
  .refine((p) => /^(0\d{5,10}|3\d{8,9})$/.test(p), 'Numero di telefono non valido');

export const Service = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  memberPriceCents: z.number().int(),
  nonMemberPriceCents: z.number().int(),
  scheduleNote: z.string().nullable(),
  bookable: z.boolean(),
  requiresTransport: z.boolean(),
});
export const ServicesResponse = z.object({ items: z.array(Service) });

export const SiteSettings = z.object({
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  openingHours: z.string().nullable(),
  slogan: z.string().nullable(),
  homeIntro: z.string().nullable(),
  membershipInfo: z.string().nullable(),
});

export const BookingInput = z.object({
  serviceId: z.uuid(),
  day: z.iso.date(),
  slot: z.enum(['mattina', 'pomeriggio']),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: Phone,
  declaredMember: z.boolean(),
  notes: z.string().max(600).optional(),
  turnstileToken: z.string().max(4096),
});
export type BookingInput = z.infer<typeof BookingInput>;
export const BookingCreated = z.object({ id: z.uuid() });
