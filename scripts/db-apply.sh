#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)

if [ ! -f "$ROOT_DIR/admin/.env" ]; then
  echo "Missing admin/.env"
  exit 1
fi

set -a
. "$ROOT_DIR/admin/.env"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Missing DATABASE_URL in admin/.env"
  exit 1
fi

echo "Applying fixed schema: supabase/schema.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/supabase/schema.sql"
