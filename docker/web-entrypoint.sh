#!/bin/sh
set -eu

ENV_JS_PATH="/usr/share/nginx/html/env.js"

escape_json() {
  printf '%s' "${1:-}" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

SUPABASE_URL_ESCAPED="$(escape_json "${VITE_SUPABASE_URL:-}")"
SUPABASE_ANON_KEY_ESCAPED="$(escape_json "${VITE_SUPABASE_ANON_KEY:-}")"

cat > "$ENV_JS_PATH" <<EOF
window.__APP_CONFIG__ = {
  runtime: "docker",
  VITE_SUPABASE_URL: "${SUPABASE_URL_ESCAPED}",
  VITE_SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY_ESCAPED}"
};
EOF
