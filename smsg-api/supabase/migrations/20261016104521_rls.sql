-- Phase 2a: RLS (docs/permissions.md). Absent policy = denied. Mirror of api/src/auth/permissions.ts.

-- anon: nothing except the four public tables
revoke all on all tables in schema public from anon;
grant select on public.services, public.posts, public.site_settings, public.media to anon;
-- authenticated keeps the default table grants; RLS decides. Views: explicit.
revoke all on public.volunteer_transports_v from anon, authenticated;
grant select on public.volunteer_transports_v to authenticated;
revoke all on public.shift_coverage from anon;
revoke all on all sequences in schema public from anon;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Shorthands used below: (select app.has_role('x')) is evaluated once per statement.

-- Identity
create policy profiles_select on public.profiles for select to authenticated
  using ((select app.has_role('staff')) or ((select app.has_role('volontario')) and id = (select auth.uid())));
create policy profiles_update on public.profiles for update to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));

create policy user_roles_select on public.user_roles for select to authenticated
  using ((select app.has_role('staff')) or ((select app.has_role('volontario')) and user_id = (select auth.uid())));
create policy user_roles_insert on public.user_roles for insert to authenticated with check ((select app.has_role('super_admin')));
create policy user_roles_update on public.user_roles for update to authenticated
  using ((select app.has_role('super_admin'))) with check ((select app.has_role('super_admin')));
create policy user_roles_delete on public.user_roles for delete to authenticated using ((select app.has_role('super_admin')));

-- Volunteers
create policy volunteers_select on public.volunteers for select to authenticated
  using ((select app.has_role('staff')) or ((select app.has_role('volontario')) and id = (select auth.uid())));
create policy volunteers_insert on public.volunteers for insert to authenticated with check ((select app.has_role('staff')));
create policy volunteers_update on public.volunteers for update to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));

create policy vehicles_all on public.vehicles for all to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));

do $$
declare t text;
begin
  foreach t in array array['availability_rules', 'availability_exceptions'] loop
    execute format($f$create policy %1$s_select on public.%1$s for select to authenticated
      using ((select app.has_role('staff')) or ((select app.has_role('volontario')) and volunteer_id = (select auth.uid())))$f$, t);
    execute format($f$create policy %1$s_insert on public.%1$s for insert to authenticated
      with check ((select app.has_role('super_admin')) or ((select app.has_role('volontario')) and volunteer_id = (select auth.uid())))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$s for update to authenticated
      using ((select app.has_role('super_admin')) or ((select app.has_role('volontario')) and volunteer_id = (select auth.uid())))
      with check ((select app.has_role('super_admin')) or ((select app.has_role('volontario')) and volunteer_id = (select auth.uid())))$f$, t);
    execute format($f$create policy %1$s_delete on public.%1$s for delete to authenticated
      using ((select app.has_role('super_admin')) or ((select app.has_role('volontario')) and volunteer_id = (select auth.uid())))$f$, t);
  end loop;
end $$;

-- Shifts
create policy shift_types_select on public.shift_types for select to authenticated using ((select app.has_role('volontario')));
create policy shift_types_write on public.shift_types for all to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));

create policy shifts_select on public.shifts for select to authenticated
  using ((select app.has_role('staff')) or ((select app.has_role('volontario')) and exists (
    select 1 from public.shift_assignments sa where sa.shift_id = shifts.id and sa.volunteer_id = (select auth.uid()))));
create policy shifts_write on public.shifts for all to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));

create policy shift_assignments_select on public.shift_assignments for select to authenticated
  using ((select app.has_role('staff')) or ((select app.has_role('volontario')) and volunteer_id = (select auth.uid())));
create policy shift_assignments_write on public.shift_assignments for all to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));

create policy volunteer_commitments_select on public.volunteer_commitments for select to authenticated
  using ((select app.has_role('staff')));

-- Transports, clients, bookings: staff S/I/U (no delete: cancel = status)
create policy transports_select on public.transports for select to authenticated using ((select app.has_role('staff')));
create policy transports_insert on public.transports for insert to authenticated with check ((select app.has_role('staff')));
create policy transports_update on public.transports for update to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));

create policy clients_select on public.clients for select to authenticated using ((select app.has_role('staff')));
create policy clients_insert on public.clients for insert to authenticated with check ((select app.has_role('staff')));
create policy clients_update on public.clients for update to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));

create policy bookings_select on public.bookings for select to authenticated using ((select app.has_role('staff')));
create policy bookings_insert on public.bookings for insert to authenticated with check ((select app.has_role('staff')));
create policy bookings_update on public.bookings for update to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));

-- Services: public sees active; staff everything
create policy services_select_public on public.services for select to anon, authenticated using (active);
create policy services_select_staff on public.services for select to authenticated using ((select app.has_role('staff')));
create policy services_insert on public.services for insert to authenticated with check ((select app.has_role('staff')));
create policy services_update on public.services for update to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));
create policy services_delete on public.services for delete to authenticated using ((select app.has_role('staff')));

-- Members (insert via register_member only)
create policy members_select on public.members for select to authenticated using ((select app.has_role('staff')));
create policy members_update on public.members for update to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));

create policy membership_fees_select on public.membership_fees for select to authenticated using ((select app.has_role('staff')));
create policy membership_fees_insert on public.membership_fees for insert to authenticated with check ((select app.has_role('staff')));
create policy membership_fees_update on public.membership_fees for update to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));
create policy membership_fees_delete on public.membership_fees for delete to authenticated using ((select app.has_role('super_admin')));

-- Invoices (insert via issue_invoice only; trigger limits updates)
create policy invoices_select on public.invoices for select to authenticated using ((select app.has_role('staff')));
create policy invoices_update on public.invoices for update to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));
create policy invoice_lines_select on public.invoice_lines for select to authenticated using ((select app.has_role('staff')));
create policy invoice_counters_select on public.invoice_counters for select to authenticated using ((select app.has_role('staff')));

-- Bacheca
create policy posts_select_public on public.posts for select to anon, authenticated
  using (status = 'pubblicata' and published_at <= now());
create policy posts_select_staff on public.posts for select to authenticated using ((select app.has_role('staff')));
create policy posts_insert on public.posts for insert to authenticated with check ((select app.has_role('staff')));
create policy posts_update on public.posts for update to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));
create policy posts_delete on public.posts for delete to authenticated using ((select app.has_role('staff')));

create policy post_proposals_select on public.post_proposals for select to authenticated using ((select app.has_role('staff')));
create policy post_proposals_update on public.post_proposals for update to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));
create policy post_proposals_delete on public.post_proposals for delete to authenticated using ((select app.has_role('super_admin')));

create policy media_select_public on public.media for select to anon, authenticated using (bucket = 'media');
create policy media_select_staff on public.media for select to authenticated using ((select app.has_role('staff')));
create policy media_insert on public.media for insert to authenticated with check ((select app.has_role('staff')));
create policy media_delete on public.media for delete to authenticated using ((select app.has_role('staff')));

-- Settings, audit
create policy site_settings_select on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_update on public.site_settings for update to authenticated
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));
create policy org_settings_select on public.org_settings for select to authenticated using ((select app.has_role('super_admin')));
create policy org_settings_update on public.org_settings for update to authenticated
  using ((select app.has_role('super_admin'))) with check ((select app.has_role('super_admin')));
create policy audit_log_select on public.audit_log for select to authenticated using ((select app.has_role('super_admin')));
-- rate_limit_hits: RLS on, no policy (service only)
