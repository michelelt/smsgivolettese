-- Follow-up to 20261016120100. GoTrue sets a RANDOM password when it verifies an invite, so
-- "encrypted_password is empty" is not a usable signal. Track real passwords explicitly instead:
-- app.password_set gets a row when a password is inserted, or set on an already-confirmed user
-- (PUT /user); the random one is set while the invite is being confirmed, so it is not recorded.
-- A staff/super_admin without a row may enter by link only to set a password: the token carries NO app_role.
create table app.password_set (user_id uuid primary key);
alter table app.password_set enable row level security;
revoke all on app.password_set from public, anon, authenticated;

create function app.track_password_set() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(new.encrypted_password, '') <> ''
     and (tg_op = 'INSERT' or (new.encrypted_password is distinct from old.encrypted_password and old.email_confirmed_at is not null))
  then insert into app.password_set values (new.id) on conflict do nothing;
  end if;
  return null;
end $$;
revoke execute on function app.track_password_set() from public, anon, authenticated;
create trigger track_password_set after insert or update of encrypted_password on auth.users
  for each row execute function app.track_password_set();

insert into app.password_set select id from auth.users where coalesce(encrypted_password, '') <> '';

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
      ) x where m is not null and m not in ('password', 'token_refresh'))
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
