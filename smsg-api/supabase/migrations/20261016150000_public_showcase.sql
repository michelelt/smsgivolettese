-- ADR-043/044: public site is a showcase; bookings are staff-only; no prices or contacts for anon.
drop function public.submit_public_booking(text, text, text, uuid, date, public.booking_slot, boolean, text);

create function app.bookings_create_transport() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if exists (select 1 from public.services where id = new.service_id and requires_transport) then
    insert into public.transports (client_id, travel_date, booking_id, created_by)
    values (new.client_id, new.day, new.id, new.created_by);
  end if;
  return new;
end $$;
create trigger bookings_create_transport after insert on public.bookings
  for each row execute function app.bookings_create_transport();

alter table public.services drop column bookable;

revoke select on public.services from anon;
grant select (id, name, description, schedule_note, sort_order, active) on public.services to anon;

alter table public.site_settings
  drop column phone, drop column email, drop column opening_hours, drop column membership_info,
  add column vat_number text,
  add column conventions jsonb not null default '[]' check (jsonb_typeof(conventions) = 'array'),
  add column footer_links jsonb not null default '[]' check (jsonb_typeof(footer_links) = 'array');
