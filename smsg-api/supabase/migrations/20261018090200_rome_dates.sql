-- "Today" means Europe/Rome everywhere (the DB session is UTC; around midnight the two dates differ).
-- Remaining spots that used UTC current_date; the other functions already use Rome.
alter table public.availability_rules
  alter column valid_from set default ((now() at time zone 'Europe/Rome')::date);

create or replace function app.volunteers_check_driver_change() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if exists (select 1 from public.transports t
             where t.driver_volunteer_id = new.id and t.status in ('assegnato', 'confermato')
               and t.travel_date >= (now() at time zone 'Europe/Rome')::date
               and not (new.active and new.can_drive and new.license_expires_on >= t.travel_date)) then
    raise exception 'DRIVER_HAS_FUTURE_TRANSPORTS';
  end if;
  return new;
end $$;

create or replace view public.volunteer_transports_v with (security_barrier = true) as
select t.id, t.travel_date, t.departure_at, t.appointment_at, t.return_at, t.from_address, t.to_address,
       t.wheelchair, t.companion, t.status, t.km, t.driver_notes,
       m.first_name as member_first_name, m.last_name as member_last_name, m.phone as member_phone,
       v.plate as vehicle_plate, v.model as vehicle_model
from public.transports t
join public.members m on m.id = t.member_id
left join public.vehicles v on v.id = t.vehicle_id
where t.driver_volunteer_id = auth.uid()
  and (t.status in ('assegnato', 'confermato')
       or (t.status = 'svolto' and t.travel_date >= (now() at time zone 'Europe/Rome')::date - 30));
