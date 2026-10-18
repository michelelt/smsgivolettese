import type { Tx } from '../../lib/db.js';
import { containsPattern, offsetOf } from '../../lib/pagination.js';
import { toRow } from '../../lib/sql.js';
import type {
  Absence,
  AvailabilityRule,
  Volunteer,
  VolunteersQuery,
} from './volunteers.schemas.js';

const COLS = {
  canDrive: 'can_drive',
  licenseNumber: 'license_number',
  licenseExpiresOn: 'license_expires_on',
  notes: 'notes',
  active: 'active',
};

const select = (tx: Tx) => tx`
  select v.id, p.first_name as "firstName", p.last_name as "lastName", p.email, p.phone,
         v.can_drive as "canDrive", v.license_number as "licenseNumber",
         v.license_expires_on::text as "licenseExpiresOn", v.notes, v.active
  from public.volunteers v join public.profiles p on p.id = v.id`;

export async function list(tx: Tx, q: VolunteersQuery) {
  const where = tx`where true
    ${q.active === undefined ? tx`` : tx`and v.active = ${q.active}`}
    ${
      q.q
        ? tx`and (p.first_name || ' ' || p.last_name ilike ${containsPattern(q.q)}
                  or p.last_name || ' ' || p.first_name ilike ${containsPattern(q.q)}
                  or p.email ilike ${containsPattern(q.q)})`
        : tx``
    }`;
  const items = await tx<Volunteer[]>`${select(tx)} ${where}
    order by p.last_name, p.first_name, v.id limit ${q.pageSize} offset ${offsetOf(q)}`;
  const [t] = await tx<{ total: number }[]>`
    select count(*)::int as total from public.volunteers v join public.profiles p on p.id = v.id ${where}`;
  return { items, total: t!.total };
}

export const byId = async (tx: Tx, id: string) =>
  (await tx<Volunteer[]>`${select(tx)} where v.id = ${id}`)[0];

export async function update(tx: Tx, id: string, input: Record<string, unknown>) {
  if (input.phone !== undefined)
    await tx`update public.profiles set phone = ${input.phone as string | null} where id = ${id}`;
  const row = toRow(input, COLS);
  if (Object.keys(row).length)
    await tx`update public.volunteers set ${tx(row)}, updated_at = now() where id = ${id}`;
}

type Keyed<T> = T & { volunteerId: string };
export const rulesFor = (tx: Tx, ids: string[]) =>
  ids.length === 0
    ? Promise.resolve([] as Keyed<AvailabilityRule>[])
    : tx<Keyed<AvailabilityRule>[]>`
    select volunteer_id as "volunteerId", weekday::int as weekday,
           to_char(start_time, 'HH24:MI') as "startTime", to_char(end_time, 'HH24:MI') as "endTime"
    from public.availability_rules where volunteer_id in ${tx(ids)}
    order by weekday, start_time`;

/** Whole-day absences ending today or later (Europe/Rome). */
export const absencesFor = (tx: Tx, ids: string[]) =>
  ids.length === 0
    ? Promise.resolve([] as Keyed<Absence>[])
    : tx<Keyed<Absence>[]>`
    select volunteer_id as "volunteerId", id, starts_on::text as "startsOn", ends_on::text as "endsOn", note
    from public.availability_exceptions
    where volunteer_id in ${tx(ids)} and kind = 'assente' and start_time is null
      and ends_on >= (now() at time zone 'Europe/Rome')::date
    order by starts_on, id`;
