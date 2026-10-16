import type { Tx } from '../../lib/db.js';
import { toRow } from '../../lib/sql.js';
import type { StaffService } from './services.schemas.js';

const COLS = {
  name: 'name',
  description: 'description',
  scheduleNote: 'schedule_note',
  memberPriceCents: 'member_price_cents',
  nonMemberPriceCents: 'non_member_price_cents',
  active: 'active',
  requiresTransport: 'requires_transport',
  sortOrder: 'sort_order',
};

const out = (tx: Tx) => tx`id, name, description, schedule_note as "scheduleNote",
  member_price_cents as "memberPriceCents", non_member_price_cents as "nonMemberPriceCents",
  active, requires_transport as "requiresTransport", sort_order as "sortOrder"`;

export const list = (tx: Tx) =>
  tx<StaffService[]>`select ${out(tx)} from public.services order by sort_order, name`;

export const create = async (tx: Tx, input: object) =>
  (
    await tx<
      StaffService[]
    >`insert into public.services ${tx(toRow(input, COLS))} returning ${out(tx)}`
  )[0]!;

export const update = async (tx: Tx, id: string, input: object) =>
  (
    await tx<StaffService[]>`
      update public.services set ${tx(toRow(input, COLS))}, updated_at = now()
      where id = ${id} returning ${out(tx)}`
  )[0];
