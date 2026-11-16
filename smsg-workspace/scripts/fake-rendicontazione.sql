-- Fake transports to try price bands, collected amount, pro forma and Rendicontazione (ADR-075). Local only.
-- Needs the demo data (make db-demo). Re-runnable: rows marked by notes = 'Prova rendicontazione' are replaced.
-- Logins: staff.esempio@example.test (staff), volontario.esempio@example.test (driver), password Esempio-Locale-123!

do $$ begin
  if not exists (select 1 from public.volunteers where id = 'a0000000-0000-4000-8000-000000000003') then
    raise exception 'Demo data missing: run make db-demo first';
  end if;
end $$;

delete from public.transports where notes = 'Prova rendicontazione' and invoice_id is null;

-- Demo prices (same as fixtures/demo.sql), set before inserting so the snapshot picks them up.
update public.org_settings set price_bands = '[
  {"upToKm": 20, "priceCents": 1000, "color": "#2E7D32", "label": "Verde"},
  {"upToKm": 30, "priceCents": 1500, "color": "#F9A825", "label": "Giallo"},
  {"upToKm": null, "priceCents": 2000, "color": "#C62828", "label": "Rosso"}]';

-- Svolti over this and last month: every band, the 20/30 km limits, discounts, not collected (null).
insert into public.transports (member_id, travel_date, departure_at, return_at, from_address, to_address, status,
  odometer_start, odometer_end, collected_cents, completed_at, driver_volunteer_id, vehicle_id, notes)
select m.id, current_date - v.d,
  ((current_date - v.d) + time '14:00') at time zone 'Europe/Rome',
  ((current_date - v.d) + time '16:00') at time zone 'Europe/Rome',
  'Via Esempio 1, Givoletto', v.dest, 'svolto', 20000 + v.d * 100, 20000 + v.d * 100 + v.km, v.collected, now(),
  'a0000000-0000-4000-8000-000000000003', (select id from public.vehicles where plate = 'AA000AA'),
  'Prova rendicontazione'
from (values
  -- days ago, member, km, collected cents (null = not collected), destination
  (1,  'Rossi (esempio)',    12, 1000, 'Ospedale di Rivoli'),
  (2,  'Gialli (esempio)',   20, 1000, 'Poliambulatorio di Pianezza'),  -- limit: still Verde
  (4,  'Esposito (esempio)', 21, 1500, 'Ospedale di Ciriè'),
  (5,  'Ferrari (esempio)',  30, 1200, 'Ospedale Maria Vittoria'),      -- limit: still Giallo, discount
  (6,  'Rossi (esempio)',    31, 2000, 'Ospedale CTO'),
  (7,  'Gialli (esempio)',   55, 1800, 'Ospedale San Luigi'),           -- discount
  (8,  'Esposito (esempio)',  8, null, 'Farmacia di Givoletto'),        -- not collected
  (9,  'Ferrari (esempio)',  25, 1500, 'Ospedale di Rivoli'),
  (10, 'Rossi (esempio)',     3, 0,    'Ambulatorio di Givoletto'),     -- free ride
  (12, 'Gialli (esempio)',   42, 2000, 'Ospedale Molinette'),
  (14, 'Esposito (esempio)', 17,  500, 'Poliambulatorio di Pianezza'),  -- discount
  (16, 'Ferrari (esempio)',  27, null, 'Ospedale di Ciriè'),            -- not collected
  (20, 'Rossi (esempio)',    33, 2000, 'Ospedale CTO'),
  (25, 'Gialli (esempio)',   19, 1000, 'Ospedale di Rivoli'),
  (32, 'Esposito (esempio)', 24, 1500, 'Ospedale Maria Vittoria'),
  (35, 'Ferrari (esempio)',  60, 1500, 'Ospedale San Luigi'),           -- discount
  (38, 'Rossi (esempio)',    11, 1000, 'Poliambulatorio di Pianezza'),
  (41, 'Gialli (esempio)',   29, 1500, 'Ospedale Molinette')
) v (d, last_name, km, collected, dest)
join public.members m on m.last_name = v.last_name;

-- Still open, assigned to the demo driver: close them from the volunteer agenda (or staff "Chiudi con i km").
insert into public.transports (member_id, travel_date, departure_at, return_at, from_address, to_address, status,
  driver_volunteer_id, vehicle_id, notes)
select m.id, current_date - v.d,
  ((current_date - v.d) + time '17:00') at time zone 'Europe/Rome',
  ((current_date - v.d) + time '19:00') at time zone 'Europe/Rome',
  'Via Esempio 2, Givoletto', 'Ospedale di Rivoli', v.st::public.transport_status,
  'a0000000-0000-4000-8000-000000000003', (select id from public.vehicles where plate = 'AA000AA'),
  'Prova rendicontazione'
from (values (0, 'Gialli (esempio)', 'confermato'), (1, 'Ferrari (esempio)', 'assegnato')) v (d, last_name, st)
join public.members m on m.last_name = v.last_name;

