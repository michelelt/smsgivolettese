import type { Tx } from '../../lib/db.js';
import type { Transport, TransportsQuery } from './transports.schemas.js';

const R = 'Europe/Rome';

export const select = (tx: Tx) => tx`
  select t.id, t.member_id as "memberId", c.first_name || ' ' || c.last_name as "memberName",
    coalesce(t.contact_phone, c.phone) as "contactPhone", t.travel_date::text as "travelDate",
    to_char(t.departure_at at time zone ${R}, 'HH24:MI') as "departureTime",
    to_char(t.appointment_at at time zone ${R}, 'HH24:MI') as "appointmentTime",
    to_char(t.return_at at time zone ${R}, 'HH24:MI') as "returnTime",
    t.from_address as "fromAddress", t.to_address as "toAddress",
    t.wheelchair, t.mobility_aids as "mobilityAids", t.companions, t.notes, t.status,
    t.driver_volunteer_id as "driverId", dp.first_name || ' ' || dp.last_name as "driverName",
    t.vehicle_id as "vehicleId", v.plate as "vehiclePlate",
    t.odometer_start as "odometerStart", t.odometer_end as "odometerEnd", t.km,
    t.driver_notes as "driverNotes", t.invoice_id as "invoiceId"
  from public.transports t
  join public.members c on c.id = t.member_id
  left join public.profiles dp on dp.id = t.driver_volunteer_id
  left join public.vehicles v on v.id = t.vehicle_id`;

export const list = (tx: Tx, q: TransportsQuery) => tx<Transport[]>`
  ${select(tx)}
  where t.travel_date between ${q.from}::date and ${q.to}::date
    ${q.status ? tx`and t.status = ${q.status}` : tx``}
  order by t.travel_date, t.departure_at nulls last, t.created_at, t.id`;

export const byId = async (tx: Tx, id: string) =>
  (await tx<Transport[]>`${select(tx)} where t.id = ${id}`)[0];

export const memberExists = async (tx: Tx, id: string) =>
  (await tx`select 1 from public.members where id = ${id}`).length > 0;

/** `date + time` in Rome as timestamptz; null time -> null. */
const at = (tx: Tx, date: string, time: string | null | undefined) =>
  tx`((${date}::date + ${time ?? null}::time) at time zone ${R})`;

type Fields = {
  travelDate: string;
  departureTime?: string | null;
  appointmentTime?: string | null;
  returnTime?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  contactPhone?: string | null;
  wheelchair?: boolean;
  mobilityAids?: boolean;
  companions?: number;
  notes?: string | null;
};

export const insert = async (tx: Tx, memberId: string, f: Fields, by: string) =>
  (
    await tx<{ id: string }[]>`
      insert into public.transports (member_id, travel_date, departure_at, appointment_at, return_at,
        from_address, to_address, contact_phone, wheelchair, mobility_aids, companions, notes, created_by)
      values (${memberId}, ${f.travelDate}, ${at(tx, f.travelDate, f.departureTime)},
        ${at(tx, f.travelDate, f.appointmentTime)}, ${at(tx, f.travelDate, f.returnTime)},
        ${f.fromAddress ?? null}, ${f.toAddress ?? null}, ${f.contactPhone ?? null},
        ${f.wheelchair ?? false}, ${f.mobilityAids ?? false}, ${f.companions ?? 0}, ${f.notes ?? null}, ${by})
      returning id`
  )[0]!.id;

/** Partial update (key present = set, null clears). A new date moves the unchanged times to that date. */
export const patch = async (tx: Tx, id: string, p: Partial<Fields>) => {
  const nd = tx`coalesce(${p.travelDate ?? null}::date, travel_date)`;
  const time = (col: string, v: string | null | undefined) =>
    v === undefined
      ? tx`((${nd} + (${tx.unsafe(col)} at time zone ${R})::time) at time zone ${R})`
      : tx`((${nd} + ${v}::time) at time zone ${R})`;
  const txt = (col: string, v: string | null | undefined) =>
    v === undefined ? tx`${tx.unsafe(col)}` : tx`${v}::text`;
  return (
    await tx`
      update public.transports set
        travel_date = ${nd},
        departure_at = ${time('departure_at', p.departureTime)},
        appointment_at = ${time('appointment_at', p.appointmentTime)},
        return_at = ${time('return_at', p.returnTime)},
        from_address = ${txt('from_address', p.fromAddress)},
        to_address = ${txt('to_address', p.toAddress)},
        contact_phone = ${txt('contact_phone', p.contactPhone)},
        notes = ${txt('notes', p.notes)},
        wheelchair = coalesce(${p.wheelchair ?? null}::boolean, wheelchair),
        mobility_aids = coalesce(${p.mobilityAids ?? null}::boolean, mobility_aids),
        companions = coalesce(${p.companions ?? null}::smallint, companions),
        updated_at = now()
      where id = ${id} and status in ('richiesto', 'assegnato', 'confermato') returning id`
  ).length;
};

/** Date/time/address change on an assigned transport: back to `assegnato`, reminder re-armed. */
export const rearm = (tx: Tx, id: string) =>
  tx`update public.transports set status = 'assegnato', reminder_sent_at = null
     where id = ${id} and status in ('assegnato', 'confermato')`;

// Conditional UPDATEs (ADR-045): zero rows = missing or wrong state.
export const assign = (tx: Tx, id: string, driverId: string, vehicleId: string | null) =>
  tx`update public.transports set
       status = case when driver_volunteer_id is not distinct from ${driverId}::uuid then status else 'assegnato' end,
       reminder_sent_at = case when driver_volunteer_id is not distinct from ${driverId}::uuid then reminder_sent_at else null end,
       driver_volunteer_id = ${driverId}, vehicle_id = ${vehicleId}, updated_at = now()
     where id = ${id} and status in ('richiesto', 'assegnato', 'confermato') returning id`;
export const unassign = (tx: Tx, id: string) =>
  tx`update public.transports set status = 'richiesto', driver_volunteer_id = null, vehicle_id = null,
       reminder_sent_at = null, updated_at = now()
     where id = ${id} and status in ('assegnato', 'confermato') returning id`;
export const cancel = (tx: Tx, id: string) =>
  tx`update public.transports set status = 'annullato', updated_at = now()
     where id = ${id} and status in ('richiesto', 'assegnato', 'confermato') returning id`;
export const complete = (tx: Tx, id: string, start: number, end: number, notes: string | null) =>
  tx`update public.transports set status = 'svolto', odometer_start = ${start}, odometer_end = ${end},
       driver_notes = ${notes}, completed_at = now()
     where id = ${id} and status in ('assegnato', 'confermato')
       and travel_date <= (now() at time zone ${R})::date returning id`;

/** ADR-015 busy period as timestamptz text, null when departure is unknown. */
export const busyPeriod = async (tx: Tx, id: string) =>
  (
    await tx<{ start: string | null; end: string | null; travelDate: string }[]>`
      select departure_at::text as start,
             greatest(coalesce(return_at, appointment_at + interval '1 hour', departure_at + interval '2 hours'),
                      departure_at + interval '15 minutes')::text as "end",
             travel_date::text as "travelDate"
      from public.transports where id = ${id}`
  )[0];

export const csvRows = (tx: Tx, month: string) => tx<
  {
    travelDate: string;
    departureTime: string | null;
    memberName: string;
    fromAddress: string | null;
    toAddress: string | null;
    driverName: string | null;
    vehiclePlate: string | null;
    odometerStart: number | null;
    odometerEnd: number | null;
    km: number | null;
    wheelchair: boolean;
    mobilityAids: boolean;
    companions: number;
    driverNotes: string | null;
  }[]
>`
  select t.travel_date::text as "travelDate",
    to_char(t.departure_at at time zone ${R}, 'HH24:MI') as "departureTime",
    c.first_name || ' ' || c.last_name as "memberName", t.from_address as "fromAddress",
    t.to_address as "toAddress", dp.first_name || ' ' || dp.last_name as "driverName",
    v.plate as "vehiclePlate", t.odometer_start as "odometerStart", t.odometer_end as "odometerEnd",
    t.km, t.wheelchair, t.mobility_aids as "mobilityAids", t.companions, t.driver_notes as "driverNotes"
  from public.transports t
  join public.members c on c.id = t.member_id
  left join public.profiles dp on dp.id = t.driver_volunteer_id
  left join public.vehicles v on v.id = t.vehicle_id
  where t.status = 'svolto'
    and t.travel_date >= (${month} || '-01')::date and t.travel_date < ((${month} || '-01')::date + interval '1 month')
  order by t.travel_date, t.departure_at nulls last, t.id`;
