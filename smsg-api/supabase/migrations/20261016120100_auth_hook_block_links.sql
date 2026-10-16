-- H2: staff and super_admin never get a session from magic link / recovery (GoTrue reports both, and invite,
-- as method `otp`). Exception: an account with no password yet (first invite) may enter to set one.
-- Refresh is covered too: the session's amr (claims.amr) keeps the original method.
-- Observed authentication_method values: password, otp (magiclink, recovery, invite, email OTP), token_refresh.
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
    if via_link and exists (select 1 from auth.users u where u.id = uid and coalesce(u.encrypted_password, '') <> '') then
      return jsonb_build_object('error', jsonb_build_object('http_code', 403,
        'message', 'Accesso con link non consentito per questo ruolo: usa email e password.'));
    end if;
  end if;
  if r is null then claims := claims - 'app_role';
  else claims := jsonb_set(claims, '{app_role}', to_jsonb(r::text));
  end if;
  return jsonb_set(event, '{claims}', claims);
end $$;
