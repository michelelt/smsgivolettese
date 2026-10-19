# Deploy guide

Topology and reasons: ADR-073 in `decisions.md`. Everything runs on free tiers (Vercel Hobby, Supabase Free); Turnstile and Resend are optional and off.

| | Staging | Production |
|---|---|---|
| Supabase | `smsg-staging` (`ydqdnicpfspqewclqrgk`) | `smsg-prod` (`vcpmnpsfcgebhmgqlqeu`) |
| Web | https://smsg-web-staging.vercel.app | https://smsgivolettese.vercel.app |
| API | https://smsg-api-staging.vercel.app | https://smsg-api.vercel.app |
| Vercel env | Preview | Production |

## Prerequisites
- `pnpm add -g vercel`, then `vercel login` and `supabase login`.
- `smsg-workspace/secrets.env` (template `secrets.env.example`) with `SUPERADMIN_*` and `SUPABASE_DB_PASSWORD_{STAGING,PROD}`. Optional: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`.
- Vercel projects `smsg-api` and `smsg-web` exist and are linked (`vercel link --project <name>` inside each folder).

## Git flow (normal path, ADR-074)
- Push to `main`: both projects build a Preview deployment with staging env vars; `smsg-web-staging.vercel.app` and `smsg-api-staging.vercel.app` follow `main`.
- Run migrations first when there are new ones: `supabase db push --project-ref ydqdnicpfspqewclqrgk` (staging) before the push.
- Production: `supabase db push --project-ref vcpmnpsfcgebhmgqlqeu` if needed, then in the Vercel dashboard open the `main` deployment of `smsg-api`, then of `smsg-web`, and click "Promote to Production". Alternative: `git push origin main:production`.
- `make deploy-check ENV=staging|production` must print only `ok`.

## Manual CLI deploy (first setup or emergencies)
Run from `smsg-api/` unless noted; replace `<ref>` and the env names.

1. Database: `supabase db push --project-ref <ref> --include-seed` (migrations before code; the CLI uses a temporary login role).
2. Auth/API config: `yes | supabase config push --project-ref <ref>` (uses the `[remotes.*]` block of `config.toml`; only after migrations, the hook needs `app.custom_access_token_hook`).
3. Env vars (from `smsg-workspace/`): `make vercel-env ENV=staging|production`. Regenerates the shared secrets, so redeploy **both** projects afterwards.
4. API: `vercel pull --yes --environment=preview|production && vercel build [--prod] && vercel deploy --prebuilt [--prod]`.
5. Web (from `smsg-web/`): `vercel deploy [--prod] --yes` (built on Vercel, because sensitive env vars cannot be pulled locally).
6. Staging only: `vercel alias set <deployment-url> smsg-api-staging.vercel.app` (and `smsg-web-staging.vercel.app` from `smsg-web/`). Production: alias the web deployment to `smsgivolettese.vercel.app`.
7. First super admin (from `smsg-workspace/`): `make superadmin-remote ENV=staging|production`.
8. Check (from `smsg-workspace/`): `make deploy-check ENV=staging|production` must print only `ok`.

## Notes
- Deployment Protection is off on both projects (server-to-server calls between web and API).
- Cron `/cron/daily` runs only in production. Without Resend no reminder is sent and rows stay unsent.
- Without Turnstile the proposal form relies only on the per-IP rate limit.
- Auth emails (invites, recovery) use Supabase's built-in SMTP: a few per hour, only to addresses of the Supabase organisation members. Add Resend SMTP in `config.toml` `[remotes.*]` for real use.
- Pool size (20/100 in `config.toml`) cannot be pushed by the CLI; set it in the dashboard if needed.
