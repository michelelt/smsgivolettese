-- Phase 4 (ADR-046, 049, 051): booking->transport sync, site links check, staff org info, card number immutability.

-- ADR-046: cancelling a booking cancels its transport (unless done); restoring revives it as a request.
create function app.bookings_sync_transport() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'annullata' and old.status <> 'annullata' then
    update public.transports set status = 'annullato'
    where booking_id = new.id and status not in ('svolto', 'annullato');
  elsif old.status = 'annullata' and new.status <> 'annullata' then
    update public.transports set status = 'richiesto', driver_volunteer_id = null, vehicle_id = null
    where booking_id = new.id and status = 'annullato';
  end if;
  return new;
end $$;
create trigger bookings_sync_transport after update of status on public.bookings
  for each row execute function app.bookings_sync_transport();

-- ADR-051: shape of the jsonb link lists (https only, non-empty labels, known footer groups).
create function app.site_links_valid(conventions jsonb, footer_links jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(conventions) = 'array' and jsonb_typeof(footer_links) = 'array'
    and not exists (
      select 1 from jsonb_array_elements(conventions) c
      where jsonb_typeof(c) <> 'object'
        or jsonb_typeof(c -> 'title') is distinct from 'string' or btrim(c ->> 'title') = ''
        or (c ? 'url' and jsonb_typeof(c -> 'url') <> 'null'
            and (jsonb_typeof(c -> 'url') <> 'string' or c ->> 'url' !~ '^https://\S+$')))
    and not exists (
      select 1 from jsonb_array_elements(footer_links) f
      where jsonb_typeof(f) <> 'object'
        or jsonb_typeof(f -> 'label') is distinct from 'string' or btrim(f ->> 'label') = ''
        or f ->> 'group' is null or f ->> 'group' not in ('associazioni', 'mutuo_soccorso', 'utili')
        or jsonb_typeof(f -> 'url') is distinct from 'string' or f ->> 'url' !~ '^https://\S+$')
$$;
-- CHECK runs with the invoker's privileges (staff updates site_settings)
grant execute on function app.site_links_valid(jsonb, jsonb) to authenticated;
alter table public.site_settings
  add constraint site_settings_links_valid check (app.site_links_valid(conventions, footer_links));

-- ADR-049: staff cannot read org_settings; expose only what forms and PDFs need.
create function public.staff_org_info() returns table (
  legal_name text, tax_code text, address text, membership_fee_cents int,
  stamp_duty_threshold_cents int, stamp_duty_amount_cents int, next_card_number int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform app.require_role('staff');
  return query select o.legal_name, o.tax_code, o.address, o.membership_fee_cents,
    o.stamp_duty_threshold_cents, o.stamp_duty_amount_cents, o.last_card_number + 1
  from public.org_settings o;
end $$;
revoke execute on function public.staff_org_info() from public, anon;
grant execute on function public.staff_org_info() to authenticated;

-- Card numbers are never reassigned.
create function app.members_card_number_guard() returns trigger
language plpgsql set search_path = ''
as $$ begin raise exception 'CARD_NUMBER_IMMUTABLE'; end $$;
create trigger card_number_immutable before update of card_number on public.members
  for each row when (new.card_number is distinct from old.card_number)
  execute function app.members_card_number_guard();

create index bookings_invoice_idx on public.bookings (invoice_id) where invoice_id is not null;
