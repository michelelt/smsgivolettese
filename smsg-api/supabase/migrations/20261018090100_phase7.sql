-- Phase 7 (ADR-063, 066, 067): TOTP in the token hook, audit coverage + append-only log, GDPR functions.

-- Phase 2 debt: app.password_set follows auth.users.
delete from app.password_set where user_id not in (select id from auth.users);
alter table app.password_set add constraint password_set_user_fk
  foreign key (user_id) references auth.users (id) on delete cascade;

-- ADR-063: the TOTP second step is not a "link" login. GoTrue reports it as 'totp' (event method / amr);
-- 'mfa/totp' is kept as the documented alias. otp, magiclink, recovery... still refuse staff/super_admin.
create or replace function app.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.app_role; claims jsonb := event -> 'claims'; uid uuid := (event ->> 'user_id')::uuid;
  via_link boolean;
begin
  select ur.role into r from public.user_roles ur join public.profiles p on p.id = ur.user_id
   where ur.user_id = uid and p.active;
  if r in ('staff', 'super_admin') then
    select exists (
      select 1 from (
        select event ->> 'authentication_method' as m
        union all select a ->> 'method' from jsonb_array_elements(coalesce(claims -> 'amr', '[]'::jsonb)) a
      ) x where m is not null and m not in ('password', 'token_refresh', 'totp', 'mfa/totp'))
    into via_link;
    if via_link then
      if exists (select 1 from app.password_set where user_id = uid) then
        return jsonb_build_object('error', jsonb_build_object('http_code', 403,
          'message', 'Accesso con link non consentito per questo ruolo: usa email e password.'));
      end if;
      r := null; -- no password yet: set-password-only session
    end if;
  end if;
  if r is null then claims := claims - 'app_role';
  else claims := jsonb_set(claims, '{app_role}', to_jsonb(r::text));
  end if;
  return jsonb_set(event, '{claims}', claims);
end $$;

-- ADR-066: audit() drops the columns named in the trigger arguments.
create or replace function app.audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare b jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) - coalesce(tg_argv, array[]::text[]) end;
        a jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) - coalesce(tg_argv, array[]::text[]) end;
        j jsonb := coalesce(a, b);
        svc boolean := auth.uid() is null and auth.role() = 'service_role';
begin
  insert into public.audit_log (actor_id, actor_role, request_id, action, table_name, row_id, before, after)
  values (case when svc then nullif(current_setting('app.actor_id', true), '')::uuid else auth.uid() end,
          case when svc then nullif(current_setting('app.actor_role', true), '')::public.app_role else app.role() end,
          current_setting('app.request_id', true), lower(tg_op)::public.audit_action,
          tg_table_name, coalesce(j ->> 'id', j ->> 'user_id', j ->> 'year'), b, a);
  return null;
end $$;

create trigger audit after insert or delete on public.media
  for each row execute function app.audit();
-- No personal data stored: the submitter fields and free text are dropped from the snapshots.
create trigger audit after update or delete on public.post_proposals
  for each row execute function app.audit('title', 'body', 'location', 'photo_path', 'video_url', 'submitter_name', 'submitter_contact');

-- ADR-066: append-only, except GDPR redaction (redacted false -> true, before/after nulled).
create function app.audit_log_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then raise exception 'AUDIT_IMMUTABLE'; end if;
  if not (old.redacted = false and new.redacted = true and new.before is null and new.after is null
          and (new.id, new.at, new.actor_id, new.actor_role, new.request_id, new.action, new.table_name, new.row_id)
              is not distinct from
              (old.id, old.at, old.actor_id, old.actor_role, old.request_id, old.action, old.table_name, old.row_id))
  then raise exception 'AUDIT_IMMUTABLE'; end if;
  return new;
end $$;
revoke execute on function app.audit_log_guard() from public, anon, authenticated;
create trigger guard before update or delete on public.audit_log
  for each row execute function app.audit_log_guard();

-- ADR-067: GDPR export. Raises FORBIDDEN (42501), INVALID_SUBJECT, MEMBER_NOT_FOUND, USER_NOT_FOUND.
create function app.gdpr_export(p_subject text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare out jsonb;
begin
  perform app.require_role('super_admin');
  if p_subject = 'member' then
    if not exists (select 1 from public.members where id = p_id) then raise exception 'MEMBER_NOT_FOUND'; end if;
    select jsonb_build_object('subject', 'member', 'exportedAt', now(),
      'member', to_jsonb(m),
      'membershipFees', coalesce((select jsonb_agg(to_jsonb(f) - 'recorded_by' order by f.year) from public.membership_fees f where f.member_id = m.id), '[]'),
      'bookings', coalesce((select jsonb_agg(to_jsonb(b) - 'created_by' order by b.day, b.created_at) from public.bookings b where b.member_id = m.id), '[]'),
      'transports', coalesce((select jsonb_agg(to_jsonb(t) - array['driver_volunteer_id', 'created_by'] order by t.travel_date, t.created_at) from public.transports t where t.member_id = m.id), '[]'),
      'invoices', coalesce((select jsonb_agg(to_jsonb(i) - array['voided_by', 'created_by'] || jsonb_build_object('lines',
          coalesce((select jsonb_agg(to_jsonb(l) order by l.position) from public.invoice_lines l where l.invoice_id = i.id), '[]'))
          order by i.year, i.number) from public.invoices i where i.member_id = m.id), '[]'))
    into out from public.members m where m.id = p_id;
  elsif p_subject = 'user' then
    if not exists (select 1 from public.profiles where id = p_id) then raise exception 'USER_NOT_FOUND'; end if;
    select jsonb_build_object('subject', 'user', 'exportedAt', now(),
      'profile', to_jsonb(p),
      'role', (select ur.role from public.user_roles ur where ur.user_id = p.id),
      'volunteer', (select to_jsonb(v) from public.volunteers v where v.id = p.id),
      'availabilityRules', coalesce((select jsonb_agg(to_jsonb(r) order by r.weekday, r.start_time) from public.availability_rules r where r.volunteer_id = p.id), '[]'),
      'availabilityExceptions', coalesce((select jsonb_agg(to_jsonb(x) order by x.starts_on) from public.availability_exceptions x where x.volunteer_id = p.id), '[]'),
      'shiftAssignments', coalesce((select jsonb_agg(jsonb_build_object('id', sa.id, 'status', sa.status,
          'respondedAt', sa.responded_at, 'shiftId', s.id, 'startsAt', s.starts_at, 'endsAt', s.ends_at,
          'shiftType', st.name) order by s.starts_at)
          from public.shift_assignments sa join public.shifts s on s.id = sa.shift_id
          left join public.shift_types st on st.id = s.shift_type_id where sa.volunteer_id = p.id), '[]'),
      'transportsAsDriver', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'travelDate', t.travel_date,
          'status', t.status, 'km', t.km, 'driverNotes', t.driver_notes) order by t.travel_date)
          from public.transports t where t.driver_volunteer_id = p.id), '[]'))
    into out from public.profiles p where p.id = p_id;
  else
    raise exception 'INVALID_SUBJECT';
  end if;
  insert into public.audit_log (actor_id, actor_role, request_id, action, table_name, row_id)
  values (auth.uid(), app.role(), current_setting('app.request_id', true), 'export',
          case p_subject when 'member' then 'members' else 'profiles' end, p_id::text);
  return out;
end $$;

-- ADR-067: member anonymisation. Raises FORBIDDEN (42501), MEMBER_NOT_FOUND, MEMBER_ACTIVE. Idempotent.
create function app.anonymize_member(p_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare m public.members;
begin
  perform app.require_role('super_admin');
  select * into m from public.members where id = p_id for update;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if m.anonymized_at is null then
    if m.status <> 'cessato' then raise exception 'MEMBER_ACTIVE'; end if;
    update public.members set first_name = 'Anonimo', last_name = 'Anonimo', tax_code = null, birth_date = null,
      birth_place = null, address = null, postal_code = null, city = null, phone = null, email = null,
      notes = null, anonymized_at = now() where id = p_id;
    update public.bookings set notes = null where member_id = p_id;
    update public.transports set requested_by = null, reason = null, notes = null, driver_notes = null,
      from_address = '(anonimizzato)', to_address = '(anonimizzato)' where member_id = p_id;
    -- last step: also covers the audit rows written just above
    update public.audit_log set redacted = true, before = null, after = null
     where not redacted and ((table_name = 'members' and row_id = p_id::text)
        or (table_name in ('membership_fees', 'transports')
            and p_id::text in (coalesce(before ->> 'member_id', ''), coalesce(after ->> 'member_id', ''))));
  end if;
  return jsonb_build_object('retainedInvoices', coalesce((select jsonb_agg(jsonb_build_object(
    'id', i.id, 'year', i.year, 'number', i.number) order by i.year, i.number)
    from public.invoices i where i.member_id = p_id), '[]'));
end $$;

-- ADR-067: user anonymisation (Auth side is done by the API afterwards).
-- Raises FORBIDDEN (42501), USER_NOT_FOUND, SELF_FORBIDDEN, LAST_SUPER_ADMIN, DRIVER_HAS_FUTURE_TRANSPORTS. Idempotent.
create function app.anonymize_user(p_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare p public.profiles;
begin
  perform app.require_role('super_admin');
  if p_id = auth.uid() then raise exception 'SELF_FORBIDDEN'; end if;
  select * into p from public.profiles where id = p_id for update;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  if p.anonymized_at is null then
    update public.profiles set first_name = 'Anonimo', last_name = 'Anonimo', phone = null,
      email = 'deleted+' || p_id || '@invalid.local', active = false, anonymized_at = now() where id = p_id;
    update public.volunteers set can_drive = false, license_number = null, license_expires_on = null,
      notes = null, active = false where id = p_id;
    delete from public.availability_rules where volunteer_id = p_id;
    delete from public.availability_exceptions where volunteer_id = p_id;
    delete from public.shift_assignments sa using public.shifts s
     where sa.volunteer_id = p_id and s.id = sa.shift_id and s.starts_at >= now() and sa.status in ('proposto', 'confermato');
    delete from app.password_set where user_id = p_id;
    update public.audit_log set redacted = true, before = null, after = null
     where not redacted and table_name in ('profiles', 'volunteers', 'user_roles') and row_id = p_id::text;
  end if;
  return jsonb_build_object('retainedInvoices', '[]'::jsonb);
end $$;

revoke execute on function app.gdpr_export(text, uuid), app.anonymize_member(uuid), app.anonymize_user(uuid)
  from public, anon, authenticated;
grant execute on function app.gdpr_export(text, uuid), app.anonymize_member(uuid), app.anonymize_user(uuid)
  to authenticated;

-- The log is append-only: TRUNCATE would bypass the row triggers.
revoke truncate on public.audit_log from public, anon, authenticated, service_role;
