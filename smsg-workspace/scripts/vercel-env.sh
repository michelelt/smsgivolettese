#!/usr/bin/env bash
# Sets Vercel env vars for smsg-api and smsg-web (ADR-073). Values are never printed.
# Usage: scripts/vercel-env.sh staging|production  (run via `make vercel-env ENV=...`, which sources secrets.env)
# Optional from secrets.env: SUPABASE_DB_PASSWORD_{STAGING,PROD}, RESEND_API_KEY, EMAIL_FROM,
# TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY, DB_POOLER_HOST. Missing ones are skipped with a warning.
set -euo pipefail
cd "$(dirname "$0")/../.."

case "${1:-}" in
  staging)
    target=preview ref=ydqdnicpfspqewclqrgk db_pass=${SUPABASE_DB_PASSWORD_STAGING:-}
    web=https://smsg-web-staging.vercel.app api=https://smsg-api-staging.vercel.app mfa=off ;;
  production)
    target=production ref=vcpmnpsfcgebhmgqlqeu db_pass=${SUPABASE_DB_PASSWORD_PROD:-}
    web=https://smsgivolettese.vercel.app api=https://smsg-api.vercel.app mfa=required ;;
  *) echo "usage: $0 staging|production" >&2; exit 1 ;;
esac

# set <project> <name> <value> [--sensitive]
set_var() {
  local project=$1 name=$2 value=$3; shift 3
  if [ -z "$value" ]; then echo "skip  $project $name (no value)" >&2; return; fi
  (cd "$project" && vercel env rm "$name" "$target" --yes >/dev/null 2>&1 || true
   printf '%s' "$value" | vercel env add "$name" "$target" "$@" >/dev/null 2>&1) \
    && echo "set   $project $name ($target)" || { echo "FAIL  $project $name" >&2; exit 1; }
}

keys=$(supabase projects api-keys --project-ref "$ref" --reveal -o json)
publishable=$(jq -r '.[] | select(.type=="publishable") | .api_key' <<<"$keys")
secret=$(jq -r '.[] | select(.type=="secret") | .api_key' <<<"$keys")
[[ $publishable == sb_publishable_* && $secret == sb_secret_* ]] || { echo "unexpected Supabase API keys for $ref" >&2; exit 1; }
supabase_url=https://$ref.supabase.co
proxy=$(openssl rand -hex 32) revalidate=$(openssl rand -hex 32) cron=$(openssl rand -hex 32)
db_url=
# Transaction pooler, port 6543; host shown in the dashboard (Connect > Transaction pooler)
[ -n "$db_pass" ] && db_url="postgresql://postgres.$ref:$(printf %s "$db_pass" | jq -sRr @uri)@${DB_POOLER_HOST:-aws-1-eu-central-1.pooler.supabase.com}:6543/postgres"

set_var smsg-api SUPABASE_URL "$supabase_url"
set_var smsg-api SUPABASE_SECRET_KEY "$secret" --sensitive
set_var smsg-api DATABASE_URL "$db_url" --sensitive
set_var smsg-api API_PROXY_SECRET "$proxy" --sensitive
set_var smsg-api REVALIDATE_SECRET "$revalidate" --sensitive
set_var smsg-api CRON_SECRET "$cron" --sensitive
set_var smsg-api TURNSTILE_SECRET_KEY "${TURNSTILE_SECRET_KEY:-}" --sensitive
set_var smsg-api RESEND_API_KEY "${RESEND_API_KEY:-}" --sensitive
set_var smsg-api EMAIL_FROM "${EMAIL_FROM:-}"
set_var smsg-api WEB_URL "$web"
set_var smsg-api SUPERADMIN_MFA "$mfa"
set_var smsg-api LOG_LEVEL info

set_var smsg-web API_URL "$api"
set_var smsg-web SITE_URL "$web"
set_var smsg-web NEXT_PUBLIC_SUPABASE_URL "$supabase_url"
set_var smsg-web NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "$publishable"
set_var smsg-web NEXT_PUBLIC_TURNSTILE_SITE_KEY "${TURNSTILE_SITE_KEY:-}"
set_var smsg-web API_PROXY_SECRET "$proxy" --sensitive
set_var smsg-web REVALIDATE_SECRET "$revalidate" --sensitive
