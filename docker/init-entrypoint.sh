#!/bin/sh
set -eu

required_vars="SUPABASE_ACCESS_TOKEN PROJECT_REF SUPABASE_DB_PASSWORD"
missing_vars=""

for var_name in $required_vars; do
  eval "value=\${$var_name:-}"
  if [ -z "$value" ]; then
    missing_vars="$missing_vars $var_name"
  fi
done

if [ -n "$missing_vars" ]; then
  echo "[init] Skipping Supabase initialization. Missing:$missing_vars"
  exit 0
fi

echo "[init] Running Supabase initialization for project $PROJECT_REF"
npm run deploy:supabase:init
