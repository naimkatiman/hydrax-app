#!/usr/bin/env bash
# Apply every db/postgres/migrations/*.sql file in lexical order against
# the DATABASE_URL. Idempotent on a fresh DB; will error on conflicts
# against an already-migrated DB (we don't track applied migrations yet
# — single 0001 file means this is fine for now).
set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG_DIR="$SCRIPT_DIR/migrations"

if [ ! -d "$MIG_DIR" ]; then
  echo "no migrations directory at $MIG_DIR" >&2
  exit 1
fi

for f in "$MIG_DIR"/*.sql; do
  echo "applying $(basename "$f")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "done"
