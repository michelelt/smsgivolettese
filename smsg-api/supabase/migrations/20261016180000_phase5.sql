-- Phase 5 (ADR-056): volunteers can respond only to open, future commitments.
create or replace function public.respond_shift_assignment(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  perform app.require_role('volontario');
  update public.shift_assignments a
     set status = case when p_accept then 'confermato' else 'rifiutato' end::public.assignment_status,
         responded_at = now()
   where a.id = p_id and a.volunteer_id = auth.uid() and a.status in ('proposto', 'confermato')
     and exists (select 1 from public.shifts s where s.id = a.shift_id and s.starts_at > now());
  if not found then
    if exists (select 1 from public.shift_assignments where id = p_id and volunteer_id = auth.uid()) then
      raise exception 'ASSIGNMENT_INVALID_TRANSITION';
    end if;
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;
end $$;

create or replace function public.respond_transport(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  perform app.require_role('volontario');
  if p_accept then
    update public.transports set status = 'confermato'
     where id = p_id and driver_volunteer_id = auth.uid() and status = 'assegnato'
       and travel_date >= (now() at time zone 'Europe/Rome')::date;
  else
    update public.transports set status = 'richiesto', driver_volunteer_id = null, vehicle_id = null
     where id = p_id and driver_volunteer_id = auth.uid() and status in ('assegnato', 'confermato')
       and travel_date >= (now() at time zone 'Europe/Rome')::date;
  end if;
  if not found then
    if exists (select 1 from public.transports where id = p_id and driver_volunteer_id = auth.uid()) then
      raise exception 'TRANSPORT_INVALID_TRANSITION';
    end if;
    raise exception 'TRANSPORT_NOT_FOUND';
  end if;
end $$;
