#!/usr/bin/env bash
# Apply every db/postgres/migrations/*.sql file in lexical order against
# the DATABASE_URL. Idempotent: tracks applied filenames in the
# schema_migrations table (created by 0006_schema_migrations.sql).
#
# First-time run: 0006 creates the tracking table and backfills
# 0001-0005 if those tables already exist (e.g., a Railway DB that was
# migrated before this tracker landed).
#
# Subsequent runs: skip every filename present in schema_migrations.
set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG_DIR="$SCRIPT_DIR/migrations"

if [ ! -d "$MIG_DIR" ]; then
  echo "no migrations directory at $MIG_DIR" >&2
  exit 1
fi

# Bootstrap the tracker table separately (so we can query it before the
# main loop). If 0001..0005 ran on this DB before this tracker existed
# (e.g., Railway migrated under the old apply.sh), backfill those
# filenames so the loop skips them. Detection: if `products` table
# exists, those five migrations have already executed.
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  INSERT INTO schema_migrations (filename)
  SELECT f FROM (VALUES
    ('0001_initial.sql'),
    ('0002_auth.sql'),
    ('0003_passkeys.sql'),
    ('0004_magic_links.sql'),
    ('0005_approvals.sql')
  ) AS m(f)
  WHERE EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'products'
  )
  ON CONFLICT (filename) DO NOTHING;
" >/dev/null

# Pull already-applied filenames into a bash array.
APPLIED=$(psql "$DB_URL" -t -A -c "SELECT filename FROM schema_migrations" || true)

is_applied() {
  local name="$1"
  while IFS= read -r line; do
    [ "$line" = "$name" ] && return 0
  done <<< "$APPLIED"
  return 1
}

for f in "$MIG_DIR"/*.sql; do
  base="$(basename "$f")"
  if is_applied "$base"; then
    echo "skipping $base (already applied)"
    continue
  fi
  echo "applying $base"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c \
    "INSERT INTO schema_migrations (filename) VALUES ('$base') ON CONFLICT DO NOTHING;" \
    >/dev/null
done

echo "done"
