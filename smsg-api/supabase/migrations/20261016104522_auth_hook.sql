-- Custom Access Token Hook: puts app_role into the JWT (enabled in config.toml). Active users only.
create function app.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare r public.app_role; claims jsonb := event -> 'claims';
begin
  select ur.role into r from public.user_roles ur join public.profiles p on p.id = ur.user_id
   where ur.user_id = (event ->> 'user_id')::uuid and p.active;
  if r is null then claims := claims - 'app_role';
  else claims := jsonb_set(claims, '{app_role}', to_jsonb(r::text));
  end if;
  return jsonb_set(event, '{claims}', claims);
end $$;

revoke execute on function app.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant usage on schema app to supabase_auth_admin;
grant execute on function app.custom_access_token_hook(jsonb) to supabase_auth_admin;
