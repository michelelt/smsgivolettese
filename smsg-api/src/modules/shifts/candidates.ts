import type { Tx } from '../../lib/db.js';

export type Candidate = {
  volunteerId: string;
  firstName: string;
  lastName: string;
  status: 'disponibile' | 'non_indicata' | 'non_disponibile' | 'gia_impegnato' | 'assente';
  selectable: boolean;
  commitmentsInMonth: number;
};

/**
 * ADR-054: one query, interval in Europe/Rome. `start`/`end` are timestamptz as text.
 * `ownShiftId` / `ownTransportId` exclude the item's own commitments from "gia_impegnato".
 * `driverDate` set = only active drivers with a licence valid on that date.
 * Order: status, commitments in the item's month asc, last name.
 */
export const candidates = (
  tx: Tx,
  o: {
    start: string;
    end: string;
    driverDate?: string;
    ownShiftId?: string;
    ownTransportId?: string;
  },
) => tx<Candidate[]>`
  with iv as (
    select ${o.start}::timestamptz as s, ${o.end}::timestamptz as e,
           (${o.start}::timestamptz at time zone 'Europe/Rome')::date as day,
           (${o.start}::timestamptz at time zone 'Europe/Rome')::time as st,
           (${o.end}::timestamptz at time zone 'Europe/Rome')::time as et
  ), c as (
    select v.id, p.first_name, p.last_name,
      case
        when exists (select 1 from public.availability_exceptions x
                     where x.volunteer_id = v.id and x.kind = 'assente'
                       and iv.day between x.starts_on and x.ends_on
                       and (x.start_time is null or (x.start_time < iv.et and x.end_time > iv.st))) then 'assente'
        when exists (select 1 from public.volunteer_commitments vc
                     where vc.volunteer_id = v.id and vc.period && tstzrange(iv.s, iv.e, '[)')
                       and not exists (select 1 from public.shift_assignments a
                                       where a.id = vc.shift_assignment_id and a.shift_id = ${o.ownShiftId ?? null}::uuid)
                       and coalesce(vc.transport_id = ${o.ownTransportId ?? null}::uuid, false) = false) then 'gia_impegnato'
        when exists (select 1 from public.availability_rules r
                     where r.volunteer_id = v.id and r.weekday = extract(isodow from iv.day)
                       and r.start_time <= iv.st and r.end_time >= iv.et
                       and r.valid_from <= iv.day and (r.valid_to is null or r.valid_to >= iv.day)) then 'disponibile'
        when not exists (select 1 from public.availability_rules r where r.volunteer_id = v.id) then 'non_indicata'
        else 'non_disponibile'
      end as status,
      (select count(*)::int from public.volunteer_commitments vc
        where vc.volunteer_id = v.id
          and date_trunc('month', lower(vc.period) at time zone 'Europe/Rome') = date_trunc('month', iv.s at time zone 'Europe/Rome')) as n
    from iv, public.volunteers v join public.profiles p on p.id = v.id
    where v.active
      ${o.driverDate ? tx`and v.can_drive and v.license_expires_on >= ${o.driverDate}::date` : tx``}
  )
  select id as "volunteerId", first_name as "firstName", last_name as "lastName", status,
         status in ('disponibile', 'non_indicata', 'non_disponibile') as selectable,
         n as "commitmentsInMonth"
  from c
  order by array_position(array['disponibile', 'non_indicata', 'non_disponibile', 'gia_impegnato', 'assente'], status),
           n, last_name, first_name, id`;
