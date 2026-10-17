SHELL := /usr/bin/env bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help

# Workspace secrets (ADR-027): exported to every recipe when present, never printed.
LOAD_SECRETS := if [ -f secrets.env ]; then set -a; . ./secrets.env; set +a; fi
CONCURRENTLY := pnpm dlx concurrently@9.2.5

.PHONY: help setup dev test e2e db-reset gen-api superadmin deploy-check

help: ## Show available targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-13s %s\n", $$1, $$2}'

setup: ## Check prerequisites, init submodules, install deps, create .env.local files
	@for cmd in node pnpm docker supabase; do \
	  command -v $$cmd >/dev/null || { echo "Missing prerequisite: $$cmd (see README.md)"; exit 1; }; \
	done
	@node -e 'process.exit(+process.versions.node.split(".")[0] >= 24 ? 0 : 1)' || { echo "Node 24 or newer required"; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "Docker is not running or not accessible (see README.md)"; exit 1; }
	git submodule update --init
	pnpm -C api install
	pnpm -C web install
	@for repo in api web; do \
	  if [ ! -f $$repo/.env.local ]; then cp $$repo/.env.example $$repo/.env.local; echo "Created $$repo/.env.local"; fi; \
	done
	@if [ ! -f secrets.env ]; then echo "Tip: cp secrets.env.example secrets.env && chmod 600 secrets.env"; fi

dev: ## Start local Supabase, apply new migrations, then API (:3001) and web (:3000)
	cd api && supabase start
	@# first start applies migrations + seed; later starts keep data (use db-reset to wipe)
	cd api && supabase migration up --local
	./scripts/local-env.sh
	$(MAKE) gen-api
	@$(CONCURRENTLY) -k -n api,web -c blue,magenta "pnpm -C api dev" "pnpm -C web dev"

test: ## Run lint, typecheck and tests of both repos
	pnpm -C api lint
	pnpm -C api typecheck
	pnpm -C api test:unit
	@# DB tests mutate schema/data: always start from a fresh LOCAL database
	$(MAKE) db-reset
	pnpm -C api test:db
	pnpm -C web lint
	pnpm -C web typecheck
	pnpm -C web test

e2e: ## Run the Playwright suite against the running `make dev` stack (slow, not part of `make test`)
	@curl -sf -o /dev/null http://localhost:3000 || { echo "Web not reachable on :3000: start 'make dev' first"; exit 1; }
	pnpm -C web e2e

db-reset: ## Reset the local database (migrations + seed)
	@# shortcut: the CLI sometimes fails at "Initialising schema" (container exit 1, cause unknown); one retry, investigate if it fails twice
	cd api && (supabase db reset --local || (echo 'db reset failed, retrying once...' && supabase db reset --local))
	@# new seed ids: drop the web's cached public data if the dev server is running (secret read from web/.env.local, never printed)
	@secret=$$(grep -m1 '^REVALIDATE_SECRET=' web/.env.local | cut -d= -f2-); \
	  curl -sf -o /dev/null -X POST http://localhost:3000/hooks/revalidate -H "x-revalidate-secret: $$secret" \
	  -H 'content-type: application/json' -d '{"tags":["services","site-settings"]}' \
	  && echo 'Web cache revalidated' || true

gen-api: ## Regenerate the web API client from the API OpenAPI schema
	pnpm -C api openapi:export
	OPENAPI_URL=../api/openapi.json pnpm -C web gen:api

superadmin: ## Create the first super admin from secrets.env (idempotent)
	@$(LOAD_SECRETS); pnpm -C api superadmin

deploy-check: ## Check env vars on Vercel and Supabase (phase 8)
	@echo "deploy-check: not implemented yet (roadmap phase 8)"; exit 1
