#!/usr/bin/env bash
# Read-only deploy check (ADR-073). Usage: deploy-check.sh staging|production
# Uses the supabase CLI session (no token handling here); never prints secrets.
set -euo pipefail
env="${1:?usage: deploy-check.sh staging|production}"
cd "$(dirname "$0")/../../smsg-api"
case "$env" in
  staging)    ref=ydqdnicpfspqewclqrgk; web=https://smsg-web-staging.vercel.app; api=https://smsg-api-staging.vercel.app ;;
  production) ref=vcpmnpsfcgebhmgqlqeu; web=https://smsgivolettese.vercel.app;   api=https://smsg-api.vercel.app ;;
  *) echo "unknown env: $env" >&2; exit 2 ;;
esac
fail=0
ok()  { echo "ok    $*"; }
bad() { echo "FAIL  $*"; fail=1; }

status=$(supabase projects list -o json | jq -r --arg r "$ref" '.[]|select(.ref==$r)|.status')
[ "$status" = ACTIVE_HEALTHY ] && ok "project $ref $status" || bad "project $ref status '${status:-missing}'"

# Declared settings vs remote; pooler sizes are dashboard-only, remote_only is not declared.
drift=$(supabase config diff --project-ref "$ref" 2>/dev/null | grep '^{' | jq -r \
  '.changes[]|select(.declared==true and (.path[0:2]!=["db","pooler"]))|.path|join(".")')
[ -z "$drift" ] && ok "config.toml matches remote" || bad "config drift: ${drift//$'\n'/ }"

mig=$(supabase db push --project-ref "$ref" --dry-run 2>/dev/null | grep '^{' | jq -r '.upToDate')
[ "$mig" = true ] && ok "migrations up to date" || bad "pending migrations"

b=$(supabase db query --linked --project-ref "$ref" "select string_agg(id||':'||public,',' order by id) from storage.buckets" -o json \
  | jq -r '.rows[0].string_agg')
[ "$b" = "media:true,proposals:false" ] && ok "storage buckets ($b)" || bad "storage buckets '$b'"

code() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$1" || true; }
# A missing deployment or alias is a failure, not a skip
c=$(code "$web/"); [ "$c" = 200 ] && ok "web $web 200" || bad "web $web -> $c"
body=$(curl -s --max-time 15 "$api/health" || true)
[ "$body" = '{"status":"ok"}' ] && ok "api $api/health 200" || bad "api $api/health -> ${body:0:60}"
exit $fail
