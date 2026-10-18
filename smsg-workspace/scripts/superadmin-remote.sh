#!/usr/bin/env bash
# Creates the first super admin on a remote project (ADR-027, ADR-073). Credentials are never printed.
# Usage: make superadmin-remote ENV=staging|production (sources secrets.env)
set -euo pipefail
cd "$(dirname "$0")/../../smsg-api"
case "${1:-}" in
  staging) ref=ydqdnicpfspqewclqrgk pass=${SUPABASE_DB_PASSWORD_STAGING:?} ;;
  production) ref=vcpmnpsfcgebhmgqlqeu pass=${SUPABASE_DB_PASSWORD_PROD:?} ;;
  *) echo "usage: $0 staging|production" >&2; exit 1 ;;
esac
SUPABASE_SECRET_KEY=$(supabase projects api-keys --project-ref "$ref" --reveal -o json | jq -r '.[] | select(.type=="secret") | .api_key')
[[ $SUPABASE_SECRET_KEY == sb_secret_* ]] || { echo "unexpected Supabase secret key for $ref" >&2; exit 1; }
SUPABASE_URL=https://$ref.supabase.co
DATABASE_URL="postgresql://postgres.$ref:$(printf %s "$pass" | jq -sRr @uri)@${DB_POOLER_HOST:-aws-1-eu-central-1.pooler.supabase.com}:6543/postgres"
# Exported vars win over the local .env files tsx loads
export SUPABASE_SECRET_KEY SUPABASE_URL DATABASE_URL
pnpm superadmin
