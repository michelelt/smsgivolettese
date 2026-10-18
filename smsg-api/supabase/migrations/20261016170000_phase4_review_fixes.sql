-- Phase 4 review: audit more tables, payment date sanity.
create trigger audit after insert or update or delete on public.clients
  for each row execute function app.audit();
create trigger audit after insert or update or delete on public.services
  for each row execute function app.audit();
create trigger audit after insert or update or delete on public.site_settings
  for each row execute function app.audit();

alter table public.invoices
  add constraint invoices_paid_on_after_issued check (paid_on is null or paid_on >= issued_on);

-- CHECK cannot use now(); 23514 maps to VALIDATION_ERROR. Only on change, so old rows stay editable.
create function app.paid_on_not_future() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.paid_on > (now() at time zone 'Europe/Rome')::date
     and (tg_op = 'INSERT' or new.paid_on is distinct from old.paid_on) then
    raise exception 'PAID_ON_IN_FUTURE' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger paid_on_not_future before insert or update on public.invoices
  for each row execute function app.paid_on_not_future();
create trigger paid_on_not_future before insert or update on public.membership_fees
  for each row execute function app.paid_on_not_future();
