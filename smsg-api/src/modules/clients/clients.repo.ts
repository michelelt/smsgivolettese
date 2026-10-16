import type { z } from '@hono/zod-openapi';
import type { Tx } from '../../lib/db.js';
import { containsPattern, offsetOf, type Page } from '../../lib/pagination.js';
import { toRow } from '../../lib/sql.js';
import { bookingSelect } from '../bookings/bookings.repo.js';
import type { Booking } from '../bookings/bookings.schemas.js';
import { invoiceSelect } from '../invoices/invoices.repo.js';
import type { Invoice } from '../invoices/invoices.schemas.js';
import type { Client } from './clients.schemas.js';
import type { ClientDetail } from './clients.schemas.js';

const COLS = {
  firstName: 'first_name',
  lastName: 'last_name',
  phone: 'phone',
  taxCode: 'tax_code',
  address: 'address',
  notes: 'notes',
  memberId: 'member_id',
};

const select = (tx: Tx) => tx`
  select c.id, c.first_name as "firstName", c.last_name as "lastName", c.phone,
    c.tax_code as "taxCode", c.address, c.notes, c.member_id as "memberId",
    m.card_number as "memberCardNumber",
    (select count(*) from public.bookings b where b.client_id = c.id)::int as "bookingsCount",
    (select count(*) from public.bookings b
      where b.client_id = c.id and b.status = 'eseguita' and b.invoice_id is null)::int as "toInvoiceCount",
    (select coalesce(sum(i.total_cents), 0) from public.invoices i
      where i.client_id = c.id and i.status <> 'annullata')::int as "invoicedCents",
    (select coalesce(sum(i.total_cents), 0) from public.invoices i
      where i.client_id = c.id and i.status = 'emessa')::int as "toCollectCents"
  from public.clients c left join public.members m on m.id = c.member_id`;

export async function list(tx: Tx, q: Page & { q?: string }) {
  const p = q.q ? containsPattern(q.q) : null;
  const where = p
    ? tx`where c.first_name || ' ' || c.last_name ilike ${p} or c.last_name || ' ' || c.first_name ilike ${p}
         or c.phone ilike ${p} or c.tax_code ilike ${p}`
    : tx``;
  const items = await tx<Client[]>`
    ${select(tx)} ${where} order by lower(c.last_name), lower(c.first_name), c.id
    limit ${q.pageSize} offset ${offsetOf(q)}`;
  const [t] = await tx<
    { total: number }[]
  >`select count(*)::int as total from public.clients c ${where}`;
  return { items, total: t!.total };
}

export const byId = async (tx: Tx, id: string) =>
  (await tx<Client[]>`${select(tx)} where c.id = ${id}`)[0];

export async function detail(tx: Tx, id: string) {
  const c = await byId(tx, id);
  if (!c) return undefined;
  const [member] = c.memberId
    ? await tx<NonNullable<z.infer<typeof ClientDetail>['member']>[]>`
        select id, card_number as "cardNumber", first_name as "firstName", last_name as "lastName", status
        from public.members where id = ${c.memberId}`
    : [];
  const bookings = await tx<Booking[]>`${bookingSelect(tx)} where b.client_id = ${id}
    order by b.day desc, b.time desc nulls last, b.created_at desc`;
  const invoices = await tx<Invoice[]>`${invoiceSelect(tx)} where i.client_id = ${id}
    order by i.year desc, i.number desc`;
  return { ...c, member: member ?? null, bookings, invoices };
}

export const insert = async (tx: Tx, input: object) =>
  (
    await tx<{ id: string }[]>`insert into public.clients ${tx(toRow(input, COLS))} returning id`
  )[0]!.id;

export const update = (tx: Tx, id: string, input: object) =>
  tx`update public.clients set ${tx(toRow(input, COLS))}, updated_at = now() where id = ${id} returning id`;

/** Invoice issue saves what the operator typed on the client too. */
export const saveFiscal = (tx: Tx, id: string, taxCode: string | null, address: string | null) =>
  tx`update public.clients set tax_code = coalesce(${taxCode}, tax_code),
       address = coalesce(${address}, address), updated_at = now() where id = ${id}`;

/** Links a client to a member only if it has none (else the caller reports a conflict). */
export const linkMember = (tx: Tx, id: string, memberId: string) =>
  tx`update public.clients set member_id = ${memberId}, updated_at = now()
     where id = ${id} and member_id is null returning id`;

export const exists = async (tx: Tx, id: string) =>
  (await tx`select 1 from public.clients where id = ${id}`).length > 0;
