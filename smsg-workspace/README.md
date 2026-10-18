# SMS Givolettese — workspace

This repository starts everything you need to work on the platform of the
Società di Mutuo Soccorso Givolettese on your own computer. It contains no
application code: the API (repo `smsg-api`) and the website (repo `smsg-web`)
are separate repositories cloned next to this one:

```
smsgivolettese/
  smsg-api/          API, database migrations
  smsg-web/          website
  smsg-workspace/    this workspace: Makefile, docs, scripts
```

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
mkdir smsgivolettese && cd smsgivolettese
git clone <smsg-api URL> smsg-api
git clone <smsg-web URL> smsg-web
git clone <workspace URL> smsg-workspace
cd smsg-workspace
make setup
```

`make setup` checks the prerequisites and the two sibling repos, installs the
dependencies and creates `.env.local` in `smsg-api` and `smsg-web`.

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
Docker; stop it with `cd ../smsg-api && supabase stop`.

## Other commands

```
make help        list all commands
make test        lint, typecheck and tests of both repos
make db-reset    wipe the local database and reload the demo data
make gen-api     regenerate the website's API client after API changes
make superadmin  create the first super admin from secrets.env
```

## Publishing

Only the project owner pushes. Each repo is pushed on its own. A push to
`main` of `smsg-api` migrates the production database and deploys: run
`make test` before.

```
make test
git -C ../smsg-api push
git -C ../smsg-web push
git push
```

## Something does not work

- **"Docker is not running"**: start Docker Desktop, or on Linux
  `sudo systemctl start docker`. Check with `docker info`.
- **Port already in use (3000, 3001, 54321…)**: another program or an old
  `make dev` is still running. Close it, or run `cd ../smsg-api && supabase stop`.
- **The page says "API: non raggiungibile"**: look at the `[api]` lines in the
  `make dev` output for the error.
