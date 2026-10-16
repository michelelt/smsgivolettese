import type { z } from '@hono/zod-openapi';
import type { Tx } from '../../lib/db.js';
import { containsPattern, offsetOf } from '../../lib/pagination.js';
import type { Invoice, InvoiceDetail, InvoiceKpis, InvoicesQuery } from './invoices.schemas.js';

const cols = (tx: Tx) => tx`
         i.id, i.year, i.number, i.issued_on::text as "issuedOn", i.client_id as "clientId",
         i.customer_name as "customerName", i.customer_tax_code as "customerTaxCode",
         i.customer_address as "customerAddress", i.subtotal_cents as "subtotalCents",
         i.stamp_duty_cents as "stampDutyCents", i.total_cents as "totalCents", i.status,
         i.payment_method as "paymentMethod", i.paid_on::text as "paidOn",
         (i.voided_at at time zone 'Europe/Rome')::date::text as "voidedOn", i.void_reason as "voidReason"`;

export const invoiceSelect = (tx: Tx) => tx`select ${cols(tx)} from public.invoices i`;

export async function list(tx: Tx, q: InvoicesQuery) {
  const where = tx`where true
    ${q.status !== 'tutte' ? tx`and i.status = ${q.status}` : tx``}
    ${q.year ? tx`and i.year = ${q.year}` : tx``}
    ${
      q.q
        ? tx`and (i.customer_name ilike ${containsPattern(q.q)}
                  or i.number || '/' || i.year ilike ${containsPattern(q.q)})`
        : tx``
    }`;
  const items = await tx<Invoice[]>`
    ${invoiceSelect(tx)} ${where}
    order by i.year desc, i.number desc limit ${q.pageSize} offset ${offsetOf(q)}`;
  const [t] = await tx<
    { total: number }[]
  >`select count(*)::int as total from public.invoices i ${where}`;
  return { items, total: t!.total };
}

/** Whole year, by number (CSV). */
export const forYear = (tx: Tx, year: number) =>
  tx<Invoice[]>`${invoiceSelect(tx)} where i.year = ${year} order by i.number`;

export const kpis = async (tx: Tx, year: number) =>
  (
    await tx<z.infer<typeof InvoiceKpis>[]>`
      select count(*)::int as count, coalesce(sum(total_cents), 0)::int as "totalCents",
        coalesce(sum(total_cents) filter (where status = 'pagata'), 0)::int as "collectedCents",
        coalesce(sum(total_cents) filter (where status = 'emessa'), 0)::int as "toCollectCents"
      from public.invoices where year = ${year} and status <> 'annullata'`
  )[0]!;

export async function detail(tx: Tx, id: string) {
  const [inv] = await tx<Omit<InvoiceDetail, 'lines'>[]>`
    select ${cols(tx)}, i.issuer_name as "issuerName", i.issuer_tax_code as "issuerTaxCode",
           i.issuer_address as "issuerAddress", i.vat_exemption_text as "vatExemptionText"
    from public.invoices i where i.id = ${id}`;
  if (!inv) return undefined;
  const lines = await tx<InvoiceDetail['lines']>`
    select position, description, amount_cents as "amountCents", booking_id as "bookingId"
    from public.invoice_lines where invoice_id = ${id} order by position`;
  return { ...inv, lines };
}

export const exists = async (tx: Tx, id: string) =>
  (await tx`select 1 from public.invoices where id = ${id}`).length > 0;

export const issue = async (
  tx: Tx,
  a: {
    clientId: string;
    bookingIds: string[];
    taxCode: string | null;
    address: string | null;
    method: string | null;
  },
) =>
  (
    await tx<{ id: string }[]>`
      select id from public.issue_invoice(${a.clientId}::uuid, ${tx.array(a.bookingIds)}::uuid[],
        ${a.taxCode}::text, ${a.address}::text, ${a.method}::public.payment_method)`
  )[0]!.id;

export const pay = (tx: Tx, id: string, method: string, paidOn: string | null) =>
  tx`update public.invoices set status = 'pagata', payment_method = ${method}::public.payment_method,
       paid_on = coalesce(${paidOn}::date, (now() at time zone 'Europe/Rome')::date)
     where id = ${id} and status = 'emessa' returning id`;

export const voidInvoice = (tx: Tx, id: string, reason: string) =>
  tx`select id from public.void_invoice(${id}::uuid, ${reason})`;
