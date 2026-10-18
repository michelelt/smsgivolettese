-- Phase 2a: helper functions, invariants (triggers), numbering and public/volunteer functions.

-- Functions are private by default: grant execute explicitly (Supabase would otherwise grant anon/authenticated).
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema app revoke execute on functions from public, anon, authenticated;
grant usage on schema app to anon, authenticated;

-- Role helpers (SQL mirror of api/src/auth/permissions.ts)
create function app.role() returns public.app_role
language sql stable set search_path = ''
as $$ select nullif(auth.jwt() ->> 'app_role', '')::public.app_role $$;

create function app.has_role(min public.app_role) returns boolean
language sql stable set search_path = ''
as $$ select coalesce(app.role() >= min, false) $$;

create function app.require_role(min public.app_role) returns void
language plpgsql stable set search_path = ''
as $$ begin
  if not app.has_role(min) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
end $$;


-- Audit (ADR-019)
create function app.audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare b jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
        a jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
        j jsonb := coalesce(a, b);
begin
  insert into public.audit_log (actor_id, actor_role, request_id, action, table_name, row_id, before, after)
  values (auth.uid(), app.role(), current_setting('app.request_id', true), lower(tg_op)::public.audit_action,
          tg_table_name, coalesce(j ->> 'id', j ->> 'user_id', j ->> 'year'), b, a);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'user_roles', 'volunteers', 'members', 'membership_fees', 'invoices',
    'invoice_lines', 'invoice_counters', 'org_settings', 'shifts', 'shift_assignments', 'transports']
  loop
    execute format('create trigger audit after insert or update or delete on public.%I
                    for each row execute function app.audit()', t);
  end loop;
end $$;

-- Rate limiting (ADR-012): service role only
create function app.consume_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
        h int;
begin
  insert into public.rate_limit_hits as r (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into h;
  return h <= p_max;
end $$;

-- Invariant 1: no double booking of a volunteer (ADR-004)
create function app.sync_assignment_commitment() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.volunteer_commitments where shift_assignment_id = old.id;
    return old;
  end if;
  if new.status in ('proposto', 'confermato') then
    insert into public.volunteer_commitments (volunteer_id, period, shift_assignment_id)
    select new.volunteer_id, tstzrange(s.starts_at, s.ends_at, '[)'), new.id
    from public.shifts s where s.id = new.shift_id
    on conflict (shift_assignment_id) do update set volunteer_id = excluded.volunteer_id, period = excluded.period;
  else
    delete from public.volunteer_commitments where shift_assignment_id = new.id;
  end if;
  return new;
end $$;
create trigger sync_commitment after insert or update or delete on public.shift_assignments
  for each row execute function app.sync_assignment_commitment();

create function app.sync_shift_commitments() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.volunteer_commitments vc set period = tstzrange(new.starts_at, new.ends_at, '[)')
  from public.shift_assignments sa where vc.shift_assignment_id = sa.id and sa.shift_id = new.id;
  return new;
end $$;
create trigger sync_commitments after update of starts_at, ends_at on public.shifts
  for each row execute function app.sync_shift_commitments();

create function app.sync_transport_commitment() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.volunteer_commitments where transport_id = old.id;
    return old;
  end if;
  if new.driver_volunteer_id is not null and new.status in ('assegnato', 'confermato', 'svolto') then
    -- ADR-015; the 15 minute floor keeps the range valid when the appointment precedes departure
    insert into public.volunteer_commitments (volunteer_id, period, transport_id)
    values (new.driver_volunteer_id,
            tstzrange(new.departure_at,
                      greatest(coalesce(new.return_at, new.appointment_at + interval '1 hour',
                                        new.departure_at + interval '2 hours'),
                               new.departure_at + interval '15 minutes'), '[)'),
            new.id)
    on conflict (transport_id) do update set volunteer_id = excluded.volunteer_id, period = excluded.period;
  else
    delete from public.volunteer_commitments where transport_id = new.id;
  end if;
  return new;
end $$;
create trigger sync_commitment after insert or update or delete on public.transports
  for each row execute function app.sync_transport_commitment();

-- Invariant 2: driver eligibility
create function app.transports_check_driver() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status in ('assegnato', 'confermato') and new.driver_volunteer_id is not null
     and (tg_op = 'INSERT' or (old.driver_volunteer_id, old.vehicle_id, old.travel_date, old.wheelchair, old.status)
          is distinct from (new.driver_volunteer_id, new.vehicle_id, new.travel_date, new.wheelchair, new.status)) then
    if not exists (select 1 from public.volunteers v where v.id = new.driver_volunteer_id
                   and v.active and v.can_drive and v.license_expires_on >= new.travel_date) then
      raise exception 'DRIVER_NOT_ELIGIBLE';
    end if;
    if new.vehicle_id is not null and not exists (
         select 1 from public.vehicles h where h.id = new.vehicle_id and h.active
           and (not new.wheelchair or h.wheelchair_accessible)) then
      raise exception 'VEHICLE_NOT_SUITABLE';
    end if;
  end if;
  return new;
end $$;
create trigger check_driver before insert or update on public.transports
  for each row execute function app.transports_check_driver();

create function app.volunteers_check_driver_change() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if exists (select 1 from public.transports t
             where t.driver_volunteer_id = new.id and t.status in ('assegnato', 'confermato')
               and t.travel_date >= current_date
               and not (new.active and new.can_drive and new.license_expires_on >= t.travel_date)) then
    raise exception 'DRIVER_HAS_FUTURE_TRANSPORTS';
  end if;
  return new;
end $$;
create trigger check_driver_change before update of can_drive, license_expires_on, active on public.volunteers
  for each row execute function app.volunteers_check_driver_change();

-- Invariant 5: invoices are immutable apart from payment and voiding; lines are insert-only
create function app.invoices_guard() returns trigger
language plpgsql set search_path = ''
as $$
declare allowed text[];
begin
  if tg_op = 'DELETE' then raise exception 'INVOICE_IMMUTABLE'; end if;
  if new.status = old.status then allowed := array['updated_at'];
  elsif old.status = 'emessa' and new.status = 'pagata' then
    allowed := array['status', 'payment_method', 'paid_on', 'updated_at'];
  elsif old.status in ('emessa', 'pagata') and new.status = 'annullata' then
    allowed := array['status', 'voided_at', 'voided_by', 'void_reason', 'updated_at'];
  else raise exception 'INVOICE_IMMUTABLE';
  end if;
  if to_jsonb(new) - allowed is distinct from to_jsonb(old) - allowed then
    raise exception 'INVOICE_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger guard before update or delete on public.invoices
  for each row execute function app.invoices_guard();

create function app.invoice_lines_guard() returns trigger
language plpgsql set search_path = ''
as $$ begin raise exception 'INVOICE_IMMUTABLE'; end $$;
create trigger guard before update or delete on public.invoice_lines
  for each row execute function app.invoice_lines_guard();

-- Counters only move upward (ADR-025)
create function app.org_settings_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.last_card_number <> old.last_card_number and (new.last_card_number < old.last_card_number
     or new.last_card_number < coalesce((select max(card_number) from public.members), 0)) then
    raise exception 'COUNTER_BELOW_MAX';
  end if;
  return new;
end $$;
create trigger guard before update on public.org_settings
  for each row execute function app.org_settings_guard();

create function app.set_member_counter(n int) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  perform app.require_role('super_admin');
  update public.org_settings set last_card_number = n;
end $$;

create function app.set_invoice_counter(p_year smallint, n int) returns void
language plpgsql security definer set search_path = ''
as $$
declare cur int;
begin
  perform app.require_role('super_admin');
  insert into public.invoice_counters (year) values (p_year) on conflict do nothing;
  select last_number into cur from public.invoice_counters where year = p_year for update;
  if n < greatest(cur, coalesce((select max(number) from public.invoices where year = p_year), 0)) then
    raise exception 'COUNTER_BELOW_MAX';
  end if;
  update public.invoice_counters set last_number = n where year = p_year;
end $$;

-- Invariant 9: last super admin
create function app.assert_other_super_admin(p_user uuid) returns void
language plpgsql set search_path = ''
as $$
begin
  perform 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
   where ur.role = 'super_admin' and p.active for update of ur;
  if not exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
                 where ur.role = 'super_admin' and p.active and ur.user_id <> p_user) then
    raise exception 'LAST_SUPER_ADMIN';
  end if;
end $$;

create function app.user_roles_protect_last_super_admin() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.role = 'super_admin' and (tg_op = 'DELETE' or new.role <> 'super_admin' or new.user_id <> old.user_id)
     and exists (select 1 from public.profiles where id = old.user_id and active) then
    perform app.assert_other_super_admin(old.user_id);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger protect_last_super_admin before update or delete on public.user_roles
  for each row execute function app.user_roles_protect_last_super_admin();

create function app.profiles_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.active and not new.active
     and exists (select 1 from public.user_roles where user_id = old.id and role = 'super_admin') then
    perform app.assert_other_super_admin(old.id);
  end if;
  -- API roles other than super_admin may not touch activation/anonymisation (service mode is exempt)
  if current_user in ('authenticated', 'anon') and not app.has_role('super_admin')
     and (new.id, new.active, new.anonymized_at) is distinct from (old.id, old.active, old.anonymized_at) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard before update on public.profiles
  for each row execute function app.profiles_guard();

-- Invariant 4: gap-free invoice numbering
create function public.issue_invoice(
  p_client_id uuid, p_booking_ids uuid[], p_customer_tax_code text, p_customer_address text,
  p_payment_method public.payment_method default null
) returns public.invoices
language plpgsql security definer set search_path = ''
as $$
declare
  v_want int := cardinality(array(select distinct unnest(p_booking_ids)));
  v_found int; v_sub int; v_year smallint; v_n int; v_stamp int;
  v_org public.org_settings; v_cli public.clients; v_inv public.invoices;
  v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  perform app.require_role('staff');
  select * into v_cli from public.clients where id = p_client_id;
  if not found then raise exception 'CLIENT_NOT_FOUND'; end if;

  select count(*), coalesce(sum(price_applied_cents), 0) into v_found, v_sub from (
    select b.price_applied_cents from public.bookings b
    where b.id = any(p_booking_ids) and b.client_id = p_client_id and b.status = 'eseguita' and b.invoice_id is null
    for update) locked;
  if v_want = 0 or v_found <> v_want then raise exception 'BOOKINGS_NOT_INVOICEABLE'; end if;

  v_year := extract(year from now() at time zone 'Europe/Rome');
  insert into public.invoice_counters (year) values (v_year) on conflict do nothing;
  select last_number + 1 into v_n from public.invoice_counters where year = v_year for update;
  update public.invoice_counters set last_number = v_n where year = v_year;

  select * into v_org from public.org_settings;
  v_stamp := case when v_sub > v_org.stamp_duty_threshold_cents then v_org.stamp_duty_amount_cents else 0 end;

  insert into public.invoices (year, number, issued_on, client_id, customer_name, customer_tax_code, customer_address,
    issuer_name, issuer_tax_code, issuer_address, vat_exemption_text, subtotal_cents, stamp_duty_cents, total_cents,
    status, payment_method, paid_on, created_by)
  values (v_year, v_n, v_today, p_client_id, v_cli.first_name || ' ' || v_cli.last_name,
    coalesce(p_customer_tax_code, v_cli.tax_code), coalesce(p_customer_address, v_cli.address),
    v_org.legal_name, v_org.tax_code, v_org.address, v_org.vat_exemption_text, v_sub, v_stamp, v_sub + v_stamp,
    case when p_payment_method is null then 'emessa' else 'pagata' end::public.invoice_status,
    p_payment_method, case when p_payment_method is not null then v_today end, auth.uid())
  returning * into v_inv;

  insert into public.invoice_lines (invoice_id, booking_id, position, description, amount_cents)
  select v_inv.id, b.id, row_number() over (order by b.day, b.created_at, b.id),
         s.name || ' del ' || to_char(b.day, 'DD/MM/YYYY'), b.price_applied_cents
  from public.bookings b join public.services s on s.id = b.service_id
  where b.id = any(p_booking_ids);

  update public.bookings set invoice_id = v_inv.id where id = any(p_booking_ids);
  return v_inv;
end $$;

create function public.void_invoice(p_id uuid, p_reason text) returns public.invoices
language plpgsql security definer set search_path = ''
as $$
declare v_inv public.invoices;
begin
  perform app.require_role('staff');
  if coalesce(btrim(p_reason), '') = '' then raise exception 'VOID_REASON_REQUIRED'; end if;
  update public.invoices set status = 'annullata', voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
  where id = p_id and status in ('emessa', 'pagata') returning * into v_inv;
  if not found then raise exception 'INVOICE_NOT_VOIDABLE'; end if;
  update public.bookings set invoice_id = null where invoice_id = p_id;
  return v_inv;
end $$;

-- Invariant 6: member numbering
create function public.register_member(p jsonb, p_fee_method public.payment_method default null)
returns public.members
language plpgsql security definer set search_path = ''
as $$
declare n int; v_m public.members; v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  perform app.require_role('staff');
  select last_card_number + 1 into n from public.org_settings for update;
  update public.org_settings set last_card_number = n;
  insert into public.members (card_number, first_name, last_name, tax_code, birth_date, birth_place, address,
    postal_code, city, phone, email, member_type, joined_on, privacy_signed_on, notes)
  values (n, p ->> 'first_name', p ->> 'last_name', p ->> 'tax_code', (p ->> 'birth_date')::date, p ->> 'birth_place',
    p ->> 'address', p ->> 'postal_code', p ->> 'city', p ->> 'phone', p ->> 'email',
    coalesce((p ->> 'member_type')::public.member_type, 'ordinario'), coalesce((p ->> 'joined_on')::date, v_today),
    (p ->> 'privacy_signed_on')::date, p ->> 'notes')
  returning * into v_m;
  if p_fee_method is not null then
    insert into public.membership_fees (member_id, year, amount_cents, paid_on, method, recorded_by)
    select v_m.id, extract(year from v_today), o.membership_fee_cents, v_today, p_fee_method, auth.uid()
    from public.org_settings o;
  end if;
  return v_m;
end $$;

-- Volunteer writes (permissions.md): definer functions checking role and ownership
create function public.respond_shift_assignment(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  perform app.require_role('volontario');
  update public.shift_assignments
     set status = case when p_accept then 'confermato' else 'rifiutato' end::public.assignment_status,
         responded_at = now()
   where id = p_id and volunteer_id = auth.uid();
  if not found then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
end $$;

create function public.respond_transport(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  perform app.require_role('volontario');
  if p_accept then
    update public.transports set status = 'confermato'
     where id = p_id and driver_volunteer_id = auth.uid() and status = 'assegnato';
  else
    update public.transports set status = 'richiesto', driver_volunteer_id = null, vehicle_id = null
     where id = p_id and driver_volunteer_id = auth.uid() and status in ('assegnato', 'confermato');
  end if;
  if not found then raise exception 'TRANSPORT_NOT_FOUND'; end if;
end $$;

create function public.complete_transport(p_id uuid, p_km numeric, p_driver_notes text) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  perform app.require_role('volontario');
  update public.transports set status = 'svolto', km = p_km, driver_notes = p_driver_notes, completed_at = now()
   where id = p_id and driver_volunteer_id = auth.uid() and status in ('assegnato', 'confermato')
     and travel_date <= (now() at time zone 'Europe/Rome')::date;
  if not found then raise exception 'TRANSPORT_NOT_COMPLETABLE'; end if;
end $$;

create function public.update_my_profile(p_phone text) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  perform app.require_role('volontario');
  update public.profiles set phone = p_phone where id = auth.uid();
end $$;

-- Public writes (ADR-006), called by the API after Turnstile + rate limit
create function public.submit_public_booking(
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
     or char_length(v_norm) not between 6 and 15 or char_length(coalesce(p_notes, '')) > 1000 then
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

create function public.submit_post_proposal(
  p_title text, p_category public.post_category, p_event_date date, p_location text, p_body text,
  p_photo_path text, p_video_url text, p_submitter_name text, p_submitter_contact text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_body), '') = '' or coalesce(btrim(p_submitter_name), '') = '' then
    raise exception 'INVALID_INPUT';
  end if;
  insert into public.post_proposals (title, category, event_date, location, body, photo_path, video_url,
    submitter_name, submitter_contact)
  values (p_title, p_category, p_event_date, p_location, p_body, p_photo_path, p_video_url,
    p_submitter_name, p_submitter_contact)
  returning id into v_id;
  return v_id;
end $$;

-- `alter default privileges ... in schema` cannot remove PUBLIC's built-in execute right: revoke explicitly,
-- then grant exactly what each role needs.
revoke execute on all functions in schema app, public from public, anon, authenticated;
grant execute on function app.role(), app.has_role(public.app_role), app.require_role(public.app_role) to anon, authenticated;
grant execute on function app.consume_rate_limit(text, int, int) to service_role;
grant execute on function app.set_member_counter(int), app.set_invoice_counter(smallint, int) to authenticated;
grant execute on function
  public.issue_invoice(uuid, uuid[], text, text, public.payment_method),
  public.void_invoice(uuid, text),
  public.register_member(jsonb, public.payment_method),
  public.respond_shift_assignment(uuid, boolean),
  public.respond_transport(uuid, boolean),
  public.complete_transport(uuid, numeric, text),
  public.update_my_profile(text)
  to authenticated;
grant execute on function
  public.submit_public_booking(text, text, text, uuid, date, public.booking_slot, boolean, text),
  public.submit_post_proposal(text, public.post_category, date, text, text, text, text, text, text)
  to anon, authenticated;
