-- Review: service-mode writes (invite) must still record who acted.
-- The app.actor_* settings are honoured only when there is no JWT sub and the JWT role is service_role,
-- so an authenticated/anon caller cannot spoof them; the API sets them only in db.asService.
create or replace function app.audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare b jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
        a jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
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
