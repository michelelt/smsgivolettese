# Permissions

Roles: JWT claim `app_role` ∈ `volontario` < `staff` < `super_admin` (enum order). Hierarchy is strict: a role has every permission of the roles below it. Visitors without a session are `anon`.

## `permissions.ts` (single source of truth)

`api/src/auth/permissions.ts` maps each action to the **minimum role** (or `anon`):

```ts
export const PERMISSIONS = { 'bookings.read': 'staff', 'availability.write_own': 'volontario', /* … */ } as const satisfies Record<string, MinRole>;
export const can = (role: AppRole | null, action: Action) => rank(role) >= rank(PERMISSIONS[action]); // rank(null)=0 (anon)
```
- `requirePermission(action)` middleware → 403 `FORBIDDEN` when `can` is false.
- `*_own` actions additionally require ownership; the service filters by `auth.uid()` and RLS enforces it again.
- SQL mirror: `app.role()` (`(auth.jwt()->>'app_role')::app_role`, null for anon) and `app.has_role(min app_role)` (`coalesce(app.role() >= min, false)`). Policies use `(select app.has_role('staff'))` (wrapped `select` = evaluated once per statement).
- Integration test `permissions.rls.test.ts` iterates the matrix below per role (anon, volontario, staff, super_admin) against local Supabase.

## Matrix

✔ = allowed, own = only rows of the caller, – = denied. Minimum role in the last column.

| Action | anon | vol. | staff | s.admin | Min |
|---|---|---|---|---|---|
| `services.read_public`, `posts.read_public`, `site_settings.read` | ✔ | ✔ | ✔ | ✔ | anon |
| `proposals.submit_public` (Turnstile + rate limit) | ✔ | ✔ | ✔ | ✔ | anon |
| `me.read`, `profile.write_own` (phone) | – | own | own | own | volontario |
| `availability.read_own`, `availability.write_own` | – | own | own | own | volontario |
| `shift_assignments.read_own`, `shift_assignments.respond_own` | – | own | own | own | volontario |
| `transports.read_own` (minimal view), `transports.respond_own`, `transports.complete_own` | – | own | own | own | volontario |
| `volunteers.read_own` | – | own | own | own | volontario |
| `bookings.read`, `bookings.write`, `bookings.change_status` | – | – | ✔ | ✔ | staff |
| `members.read`, `members.write`, `members.end`, `members.export`, `membership_fees.write` | – | – | ✔ | ✔ | staff |
| `invoices.read`, `invoices.issue`, `invoices.mark_paid`, `invoices.void`, `invoices.export` | – | – | ✔ | ✔ | staff |
| `services.read` (all, with prices), `services.write`, `site_settings.write` | – | – | ✔ | ✔ | staff |
| `org_info.read` (`staff_org_info()`: issuer, fee, stamp duty, next card number) | – | – | ✔ | ✔ | staff |
| `posts.read_drafts`, `posts.write`, `posts.publish`, `posts.delete` | – | – | ✔ | ✔ | staff |
| `proposals.read`, `proposals.moderate` | – | – | ✔ | ✔ | staff |
| `media.upload`, `media.delete` | – | – | ✔ | ✔ | staff |
| `shifts.read`, `shifts.write`, `shifts.assign` | – | – | ✔ | ✔ | staff |
| `transports.read`, `transports.write`, `transports.assign`, `transports.export` | – | – | ✔ | ✔ | staff |
| `volunteers.read`, `volunteers.write`, `vehicles.read`, `vehicles.write` | – | – | ✔ | ✔ | staff |
| `availability.read_all` | – | – | ✔ | ✔ | staff |
| `users.read` (all `profiles`: name, email, phone, active; all `user_roles`) | – | own | ✔ | ✔ | staff |
| `users.invite_volunteer` | – | – | ✔ | ✔ | staff |
| `availability.write_all` | – | – | – | ✔ | super_admin |
| `users.invite_staff`, `users.change_role`, `users.deactivate` | – | – | – | ✔ | super_admin |
| `org_settings.write`, `counters.write` | – | – | – | ✔ | super_admin |
| `audit.read` | – | – | – | ✔ | super_admin |
| `gdpr.export`, `gdpr.anonymize` | – | – | – | ✔ | super_admin |

Notes: `org_settings` is read by `issue_invoice`/receipts internally (definer), so staff need no direct read. "Proporre" in bacheca for volunteers = the public proposal form (no extra permission). Volunteers may not propose availability for others; staff only **read** all availability (brief), super_admin edits all.

## Web route guards (`web/proxy.ts` + layout)
| Route under `/gestione` | Min role |
|---|---|
| `/` (dashboard by role; volunteer = "I miei impegni"), `/disponibilita` (own grid; staff see all) | volontario |
| `prenotazioni`, `soci` (also history of bookings/transports/invoices; `utenti` "Assistiti" removed, ADR-060), `fatture`, `bacheca`, `servizi`, `sito` (Info del sito), `turni`, `trasporti`, `volontari`, `mezzi` (ADR-059) | staff |
| `impostazioni`, `utenti-e-ruoli`, `registro-attivita` | super_admin |
Navigation hides what the role cannot do; the API is the enforcement point.

## RLS policies per table

API queries run as `authenticated`/`anon` with the caller's JWT claims (ADR-002), so these policies are live. S/I/U/D = select/insert/update/delete. `≥staff` = `app.has_role('staff')`. Absent = denied. `service` (no role switch) is used only by cron, invites, bootstrap, rate limiting.

| Table | anon | volontario | ≥staff | super_admin extra |
|---|---|---|---|---|
| `profiles` | – | S own | S all; U (not `active`/role via trigger guard) | U `active` |
| `user_roles` | – | S own | S all | I/U/D (last-admin trigger) |
| `volunteers` | – | S own | S/I/U all | |
| `vehicles` | – | – | S/I/U/D | |
| `availability_rules`, `availability_exceptions` | – | S/I/U/D own (`volunteer_id = auth.uid()`) | S all | I/U/D all |
| `shift_types` | – | S | S/I/U/D | |
| `shifts` | – | S where own assignment exists | S/I/U/D | |
| `shift_assignments` | – | S own | S/I/U/D | |
| `volunteer_commitments` | – | – | S | (writes by triggers only) |
| `transports` | – | – (use view) | S/I/U (no D; cancel = `annullato`) | |
| `volunteer_transports_v` (view) | – | S (filtered in view) | – | |
| `services` | S `active`, columns without prices only (column grant, ADR-044) | S `active` | S/I/U/D | |
| `bookings` | – | – | S/I/U (no D; cancel = status; only write path, ADR-043) | |
| `members` | – | – | S/U (I via `register_member`) | |
| `membership_fees` | – | – | S/I/U | D |
| `invoices` | – | – | S/U (trigger restricts columns; I via `issue_invoice`) | |
| `invoice_lines` | – | – | S | |
| `invoice_counters` | – | – | S | U via `set_invoice_counter` |
| `posts` | S published | S published | S/I/U/D | |
| `post_proposals` | – (I via function) | – | S/U | D |
| `media` | S `bucket='media'` | S `bucket='media'` | S/I/D | |
| `site_settings` | S | S | S/U (incl. `pages`, ADR-061; no new permission) | |
| `org_settings` | – | – | – | S/U |
| `audit_log` | – | – | – | S |
| `rate_limit_hits` | – | – | – | (service only) |

Volunteer writes outside availability go through `security definer` functions that check `app.has_role('volontario')` and ownership:
- `respond_shift_assignment(id, accept bool)` → `confermato` / `rifiutato`, `responded_at`.
- `respond_transport(id, accept bool)` → `confermato`, or back to `richiesto` with driver/vehicle cleared (staff notified by email).
- `complete_transport(id, km, driver_notes)` → `svolto`, `completed_at`; only from `assegnato|confermato`, only on/after `travel_date`.
- `update_my_profile(phone)`.

## Volunteer data minimisation
A volunteer sees for an assigned transport **only**: the member's first/last name and phone, from/to address, date, departure/appointment/return times, wheelchair, companion, status, vehicle plate/model, and their own km/driver notes. Never: card number, `tax_code`, birth data, email, `address` of the member record, `reason`, staff `notes`, fees, invoices, bookings, other members.
Enforced twice: the view `volunteer_transports_v` (owned by `postgres`, `security_barrier`, filter `driver_volunteer_id = auth.uid()`, `grant select to authenticated`, no base-table policy for volunteers) and the API response schema `MyTransport` (Zod, strict). Shifts carry no personal data and use plain RLS.

## Invites and user lifecycle
- `POST /users/invite {email, first_name, last_name, role}`: staff → only `volontario`; super_admin → any. API calls `auth.admin.inviteUserByEmail(email, { redirectTo: <web>/imposta-password })` with the secret key, then in one transaction inserts `profiles`, `user_roles` and (for `volontario`) `volunteers`; on DB failure it deletes the auth user.
- Public sign-up disabled in Supabase Auth; volunteer magic link uses `signInWithOtp({ shouldCreateUser: false })`.
- **Sign-in methods by role (ADR-034)**: the Auth Hook refuses to issue a token for `staff`/`super_admin` when the session comes from an emailed link (GoTrue method `otp`, which covers magic link, recovery and invite) and the account has a recorded password (`app.password_set`, filled by a trigger on `auth.users`); while the account has no password, a link session carries no `app_role` (it can only set the first password; the web then signs out), then they sign in with `password`. Volunteers may use magic link and recovery. Real-Auth tests cover password, magic link and recovery per role, plus the staff invite → first password → password login flow.
- Role change / deactivation: super_admin only. Deactivation sets `profiles.active=false`, bans the auth user, the Auth Hook stops issuing `app_role`. Residual access ≤ JWT lifetime (set to 15 min).
- **Last super admin**: DB trigger (`LAST_SUPER_ADMIN`, 409) + API check for a clear message. A super admin may not demote/deactivate themself if they are the last one.
- Bootstrap: `scripts/bootstrap-superadmin.ts` (idempotent) reads `SUPERADMIN_EMAIL` + `SUPERADMIN_PASSWORD` (Zod: valid email, password ≥ 12 chars) from the workspace `secrets.env`. If the auth user is missing it creates it with `auth.admin.createUser({ email, password, email_confirm: true })`; if it exists it never touches the password. Then upserts profile + `super_admin` role (ADR-027).
- **Own password change** (all roles in `/gestione`): UI always calls `reauthenticate()` and sends the emailed nonce with `updateUser({ password, nonce })`; "Secure password change" on. GoTrue enforces the nonce only for sessions > 24 h (accepted residual risk, ADR-034).
- **Super admin password**: changeable only by that super admin, logged in, as above. Lost password: owner resets it from the Supabase dashboard (outside the app).
- **Staff lost password**: the super admin resets it from the Supabase dashboard (owner decision, ADR-034). There is no API endpoint for it: no endpoint, role or script may call `auth.admin.updateUserById` with `password` or otherwise set another user's password.

## GDPR (super_admin)
- `GET /gdpr/export?subject=member|user&id=…` → JSON with every row referencing the person (member + fees + bookings + transports + invoices; profile + volunteer + availability + assignments). Writes an audit row. No `client` subject (ADR-060).
- `POST /gdpr/anonymize` → definer functions `app.anonymize_member|user(id)`: names → `Anonimo`, phone/tax code/address/email/birth data → null, `anonymized_at = now()`; keeps ids, card numbers, amounts and statuses; redacts `before/after` of that person's rows in `audit_log` (`redacted = true`). For users also bans the auth user and replaces its email with `deleted+<id>@invalid.local`.
- **Invoices are not anonymised** (fiscal retention, 10 years — GDPR art. 17(3)(b)); the response lists retained invoices. Open question for the association's privacy officer.
- No health data: only the service type; `transports.reason` and notes carry a UI warning.
