# Roadmap

Rules: one phase at a time; a phase is done when `make test` is green, `security-reviewer` has no open high/medium findings, and each touched repo has a Conventional Commit (workspace submodule pointers updated). End each phase with a short summary: what works, how to try it, what's left.

## 1. Workspace, scaffolding, CI
- **Scope**: `smsg-workspace` (Makefile, `.env.example`, README for non-expert volunteers, submodules), `smsg-api` (Hono + `@hono/zod-openapi`, `api/index.ts`, `config/env.ts`, `lib/logger.ts`, `lib/errors.ts`, error handler, `GET /health`, `GET /openapi.json`, Supabase CLI config), `smsg-web` (Next.js, Tailwind tokens: bordeaux `#7A1E2C`, blu `#1F3F7A`, 19px base; "hello" page; `/api` rewrite; generated client).
- **Deliverables**: all Makefile targets (`setup`, `dev`, `test`, `db-reset`, `gen-api`, `superadmin` stub, `deploy-check`), ESLint + Prettier, GitHub Actions (lint, typecheck, test, openapi diff), `.env.example` per repo; Makefile sources workspace `secrets.env` when present (ADR-027) and never prints its values.
- **Acceptance**: `make setup && make dev` from a fresh clone shows the hello page on :3000 calling `/api/health` → 200 via rewrite; `make test` green (1 unit test per repo); CI green on both repos; `openapi.json` committed and checked.
- **Repos**: workspace, api, web.

## 2. Schema, RLS, Auth Hook, super admin, login
- **Scope**: full schema of `data-model.md` (all tables, enums, constraints, triggers, SQL functions, views, audit triggers, storage buckets), all RLS policies of `permissions.md`, Custom Access Token Hook, `permissions.ts` + `requirePermission`, JWT verification (JWKS), `db.asUser/asAnon/asService`, `scripts/bootstrap-superadmin.ts`, seed with obvious demo data ("Mario Rossi (esempio)"). Web: `/accedi`, `/imposta-password`, magic link, `proxy.ts` guard, role-aware `/gestione` shell.
- **Acceptance**: RLS integration tests per role (anon/volontario/staff/super_admin × each table: allowed and denied S/I/U/D); invariant tests: overlapping commitments → 23P01, ineligible driver rejected, invoice/member numbering under 10 concurrent calls has no gaps or duplicates, void keeps number, `(member_id, year)` unique, last super admin protected; hook puts `app_role` in JWT; `make superadmin` idempotent (credentials from `secrets.env`, password never overwritten on re-run); super admin changes own password with reauthentication and no other user or endpoint can change it; Playwright: staff login reaches `/gestione`, volunteer blocked from staff pages.
- **Repos**: api, web, workspace.

## 3. Public site, services, public booking
- **Scope**: home, servizi, prenota (4 steps: servizio → giorno e fascia → dati → conferma, success screen), chi-siamo, contatti, privacy (placeholders), text size A/A+/A++ remembered, large-button menu, phone always visible; ISR + `/hooks/revalidate`; `submit_public_booking` with Turnstile + IP rate limit; transport auto-created for `requires_transport`; SEO (metadata, sitemap, OG); PWA manifest; CSP.
- **Acceptance**: Playwright public booking happy path + Turnstile failure + rate limit 429; booking of a transport service creates `richiesto` transport; Lighthouse Accessibility ≥ 95 and axe clean on all public pages; revalidation updates services page without redeploy; client IP header verified behind the rewrite.
- **Repos**: api, web.

## 4. Staff: bookings, clients, members, invoices
- **Scope**: bookings list/filters/KPIs (confirm with time, executed, cancel, restore, phone booking), clients with history, members book (progressive card, CF validation with checksum + "save anyway", fees with PDF receipt, end/reactivate, CSV export), invoices (issue from executed bookings via `issue_invoice`, server PDF, mark paid, void, CSV export `;`-separated UTF-8 BOM), services & prices, site info.
- **Acceptance**: Vitest for services (price by member status, stamp duty at 77.47/77.48, numbering per year, void → bookings invoiceable again, number not reused); Playwright: invoice issuance end to end; audit rows written for members/invoices.
- **Repos**: api, web.

## 5. Volunteers, availability, shifts, transports, notifications
- **Scope**: volunteers + vehicles registry, invites of volunteers by staff, volunteer UI (weekly grid Mon–Sat × Mattina/Pomeriggio + custom times, "Non ci sono", "I miei impegni" with Confermo/Non posso, map link), shifts weekly calendar (day view mobile, grid desktop), "copia la settimana", assignment dialog with candidates (labels disponibile/già impegnato/assente, sorted by shifts in month), coverage + uncovered count on dashboard, transports form/list day & week, driver + vehicle assignment, travel sheet PDF, close with km/notes, monthly CSV, Resend emails on assignment, daily cron reminders.
- **Acceptance**: forced overlap → 409 `COMMITMENT_OVERLAP`; volunteer cannot read transport columns outside the minimal set (RLS + API test); reminder cron idempotent; Playwright: create shift + assign, volunteer enters availability, volunteer confirms commitment.
- **Repos**: api, web.

## 6. Bacheca, block editor, media, moderation
- **Scope**: BlockNote editor (paragraph, heading, image with caption/size, gallery, video upload or YouTube/Vimeo, quote, list, button-link, divider), cover image, drafts, preview, publish/update, slug, signed uploads with browser resize to WebP ≤ 2000 px, video size limit with clear message, server renderer with whitelist + `next/image`, news list filter + article page with lightbox; public "Proponi una notizia" (Turnstile, photo, video link) and moderation (pubblica così / apri nell'editor / scarta).
- **Acceptance**: unknown block types rejected on write and ignored on render; XSS payloads in content escaped; upload over limit rejected before upload; publishing revalidates `/notizie`; Playwright: create and publish a post with image.
- **Repos**: api, web.

## 7. Super admin, GDPR, accessibility, full e2e
- **Scope**: users & roles (invite staff, change role, deactivate, last-admin protection UX), org settings (issuer data, VAT exemption text, stamp duty, fee, counters upward only), audit log viewer with filters, GDPR export/anonymise, accessibility pass on `/gestione`, complete Playwright suite (public booking, staff login, shift create/assign, volunteer availability, invoice issuance).
- **Acceptance**: all e2e green in CI; anonymisation leaves invoices intact and redacts audit; last super admin cannot be removed (UI + API + DB); settings changes audited.
- **Repos**: api, web.

## 8. Deploy guide
- **Scope**: `docs/deploy.md`: link both existing Supabase projects (check contents with `supabase migration list` / `db diff` first, stop if foreign data; verify EU region), Auth settings (hook, redirect URLs, signups off, Resend SMTP, JWT expiry 15 min) on both, storage buckets, Vercel projects api/web (fra1, env per environment, cron, Git settings, deployment protection), domain, `make deploy-check`, first super admin.
- **Acceptance**: `make deploy-check` passes against staging; a reviewer follows the guide on staging end to end without extra knowledge. Production migration only with explicit approval.
- **Repos**: workspace (docs, Makefile), api (deploy workflow if adjusted).
