# Railway Postgres Provisioning — Runbook

> **Status:** ready-to-execute. Stops at the `railway add` line because **that line bills**. Auto-mode runs cannot provision shared paid infrastructure without explicit user authorization.
>
> **Resolves:** Tier-1 recommendation Item 14 — Provision Railway Postgres addon for workflow-svc.
>
> **Supersedes the runbook embedded in** [docs/plans/2026-04-25-persistence-foundation.md §Railway Provisioning Runbook](2026-04-25-persistence-foundation.md). That earlier runbook predates the migration tracker (`db/postgres/migrations/0006_schema_migrations.sql`) and predates 0002–0005. Use this one.

- **Date:** 2026-04-26
- **Scope:** workflow-svc only (other services do not currently read `DATABASE_URL`).
- **Cost:** Railway Postgres is usage-billed. On the Hobby plan baseline runs ~$5/mo; on the Pro plan it's $0/seat-flat-rate plus ~$5–10/mo storage + egress depending on traffic. Confirm current pricing on the Railway dashboard before running step 4.
- **Reversibility:** addon can be deleted from the Railway dashboard at any time. Workflow-svc will fail-soft (`/healthz` works without `DATABASE_URL`; CRUD endpoints return errors). No data is durable yet — no migrations run in production today. So this provisioning is fully reversible up to the point where production data is written.

## Pre-flight (NO billing yet — safe to run anytime)

Run these BEFORE the billing block to fail-fast on environment mismatch.

```bash
# 1. Railway CLI installed and logged in
railway --version
railway whoami

# 2. CLI linked to the right project. If unlinked, run `railway link`
#    and pick `hydrax-app`.
railway status

# 3. workflow-svc reads DATABASE_URL correctly. Local check:
cd services/workflow-svc
DATABASE_URL='postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' \
  go test ./internal/db/... ./internal/products/... ./internal/subscriptions/... ./internal/handlers/...
# All should be GREEN. Any FAIL means the service code isn't ready for
# a Railway DB either — debug locally first.

# 4. Migration script is idempotent. Already verified on
#    2026-04-26 against a fresh DB and an already-migrated DB.
#    Re-verify here if you've changed anything since:
docker compose -f db/postgres/docker-compose.test.yml up -d
DATABASE_URL='postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' \
  bash db/postgres/apply.sh   # first run — applies 0001..0006
DATABASE_URL='postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' \
  bash db/postgres/apply.sh   # second run — must print "skipping … (already applied)" for every file

# 5. Confirm the migration set you'll deploy
ls db/postgres/migrations/
# Expect: 0001_initial.sql 0002_auth.sql 0003_passkeys.sql
#         0004_magic_links.sql 0005_approvals.sql 0006_schema_migrations.sql
```

If any of these fail, **stop**. Fix locally before touching shared infra.

## Outstanding code-side gates

The persistence-foundation slice and the workflow-svc lifecycle slices have all merged. There are two gates outside this runbook that you should be aware of before you point a real DB at workflow-svc:

1. **workflow-svc Docker build toolchain.** [CLAUDE.md / TradeClaw decisions log] notes "Railway redeploy of workflow-svc still gated on pgx 5.9.2 + alpine 1.22 toolchain decision." That gate predates this runbook. If it has been resolved since, reflect that here. If not, fix it before step 5 (the redeploy).
2. **workflow-svc → hydrax-adapter HTTP wire-up.** Currently `_ = rails` in `services/workflow-svc/cmd/server/main.go` (per STATE.yaml `next_actions`). Provisioning Postgres does not unblock that follow-up — they are independent.

Neither blocks **provisioning** the addon. Both block "the deployed workflow-svc actually does something useful with the DB" — so the addon will sit idle until the toolchain gate is closed.

## The billing block — RUN ONLY WHEN AUTHORIZED

> Each command in this section either creates a paid resource or modifies a deployed service. Read the cost note above. The `railway add` line is the point of no easy return — after it runs, the addon exists and starts billing.

```bash
# A. Provision the Postgres addon. THIS BILLS.
#    Confirms shape: a separate Postgres service appears in the project.
railway add --plugin postgresql

# B. Capture the DSN. Railway also injects DATABASE_URL into
#    same-project services automatically — this just verifies it.
railway run --service workflow-svc -- bash -c 'echo $DATABASE_URL'

# C. Apply migrations using the local apply.sh against the Railway DSN.
#    apply.sh is idempotent — safe to re-run.
DSN=$(railway run --service workflow-svc -- bash -c 'echo $DATABASE_URL' | tail -1)
DATABASE_URL="$DSN" bash db/postgres/apply.sh
# Expect 6 "applying …" lines (fresh DB), then "done".

# D. Verify schema landed.
railway run --service workflow-svc -- psql "$DSN" -c "\dt"
# Expect: 9 tables (approvals, audit_events, magic_link_tokens, products,
#         schema_migrations, subscriptions, tenants, user_passkeys,
#         user_sessions, users) — same set as local Postgres.
railway run --service workflow-svc -- psql "$DSN" -c \
  "SELECT filename FROM schema_migrations ORDER BY filename"
# Expect: 0001..0006 listed.

# E. Wire workflow-svc to the addon. Railway dashboard:
#    workflow-svc → Variables → New Variable Reference →
#    DATABASE_URL = ${{Postgres.DATABASE_URL}}
#    Save. Service redeploys.

# F. Smoke the deployed service.
RAILWAY_URL=$(railway status --json | jq -r '.deployments[] | select(.serviceName=="workflow-svc") | .url' | head -1)
curl -sS "https://$RAILWAY_URL/healthz"
# Expect: {"service":"workflow-svc","status":"ok"}

# G. Round-trip test: insert a tenant + product, read it back.
#    (Tenant first because products has FK to tenants.)
railway run --service workflow-svc -- psql "$DSN" -c \
  "INSERT INTO tenants (slug,name,persona) VALUES ('railway-smoke','Railway Smoke','issuer') RETURNING id" \
  > /tmp/tenant_id.txt
TENANT_ID=$(awk '/^ +[0-9a-f-]+$/{print $1; exit}' /tmp/tenant_id.txt)
curl -sS -X POST "https://$RAILWAY_URL/v1/products" \
  -H 'Content-Type: application/json' \
  -d "{\"tenant_id\":\"$TENANT_ID\",\"code\":\"smoke-001\",\"name\":\"Smoke Product\",\"product_type\":\"credit\"}"
# Expect: 201 with the product json including a UUID id.

# H. Cleanup the smoke tenant (optional, recommended).
railway run --service workflow-svc -- psql "$DSN" -c \
  "DELETE FROM tenants WHERE slug='railway-smoke'"
```

## After the smoke passes

1. Update [STATE.yaml](../../STATE.yaml) `verification_log` with the Railway service name, build id, and timestamp of the round-trip.
2. Add a one-line entry to CLAUDE.md "Decisions (Recent)": `2026-MM-DD — Railway Postgres provisioned for workflow-svc; six migrations applied; round-trip smoke green.`
3. Move "Provision Railway Postgres addon for workflow-svc" out of `next_actions` in STATE.yaml.
4. Open follow-up: workflow-svc Docker build toolchain (pgx 5.9.2 + alpine 1.22) if still pending.

## If something goes wrong

- **`railway add --plugin postgresql` fails or asks for plan upgrade.** Stop. The Railway plan tier is the blocker, not the code.
- **Step C migration apply errors mid-stream.** The script is idempotent — re-run. If errors persist, dump the Railway DB schema (`pg_dump --schema-only`) and compare against expected. Likely cause: someone manually CREATEd one of these tables before this runbook ran; resolve manually then mark via `INSERT INTO schema_migrations`.
- **Step E wire-up doesn't take.** Workflow-svc logs `DATABASE_URL unset`. Confirm the variable reference syntax in the dashboard matches `${{Postgres.DATABASE_URL}}` exactly (curly-brace count is load-bearing). Redeploy after fix.
- **Step G returns 500.** Check workflow-svc logs for pgx connection errors. If "tls: …", the Railway DSN includes `?sslmode=require` which pgx handles natively but the local `apply.sh` default DSN does NOT. Re-run with the Railway DSN exactly as Railway provides it.

## Out of scope for this runbook

- Multi-environment (staging/prod separation) — covered in a separate plan once the project graduates from one-environment-only.
- pgBouncer / connection pooling — workflow-svc uses pgx's built-in pool; revisit only if connection counts breach Railway's plan limit.
- Backups — Railway's Postgres addon includes daily backups on Pro; document tenant-level dump policy in a separate plan when first tenant data lands.
- audit-svc, integration-svc, bff persistence — those services have their own DSNs (`AUDIT_SVC_DATABASE_URL`, `INTEGRATION_SVC_DATABASE_URL`) and would each get their own runbook when wired.
