import type { Tx } from '../../lib/db.js';
import { containsPattern, offsetOf } from '../../lib/pagination.js';
import type { z } from '@hono/zod-openapi';
import type { Booking, BookingKpis, BookingsQuery } from './bookings.schemas.js';

/** Row shape shared with the client detail view. */
export const bookingSelect = (tx: Tx) => tx`
  select b.id, b.client_id as "clientId", c.first_name || ' ' || c.last_name as "clientName",
         c.phone as "clientPhone", b.service_id as "serviceId", s.name as "serviceName",
         b.day::text as day, b.slot, to_char(b.time, 'HH24:MI') as time, b.status,
         b.declared_member as "isMember", b.price_applied_cents as "priceAppliedCents",
         b.origin, b.notes, b.cancelled_by as "cancelledBy", b.invoice_id as "invoiceId",
         case when i.id is not null then i.number || '/' || i.year end as "invoiceNumber"
  from public.bookings b
  join public.clients c on c.id = b.client_id
  join public.services s on s.id = b.service_id
  left join public.invoices i on i.id = b.invoice_id`;

const statusFilter = (tx: Tx, s: BookingsQuery['status']) => {
  switch (s) {
    case 'aperte':
      return tx`b.status in ('attesa', 'confermata')`;
    case 'da_fatturare':
      return tx`b.status = 'eseguita' and b.invoice_id is null`;
    case 'tutte':
      return tx`true`;
    default:
      return tx`b.status = ${s}`;
  }
};

export async function list(tx: Tx, q: BookingsQuery) {
  const where = tx`where ${statusFilter(tx, q.status)}
    ${q.from ? tx`and b.day >= ${q.from}` : tx``}
    ${q.to ? tx`and b.day <= ${q.to}` : tx``}
    ${q.clientId ? tx`and b.client_id = ${q.clientId}` : tx``}
    ${
      q.q
        ? tx`and (c.first_name || ' ' || c.last_name ilike ${containsPattern(q.q)}
                  or c.last_name || ' ' || c.first_name ilike ${containsPattern(q.q)}
                  or c.phone ilike ${containsPattern(q.q)} or s.name ilike ${containsPattern(q.q)})`
        : tx``
    }`;
  const items = await tx<Booking[]>`
    ${bookingSelect(tx)} ${where}
    order by b.day, b.time nulls last, b.created_at, b.id
    limit ${q.pageSize} offset ${offsetOf(q)}`;
  const [t] = await tx<{ total: number }[]>`
    select count(*)::int as total from public.bookings b
    join public.clients c on c.id = b.client_id join public.services s on s.id = b.service_id ${where}`;
  return { items, total: t!.total };
}

export const byId = async (tx: Tx, id: string) =>
  (await tx<Booking[]>`${bookingSelect(tx)} where b.id = ${id}`)[0];

export const exists = async (tx: Tx, id: string) =>
  (await tx`select 1 from public.bookings where id = ${id}`).length > 0;

type Kpis = z.infer<typeof BookingKpis>;
export const kpis = async (tx: Tx) =>
  (
    await tx<Kpis[]>`
    select
      (select count(*) from public.bookings where status = 'attesa')::int as "toConfirm",
      (select count(*) from public.bookings
        where day = (now() at time zone 'Europe/Rome')::date and status <> 'annullata')::int as today,
      (select count(*) from public.bookings where status = 'eseguita' and invoice_id is null)::int as "toInvoice",
      (select coalesce(sum(total_cents), 0) from public.invoices
        where status <> 'annullata'
          and date_trunc('month', issued_on) = date_trunc('month', (now() at time zone 'Europe/Rome')::date)
      )::int as "invoicedMonthCents",
      (select coalesce(sum(total_cents), 0) from public.invoices where status = 'emessa')::int as "toCollectCents"`
  )[0]!;

export const serviceById = async (tx: Tx, id: string) =>
  (
    await tx<{ active: boolean; memberPriceCents: number; nonMemberPriceCents: number }[]>`
      select active, member_price_cents as "memberPriceCents", non_member_price_cents as "nonMemberPriceCents"
      from public.services where id = ${id}`
  )[0];

/** undefined = no such client; else whether it is linked to an active member. */
export const clientMembership = async (tx: Tx, id: string) =>
  (
    await tx<{ isActiveMember: boolean }[]>`
      select coalesce(m.status = 'attivo', false) as "isActiveMember"
      from public.clients c left join public.members m on m.id = c.member_id where c.id = ${id}`
  )[0];

export const insert = async (
  tx: Tx,
  b: {
    clientId: string;
    serviceId: string;
    day: string;
    slot: string;
    time: string | null;
    declaredMember: boolean;
    priceCents: number;
    notes: string | null;
    createdBy: string;
  },
) =>
  (
    await tx<{ id: string }[]>`
      insert into public.bookings (client_id, service_id, day, slot, time, declared_member,
        price_applied_cents, origin, status, notes, created_by)
      values (${b.clientId}, ${b.serviceId}, ${b.day}, ${b.slot}::public.booking_slot, ${b.time}::time,
        ${b.declaredMember}, ${b.priceCents}, 'telefono',
        ${b.time ? 'confermata' : 'attesa'}::public.booking_status, ${b.notes}, ${b.createdBy})
      returning id`
  )[0]!.id;

// Conditional UPDATEs (ADR-045): zero rows = missing or wrong state.
export const confirm = (tx: Tx, id: string, time: string | null) =>
  tx`update public.bookings set status = 'confermata', time = coalesce(${time}::time, time), updated_at = now()
     where id = ${id} and status = 'attesa' returning id`;
export const execute = (tx: Tx, id: string) =>
  tx`update public.bookings set status = 'eseguita', executed_at = now(), updated_at = now()
     where id = ${id} and status in ('attesa', 'confermata') returning id`;
export const cancel = (tx: Tx, id: string, by: string) =>
  tx`update public.bookings set status = 'annullata', cancelled_by = ${by}, updated_at = now()
     where id = ${id} and status in ('attesa', 'confermata') returning id`;
export const restore = (tx: Tx, id: string) =>
  tx`update public.bookings set status = 'attesa', cancelled_by = null, updated_at = now()
     where id = ${id} and status = 'annullata' returning id`;
