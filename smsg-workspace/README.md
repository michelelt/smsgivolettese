# SMS Givolettese — workspace

This repository starts everything you need to work on the platform of the
Società di Mutuo Soccorso Givolettese on your own computer. It contains no
application code: the API lives in `api/` (repo `smsg-api`) and the website in
`web/` (repo `smsg-web`), included as git submodules.

## 1. Install the prerequisites (once)

| Tool | Check it works | Notes |
|---|---|---|
| Node.js 24 | `node --version` | https://nodejs.org (LTS) |
| pnpm | `pnpm --version` | `corepack enable` or https://pnpm.io |
| Docker | `docker info` | Must work **without** `sudo`. On Linux: `sudo usermod -aG docker $USER`, then log out and back in. |
| Supabase CLI | `supabase --version` | https://supabase.com/docs/guides/cli |
| Git, make | `git --version`, `make --version` | |

## 2. Get the code (once)

```
git clone --recurse-submodules <workspace URL> smsg-workspace
cd smsg-workspace
make setup
```

`make setup` checks the prerequisites, downloads `api/` and `web/`, installs the
dependencies and creates `api/.env.local` and `web/.env.local`.

Optional, only needed for `make superadmin`:
```
cp secrets.env.example secrets.env
chmod 600 secrets.env
```
then fill in `secrets.env`. Never share or commit this file.

## 3. Start everything

```
make dev
```

The first run downloads the Supabase images and takes a few minutes. Then open:

- website: http://localhost:3000
- API: http://localhost:3001/health
- local Supabase Studio: http://localhost:54323
- emails sent locally: http://localhost:54324

Press `Ctrl+C` to stop the API and the website. Supabase keeps running in
Docker; stop it with `cd api && supabase stop`.

## Other commands

```
make help        list all commands
make test        lint, typecheck and tests of both repos
make db-reset    wipe the local database and reload the demo data
make gen-api     regenerate the website's API client after API changes
make superadmin  create the first super admin from secrets.env
```

## Publishing

Only the project owner pushes. Push `api` and `web` first, then the workspace
(it points at their commits). A push to `main` of `smsg-api` migrates the
production database and deploys: run `make test` before.

```
make test
git submodule foreach git push
git push
```

## Something does not work

- **"Docker is not running"**: start Docker Desktop, or on Linux
  `sudo systemctl start docker`. Check with `docker info`.
- **Port already in use (3000, 3001, 54321…)**: another program or an old
  `make dev` is still running. Close it, or run `cd api && supabase stop`.
- **The page says "API: non raggiungibile"**: look at the `[api]` lines in the
  `make dev` output for the error.
