-- ADR-070: transports only. No bookings; odometer km; per-km invoice. Local data only: reset, no data migration.
do $$ begin
  if exists (select 1 from public.bookings) or exists (select 1 from public.transports) or exists (select 1 from public.invoices) then
    raise exception 'TRANSPORTS_ONLY_NEEDS_RESET';
  end if;
end $$;

-- Dependents first.
drop view public.volunteer_transports_v;
drop function public.issue_invoice(uuid, uuid[], text, text, public.payment_method);
drop function public.complete_transport(uuid, numeric, text);
drop function public.staff_org_info();
alter table public.invoice_lines drop column booking_id;

alter table public.services drop column price_cents, drop column requires_transport;

alter table public.transports
  drop column booking_id, drop column companion, drop column requested_by, drop column reason, drop column km,
  add column contact_phone text check (char_length(contact_phone) <= 40),
  add column mobility_aids boolean not null default false,
  add column companions smallint not null default 0 check (companions between 0 and 8),
  add column odometer_start int check (odometer_start between 0 and 9999999),
  add column odometer_end int check (odometer_end between 0 and 9999999),
  add column km int generated always as (odometer_end - odometer_start) stored,
  add column invoice_id uuid references public.invoices (id),
  add constraint transports_time_chk check (departure_at is not null or appointment_at is not null),
  add constraint transports_odometer_pair_chk check ((odometer_start is null) = (odometer_end is null)),
  add constraint transports_odometer_order_chk check (odometer_end >= odometer_start),
  add constraint transports_svolto_odometer_chk check (status <> 'svolto' or odometer_start is not null),
  add constraint transports_invoice_chk check (invoice_id is null or status = 'svolto');

drop table public.bookings;
drop function app.bookings_create_transport();
drop function app.bookings_sync_transport();
drop type public.booking_status;
drop type public.booking_origin;
drop type public.booking_slot;

create index transports_invoice_idx on public.transports (invoice_id) where invoice_id is not null;

alter table public.invoice_lines add column transport_id uuid references public.transports (id);
alter table public.org_settings add column km_rate_cents int not null default 0 check (km_rate_cents between 0 and 100000);

create or replace function public.complete_transport(p_id uuid, p_odometer_start int, p_odometer_end int, p_driver_notes text)
returns void
language plpgsql security definer set search_path = ''
as $$ begin
  perform app.require_role('volontario');
  update public.transports set status = 'svolto', odometer_start = p_odometer_start, odometer_end = p_odometer_end,
         driver_notes = p_driver_notes, completed_at = now()
   where id = p_id and driver_volunteer_id = auth.uid() and status in ('assegnato', 'confermato')
     and travel_date <= (now() at time zone 'Europe/Rome')::date;
  if not found then raise exception 'TRANSPORT_NOT_COMPLETABLE'; end if;
end $$;
revoke execute on function public.complete_transport(uuid, int, int, text) from public, anon;
grant execute on function public.complete_transport(uuid, int, int, text) to authenticated;

create function public.issue_invoice(
  p_transport_id uuid, p_amount_cents int, p_customer_tax_code text, p_customer_address text,
  p_payment_method public.payment_method default null
) returns public.invoices
language plpgsql security definer set search_path = ''
as $$
declare
  v_t public.transports; v_year smallint; v_n int; v_stamp int;
  v_org public.org_settings; v_mem public.members; v_inv public.invoices;
  v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  perform app.require_role('staff');
  select * into v_t from public.transports where id = p_transport_id and status = 'svolto' and invoice_id is null for update;
  if not found then raise exception 'TRANSPORT_NOT_INVOICEABLE'; end if;
  select * into v_mem from public.members where id = v_t.member_id for update;

  if p_customer_tax_code is not null and p_customer_tax_code is distinct from v_mem.tax_code then
    update public.members set tax_code = p_customer_tax_code where id = v_mem.id;
  end if;

  v_year := extract(year from now() at time zone 'Europe/Rome');
  insert into public.invoice_counters (year) values (v_year) on conflict do nothing;
  select last_number + 1 into v_n from public.invoice_counters where year = v_year for update;
  update public.invoice_counters set last_number = v_n where year = v_year;

  select * into v_org from public.org_settings;
  v_stamp := case when p_amount_cents > v_org.stamp_duty_threshold_cents then v_org.stamp_duty_amount_cents else 0 end;

  insert into public.invoices (year, number, issued_on, member_id, customer_name, customer_tax_code, customer_address,
    issuer_name, issuer_tax_code, issuer_address, vat_exemption_text, subtotal_cents, stamp_duty_cents, total_cents,
    status, payment_method, paid_on, created_by)
  values (v_year, v_n, v_today, v_mem.id, v_mem.first_name || ' ' || v_mem.last_name,
    coalesce(p_customer_tax_code, v_mem.tax_code),
    coalesce(p_customer_address,
      nullif(concat_ws(', ', v_mem.address, nullif(concat_ws(' ', v_mem.postal_code, v_mem.city), '')), '')),
    v_org.legal_name, v_org.tax_code, v_org.address, v_org.vat_exemption_text, p_amount_cents, v_stamp, p_amount_cents + v_stamp,
    case when p_payment_method is null then 'emessa' else 'pagata' end::public.invoice_status,
    p_payment_method, case when p_payment_method is not null then v_today end, auth.uid())
  returning * into v_inv;

  insert into public.invoice_lines (invoice_id, transport_id, position, description, amount_cents)
  values (v_inv.id, v_t.id, 1, 'Trasporto del ' || to_char(v_t.travel_date, 'DD/MM/YYYY') || ' (' || v_t.km || ' km)', p_amount_cents);

  update public.transports set invoice_id = v_inv.id where id = v_t.id;
  return v_inv;
end $$;
revoke execute on function public.issue_invoice(uuid, int, text, text, public.payment_method) from public, anon;
grant execute on function public.issue_invoice(uuid, int, text, text, public.payment_method) to authenticated;

create or replace function public.void_invoice(p_id uuid, p_reason text) returns public.invoices
language plpgsql security definer set search_path = ''
as $$
declare v_inv public.invoices;
begin
  perform app.require_role('staff');
  if coalesce(btrim(p_reason), '') = '' then raise exception 'VOID_REASON_REQUIRED'; end if;
  update public.invoices set status = 'annullata', voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
  where id = p_id and status in ('emessa', 'pagata') returning * into v_inv;
  if not found then raise exception 'INVOICE_NOT_VOIDABLE'; end if;
  update public.transports set invoice_id = null where invoice_id = p_id;
  return v_inv;
end $$;

create function public.staff_org_info() returns table (
  legal_name text, tax_code text, address text, membership_fee_cents int,
  stamp_duty_threshold_cents int, stamp_duty_amount_cents int, next_card_number int, km_rate_cents int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform app.require_role('staff');
  return query select o.legal_name, o.tax_code, o.address, o.membership_fee_cents,
    o.stamp_duty_threshold_cents, o.stamp_duty_amount_cents, o.last_card_number + 1, o.km_rate_cents
  from public.org_settings o;
end $$;
revoke execute on function public.staff_org_info() from public, anon;
grant execute on function public.staff_org_info() to authenticated;

create view public.volunteer_transports_v with (security_barrier = true) as
select t.id, t.travel_date, t.departure_at, t.appointment_at, t.return_at, t.from_address, t.to_address,
       t.wheelchair, t.mobility_aids, t.companions, t.status,
       t.odometer_start, t.odometer_end, t.km, t.driver_notes,
       m.first_name as member_first_name, m.last_name as member_last_name,
       -- phone only while the trip is open (minimisation)
       case when t.status <> 'svolto' then coalesce(t.contact_phone, m.phone) end as contact_phone,
       v.plate as vehicle_plate, v.model as vehicle_model
from public.transports t
join public.members m on m.id = t.member_id
left join public.vehicles v on v.id = t.vehicle_id
where t.driver_volunteer_id = auth.uid()
  and (t.status in ('assegnato', 'confermato')
       or (t.status = 'svolto' and t.travel_date >= (now() at time zone 'Europe/Rome')::date - 30));
revoke all on public.volunteer_transports_v from anon, authenticated;
grant select on public.volunteer_transports_v to authenticated;

-- gdpr_export / anonymize_member: same bodies as phase7 minus bookings; transports also lose contact_phone.
do $mig$
declare d text;
begin
  d := pg_get_functiondef('app.gdpr_export(text, uuid)'::regprocedure);
  d := regexp_replace(d, '\n\s*''bookings'', coalesce\(\(select jsonb_agg\(to_jsonb\(b\)[^\n]*\n', E'\n');
  if d like '%public.bookings%' then raise exception 'gdpr_export patch failed'; end if;
  execute d;
  d := pg_get_functiondef('app.anonymize_member(uuid)'::regprocedure);
  d := regexp_replace(d, '\n\s*update public\.bookings set notes = null where member_id = p_id;', '');
  d := replace(d, 'set requested_by = null, reason = null, notes = null', 'set contact_phone = null, notes = null');
  if d like '%bookings%' or d like '%requested_by%' then raise exception 'anonymize_member patch failed'; end if;
  execute d;
end $mig$;
