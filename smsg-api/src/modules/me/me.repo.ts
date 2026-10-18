import type { Tx } from '../../lib/db.js';
import type { Item } from '../notifications/templates.js';
import type { AvailabilityRule } from '../volunteers/volunteers.schemas.js';
import type { MyShift, MyTransport } from './me.schemas.js';

const R = 'Europe/Rome';

export const name = async (tx: Tx, uid: string) =>
  (
    await tx<{ firstName: string; lastName: string }[]>`
      select first_name as "firstName", last_name as "lastName"
      from public.profiles where id = ${uid}`
  )[0];

export const rules = (tx: Tx, uid: string) => tx<AvailabilityRule[]>`
  select weekday::int as weekday, to_char(start_time, 'HH24:MI') as "startTime",
         to_char(end_time, 'HH24:MI') as "endTime"
  from public.availability_rules where volunteer_id = ${uid} order by weekday, start_time`;

export const replaceRules = async (tx: Tx, uid: string, rows: AvailabilityRule[]) => {
  await tx`delete from public.availability_rules where volunteer_id = ${uid}`;
  if (rows.length)
    await tx`insert into public.availability_rules ${tx(
      rows.map((r) => ({
        volunteer_id: uid,
        weekday: r.weekday,
        start_time: r.startTime,
        end_time: r.endTime,
      })),
    )}`;
};

export const addAbsence = async (
  tx: Tx,
  uid: string,
  a: { startsOn: string; endsOn: string; note: string | null },
) =>
  (
    await tx<{ id: string }[]>`
      insert into public.availability_exceptions (volunteer_id, starts_on, ends_on, kind, note)
      values (${uid}, ${a.startsOn}, ${a.endsOn}, 'assente', ${a.note}) returning id`
  )[0]!.id;

export const deleteAbsence = (tx: Tx, uid: string, id: string) =>
  tx`delete from public.availability_exceptions where id = ${id} and volunteer_id = ${uid} returning id`;

/** Own live commitments inside [from, to] (Rome days); the volunteer cannot read volunteer_commitments. */
export const countCommitments = async (tx: Tx, uid: string, from: string, to: string) =>
  (
    await tx<{ n: number }[]>`
      select (
        (select count(*) from public.shift_assignments a join public.shifts s on s.id = a.shift_id
          where a.volunteer_id = ${uid} and a.status in ('proposto', 'confermato') and s.ends_at > now()
            and (s.starts_at at time zone ${R})::date between ${from}::date and ${to}::date)
        + (select count(*) from public.volunteer_transports_v t
            where t.status in ('assegnato', 'confermato') and t.travel_date between ${from}::date and ${to}::date)
      )::int as n`
  )[0]!.n;

export const shifts = (tx: Tx, uid: string) => tx<MyShift[]>`
  select a.id as "assignmentId", st.name as "shiftType",
         (s.starts_at at time zone ${R})::date::text as day,
         to_char(s.starts_at at time zone ${R}, 'HH24:MI') as "startTime",
         to_char(s.ends_at at time zone ${R}, 'HH24:MI') as "endTime", a.status, s.notes
  from public.shift_assignments a
  join public.shifts s on s.id = a.shift_id
  join public.shift_types st on st.id = s.shift_type_id
  where a.volunteer_id = ${uid} and s.starts_at > now()
  order by s.starts_at, a.id`;

const T = (tx: Tx) => tx`
  select id, travel_date::text as "travelDate",
    to_char(departure_at at time zone ${R}, 'HH24:MI') as "departureTime",
    to_char(appointment_at at time zone ${R}, 'HH24:MI') as "appointmentTime",
    to_char(return_at at time zone ${R}, 'HH24:MI') as "returnTime",
    from_address as "fromAddress", to_address as "toAddress", wheelchair, mobility_aids as "mobilityAids", companions, status,
    odometer_start as "odometerStart", odometer_end as "odometerEnd", km, driver_notes as "driverNotes", member_first_name as "memberFirstName",
    member_last_name as "memberLastName", contact_phone as "contactPhone",
    vehicle_plate as "vehiclePlate", vehicle_model as "vehicleModel"
  from public.volunteer_transports_v`;

/** Future ones plus those still open (assegnato|confermato) so past trips can be closed. */
export const transports = (tx: Tx) => tx<MyTransport[]>`
  ${T(tx)}
  where travel_date >= (now() at time zone ${R})::date or status in ('assegnato', 'confermato')
  order by travel_date, departure_at nulls last, id`;

export const myShiftId = async (tx: Tx, uid: string, assignmentId: string) =>
  (
    await tx<{ shiftId: string }[]>`
      select shift_id as "shiftId" from public.shift_assignments
      where id = ${assignmentId} and volunteer_id = ${uid}`
  )[0]?.shiftId;

export const myTransportItem = async (tx: Tx, id: string) =>
  (
    await tx<Item[]>`
      select 'Trasporto' as label, travel_date::text as day,
             to_char(departure_at at time zone ${R}, 'HH24:MI') as time
      from public.volunteer_transports_v where id = ${id}`
  )[0];

export const respondShift = (tx: Tx, id: string, accept: boolean) =>
  tx`select public.respond_shift_assignment(${id}::uuid, ${accept}::boolean)`;
export const respondTransport = (tx: Tx, id: string, accept: boolean) =>
  tx`select public.respond_transport(${id}::uuid, ${accept}::boolean)`;
export const completeTransport = (
  tx: Tx,
  id: string,
  start: number,
  end: number,
  notes: string | null,
) => tx`select public.complete_transport(${id}::uuid, ${start}::int, ${end}::int, ${notes}::text)`;
