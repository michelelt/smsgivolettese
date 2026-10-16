import { z } from '@hono/zod-openapi';
import { PageQuery, pageOf } from '../../lib/pagination.js';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Orario HH:MM');
const slot = z.enum(['mattina', 'pomeriggio']);
const status = z.enum(['attesa', 'confermata', 'eseguita', 'annullata']);

export const Booking = z
  .strictObject({
    id: z.uuid(),
    clientId: z.uuid(),
    clientName: z.string(),
    clientPhone: z.string(),
    serviceId: z.uuid(),
    serviceName: z.string(),
    day: z.string(),
    slot,
    time: z.string().nullable(),
    status,
    isMember: z.boolean(),
    priceAppliedCents: z.number().int(),
    origin: z.enum(['online', 'telefono']),
    notes: z.string().nullable(),
    cancelledBy: z.enum(['staff', 'utente']).nullable(),
    invoiceId: z.uuid().nullable(),
    invoiceNumber: z.string().nullable(),
  })
  .openapi('Booking');
export type Booking = z.infer<typeof Booking>;
export const BookingPage = pageOf(Booking).openapi('BookingPage');

export const BookingsQuery = PageQuery.extend({
  status: z
    .enum(['aperte', 'attesa', 'confermata', 'eseguita', 'da_fatturare', 'annullata', 'tutte'])
    .default('aperte'),
  q: z.string().trim().max(100).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  clientId: z.uuid().optional(),
});
export type BookingsQuery = z.infer<typeof BookingsQuery>;

export const BookingKpis = z
  .strictObject({
    toConfirm: z.number().int(),
    today: z.number().int(),
    toInvoice: z.number().int(),
    invoicedMonthCents: z.number().int(),
    toCollectCents: z.number().int(),
  })
  .openapi('BookingKpis');

export const BookingCreate = z
  .strictObject({
    clientId: z.uuid(),
    serviceId: z.uuid(),
    day: z.iso.date(),
    slot,
    time: time.optional(),
    declaredMember: z.boolean().optional(),
    notes: z.string().trim().max(600).optional(),
  })
  .openapi('BookingCreate');
export const BookingConfirm = z.strictObject({ time: time.optional() }).openapi('BookingConfirm');
export const BookingCancel = z
  .strictObject({ by: z.enum(['staff', 'utente']) })
  .openapi('BookingCancel');
