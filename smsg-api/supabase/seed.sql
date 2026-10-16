-- Demo data: obviously fake, local only. Demo logins (password for all: Esempio-Locale-123!):
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
insert into public.services (name, description, price_cents, schedule_note, requires_transport, sort_order) values
  ('Misurazione pressione (esempio)', 'Servizio di esempio', 0, 'martedì mattina', false, 1),
  ('Prelievi (esempio)', 'Servizio di esempio', 500, 'giovedì mattina', false, 2),
  ('Accompagnamento (esempio)', 'Servizio di esempio', 1000, 'su richiesta', true, 3);
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
  ('festa-di-esempio', 'Festa di esempio', 'evento', '[]', 'Evento fittizio per il sito.', 'pubblicata', now());
update public.site_settings set slogan = 'Sito di esempio', vat_number = '00000000000',
  conventions = '[{"title":"Farmacia di esempio","description":"Sconto per i soci (esempio)","url":"https://example.test/farmacia"},{"title":"Ottica di esempio","description":"Convenzione fittizia"}]',
  footer_links = '[{"group":"associazioni","label":"Pro Loco (esempio)","url":"https://example.test/proloco"},
    {"group":"associazioni","label":"Croce Esempio","url":"https://example.test/croce"},
    {"group":"mutuo_soccorso","label":"Federazione mutuo soccorso (esempio)","url":"https://example.test/federazione"},
    {"group":"mutuo_soccorso","label":"Società di mutuo soccorso vicina (esempio)","url":"https://example.test/sms"},
    {"group":"utili","label":"Comune di esempio","url":"https://example.test/comune"},
    {"group":"utili","label":"ASL di esempio","url":"https://example.test/asl"}]';

insert into public.bookings (member_id, service_id, day, slot, price_applied_cents, origin, status, executed_at)
select c.id, s.id, current_date + d.off, 'mattina', s.price_cents, 'telefono', d.st::public.booking_status,
  case when d.st = 'eseguita' then now() end
from public.members c, public.services s,
  (values (1, 'attesa'), (-7, 'eseguita'), (-3, 'eseguita')) d (off, st)
where c.last_name = 'Rossi (esempio)' and s.name = 'Prelievi (esempio)';

-- Page texts (ADR-061): same copy as the migration default, placeholders included.
update public.site_settings set pages = $pages${
  "home": {
    "servicesButton": "I nostri servizi",
    "whereButton": "Dove siamo",
    "quote": "Le Società di Mutuo Soccorso non hanno finalità di lucro, ma perseguono finalità di interesse generale, sulla base del principio costituzionale di sussidiarietà.",
    "quoteSource": "Legge 15 aprile 1886, n. 3818, articolo 1"
  },
  "chiSiamo": {
    "title": "Una società di persone che si aiutano",
    "intro": "La Società di Mutuo Soccorso Givolettese fa parte di una lunga tradizione piemontese: lavoratori e famiglie che, versando una piccola quota, si sostengono a vicenda nei momenti di bisogno.\n\nOggi questo aiuto prende la forma di servizi sanitari per i soci, accompagnamenti, attività culturali e ricreative, e di un luogo dove ritrovarsi.",
    "sections": [
      {
        "heading": "Senza scopo di lucro",
        "body": "Ogni euro raccolto torna ai soci sotto forma di servizi e sostegno."
      },
      {
        "heading": "Porta aperta",
        "body": "Chiunque può iscriversi. Una volta soci, non si viene esclusi per età o per salute."
      },
      {
        "heading": "Decidono i soci",
        "body": "L'assemblea dei soci elegge il consiglio e approva il bilancio ogni anno."
      }
    ]
  },
  "privacy": {
    "title": "Informativa sulla privacy",
    "intro": "Testo provvisorio. L'informativa completa sarà pubblicata prima dell'apertura del sito.",
    "sections": [
      {
        "heading": "Titolare del trattamento",
        "body": "Società di Mutuo Soccorso Givolettese, Givoletto."
      },
      {
        "heading": "Dati raccolti da questo sito",
        "body": "Il sito pubblico è solo informativo: non raccoglie dati personali dei visitatori."
      },
      {
        "heading": "Per quanto tempo",
        "body": "[Da definire.]"
      },
      {
        "heading": "I suoi diritti",
        "body": "Può chiedere di vedere, correggere o cancellare i suoi dati rivolgendosi alla sede."
      }
    ]
  },
  "servizi": {
    "title": "I nostri servizi",
    "intro": ""
  },
  "convenzioni": {
    "title": "Convenzioni",
    "intro": ""
  },
  "doveSiamo": {
    "title": "Dove siamo",
    "intro": ""
  }
}$pages$::jsonb;
