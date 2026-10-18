import { z } from '@hono/zod-openapi';
import { PageQuery, pageOf } from '../../lib/pagination.js';

export const PaymentMethod = z.enum(['contanti', 'pos', 'bonifico']);
const status = z.enum(['emessa', 'pagata', 'annullata']);

export const Invoice = z
  .strictObject({
    id: z.uuid(),
    year: z.number().int(),
    number: z.number().int(),
    issuedOn: z.string(),
    memberId: z.uuid(),
    customerName: z.string(),
    customerTaxCode: z.string().nullable(),
    customerAddress: z.string().nullable(),
    subtotalCents: z.number().int(),
    stampDutyCents: z.number().int(),
    totalCents: z.number().int(),
    status,
    paymentMethod: PaymentMethod.nullable(),
    paidOn: z.string().nullable(),
    voidedOn: z.string().nullable(),
    voidReason: z.string().nullable(),
  })
  .openapi('Invoice');
export type Invoice = z.infer<typeof Invoice>;
export const InvoicePage = pageOf(Invoice).openapi('InvoicePage');

export const InvoiceDetail = Invoice.extend({
  issuerName: z.string(),
  issuerTaxCode: z.string().nullable(),
  issuerAddress: z.string().nullable(),
  vatExemptionText: z.string(),
  lines: z.array(
    z.strictObject({
      position: z.number().int(),
      description: z.string(),
      amountCents: z.number().int(),
      transportId: z.uuid().nullable(),
    }),
  ),
}).openapi('InvoiceDetail');
export type InvoiceDetail = z.infer<typeof InvoiceDetail>;

export const InvoicesQuery = PageQuery.extend({
  status: z.enum(['emessa', 'pagata', 'annullata', 'tutte']).default('tutte'),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  q: z.string().trim().max(100).optional(),
});
export type InvoicesQuery = z.infer<typeof InvoicesQuery>;
export const YearQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });

export const InvoiceKpis = z
  .strictObject({
    count: z.number().int(),
    totalCents: z.number().int(),
    collectedCents: z.number().int(),
    toCollectCents: z.number().int(),
  })
  .openapi('InvoiceKpis');

export const InvoiceIssue = z
  .strictObject({
    transportId: z.uuid(),
    amountCents: z.number().int().min(0).max(10_000_000),
    customerTaxCode: z.string().trim().max(40).nullable().optional(),
    taxCodeConfirmed: z.boolean().optional(),
    customerAddress: z.string().trim().max(200).nullable().optional(),
    paymentMethod: PaymentMethod.optional(),
  })
  .openapi('InvoiceIssue');
export const InvoicePay = z
  .strictObject({ method: PaymentMethod, paidOn: z.iso.date().optional() })
  .openapi('InvoicePay');
export const InvoiceVoid = z
  .strictObject({ reason: z.string().trim().min(1).max(300) })
  .openapi('InvoiceVoid');
