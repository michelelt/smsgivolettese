-- Demo data for tests only (make test, make e2e): obviously fake, local only, loaded after seed.sql.
-- Demo logins (password for all: Esempio-Locale-123!):
--   admin.esempio@example.test (super_admin), staff.esempio@example.test (staff),
--   volontario.esempio@example.test (volontario), volontario2.esempio@example.test (volontario)

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Esempio-Locale-123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin.esempio@example.test'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'staff.esempio@example.test'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'volontario.esempio@example.test'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'volontario2.esempio@example.test')) u (id, email);

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
from auth.users where email like '%.esempio@example.test';

insert into public.profiles (id, first_name, last_name, email, phone) values
  ('a0000000-0000-4000-8000-000000000001', 'Anna', 'Bianchi (esempio)', 'admin.esempio@example.test', '0000000001'),
  ('a0000000-0000-4000-8000-000000000002', 'Luca', 'Verdi (esempio)', 'staff.esempio@example.test', '0000000002'),
  ('a0000000-0000-4000-8000-000000000003', 'Mario', 'Rossi (esempio)', 'volontario.esempio@example.test', '0000000003'),
  ('a0000000-0000-4000-8000-000000000004', 'Giulia', 'Neri (esempio)', 'volontario2.esempio@example.test', '0000000004');
insert into public.user_roles (user_id, role) values
  ('a0000000-0000-4000-8000-000000000001', 'super_admin'),
  ('a0000000-0000-4000-8000-000000000002', 'staff'),
  ('a0000000-0000-4000-8000-000000000003', 'volontario'),
  ('a0000000-0000-4000-8000-000000000004', 'volontario');
insert into public.volunteers (id, license_number, license_expires_on, can_drive) values
  ('a0000000-0000-4000-8000-000000000003', 'ESEMPIO0001', current_date + 700, true),
  ('a0000000-0000-4000-8000-000000000004', null, null, false);

insert into public.vehicles (plate, model, seats, wheelchair_accessible) values
  ('AA000AA', 'Fiat Doblò (esempio)', 5, true), ('BB111BB', 'Fiat Panda (esempio)', 4, false);
insert into public.shift_types (name, sort_order) values
  ('Sede', 1), ('Centralino', 2), ('Ambulatorio', 3), ('Accompagnamento', 4);
insert into public.services (name, description, schedule_note, sort_order) values
  ('Misurazione pressione (esempio)', 'Servizio di esempio', 'martedì mattina', 1),
  ('Prelievi (esempio)', 'Servizio di esempio', 'giovedì mattina', 2),
  ('Accompagnamento (esempio)', 'Servizio di esempio', 'su richiesta', 3);
update public.org_settings set km_rate_cents = 35;
insert into public.members (card_number, first_name, last_name, joined_on) values
  (1, 'Maria', 'Esposito (esempio)', current_date - 400), (2, 'Carlo', 'Ferrari (esempio)', current_date - 200);
insert into public.members (card_number, first_name, last_name, phone, address, joined_on)
select 2 + row_number() over (), f, l, ph, a, current_date - 100
from (values ('Mario', 'Rossi (esempio)', '3330000001', 'Via Esempio 1, Givoletto'),
             ('Rosa', 'Gialli (esempio)', '3330000002', 'Via Esempio 2, Givoletto')) v (f, l, ph, a);
update public.org_settings set last_card_number = (select max(card_number) from public.members);
insert into public.shifts (shift_type_id, starts_at, ends_at, required_slots)
select id, date_trunc('day', now()) + interval '2 days 9 hours', date_trunc('day', now()) + interval '2 days 12 hours', 2
from public.shift_types where name = 'Sede';
insert into public.shift_assignments (shift_id, volunteer_id, status)
select id, 'a0000000-0000-4000-8000-000000000003', 'proposto' from public.shifts;
insert into public.posts (slug, title, category, content, excerpt, status, published_at) values
  ('festa-di-esempio', 'Festa di esempio', 'avviso', $b$[
    {"id":"b1","type":"heading","props":{"level":1},"content":[{"type":"text","text":"Titolo di esempio","styles":{}}],"children":[]},
    {"id":"b2","type":"paragraph","props":{},"content":[{"type":"text","text":"Testo ","styles":{"bold":true}},{"type":"link","href":"https://example.test","content":[{"type":"text","text":"con un link (esempio)","styles":{}}]}],"children":[]},
    {"id":"b3","type":"quote","props":{},"content":[{"type":"text","text":"Citazione fittizia","styles":{"italic":true}}],"children":[]},
    {"id":"b4","type":"bulletListItem","props":{},"content":[{"type":"text","text":"Elemento uno","styles":{}}],"children":[{"id":"b5","type":"bulletListItem","props":{},"content":[{"type":"text","text":"Sotto-elemento","styles":{}}],"children":[]}]},
    {"id":"b6","type":"numberedListItem","props":{},"content":[{"type":"text","text":"Primo passo","styles":{}}],"children":[]},
    {"id":"b7","type":"video","props":{"source":"youtube","src":"dQw4w9WgXcQ","caption":"Video di esempio"},"children":[]},
    {"id":"b8","type":"buttonLink","props":{"label":"Pulsante di esempio","href":"/chi-siamo"},"children":[]},
    {"id":"b9","type":"divider","props":{},"children":[]}
  ]$b$, 'Titolo di esempio Testo con un link (esempio) Citazione fittizia', 'pubblicata', now());
insert into public.posts (slug, title, category, event_date, location, content, excerpt, status, published_at) values
  ('gita-di-esempio', 'Gita di esempio', 'evento', current_date + 14, 'Sede (esempio)',
   '[{"id":"e1","type":"paragraph","props":{},"content":[{"type":"text","text":"Evento fittizio per il sito.","styles":{}}],"children":[]}]',
   'Evento fittizio per il sito.', 'pubblicata', now());
insert into public.post_proposals (title, category, body, submitter_name, submitter_contact) values
  ('Proposta di esempio', 'notizia', 'Testo fittizio di una proposta in attesa.', 'Mario Rossi (esempio)', 'mario@example.test');

insert into public.transports (member_id, travel_date, departure_at, from_address, to_address, status, odometer_start, odometer_end, completed_at,
  driver_volunteer_id, vehicle_id)
select m.id, current_date + 1, (current_date + 1) + time '08:30', 'Via Esempio 1, Givoletto', 'Ospedale di esempio', 'richiesto', null, null, null, null, null
from public.members m where m.last_name = 'Rossi (esempio)';
insert into public.transports (member_id, travel_date, departure_at, from_address, to_address, status, odometer_start, odometer_end, completed_at,
  driver_volunteer_id, vehicle_id)
select m.id, current_date - 3, (current_date - 3) + time '08:30', 'Via Esempio 1, Givoletto', 'Ospedale di esempio', 'svolto', 10000, 10042, now(),
  'a0000000-0000-4000-8000-000000000003', (select id from public.vehicles where plate = 'AA000AA')
from public.members m where m.last_name = 'Rossi (esempio)';
