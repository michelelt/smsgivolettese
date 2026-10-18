-- ADR-072: staff manage org settings (fee, km rate, issuer data) and the card/invoice counters.
-- Super admin keeps user management, audit log and GDPR.
alter policy org_settings_select on public.org_settings using ((select app.has_role('staff')));
alter policy org_settings_update on public.org_settings
  using ((select app.has_role('staff'))) with check ((select app.has_role('staff')));

create or replace function app.set_member_counter(n int) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  perform app.require_role('staff');
  update public.org_settings set last_card_number = n;
end $$;

create or replace function app.set_invoice_counter(p_year smallint, n int) returns void
language plpgsql security definer set search_path = ''
as $$
declare cur int;
begin
  perform app.require_role('staff');
  insert into public.invoice_counters (year) values (p_year) on conflict do nothing;
  select last_number into cur from public.invoice_counters where year = p_year for update;
  if n < greatest(cur, coalesce((select max(number) from public.invoices where year = p_year), 0)) then
    raise exception 'COUNTER_BELOW_MAX';
  end if;
  update public.invoice_counters set last_number = n where year = p_year;
end $$;
