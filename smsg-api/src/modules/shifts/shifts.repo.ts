import type { Tx } from '../../lib/db.js';
import { toRow } from '../../lib/sql.js';
import type { Shift, ShiftAssignment, ShiftType } from './shifts.schemas.js';

const R = 'Europe/Rome';

// ---- shift types
const TYPE_COLS = { name: 'name', active: 'active', sortOrder: 'sort_order' };
const typeOut = (tx: Tx) => tx`id, name, active, sort_order as "sortOrder"`;
export const types = (tx: Tx) =>
  tx<ShiftType[]>`select ${typeOut(tx)} from public.shift_types order by sort_order, name`;
export const createType = async (tx: Tx, input: object) =>
  (
    await tx<
      ShiftType[]
    >`insert into public.shift_types ${tx(toRow(input, TYPE_COLS))} returning ${typeOut(tx)}`
  )[0]!;
export const updateType = async (tx: Tx, id: string, input: object) =>
  (
    await tx<ShiftType[]>`update public.shift_types set ${tx(toRow(input, TYPE_COLS))}
      where id = ${id} returning ${typeOut(tx)}`
  )[0];

// ---- shifts
const shiftSelect = (tx: Tx) => tx`
  select s.id, s.shift_type_id as "shiftTypeId", st.name as "shiftType",
    (s.starts_at at time zone ${R})::date::text as day,
    to_char(s.starts_at at time zone ${R}, 'HH24:MI') as "startTime",
    to_char(s.ends_at at time zone ${R}, 'HH24:MI') as "endTime",
    s.required_slots::int as "requiredSlots", s.notes, c.filled::int as filled, c.coverage,
    coalesce((select json_agg(json_build_object('id', a.id, 'volunteerId', a.volunteer_id,
        'firstName', p.first_name, 'lastName', p.last_name, 'status', a.status)
        order by p.last_name, p.first_name, a.id)
      from public.shift_assignments a join public.profiles p on p.id = a.volunteer_id
      where a.shift_id = s.id), '[]'::json) as assignments
  from public.shifts s
  join public.shift_types st on st.id = s.shift_type_id
  join public.shift_coverage c on c.shift_id = s.id`;

export const range = (tx: Tx, from: string, to: string) => tx<Shift[]>`
  ${shiftSelect(tx)}
  where s.starts_at >= (${from}::date)::timestamp at time zone ${R}
    and s.starts_at < (${to}::date + 1)::timestamp at time zone ${R}
  order by s.starts_at, s.ends_at, s.id`;

export const byId = async (tx: Tx, id: string) =>
  (await tx<Shift[]>`${shiftSelect(tx)} where s.id = ${id}`)[0];

export const insert = async (
  tx: Tx,
  b: {
    shiftTypeId: string;
    day: string;
    startTime: string;
    endTime: string;
    requiredSlots: number;
    notes: string | null;
    createdBy: string;
  },
) =>
  (
    await tx<{ id: string }[]>`
      insert into public.shifts (shift_type_id, starts_at, ends_at, required_slots, notes, created_by)
      values (${b.shiftTypeId}, (${b.day}::date + ${b.startTime}::time) at time zone ${R},
              (${b.day}::date + ${b.endTime}::time) at time zone ${R}, ${b.requiredSlots}, ${b.notes}, ${b.createdBy})
      returning id`
  )[0]!.id;

/** Partial update of local day/times; `notes` only when the key is present (null clears it). */
export const patch = async (
  tx: Tx,
  id: string,
  p: {
    shiftTypeId?: string;
    day?: string;
    startTime?: string;
    endTime?: string;
    requiredSlots?: number;
    notes?: string | null;
  },
) =>
  (
    await tx`
      update public.shifts set
        shift_type_id = coalesce(${p.shiftTypeId ?? null}::uuid, shift_type_id),
        starts_at = (coalesce(${p.day ?? null}::date, (starts_at at time zone ${R})::date)
                     + coalesce(${p.startTime ?? null}::time, (starts_at at time zone ${R})::time)) at time zone ${R},
        ends_at = (coalesce(${p.day ?? null}::date, (ends_at at time zone ${R})::date)
                   + coalesce(${p.endTime ?? null}::time, (ends_at at time zone ${R})::time)) at time zone ${R},
        required_slots = coalesce(${p.requiredSlots ?? null}::smallint, required_slots),
        notes = case when ${p.notes !== undefined} then ${p.notes ?? null}::text else notes end,
        updated_at = now()
      where id = ${id} returning id`
  ).length > 0;

/** Volunteers with a live (proposto|confermato) assignment to a future shift. */
export const liveVolunteers = async (tx: Tx, shiftId: string) =>
  (
    await tx<{ id: string }[]>`
      select a.volunteer_id as id from public.shift_assignments a join public.shifts s on s.id = a.shift_id
      where a.shift_id = ${shiftId} and a.status in ('proposto', 'confermato') and s.starts_at > now()`
  ).map((r) => r.id);

export const remove = async (tx: Tx, id: string) =>
  (await tx`delete from public.shifts where id = ${id} returning id`).length > 0;

export const copyWeek = async (tx: Tx, from: string, to: string, days: number, by: string) =>
  (
    await tx<{ total: number; created: number }[]>`
      with src as (
        select s.shift_type_id, s.required_slots, s.notes,
               ((s.starts_at at time zone ${R}) + make_interval(days => ${days})) at time zone ${R} as ns,
               ((s.ends_at at time zone ${R}) + make_interval(days => ${days})) at time zone ${R} as ne
        from public.shifts s
        where s.starts_at >= (${from}::date)::timestamp at time zone ${R}
          and s.starts_at < (${from}::date + 7)::timestamp at time zone ${R}
      ), ins as (
        insert into public.shifts (shift_type_id, starts_at, ends_at, required_slots, notes, created_by)
        select shift_type_id, ns, ne, required_slots, notes, ${by} from src
        where not exists (select 1 from public.shifts t
                          where t.shift_type_id = src.shift_type_id and t.starts_at = src.ns and t.ends_at = src.ne)
        returning 1
      )
      select (select count(*) from src)::int as total, (select count(*) from ins)::int as created`
  )[0]!;

// ---- assignments
export const volunteerState = async (tx: Tx, id: string) =>
  (await tx<{ active: boolean }[]>`select active from public.volunteers where id = ${id}`)[0];

export const isAbsent = async (tx: Tx, volunteerId: string, shiftId: string) =>
  (
    await tx`
      select 1 from public.shifts s, public.availability_exceptions x
      where s.id = ${shiftId} and x.volunteer_id = ${volunteerId} and x.kind = 'assente'
        and (s.starts_at at time zone ${R})::date between x.starts_on and x.ends_on
        and (x.start_time is null or (x.start_time < (s.ends_at at time zone ${R})::time
                                      and x.end_time > (s.starts_at at time zone ${R})::time))`
  ).length > 0;

/** New row, or a `rifiutato` one reset to `proposto`; undefined when a live row exists. */
export const assign = async (tx: Tx, shiftId: string, volunteerId: string, by: string) =>
  (
    await tx<{ id: string }[]>`
      insert into public.shift_assignments (shift_id, volunteer_id, assigned_by)
      values (${shiftId}, ${volunteerId}, ${by})
      on conflict (shift_id, volunteer_id) do update
        set status = 'proposto', responded_at = null, reminder_sent_at = null, assigned_by = ${by}
        where public.shift_assignments.status = 'rifiutato'
      returning id`
  )[0]?.id;

export const assignmentById = async (tx: Tx, id: string) =>
  (
    await tx<ShiftAssignment[]>`
      select a.id, a.volunteer_id as "volunteerId", p.first_name as "firstName",
             p.last_name as "lastName", a.status
      from public.shift_assignments a join public.profiles p on p.id = a.volunteer_id where a.id = ${id}`
  )[0];

export const unassign = async (tx: Tx, shiftId: string, id: string) =>
  (
    await tx<{ volunteerId: string; live: boolean }[]>`
      delete from public.shift_assignments a using public.shifts s
      where a.id = ${id} and a.shift_id = ${shiftId} and s.id = a.shift_id
      returning a.volunteer_id as "volunteerId",
                (a.status in ('proposto', 'confermato') and s.starts_at > now()) as live`
  )[0];

export const times = async (tx: Tx, shiftId: string) =>
  (
    await tx<{ start: string; end: string }[]>`
      select starts_at::text as start, ends_at::text as "end" from public.shifts where id = ${shiftId}`
  )[0];
