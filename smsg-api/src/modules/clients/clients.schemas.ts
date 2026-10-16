import { z } from '@hono/zod-openapi';
import { PageQuery, pageOf } from '../../lib/pagination.js';
import { Booking } from '../bookings/bookings.schemas.js';
import { Invoice } from '../invoices/invoices.schemas.js';

export const Client = z
  .strictObject({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string(),
    taxCode: z.string().nullable(),
    address: z.string().nullable(),
    notes: z.string().nullable(),
    memberId: z.uuid().nullable(),
    memberCardNumber: z.number().int().nullable(),
    bookingsCount: z.number().int(),
    toInvoiceCount: z.number().int(),
    invoicedCents: z.number().int(),
    toCollectCents: z.number().int(),
  })
  .openapi('Client');
export type Client = z.infer<typeof Client>;
export const ClientPage = pageOf(Client).openapi('ClientPage');

export const ClientDetail = Client.extend({
  member: z
    .strictObject({
      id: z.uuid(),
      cardNumber: z.number().int(),
      firstName: z.string(),
      lastName: z.string(),
      status: z.enum(['attivo', 'cessato']),
    })
    .nullable(),
  bookings: z.array(Booking),
  invoices: z.array(Invoice),
}).openapi('ClientDetail');

export const ClientsQuery = PageQuery.extend({ q: z.string().trim().max(100).optional() });

const fields = {
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(3).max(30),
  taxCode: z.string().trim().max(40).nullable().optional(),
  taxCodeConfirmed: z.boolean().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(600).nullable().optional(),
  memberId: z.uuid().nullable().optional(),
};
export const ClientCreate = z.strictObject(fields).openapi('ClientCreate');
export const ClientPatch = z.strictObject(fields).partial().openapi('ClientPatch');
