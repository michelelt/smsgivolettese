-- ADR-039: notes max 600 chars (was 1000). Body otherwise identical to the original function.
create or replace function public.submit_public_booking(
  p_first_name text, p_last_name text, p_phone text, p_service_id uuid, p_day date,
  p_slot public.booking_slot, p_declared_member boolean, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_svc public.services; v_client uuid; v_booking uuid;
        v_today date := (now() at time zone 'Europe/Rome')::date;
        v_norm text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if coalesce(btrim(p_first_name), '') = '' or coalesce(btrim(p_last_name), '') = ''
     or char_length(p_first_name) > 100 or char_length(p_last_name) > 100
     or char_length(v_norm) not between 6 and 15 or char_length(coalesce(p_notes, '')) > 600 then
    raise exception 'INVALID_INPUT';
  end if;
  select * into v_svc from public.services where id = p_service_id and active and bookable;
  if not found then raise exception 'SERVICE_NOT_BOOKABLE'; end if;
  if p_day not between v_today + 1 and v_today + 60 or extract(isodow from p_day) = 7 then
    raise exception 'INVALID_DAY';
  end if;
  select id into v_client from public.clients
   where phone_normalized = v_norm and lower(last_name) = lower(btrim(p_last_name))
   order by created_at limit 1;
  if v_client is null then
    insert into public.clients (first_name, last_name, phone) values (btrim(p_first_name), btrim(p_last_name), btrim(p_phone))
    returning id into v_client;
  end if;
  insert into public.bookings (client_id, service_id, day, slot, declared_member, price_applied_cents, origin, status, notes)
  values (v_client, p_service_id, p_day, p_slot, p_declared_member,
          case when p_declared_member then v_svc.member_price_cents else v_svc.non_member_price_cents end,
          'online', 'attesa', p_notes)
  returning id into v_booking;
  if v_svc.requires_transport then
    insert into public.transports (client_id, requested_by, travel_date, booking_id)
    values (v_client, 'online', p_day, v_booking);
  end if;
  return v_booking;
end $$;
