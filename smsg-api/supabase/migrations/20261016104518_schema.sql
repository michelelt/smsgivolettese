-- Phase 2a: schema (docs/data-model.md). Functions/triggers, RLS and the auth hook follow in later migrations.
create extension if not exists btree_gist with schema extensions;
create extension if not exists moddatetime with schema extensions;
create schema if not exists app;

-- Enums (values are Italian domain vocabulary; app_role order matters)
create type public.app_role as enum ('volontario', 'staff', 'super_admin');
create type public.assignment_status as enum ('proposto', 'confermato', 'rifiutato');
create type public.transport_status as enum ('richiesto', 'assegnato', 'confermato', 'svolto', 'annullato');
create type public.booking_status as enum ('attesa', 'confermata', 'eseguita', 'annullata');
create type public.booking_origin as enum ('online', 'telefono');
create type public.booking_slot as enum ('mattina', 'pomeriggio');
create type public.member_type as enum ('ordinario', 'familiare', 'sostenitore', 'onorario');
create type public.member_status as enum ('attivo', 'cessato');
create type public.member_end_reason as enum ('dimissioni', 'decesso', 'mancato_pagamento', 'esclusione', 'trasferimento');
create type public.payment_method as enum ('contanti', 'pos', 'bonifico');
create type public.invoice_status as enum ('emessa', 'pagata', 'annullata');
create type public.post_category as enum ('evento', 'avviso', 'notizia');
create type public.post_status as enum ('bozza', 'pubblicata');
create type public.proposal_status as enum ('attesa', 'pubblicata', 'rifiutata');
create type public.availability_exception_kind as enum ('assente', 'extra');
create type public.audit_action as enum ('insert', 'update', 'delete');

-- Identity
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  active boolean not null default true,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references public.profiles (id),
  role public.app_role not null,
  updated_at timestamptz not null default now()
);

-- Volunteers
create table public.volunteers (
  id uuid primary key references public.profiles (id),
  license_number text,
  license_expires_on date,
  can_drive boolean not null default false,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not can_drive or license_expires_on is not null)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique check (plate = upper(replace(plate, ' ', ''))),
  model text not null,
  seats smallint not null check (seats between 1 and 9),
  wheelchair_accessible boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (valid_to >= valid_from)
);
create index availability_rules_volunteer_weekday_idx on public.availability_rules (volunteer_id, weekday);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  start_time time,
  end_time time,
  kind public.availability_exception_kind not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check ((start_time is null) = (end_time is null))
);
create index availability_exceptions_volunteer_idx on public.availability_exceptions (volunteer_id, starts_on);

create table public.shift_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  sort_order int not null default 0
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  shift_type_id uuid not null references public.shift_types (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  required_slots smallint not null check (required_slots >= 1),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index shifts_starts_at_idx on public.shifts (starts_at);

create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  volunteer_id uuid not null references public.volunteers (id),
  status public.assignment_status not null default 'proposto',
  responded_at timestamptz,
  assigned_by uuid references public.profiles (id),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, volunteer_id)
);
create index shift_assignments_volunteer_idx on public.shift_assignments (volunteer_id);

create view public.shift_coverage with (security_invoker = true) as
select s.id as shift_id,
       count(sa.id) filter (where sa.status in ('proposto', 'confermato')) as filled,
       s.required_slots,
       case
         when count(sa.id) filter (where sa.status in ('proposto', 'confermato')) = 0 then 'scoperto'
         when count(sa.id) filter (where sa.status in ('proposto', 'confermato')) >= s.required_slots then 'coperto'
         else 'parziale'
       end as coverage
from public.shifts s
left join public.shift_assignments sa on sa.shift_id = s.id
group by s.id;

-- Members
create table public.members (
  id uuid primary key default gen_random_uuid(),
  card_number int not null unique,
  first_name text not null,
  last_name text not null,
  tax_code text unique check (tax_code ~ '^[A-Z0-9]{16}$'),
  birth_date date,
  birth_place text,
  address text,
  postal_code text check (postal_code ~ '^\d{5}$'),
  city text,
  phone text,
  email text,
  member_type public.member_type not null default 'ordinario',
  joined_on date not null,
  status public.member_status not null default 'attivo',
  ended_on date,
  end_reason public.member_end_reason,
  privacy_signed_on date,
  notes text,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'cessato') = (ended_on is not null))
);
create index members_name_idx on public.members (last_name, first_name);

create table public.membership_fees (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  year smallint not null check (year between 2000 and 2100),
  amount_cents int not null check (amount_cents >= 0),
  paid_on date not null,
  method public.payment_method not null,
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (member_id, year)
);

-- Clients, services
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  phone_normalized text generated always as (regexp_replace(phone, '\D', '', 'g')) stored,
  tax_code text check (tax_code ~ '^[A-Z0-9]{16}$'),
  address text,
  notes text,
  member_id uuid unique references public.members (id),
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_phone_idx on public.clients (phone_normalized);
create index clients_last_name_idx on public.clients (lower(last_name));
create index clients_tax_code_idx on public.clients (tax_code);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  member_price_cents int not null check (member_price_cents >= 0),
  non_member_price_cents int not null check (non_member_price_cents >= 0),
  schedule_note text,
  active boolean not null default true,
  bookable boolean not null default true,
  requires_transport boolean not null default false,
  sort_order int not null default 99,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Invoices
create table public.invoice_counters (
  year smallint primary key,
  last_number int not null default 0 check (last_number >= 0)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  year smallint not null,
  number int not null,
  issued_on date not null,
  client_id uuid not null references public.clients (id),
  customer_name text not null,
  customer_tax_code text,
  customer_address text,
  issuer_name text not null,
  issuer_tax_code text,
  issuer_address text,
  vat_exemption_text text not null,
  subtotal_cents int not null check (subtotal_cents >= 0),
  stamp_duty_cents int not null check (stamp_duty_cents >= 0),
  total_cents int not null,
  status public.invoice_status not null,
  payment_method public.payment_method,
  paid_on date,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, number),
  check (total_cents = subtotal_cents + stamp_duty_cents),
  check (status <> 'pagata' or (payment_method is not null and paid_on is not null)),
  check (status <> 'annullata' or voided_at is not null)
);
create index invoices_client_idx on public.invoices (client_id);
create index invoices_status_idx on public.invoices (status);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  service_id uuid not null references public.services (id),
  day date not null,
  slot public.booking_slot not null,
  time time,
  declared_member boolean not null,
  price_applied_cents int not null check (price_applied_cents >= 0),
  origin public.booking_origin not null,
  status public.booking_status not null default 'attesa',
  notes text,
  invoice_id uuid references public.invoices (id),
  executed_at timestamptz,
  cancelled_by text check (cancelled_by in ('staff', 'utente')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (invoice_id is null or status = 'eseguita')
);
create index bookings_day_idx on public.bookings (day);
create index bookings_client_idx on public.bookings (client_id);
create index bookings_open_status_idx on public.bookings (status) where status in ('attesa', 'confermata');

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  booking_id uuid references public.bookings (id),
  position smallint not null,
  description text not null,
  amount_cents int not null check (amount_cents >= 0),
  unique (invoice_id, position)
);

-- Transports
create table public.transports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  requested_by text,
  travel_date date not null,
  departure_at timestamptz,
  appointment_at timestamptz,
  return_at timestamptz,
  from_address text,
  to_address text,
  reason text,
  wheelchair boolean not null default false,
  companion boolean not null default false,
  notes text,
  driver_volunteer_id uuid references public.volunteers (id),
  vehicle_id uuid references public.vehicles (id),
  status public.transport_status not null default 'richiesto',
  km numeric(6, 1) check (km >= 0),
  driver_notes text,
  completed_at timestamptz,
  booking_id uuid unique references public.bookings (id),
  reminder_sent_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('assegnato', 'confermato', 'svolto')
    or (driver_volunteer_id is not null and departure_at is not null
        and from_address is not null and to_address is not null)),
  check (status <> 'richiesto' or driver_volunteer_id is null),
  check (status <> 'svolto' or km is not null),
  check (return_at is null or return_at > departure_at)
);
create index transports_travel_date_idx on public.transports (travel_date);
create index transports_driver_idx on public.transports (driver_volunteer_id, travel_date);

-- Single table behind the no-double-booking invariant (ADR-004); written only by triggers.
create table public.volunteer_commitments (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers (id),
  period tstzrange not null,
  shift_assignment_id uuid unique references public.shift_assignments (id) on delete cascade,
  transport_id uuid unique references public.transports (id) on delete cascade,
  constraint volunteer_commitments_one_source check (num_nonnulls(shift_assignment_id, transport_id) = 1),
  constraint volunteer_commitments_no_overlap exclude using gist (volunteer_id with =, period with &&)
);

-- Bacheca, media
create table public.media (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('media', 'proposals')),
  path text not null,
  mime text not null,
  size_bytes bigint not null,
  width int,
  height int,
  alt text,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create table public.post_proposals (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 200),
  category public.post_category not null,
  event_date date,
  location text,
  body text not null check (char_length(body) <= 3000),
  photo_path text,
  video_url text,
  submitter_name text not null,
  submitter_contact text,
  status public.proposal_status not null default 'attesa',
  post_id uuid,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  category public.post_category not null,
  event_date date,
  location text,
  cover_media_id uuid references public.media (id),
  content jsonb not null default '[]',
  excerpt text check (char_length(excerpt) <= 260),
  status public.post_status not null default 'bozza',
  author_id uuid references public.profiles (id),
  published_at timestamptz,
  from_proposal_id uuid unique references public.post_proposals (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'bozza' or published_at is not null)
);
create index posts_status_published_idx on public.posts (status, published_at desc);
alter table public.post_proposals add foreign key (post_id) references public.posts (id);

-- Settings (single rows; seeded here because the app needs them to exist)
create table public.site_settings (
  id boolean primary key default true check (id),
  phone text,
  email text,
  address text,
  opening_hours text,
  slogan text,
  home_intro text,
  membership_info text,
  updated_at timestamptz not null default now()
);
insert into public.site_settings default values;

create table public.org_settings (
  id boolean primary key default true check (id),
  legal_name text not null default 'Società di Mutuo Soccorso Givolettese',
  tax_code text,
  address text,
  vat_exemption_text text not null default 'Operazione esente IVA ai sensi dell''art. 10, comma 1, n. 18 del D.P.R. 633/1972',
  stamp_duty_threshold_cents int not null default 7747,
  stamp_duty_amount_cents int not null default 200,
  membership_fee_cents int not null default 2000,
  last_card_number int not null default 0 check (last_card_number >= 0),
  video_max_mb int not null default 50 check (video_max_mb between 1 and 50),
  updated_at timestamptz not null default now()
);
insert into public.org_settings default values;

create table public.rate_limit_hits (
  key text not null,
  window_start timestamptz not null,
  hits int not null,
  primary key (key, window_start)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_role public.app_role,
  request_id text,
  action public.audit_action not null,
  table_name text not null,
  row_id text,
  before jsonb,
  after jsonb,
  redacted boolean not null default false
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_row_idx on public.audit_log (table_name, row_id);
create index audit_log_actor_idx on public.audit_log (actor_id);

-- Volunteer minimisation view (permissions.md): owned by postgres, bypasses base-table RLS on purpose,
-- exposes only the minimal column set for transports driven by the caller.
create view public.volunteer_transports_v with (security_barrier = true) as
select t.id, t.travel_date, t.departure_at, t.appointment_at, t.return_at, t.from_address, t.to_address,
       t.wheelchair, t.companion, t.status, t.km, t.driver_notes,
       c.first_name as client_first_name, c.last_name as client_last_name, c.phone as client_phone,
       v.plate as vehicle_plate, v.model as vehicle_model
from public.transports t
join public.clients c on c.id = t.client_id
left join public.vehicles v on v.id = t.vehicle_id
where t.driver_volunteer_id = auth.uid()
  and t.status in ('assegnato', 'confermato', 'svolto');

-- updated_at maintenance on every table that has the column
do $$
declare t text;
begin
  for t in select table_name from information_schema.columns
           where table_schema = 'public' and column_name = 'updated_at'
             and table_name in (select tablename from pg_tables where schemaname = 'public')
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function extensions.moddatetime(updated_at)', t);
  end loop;
end $$;

-- Storage buckets (ADR-010): media is public-read, proposals private. No storage.objects policies:
-- uploads go through the API with the secret key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']),
  ('proposals', 'proposals', false, 52428800, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
