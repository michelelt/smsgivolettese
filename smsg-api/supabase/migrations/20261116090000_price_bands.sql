-- ADR-075: flat price per km band; the driver collects and records the amount; the invoice becomes a pro forma
-- summary of the service (no price). Invoice tables, stamp duty and km rate are left unused (dropped at the next reset).

-- Bands sorted by upToKm, last one open-ended (upToKm null). km <= upToKm falls in that band.
alter table public.org_settings add column price_bands jsonb not null default '[
  {"upToKm": 20, "priceCents": 0, "color": "#2E7D32", "label": "Verde"},
  {"upToKm": 30, "priceCents": 0, "color": "#F9A825", "label": "Giallo"},
  {"upToKm": null, "priceCents": 0, "color": "#C62828", "label": "Rosso"}
]'::jsonb check (jsonb_typeof(price_bands) = 'array' and jsonb_array_length(price_bands) between 1 and 20);

-- Snapshot of the band at completion: later price changes do not rewrite history.
alter table public.transports
  add column band_label text,
  add column band_color text,
  add column band_price_cents int,
  add column collected_cents int check (collected_cents between 0 and 10000000);

create function app.transports_price_band() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare b jsonb;
begin
  if new.odometer_start is null then
    new.band_label := null; new.band_color := null; new.band_price_cents := null;
    return new;
  end if;
  select e into b from public.org_settings o, jsonb_array_elements(o.price_bands) e
  where e->>'upToKm' is null or new.odometer_end - new.odometer_start <= (e->>'upToKm')::int
  order by (e->>'upToKm')::int nulls last limit 1;
  new.band_label := b->>'label'; new.band_color := b->>'color'; new.band_price_cents := (b->>'priceCents')::int;
  return new;
end $$;
create trigger price_band before insert or update of odometer_start, odometer_end on public.transports
  for each row execute function app.transports_price_band();

drop view public.volunteer_transports_v;
drop function public.complete_transport(uuid, int, int, text);
create function public.complete_transport(
  p_id uuid, p_odometer_start int, p_odometer_end int, p_driver_notes text, p_collected_cents int
) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  perform app.require_role('volontario');
  update public.transports set status = 'svolto', odometer_start = p_odometer_start, odometer_end = p_odometer_end,
         driver_notes = p_driver_notes, collected_cents = p_collected_cents, completed_at = now()
   where id = p_id and driver_volunteer_id = auth.uid() and status in ('assegnato', 'confermato')
     and travel_date <= (now() at time zone 'Europe/Rome')::date;
  if not found then raise exception 'TRANSPORT_NOT_COMPLETABLE'; end if;
end $$;
revoke execute on function public.complete_transport(uuid, int, int, text, int) from public, anon;
grant execute on function public.complete_transport(uuid, int, int, text, int) to authenticated;

-- Bands for the driver's completion form (price shown while typing km).
create function public.price_bands() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$ begin
  perform app.require_role('volontario');
  return (select price_bands from public.org_settings);
end $$;
revoke execute on function public.price_bands() from public, anon;
grant execute on function public.price_bands() to authenticated;

create view public.volunteer_transports_v with (security_barrier = true) as
select t.id, t.travel_date, t.departure_at, t.appointment_at, t.return_at, t.from_address, t.to_address,
       t.wheelchair, t.mobility_aids, t.companions, t.status,
       t.odometer_start, t.odometer_end, t.km, t.driver_notes,
       t.band_label, t.band_color, t.band_price_cents, t.collected_cents,
       m.first_name as member_first_name, m.last_name as member_last_name,
       -- phone only while the trip is open (minimisation)
       case when t.status <> 'svolto' then coalesce(t.contact_phone, m.phone) end as contact_phone,
       v.plate as vehicle_plate, v.model as vehicle_model
from public.transports t
join public.members m on m.id = t.member_id
left join public.vehicles v on v.id = t.vehicle_id
where t.driver_volunteer_id = auth.uid()
  and (t.status in ('assegnato', 'confermato')
       or (t.status = 'svolto' and t.travel_date >= (now() at time zone 'Europe/Rome')::date - 30));
revoke all on public.volunteer_transports_v from anon, authenticated;
grant select on public.volunteer_transports_v to authenticated;
