import type { z } from '@hono/zod-openapi';
import type { Tx } from '../../lib/db.js';
import { containsPattern, offsetOf } from '../../lib/pagination.js';
import { toRow } from '../../lib/sql.js';
import { bookingSelect } from '../bookings/bookings.repo.js';
import type { Booking } from '../bookings/bookings.schemas.js';
import { invoiceSelect } from '../invoices/invoices.repo.js';
import type { Invoice } from '../invoices/invoices.schemas.js';
import { select as transportSelect } from '../transports/transports.repo.js';
import type { Transport } from '../transports/transports.schemas.js';
import type { Fee, Member, MemberKpis, MembersQuery } from './members.schemas.js';

const year = (tx: Tx) => tx`extract(year from now() at time zone 'Europe/Rome')`;

export const COLS = {
  firstName: 'first_name',
  lastName: 'last_name',
  taxCode: 'tax_code',
  birthDate: 'birth_date',
  birthPlace: 'birth_place',
  address: 'address',
  postalCode: 'postal_code',
  city: 'city',
  phone: 'phone',
  email: 'email',
  memberType: 'member_type',
  joinedOn: 'joined_on',
  privacySignedOn: 'privacy_signed_on',
  notes: 'notes',
};

const select = (tx: Tx) => tx`
  select m.id, m.card_number as "cardNumber", m.first_name as "firstName", m.last_name as "lastName",
    m.tax_code as "taxCode", m.birth_date::text as "birthDate", m.birth_place as "birthPlace", m.address,
    m.postal_code as "postalCode", m.city, m.phone, m.email, m.member_type as "memberType",
    m.joined_on::text as "joinedOn", m.status, m.ended_on::text as "endedOn", m.end_reason as "endReason",
    m.privacy_signed_on::text as "privacySignedOn", m.notes,
    exists (select 1 from public.membership_fees f
            where f.member_id = m.id and f.year = ${year(tx)}) as "feePaidCurrentYear"
  from public.members m`;

const filterOf = (tx: Tx, f: MembersQuery['filter']) => {
  switch (f) {
    case 'attivi':
      return tx`m.status = 'attivo'`;
    case 'cessati':
      return tx`m.status = 'cessato'`;
    case 'da_rinnovare':
      return tx`m.status = 'attivo' and not exists (select 1 from public.membership_fees f
        where f.member_id = m.id and f.year = ${year(tx)})`;
    default:
      return tx`true`;
  }
};

export async function list(tx: Tx, q: MembersQuery) {
  const p = q.q ? containsPattern(q.q) : null;
  const where = tx`where ${filterOf(tx, q.filter)}
    ${
      p
        ? tx`and (m.first_name || ' ' || m.last_name ilike ${p} or m.last_name || ' ' || m.first_name ilike ${p}
                  or m.card_number::text = ${q.q!} or m.tax_code ilike ${p} or m.phone ilike ${p})`
        : tx``
    }`;
  const items = await tx<Member[]>`${select(tx)} ${where} order by m.card_number
    limit ${q.pageSize} offset ${offsetOf(q)}`;
  const [t] = await tx<
    { total: number }[]
  >`select count(*)::int as total from public.members m ${where}`;
  return { items, total: t!.total };
}

export const kpis = async (tx: Tx) =>
  (
    await tx<z.infer<typeof MemberKpis>[]>`
      select
        count(*) filter (where status = 'attivo')::int as active,
        count(*) filter (where status = 'attivo' and paid)::int as "paidCurrentYear",
        count(*) filter (where status = 'attivo' and not paid)::int as "unpaidCurrentYear",
        count(*) filter (where extract(year from joined_on) = ${year(tx)})::int as "joinedCurrentYear"
      from (select m.status, m.joined_on,
              exists (select 1 from public.membership_fees f
                      where f.member_id = m.id and f.year = ${year(tx)}) as paid
            from public.members m) x`
  )[0]!;

const fees = (tx: Tx, memberId: string) => tx<Fee[]>`
  select id, member_id as "memberId", year, amount_cents as "amountCents", paid_on::text as "paidOn", method
  from public.membership_fees where member_id = ${memberId} order by year desc`;

export const byId = async (tx: Tx, id: string) =>
  (await tx<Member[]>`${select(tx)} where m.id = ${id}`)[0];

export async function detail(tx: Tx, id: string) {
  const m = await byId(tx, id);
  if (!m) return undefined;
  // History is unbounded for now (shortcut: add paging if a member exceeds a few hundred rows).
  const [f, bookings, transports, invoices] = await Promise.all([
    fees(tx, id),
    tx<
      Booking[]
    >`${bookingSelect(tx)} where b.member_id = ${id} order by b.day desc, b.created_at desc`,
    tx<
      Transport[]
    >`${transportSelect(tx)} where t.member_id = ${id} order by t.travel_date desc, t.created_at desc`,
    tx<
      Invoice[]
    >`${invoiceSelect(tx)} where i.member_id = ${id} order by i.year desc, i.number desc`,
  ]);
  return { ...m, fees: f, bookings, transports, invoices };
}

export const register = async (tx: Tx, p: Record<string, unknown>, feeMethod: string | null) =>
  (
    await tx<{ id: string }[]>`
      select id from public.register_member(${tx.json(p as never)}::jsonb, ${feeMethod}::public.payment_method)`
  )[0]!.id;

export const update = (tx: Tx, id: string, input: object) =>
  tx`update public.members set ${tx(toRow(input, COLS))}, updated_at = now() where id = ${id} returning id`;

export const end = (tx: Tx, id: string, endedOn: string | null, reason: string) =>
  tx`update public.members set status = 'cessato', ended_on = coalesce(${endedOn}::date, (now() at time zone 'Europe/Rome')::date),
       end_reason = ${reason}::public.member_end_reason, updated_at = now()
     where id = ${id} and status = 'attivo' returning id`;

export const reactivate = (tx: Tx, id: string) =>
  tx`update public.members set status = 'attivo', ended_on = null, end_reason = null, updated_at = now()
     where id = ${id} and status = 'cessato' returning id`;

export const exists = async (tx: Tx, id: string) =>
  (await tx`select 1 from public.members where id = ${id}`).length > 0;

export const addFee = async (
  tx: Tx,
  f: {
    memberId: string;
    year: number | null;
    amountCents: number | null;
    paidOn: string | null;
    method: string;
    by: string;
  },
) =>
  (
    await tx<Fee[]>`
      insert into public.membership_fees (member_id, year, amount_cents, paid_on, method, recorded_by)
      select ${f.memberId}, coalesce(${f.year}::int, ${year(tx)}::int),
             coalesce(${f.amountCents}::int, o.membership_fee_cents),
             coalesce(${f.paidOn}::date, (now() at time zone 'Europe/Rome')::date),
             ${f.method}::public.payment_method, ${f.by}
      from public.staff_org_info() o
      returning id, member_id as "memberId", year, amount_cents as "amountCents", paid_on::text as "paidOn", method`
  )[0]!;

export const receiptData = async (tx: Tx, memberId: string, feeId: string) =>
  (
    await tx<
      {
        firstName: string;
        lastName: string;
        taxCode: string | null;
        cardNumber: number;
        year: number;
        amountCents: number;
        paidOn: string;
        method: 'contanti' | 'pos' | 'bonifico';
      }[]
    >`
      select m.first_name as "firstName", m.last_name as "lastName", m.tax_code as "taxCode",
             m.card_number as "cardNumber", f.year, f.amount_cents as "amountCents",
             f.paid_on::text as "paidOn", f.method
      from public.membership_fees f join public.members m on m.id = f.member_id
      where f.id = ${feeId} and f.member_id = ${memberId}`
  )[0];

/** Book export: members by card with the current year's fee amount (null = unpaid). */
export const exportRows = (tx: Tx) =>
  tx<(Member & { currentFeeCents: number | null })[]>`
    select x.*, (select f.amount_cents from public.membership_fees f
                 where f.member_id = x.id and f.year = ${year(tx)}) as "currentFeeCents"
    from (${select(tx)}) x order by x."cardNumber"`;
