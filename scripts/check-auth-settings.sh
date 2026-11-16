#!/usr/bin/env bash
# Fails when the Supabase project still allows public signup (GAP-S-01).
# Reads VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from the environment,
# falling back to .env for local runs. Never prints the key.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${VITE_SUPABASE_URL:-}" || -z "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  [[ -f .env ]] || { echo "No .env and no VITE_SUPABASE_* in the environment"; exit 2; }
  VITE_SUPABASE_URL=$(grep -E '^\s*VITE_SUPABASE_URL=' .env | head -1 | sed 's/.*=//' | tr -d ' "')
  VITE_SUPABASE_PUBLISHABLE_KEY=$(grep -E '^\s*VITE_SUPABASE_PUBLISHABLE_KEY=' .env | head -1 | sed 's/.*=//' | tr -d ' "')
fi

settings=$(curl -sf -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" "$VITE_SUPABASE_URL/auth/v1/settings")
disable_signup=$(printf '%s' "$settings" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).disable_signup))')

if [[ "$disable_signup" == "true" ]]; then
  echo "OK: public signup is disabled"
else
  echo "FAIL: public signup is enabled (disable_signup=$disable_signup)."
  echo "Fix in the Supabase dashboard: Authentication > Sign In / Providers > turn off 'Allow new users to sign up'."
  exit 1
fi
