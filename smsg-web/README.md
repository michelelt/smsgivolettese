# smsg-web

Next.js 16 (App Router) front end for SMS Givolettese. Data only through the generated client in `lib/api/`.

```
pnpm install
pnpm dev          # http://localhost:3000, /api/* proxied to API_URL
pnpm lint | typecheck | test | build
pnpm gen:api      # regenerate lib/api/schema.d.ts (OPENAPI_URL, default ../smsg-api/openapi.json)
```

Copy `.env.example` to `.env.local`. Node 24, pnpm 12.9.1.
