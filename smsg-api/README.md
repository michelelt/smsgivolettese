# smsg-api

Hono API (Vercel Functions, Node 24) for SMS Givolettese. Owns the DB schema (`supabase/`) and the OpenAPI contract (`openapi.json`).

- `pnpm dev` (:3001), `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm openapi:export`, `pnpm superadmin` (stub until phase 2).
- Env: copy `.env.example` to `.env.local`.
- `vercel.json` has no cron yet: add `0 16 * * *` -> `/cron/daily` in phase 5 together with the route (otherwise it would 404).
- CI: `.github/workflows/ci.yml`; `deploy.yml` runs on `main` only (tests, `supabase db push`, `vercel deploy --prebuilt --prod`).
