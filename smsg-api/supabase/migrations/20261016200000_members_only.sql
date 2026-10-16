-- ADR-060: members only. Drop `clients`; bookings, transports and invoices point at `members`.
do $$ begin
  if exists (select 1 from public.clients) or exists (select 1 from public.bookings)
     or exists (select 1 from public.transports) or exists (select 1 from public.invoices) then
    raise exception 'MEMBERS_ONLY_NEEDS_RESET';
  end if;
end $$;

drop view public.volunteer_transports_v;

alter table public.bookings drop column client_id, drop column declared_member,
  add column member_id uuid not null references public.members (id);
alter table public.transports drop column client_id,
  add column member_id uuid not null references public.members (id);
alter table public.invoices drop column client_id,
  add column member_id uuid not null references public.members (id);
create index bookings_member_idx on public.bookings (member_id);
create index transports_member_idx on public.transports (member_id);
create index invoices_member_idx on public.invoices (member_id);

-- policies, audit trigger and indexes go with the table
drop table public.clients;

-- Single price. anon column grant (id, name, description, schedule_note, sort_order, active) is unaffected.
alter table public.services rename column member_price_cents to price_cents;
alter table public.services drop column non_member_price_cents;

-- Only an active member can get new bookings/transports (existing ones stay executable/invoiceable).
create function app.require_active_member() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.members where id = new.member_id and status = 'attivo') then
    raise exception 'MEMBER_NOT_ACTIVE';
  end if;
  return new;
end $$;
create trigger require_active_member before insert on public.bookings
  for each row execute function app.require_active_member();
create trigger require_active_member before insert on public.transports
  for each row execute function app.require_active_member();

-- Who was served never changes (cancel and re-create); the RLS update policies would otherwise allow it.
create or replace function app.member_immutable() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'MEMBER_IMMUTABLE';
end $$;
revoke execute on function app.member_immutable() from public;
create trigger member_immutable before update of member_id on public.bookings
  for each row when (new.member_id is distinct from old.member_id)
  execute function app.member_immutable();
create trigger member_immutable before update of member_id on public.transports
  for each row when (new.member_id is distinct from old.member_id)
  execute function app.member_immutable();

-- bookings_sync_transport only touches transports by booking_id: unchanged.
create or replace function app.bookings_create_transport() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if exists (select 1 from public.services where id = new.service_id and requires_transport) then
    insert into public.transports (member_id, travel_date, booking_id, created_by)
    values (new.member_id, new.day, new.id, new.created_by);
  end if;
  return new;
end $$;

-- L4 (30-day rule) kept; the driver sees only the member's name and phone.
create view public.volunteer_transports_v with (security_barrier = true) as
select t.id, t.travel_date, t.departure_at, t.appointment_at, t.return_at, t.from_address, t.to_address,
       t.wheelchair, t.companion, t.status, t.km, t.driver_notes,
       m.first_name as member_first_name, m.last_name as member_last_name, m.phone as member_phone,
       v.plate as vehicle_plate, v.model as vehicle_model
from public.transports t
join public.members m on m.id = t.member_id
left join public.vehicles v on v.id = t.vehicle_id
where t.driver_volunteer_id = auth.uid()
  and (t.status in ('assegnato', 'confermato') or (t.status = 'svolto' and t.travel_date >= current_date - 30));
revoke all on public.volunteer_transports_v from anon, authenticated;
grant select on public.volunteer_transports_v to authenticated;

drop function public.issue_invoice(uuid, uuid[], text, text, public.payment_method);
create function public.issue_invoice(
  p_member_id uuid, p_booking_ids uuid[], p_customer_tax_code text, p_customer_address text,
  p_payment_method public.payment_method default null
) returns public.invoices
language plpgsql security definer set search_path = ''
as $$
declare
  v_want int := cardinality(array(select distinct unnest(p_booking_ids)));
  v_found int; v_sub int; v_year smallint; v_n int; v_stamp int;
  v_org public.org_settings; v_mem public.members; v_inv public.invoices;
  v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  perform app.require_role('staff');
  select * into v_mem from public.members where id = p_member_id for update;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;

  select count(*), coalesce(sum(price_applied_cents), 0) into v_found, v_sub from (
    select b.price_applied_cents from public.bookings b
    where b.id = any(p_booking_ids) and b.member_id = p_member_id and b.status = 'eseguita' and b.invoice_id is null
    for update) locked;
  if v_want = 0 or v_found <> v_want then raise exception 'BOOKINGS_NOT_INVOICEABLE'; end if;

  -- a tax code typed at invoicing is kept on the member (an address is not)
  if p_customer_tax_code is not null and p_customer_tax_code is distinct from v_mem.tax_code then
    update public.members set tax_code = p_customer_tax_code where id = p_member_id;
  end if;

  v_year := extract(year from now() at time zone 'Europe/Rome');
  insert into public.invoice_counters (year) values (v_year) on conflict do nothing;
  select last_number + 1 into v_n from public.invoice_counters where year = v_year for update;
  update public.invoice_counters set last_number = v_n where year = v_year;

  select * into v_org from public.org_settings;
  v_stamp := case when v_sub > v_org.stamp_duty_threshold_cents then v_org.stamp_duty_amount_cents else 0 end;

  insert into public.invoices (year, number, issued_on, member_id, customer_name, customer_tax_code, customer_address,
    issuer_name, issuer_tax_code, issuer_address, vat_exemption_text, subtotal_cents, stamp_duty_cents, total_cents,
    status, payment_method, paid_on, created_by)
  values (v_year, v_n, v_today, p_member_id, v_mem.first_name || ' ' || v_mem.last_name,
    coalesce(p_customer_tax_code, v_mem.tax_code),
    coalesce(p_customer_address,
      nullif(concat_ws(', ', v_mem.address, nullif(concat_ws(' ', v_mem.postal_code, v_mem.city), '')), '')),
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
revoke execute on function public.issue_invoice(uuid, uuid[], text, text, public.payment_method) from public, anon;
grant execute on function public.issue_invoice(uuid, uuid[], text, text, public.payment_method) to authenticated;
revoke execute on function app.require_active_member() from public, anon, authenticated;
