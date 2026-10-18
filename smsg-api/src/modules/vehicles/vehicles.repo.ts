import type { Tx } from '../../lib/db.js';
import { toRow } from '../../lib/sql.js';
import type { Vehicle } from './vehicles.schemas.js';

const COLS = {
  plate: 'plate',
  model: 'model',
  seats: 'seats',
  wheelchairAccessible: 'wheelchair_accessible',
  active: 'active',
};
const out = (tx: Tx) => tx`id, plate, model, seats::int as seats,
  wheelchair_accessible as "wheelchairAccessible", active`;

export const list = (tx: Tx) =>
  tx<Vehicle[]>`select ${out(tx)} from public.vehicles order by active desc, plate`;

export const create = async (tx: Tx, input: object) =>
  (
    await tx<Vehicle[]>`insert into public.vehicles ${tx(toRow(input, COLS))} returning ${out(tx)}`
  )[0]!;

export const update = async (tx: Tx, id: string, input: object) =>
  (
    await tx<Vehicle[]>`update public.vehicles set ${tx(toRow(input, COLS))}, updated_at = now()
      where id = ${id} returning ${out(tx)}`
  )[0];
