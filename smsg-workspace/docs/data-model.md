# Data model

Postgres (Supabase), schema `public` for tables, schema `app` for private helper functions (not exposed). All migrations hand-written in `smsg-api/supabase/migrations`.

Conventions (ADR-001, ADR-013):
- Table/column names **English**, snake_case. Enum **values** stay Italian (domain vocabulary from the brief, shown in the UI, `volontario` is mandated in the JWT claim).
- PK `id uuid default gen_random_uuid()` unless stated. `created_at timestamptz not null default now()`, `updated_at` maintained by `extensions.moddatetime` on mutable tables.
- Money as **integer euro cents** (`*_cents int`, project convention), never float; formatted only in UI/PDF. Instants `timestamptz`; calendar days `date`; local wall-clock `time` interpreted in `Europe/Rome`.
- RLS **enabled on every table** (policies: see `permissions.md`).

Glossary: socio (also the person served; "assistito" no longer exists, ADR-060) → `members`, quota → `membership_fees`, turno → `shifts`, tessera → `card_number`, bollo → `stamp_duty`, bacheca → `posts`, contachilometri → `odometer_*`. No bookings: every service request is a transport (ADR-070).

## ER diagram

```mermaid
erDiagram
  auth_users ||--|| profiles : "id"
  profiles ||--|| user_roles : "user_id"
  profiles ||--o| volunteers : "id"
  volunteers ||--o{ availability_rules : has
  volunteers ||--o{ availability_exceptions : has
  shift_types ||--o{ shifts : types
  shifts ||--o{ shift_assignments : has
  volunteers ||--o{ shift_assignments : assigned
  volunteers ||--o{ volunteer_commitments : "busy in"
  shift_assignments ||--o| volunteer_commitments : mirrors
  transports ||--o| volunteer_commitments : mirrors
  members ||--o{ transports : "carried"
  volunteers ||--o{ transports : drives
  vehicles ||--o{ transports : uses
  members ||--o{ membership_fees : pays
  members ||--o{ invoices : billed
  invoices ||--|{ invoice_lines : has
  transports ||--o{ invoice_lines : "billed as"
  invoices ||--o{ transports : "current invoice"
  invoice_counters ||..o{ invoices : numbers
  profiles ||--o{ posts : authors
  media ||--o{ posts : cover
  post_proposals |o--o| posts : "becomes"
  profiles ||--o{ media : uploads
  profiles ||--o{ audit_log : actor

  profiles { uuid id PK "= auth.users.id" text first_name text last_name text email text phone bool active }
  user_roles { uuid user_id PK app_role role }
  volunteers { uuid id PK "FK profiles" text license_number date license_expires_on bool can_drive bool active }
  vehicles { uuid id PK text plate UK text model int seats bool wheelchair_accessible bool active }
  availability_rules { uuid id PK uuid volunteer_id FK int weekday time start_time time end_time date valid_from date valid_to }
  availability_exceptions { uuid id PK uuid volunteer_id FK date starts_on date ends_on time start_time time end_time availability_exception_kind kind }
  shift_types { uuid id PK text name UK bool active int sort_order }
  shifts { uuid id PK uuid shift_type_id FK timestamptz starts_at timestamptz ends_at int required_slots }
  shift_assignments { uuid id PK uuid shift_id FK uuid volunteer_id FK assignment_status status }
  volunteer_commitments { uuid id PK uuid volunteer_id FK tstzrange period uuid shift_assignment_id FK uuid transport_id FK }
  transports { uuid id PK uuid member_id FK date travel_date timestamptz departure_at uuid driver_volunteer_id FK uuid vehicle_id FK transport_status status int km "generated" uuid invoice_id FK }
  services { uuid id PK text name text description "public content only" }
  members { uuid id PK int card_number UK text tax_code UK member_status status }
  membership_fees { uuid id PK uuid member_id FK int year int amount_cents }
  invoices { uuid id PK int year int number uuid member_id FK invoice_status status int total_cents }
  invoice_lines { uuid id PK uuid invoice_id FK uuid transport_id FK int amount_cents }
  invoice_counters { int year PK int last_number }
  posts { uuid id PK text slug UK post_category category post_status status jsonb content }
  post_proposals { uuid id PK proposal_status status uuid post_id FK }
  media { uuid id PK text bucket text path }
  site_settings { bool id PK "single row" }
  org_settings { bool id PK "single row" }
  rate_limit_hits { text key PK timestamptz window_start PK int hits }
  audit_log { bigint id PK uuid actor_id text table_name text row_id jsonb before jsonb after }
```

## Enums

| Postgres enum | Values (order matters only for `app_role`) |
|---|---|
| `app_role` | `volontario`, `staff`, `super_admin` (ascending: `role >= 'staff'` = "at least staff") |
| `assignment_status` | `proposto`, `confermato`, `rifiutato` |
| `transport_status` | `richiesto`, `assegnato`, `confermato`, `svolto`, `annullato` |
| `member_type` | `ordinario`, `familiare`, `sostenitore`, `onorario` |
| `member_status` | `attivo`, `cessato` |
| `member_end_reason` | `dimissioni`, `decesso`, `mancato_pagamento`, `esclusione`, `trasferimento` |
| `payment_method` | `contanti`, `pos`, `bonifico` |
| `invoice_status` | `emessa`, `pagata`, `annullata` |
| `post_category` | `evento`, `avviso`, `notizia` |
| `post_status` | `bozza`, `pubblicata` |
| `proposal_status` | `attesa`, `pubblicata`, `rifiutata` |
| `availability_exception_kind` | `assente`, `extra` |
| `audit_action` | `insert`, `update`, `delete` |

## Tables

### Identity
**profiles** — `id uuid PK references auth.users(id) on delete restrict`, `first_name text not null`, `last_name text not null`, `email text not null` (copy of auth email, for lists), `phone text`, `active bool not null default true`, `anonymized_at timestamptz`, timestamps. Created by the API on invite / bootstrap (no profile trigger on `auth.users`; the only trigger there records `app.password_set`, ADR-034).

**user_roles** — `user_id uuid PK references profiles(id)`, `role app_role not null`, `updated_at`. One role per user (ADR-005). Trigger `user_roles_protect_last_super_admin` (see invariants).

### Volunteers
**volunteers** — `id uuid PK references profiles(id)`, `license_number text`, `license_expires_on date`, `can_drive bool not null default false`, `notes text`, `active bool not null default true`, timestamps. `check (not can_drive or license_expires_on is not null)`.

**vehicles** — `plate text not null unique` (upper, no spaces: `check (plate = upper(replace(plate,' ','')))`), `model text not null`, `seats smallint not null check (seats between 1 and 9)`, `wheelchair_accessible bool not null default false`, `active bool not null default true`.

**availability_rules** — `volunteer_id uuid not null FK volunteers on delete cascade`, `weekday smallint not null check (weekday between 1 and 7)` (ISO, 1 = Monday), `start_time time not null`, `end_time time not null check (end_time > start_time)`, `valid_from date not null default current_date`, `valid_to date check (valid_to >= valid_from)`. Index `(volunteer_id, weekday)`. UI "Mattina/Pomeriggio" = 08:00–12:00 / 14:00–18:00 rows. Saving the weekly grid replaces the volunteer's open-ended rules in one transaction (`PUT /me/availability`).

**availability_exceptions** — `volunteer_id FK cascade`, `starts_on date not null`, `ends_on date not null check (ends_on >= starts_on)`, `start_time time`, `end_time time` (both null = whole day; `check ((start_time is null) = (end_time is null))`), `kind availability_exception_kind not null`, `note text`. "Non ci sono" = one `assente` row over a date range. Index `(volunteer_id, starts_on)`.

**shift_types** — `name text not null unique`, `active bool default true`, `sort_order int default 0`. Seed: Sede, Centralino, Ambulatorio, Accompagnamento.

**shifts** — `shift_type_id uuid not null FK`, `starts_at timestamptz not null`, `ends_at timestamptz not null check (ends_at > starts_at)`, `required_slots smallint not null check (required_slots >= 1)`, `notes text`, `created_by uuid FK profiles`. Index `(starts_at)`.

**shift_assignments** — `shift_id FK cascade`, `volunteer_id FK volunteers`, `status assignment_status not null default 'proposto'`, `responded_at timestamptz`, `assigned_by uuid FK profiles`, `reminder_sent_at timestamptz`, `unique (shift_id, volunteer_id)`. Index `(volunteer_id)`.
View **shift_coverage** (`shift_id, filled, required_slots, coverage` where `filled` = count of `proposto|confermato`; coverage `scoperto` (0) / `parziale` / `coperto`).

**volunteer_commitments** — see invariant 1. `volunteer_id FK`, `period tstzrange not null`, `shift_assignment_id uuid unique FK cascade`, `transport_id uuid unique FK cascade`, `check (num_nonnulls(shift_assignment_id, transport_id) = 1)`. Written only by triggers.

### Transports
**transports** (the only service record, ADR-070; one trip = home → venue → home) — `member_id uuid not null FK members` (ADR-060), `travel_date date not null`, `departure_at timestamptz` (pick-up at home), `appointment_at timestamptz` (at the venue), `return_at timestamptz`, `from_address text` (UI prefill: member `address, CAP city`), `to_address text`, `contact_phone text check (char_length(contact_phone) <= 40)` (UI prefill: member phone), `wheelchair bool not null default false`, `mobility_aids bool not null default false` (walker/crutches), `companions smallint not null default 0 check (companions between 0 and 8)`, `notes text` (staff only), `driver_volunteer_id uuid FK volunteers`, `vehicle_id uuid FK vehicles`, `status transport_status not null default 'richiesto'`, `odometer_start int check (odometer_start between 0 and 9999999)`, `odometer_end int check (odometer_end between 0 and 9999999)`, `km int generated always as (odometer_end - odometer_start) stored`, `driver_notes text`, `completed_at timestamptz`, `invoice_id uuid FK invoices` (current non-void invoice; cleared on void), `reminder_sent_at timestamptz`, `created_by uuid FK profiles`, timestamps. Dropped by ADR-070: `booking_id`, `companion`, `requested_by`, `reason`, old `km numeric`.
Checks:
- `status in ('assegnato','confermato','svolto') ⇒ driver_volunteer_id, departure_at, from_address, to_address not null` (unchanged: assignment needs a departure time)
- `status = 'richiesto' ⇒ driver_volunteer_id is null`
- `return_at is null or return_at > departure_at`
- `transports_time_chk`: `departure_at is not null or appointment_at is not null`
- `transports_odometer_pair_chk`: `(odometer_start is null) = (odometer_end is null)`
- `transports_odometer_order_chk`: `odometer_end >= odometer_start`
- `transports_svolto_odometer_chk`: `status <> 'svolto' or odometer_start is not null`
- `transports_invoice_chk`: `invoice_id is null or status = 'svolto'`
Indexes `(travel_date)`, `(driver_volunteer_id, travel_date)`, `(member_id)`, `(invoice_id)`.
Trigger `require_active_member` (BEFORE INSERT, ADR-060): member must be `attivo`, else `P0001 MEMBER_NOT_ACTIVE` (422); updates not checked. Trigger `member_immutable` unchanged.
Busy period (ADR-015): `tstzrange(departure_at, coalesce(return_at, appointment_at + interval '1 hour', departure_at + interval '2 hours'), '[)')`.

**volunteer_transports_v** (view, minimisation — `permissions.md`): `id, travel_date, departure_at, appointment_at, return_at, from_address, to_address, wheelchair, mobility_aids, companions, status, odometer_start, odometer_end, km, driver_notes, member_first_name, member_last_name, contact_phone (= coalesce(t.contact_phone, m.phone)), vehicle_plate, vehicle_model` (join `members`), filter unchanged (`driver_volunteer_id = auth.uid()`, `assegnato|confermato`, `svolto` of the last 30 Rome days).

### Services
No `clients`, no `bookings` (ADR-060, ADR-070).

**services** (descriptive public content only, ADR-070) — `name text not null`, `description text`, `schedule_note text` ("quando"), `active bool default true` (shown on site), `sort_order int default 99`. `price_cents`, `requires_transport` dropped. Anon column grant unchanged.

### Members
**members** — `card_number int not null unique` (tessera, never reused), `first_name`, `last_name text not null`, `tax_code text unique check (~ '^[A-Z0-9]{16}$')` (NULLs allowed; checksum validated in the API with explicit "save anyway"), `birth_date date`, `birth_place text`, `address text`, `postal_code text check (~ '^\d{5}$')`, `city text`, `phone text`, `email text`, `member_type member_type not null default 'ordinario'`, `joined_on date not null`, `status member_status not null default 'attivo'`, `ended_on date`, `end_reason member_end_reason`, `privacy_signed_on date`, `notes text`, `anonymized_at`, timestamps. `check ((status = 'cessato') = (ended_on is not null))`. Index `(last_name, first_name)`. BEFORE UPDATE OF `card_number` trigger raises `CARD_NUMBER_IMMUTABLE` (phase 4).

**membership_fees** — `member_id FK`, `year smallint not null check (year between 2000 and 2100)`, `amount_cents int not null check (>= 0)`, `paid_on date not null`, `method payment_method not null`, `recorded_by uuid FK profiles`, **`unique (member_id, year)`**. Receipt PDF rendered on demand.

### Invoices
**invoice_counters** — `year smallint PK`, `last_number int not null default 0 check (>= 0)`.

**invoices** — `year smallint not null`, `number int not null`, **`unique (year, number)`**, `issued_on date not null`, `member_id uuid not null FK members`, snapshot columns `customer_name`, `customer_tax_code`, `customer_address`, `issuer_name`, `issuer_tax_code`, `issuer_address`, `vat_exemption_text text not null`, `subtotal_cents`, `stamp_duty_cents`, `total_cents int not null` (`check (total_cents = subtotal_cents + stamp_duty_cents)`), `status invoice_status not null`, `payment_method payment_method`, `paid_on date`, `voided_at timestamptz`, `voided_by uuid`, `void_reason text`, `created_by uuid`, timestamps. Checks: `status='pagata' ⇒ payment_method, paid_on not null`; `status='annullata' ⇒ voided_at not null`. Display number `"{number}/{year}"`. Indexes `(member_id)`, `(status)`.

**invoice_lines** — `invoice_id FK cascade`, `transport_id uuid FK transports` (ADR-070; one line per invoice in practice), `position smallint not null`, `description text not null`, `amount_cents int not null check (>= 0)`, `unique (invoice_id, position)`.

### Bacheca and media
**media** — `bucket text not null check (bucket in ('media','proposals'))`, `path text not null`, `mime text not null`, `size_bytes bigint not null`, `width int`, `height int`, `alt text`, `uploaded_by uuid FK profiles` (null for public proposals), `created_at`, `unique (bucket, path)`. Row inserted only after the upload is verified (`architecture.md` §Uploads).

**posts** — `slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')` (≤ 80; frozen once `published_at` is set, trigger raises `SLUG_FROZEN`; unpublish keeps `published_at`), `title text not null` (≤ 200), `category post_category not null`, `event_date date`, `location text` (≤ 200), `cover_media_id uuid FK media`, `content jsonb not null default '[]'` (`check jsonb_typeof = 'array'`; BlockNote blocks, whitelist validated by Zod on write), `excerpt text` (≤ 260 chars, derived), `status post_status not null default 'bozza'`, `author_id uuid FK profiles`, `published_at timestamptz` (`check (status='bozza' or published_at is not null)`), `from_proposal_id uuid unique FK post_proposals on delete set null`, timestamps. `posts_event_date_chk`: published `evento` needs `event_date`. Audited. Index `(status, published_at desc)`.

**post_proposals** — `title text not null`, `category post_category not null`, `event_date date`, `location text`, `body text not null` (≤ 3000), `photo_path text` (private bucket `proposals`), `video_url text`, `submitter_name text not null`, `submitter_contact text`, `status proposal_status not null default 'attesa'`, `post_id uuid FK posts on delete set null`, `reviewed_by uuid`, `reviewed_at`, `created_at`.

### Settings, infrastructure
**site_settings** (public, single row: `id bool PK default true check (id)`) — `address`, `slogan`, `home_intro`, `vat_number`, `conventions jsonb not null default '[]'` (`[{title, description, url?}]`), `footer_links jsonb not null default '[]'` (`[{group: associazioni|mutuo_soccorso|utili, label, url}]`), both `check (jsonb_typeof(..) = 'array')`, plus `site_settings_links_valid check (app.site_links_valid(conventions, footer_links))` (items are objects, non-empty `title`/`label`, valid `group`, `url ~ '^https://\S+$'`; ADR-051), `pages jsonb not null` (editable page texts, ADR-061: `{home: {servicesButton, whereButton, quote, quoteSource}, chiSiamo|privacy: {title, intro, sections: [{heading, body}]}, servizi|convenzioni|doveSiamo: {title, intro}}`, plain text, blank line = paragraph; `site_settings_pages_valid check (jsonb_typeof(pages) = 'object' and pages ?& array['home','chiSiamo','servizi','convenzioni','doveSiamo','privacy'])`, inner shape validated by Zod; seeded with the copy previously hardcoded in the web pages, privacy placeholders included), `updated_at`. No phone, email, opening hours or quota text (ADR-044). Only write path: `PUT /site-settings`.

**org_settings** (private, single row) — `legal_name`, `tax_code`, `address`, `vat_exemption_text default 'Operazione esente IVA ai sensi dell''art. 10, comma 1, n. 18 del D.P.R. 633/1972'`, `stamp_duty_threshold_cents int not null default 7747`, `stamp_duty_amount_cents int not null default 200`, `membership_fee_cents int not null default 2000`, `km_rate_cents int not null default 0 check (km_rate_cents between 0 and 100000)` (transport price per km, ADR-070), `last_card_number int not null default 0`, `video_max_mb int not null default 50 check (video_max_mb between 1 and 50)` (Supabase free-tier cap), `updated_at`.

**rate_limit_hits** — `key text`, `window_start timestamptz`, `hits int`, PK `(key, window_start)`. Function `app.consume_rate_limit(key, max, window_seconds) returns bool` (upsert + compare). Rows older than 1 day are purged inside `consume_rate_limit` itself (no cron needed).

**audit_log** — `id bigint generated always as identity PK`, `at timestamptz default now()`, `actor_id uuid` (`auth.uid()`, null = system), `actor_role app_role`, `request_id text` (`current_setting('app.request_id', true)`), `action audit_action`, `table_name text`, `row_id text`, `before jsonb`, `after jsonb`, `redacted bool default false`. Indexes `(at desc)`, `(table_name, row_id)`, `(actor_id)`. Filled by generic trigger `app.audit()` (AFTER INSERT/UPDATE/DELETE, security definer) on: `profiles`, `user_roles`, `volunteers`, `services`, `site_settings`, `members`, `membership_fees`, `invoices`, `invoice_lines`, `invoice_counters`, `org_settings`, `shifts`, `shift_assignments`, `transports`, `posts`, `media` (insert/delete), `post_proposals` (update/delete, personal columns dropped via trigger arguments, ADR-066). `audit_action` also has `export`. Append-only: `audit_log_guard` allows only the GDPR redaction update (ADR-066/067).

## DB-enforced invariants

1. **No double booking of a volunteer** (ADR-004). Table `volunteer_commitments` with
   `constraint volunteer_commitments_no_overlap exclude using gist (volunteer_id with =, period with &&)` (`create extension btree_gist`).
   Security-definer triggers keep it in sync in the same transaction:
   - `shift_assignments` AFTER INSERT/UPDATE/DELETE: upsert row with `tstzrange(shift.starts_at, shift.ends_at, '[)')` when status ∈ {`proposto`,`confermato`}, else delete.
   - `shifts` AFTER UPDATE OF `starts_at, ends_at`: update periods of its commitments (a move that creates an overlap fails).
   - `transports` AFTER INSERT/UPDATE/DELETE: upsert when `driver_volunteer_id` not null and status ∈ {`assegnato`,`confermato`,`svolto`}, else delete.
   Violation → SQLSTATE `23P01`, API maps to 409 `COMMITMENT_OVERLAP`. Chosen over a trigger-only check (races under READ COMMITTED) and a materialized view (cannot reject the write).
2. **Driver eligibility**: BEFORE INSERT/UPDATE trigger `transports_check_driver` when `driver_volunteer_id` is not null: volunteer `active`, `can_drive`, `license_expires_on >= travel_date`; if `wheelchair` and `vehicle_id` set, vehicle must be `wheelchair_accessible`; vehicle must be `active`. Raises `P0001` with message `DRIVER_NOT_ELIGIBLE` / `VEHICLE_NOT_SUITABLE`. Trigger on `volunteers` UPDATE OF `can_drive, license_expires_on, active` rejects the change (`DRIVER_HAS_FUTURE_TRANSPORTS`) if it would invalidate future assigned transports.
3. **Uniqueness**: `members.card_number`, `members.tax_code`, `invoices (year, number)`, `membership_fees (member_id, year)`, `shift_assignments (shift_id, volunteer_id)`, `posts.slug`, `vehicles.plate`.
4. **Invoice numbering** (one invoice per transport, ADR-070) — `public.issue_invoice(p_transport_id uuid, p_amount_cents int, p_customer_tax_code text, p_customer_address text, p_payment_method payment_method default null) returns invoices`, `security definer`, `set search_path = ''`, granted to `authenticated`:
   1. `app.require_role('staff')`;
   2. `select … from transports where id = p_transport_id and status = 'svolto' and invoice_id is null for update` — no row → `TRANSPORT_NOT_INVOICEABLE`; member = `transports.member_id` locked `for update` (any status may be invoiced); `p_amount_cents` null or < 0 → `23514` via the line/subtotal checks;
   3. `y := extract(year from now() at time zone 'Europe/Rome')`; `insert into invoice_counters(year) values (y) on conflict do nothing`; `select last_number from invoice_counters where year = y for update`; `n := last_number + 1`; update counter;
   4. snapshot `org_settings` + customer from the member (ADR-060): name `first_name || ' ' || last_name`, tax code `coalesce(p_customer_tax_code, tax_code)`, address `coalesce(p_customer_address, nullif(concat_ws(', ', address, nullif(concat_ws(' ', postal_code, city), '')), ''))`; `stamp_duty_cents := case when subtotal_cents > stamp_duty_threshold_cents then stamp_duty_amount_cents else 0 end`;
   5. `subtotal_cents = p_amount_cents`; insert invoice (+ `pagata`, `paid_on = today` if payment given), one line (`position 1`, `transport_id`, `'Trasporto del ' || to_char(travel_date, 'DD/MM/YYYY') || ' (' || km || ' km)'`, `p_amount_cents`), set `transports.invoice_id`. A given tax code is saved on the member (ADR-060).
   Rollback after step 3 also rolls back the counter → no gaps from failures.
5. **Voided numbers never reused**: `public.void_invoice(id, reason)` (staff) only sets `annullata` + void fields and clears `transports.invoice_id` (transport invoiceable again); counters only increase; no DELETE policy on `invoices`/`invoice_lines` and BEFORE DELETE triggers raise `INVOICE_IMMUTABLE`; BEFORE UPDATE trigger allows only `emessa→pagata` (payment fields) and `emessa|pagata→annullata` (void fields), every other column immutable. Lines are insert-only (via `issue_invoice`).
6. **Member numbering** — `public.register_member(p jsonb, p_fee_method payment_method default null) returns members` (staff): `select last_card_number from org_settings for update`, `+1`, insert member, optional fee for current year at `membership_fee_cents`. Cessation/reactivation never touch the number.
7. **Counter adjustment** (super_admin, "numerazioni"): `app.set_member_counter(n)` requires `n >= max(card_number)`; `app.set_invoice_counter(year, n)` requires `n >= max(number) for year`. Upward only (ADR-025).
7b. **Staff view of org data** — `public.staff_org_info()` (security definer, `app.require_role('staff')`, granted to `authenticated`) returns `legal_name, tax_code, address, membership_fee_cents, stamp_duty_threshold_cents, stamp_duty_amount_cents, next_card_number (= last_card_number + 1), km_rate_cents` (last column added by ADR-070: drop + recreate, re-grant); used for form defaults and fee receipts (ADR-049). Staff still have no direct read on `org_settings`.
8. **Stamp duty** config lives in `org_settings` (threshold/amount), snapshot per invoice so config changes never alter issued invoices.
9. **Last super admin**: BEFORE UPDATE/DELETE on `user_roles` and BEFORE UPDATE OF `active` on `profiles`: if the row is an active super_admin losing that status, `perform 1 from user_roles where role = 'super_admin' for update` then raise `LAST_SUPER_ADMIN` if no other active one remains.
10. **Proposal → post** one-to-one via `posts.from_proposal_id unique`.

## Public (anon) readable rows
| Table | anon `select` policy |
|---|---|
| `services` | `active = true`; column grant only `id, name, description, schedule_note, sort_order, active` (no prices, ADR-044) |
| `posts` | `status = 'pubblicata' and published_at <= now()` |
| `site_settings` | the single row (all columns are public by design) |
| `media` | `bucket = 'media'` (public bucket; metadata only) |
All other tables: no anon access. Anon writes only via `submit_post_proposal(...)` (security definer, `grant execute to anon`, phase 6), called by the API after Turnstile + rate limit (ADR-006). `submit_public_booking` was dropped (ADR-043).

## API contract changed by ADR-070 (frozen for parallel db/api/web work)
Conventions ADR-045 (camelCase, dates `YYYY-MM-DD`, times `HH:MM` Europe/Rome, money `*Cents` int). `info.version` major bump. Removed entirely: every `/bookings*` route, schemas `Booking`, `Bookings`, `BookingCreate`, `BookingKpis` and the booking verb bodies, permissions `bookings.read|write|change_status`, error `BOOKINGS_NOT_INVOICEABLE`.

`Transport` (strict; `GET /transports`, `GET /transports/:id`, verb responses, `MemberDetail.transports`):
`{ id: uuid, memberId: uuid, memberName: string, contactPhone: string|null, travelDate: string, departureTime: string|null, appointmentTime: string|null, returnTime: string|null, fromAddress: string|null, toAddress: string|null, wheelchair: boolean, mobilityAids: boolean, companions: int, notes: string|null, status: 'richiesto'|'assegnato'|'confermato'|'svolto'|'annullato', driverId: uuid|null, driverName: string|null, vehicleId: uuid|null, vehiclePlate: string|null, odometerStart: int|null, odometerEnd: int|null, km: int|null, driverNotes: string|null, invoiceId: uuid|null }` — removed `memberPhone`, `requestedBy`, `reason`, `companion`, `bookingId`.

`TransportCreate` (`POST /transports`, 201 Transport): `{ memberId: uuid, travelDate: date, departureTime?: HH:MM|null, appointmentTime?: HH:MM|null, returnTime?: HH:MM|null, fromAddress?: string 1..200|null, toAddress?: string 1..200|null, contactPhone?: string trim 1..40|null, wheelchair?: boolean, mobilityAids?: boolean, companions?: int 0..8, notes?: string 1..500|null }`; refine: `departureTime` or `appointmentTime` present, else 400 "Indica l'ora di partenza da casa o l'ora dell'appuntamento"; existing return-after-departure refine kept. `TransportPatch` = same fields without `memberId`, all optional (the merged row is checked by `transports_time_chk` → 400 `VALIDATION_ERROR`). Errors unchanged: 422 `MEMBER_NOT_ACTIVE`, 422 `TRANSPORT_INCOMPLETE`, 409 `TRANSPORT_INVALID_TRANSITION`.

`TransportComplete` (`POST /transports/:id/complete`, staff) = `MyTransportComplete` (`POST /me/transports/:id/complete`, volunteer): `{ odometerStart: int 0..9999999, odometerEnd: int 0..9999999, driverNotes?: string trim ≤500|null }`, refine `odometerEnd >= odometerStart` and `odometerEnd - odometerStart <= 2000` → 400 "Controlla i chilometri: l'arrivo deve essere maggiore o uguale alla partenza". Volunteer path calls `complete_transport(id, start, end, notes)`; errors unchanged (`TRANSPORT_NOT_COMPLETABLE`).

`MyTransport` (strict): `{ id, travelDate, departureTime, appointmentTime, returnTime, fromAddress, toAddress, wheelchair: boolean, mobilityAids: boolean, companions: int, status: 'assegnato'|'confermato'|'svolto', odometerStart: int|null, odometerEnd: int|null, km: int|null, driverNotes, memberFirstName: string, memberLastName: string, contactPhone: string|null, vehiclePlate, vehicleModel }` — `companion`, `memberPhone` removed.

`InvoiceIssue` (`POST /invoices`, 201 `InvoiceDetail`): `{ transportId: uuid, amountCents: int 0..10000000, customerTaxCode?: string trim ≤40|null, taxCodeConfirmed?: boolean, customerAddress?: string trim ≤200|null, paymentMethod?: 'contanti'|'pos'|'bonifico' }` (no `memberId`, no `bookingIds`). New error 409 `TRANSPORT_NOT_INVOICEABLE` "Il trasporto non è fatturabile (non svolto o già fatturato)"; 422 `TAX_CODE_INVALID` unchanged. `InvoiceDetail.lines[]` = `{ position, description, amountCents, transportId: uuid|null }`.

`MemberDetail` = `Member + { fees, transports: Transport[], invoices: Invoice[] }` (`bookings` removed).
`StaffService` = `{ id, name, description|null, scheduleNote|null, active, sortOrder }`; `ServiceCreate`/`ServicePatch` drop `priceCents`, `requiresTransport`.
`OrgSettingsInput`/`OrgSettings` add required `kmRateCents: int 0..100000`; `OrgInfo` (`GET /org-info`) adds `kmRateCents: int`.
Web prefill of the invoice amount: `km × kmRateCents` (both integers), shown in the editable money input.
Transports CSV columns: Data, Partenza, Socio, Da, A, Autista, Targa, Km partenza, Km arrivo, Km, Carrozzina, Ausili, Accompagnatori, Note autista. Trip sheet PDF: "Accompagnatori N", "Ausili (deambulatore/stampelle) Sì/No", "Telefono" = contact phone, blank "Km partenza ____ Km arrivo ____".

## API contract changed by ADR-071 (frozen; additive, `info.version` minor bump; no DB/RLS change)
- `GET /availability` (`AvailabilityOverview`, `availability.read_all` = staff): each `items[]` adds `canDrive: boolean` (`volunteers.can_drive`). Items stay `{ volunteerId, firstName, lastName, canDrive, rules, absences }`; no phone, email, licence. Web shows names, slots and an "autista" mark only (no absence notes in the calendar).
- Unchanged and reused: `GET /shifts?from&to`, `GET /transports?from&to` (one week per call), `GET /me/commitments`.
- Web URL param: `?week=YYYY-MM-DD` (any day, normalised to Monday) on `/gestione/turni`, `/gestione/trasporti` (`day=` dropped), `/gestione/disponibilita` (staff) and `/gestione` (volunteer).
