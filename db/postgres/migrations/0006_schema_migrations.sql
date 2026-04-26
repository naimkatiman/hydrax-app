-- 0006_schema_migrations.sql
-- Track which migration files have been applied, so apply.sh can be
-- safely re-run against an already-migrated database. Without this,
-- re-running apply.sh against a Railway DB that already has the
-- 0001..0005 schema fails with "relation already exists" mid-stream.
--
-- The script reads from this table BEFORE attempting to apply each
-- file. New migrations append a row; already-applied ones are skipped.

CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill: any DB where 0001..0005 already ran (i.e., the products /
-- audit_events tables exist) was migrated before this tracker was
-- introduced. Mark those filenames as applied so apply.sh doesn't
-- attempt to re-run them.
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
