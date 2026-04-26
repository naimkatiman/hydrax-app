# Approvals Postgres persistence

**Date:** 2026-04-26
**Slug:** approvals-postgres-persistence
**Author:** Claude Opus 4.7 (1M context)
**Plan owner:** Naim Katiman
**Routed via:** `/proceed-with-claude-recommendation` (Phase 2 plan)

## Goal

Replace approval-svc's in-memory `MemRepo` with a Postgres-backed repo, behind a `Repo` interface so both backends coexist. Pg backend is used when `DATABASE_URL` is set (production, Railway); MemRepo stays as the local-dev / health-only fallback. Mirrors the persistence pattern already in workflow-svc.

## Why now

Approval-svc currently logs at startup: *"in-memory repo — persistence deferred"*. Process restart wipes every approval. That makes it impossible to:
- Validate the approval-chain UX in distributor-portal across server restarts
- Hold pending approvals while operators rotate
- Move toward the multi-approver chain in the PRD-v2 §11 issuance flow
- Reason about approval state from any other service — today the only access is through approval-svc's own process memory

(Note: `audit_events.resource_type` CHECK in `0001_initial.sql` does NOT include `'approval'`, so a direct join from audit_events to approvals is not in scope today. A future slice can add `'approval'` to that CHECK if the platform needs to audit approval transitions themselves.)

The schema and FK targets already exist in `0001_initial.sql` (`tenants`, `users`, `resource_type` enum). This is a small, well-scoped persistence slice — same shape as the product persistence slice from `2026-04-25-persistence-foundation.md`.

## Schema design

New migration `db/postgres/migrations/0005_approvals.sql`:

```sql
CREATE TABLE approvals (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    resource_type      TEXT NOT NULL CHECK (resource_type IN ('product','subscription','user','tenant')),
    resource_id        UUID NOT NULL,
    status             TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
    decided_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    decided_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_approvals_tenant_status ON approvals (tenant_id, status);
CREATE INDEX idx_approvals_resource ON approvals (resource_type, resource_id);
```

Decisions:
- **`resource_id UUID` (not generic).** All current resource types have UUID primary keys (products, subscriptions, users, tenants). Tightening the type now catches type-mismatch bugs at insert time. If a future resource type uses a different id format, that's a separate migration.
- **`tenant_id ON DELETE CASCADE`.** Approvals are tenant-scoped audit data; deleting a tenant should drop them. Mirrors `audit_events`.
- **`decided_by_user_id ON DELETE SET NULL`.** A user record might be removed for GDPR/offboarding; the historical approval row stays. Mirrors `audit_events.actor_user_id`.
- **No FK from `resource_id` to a polymorphic target.** Polymorphic FKs aren't expressible in SQL. The CHECK on `resource_type` plus index on `(resource_type, resource_id)` is the practical bound.
- **No `updated_at`.** This domain has exactly one mutating event per row (Decide). `decided_at` carries the timestamp. Adding `updated_at` with no second mutation is dead surface.
- **No optimistic-concurrency token.** Decide overwrites pending → terminal; double-decide is rejected at the application layer (`WHERE status = 'pending'` predicate). Mirrors the application-side intent.

## Files to touch (one commit per layer)

1. **Migration** (Phase A)
   - `db/postgres/migrations/0005_approvals.sql` (new)
   - `docs/env.md` (add `DATABASE_URL` note for approval-svc — currently only workflow-svc references it)
   Migration is reversible by `DROP TABLE approvals CASCADE` (one-liner, document inline as a comment header).

2. **Repo interface + Pg implementation** (Phase B)
   - `services/approval-svc/internal/approvals/repo.go` (extend — add `Repo` interface)
   - `services/approval-svc/internal/approvals/pg_repo.go` (new)
   - `services/approval-svc/internal/approvals/pg_repo_test.go` (new — Tx-bound, mirrors subscriptions repo_test pattern)
   - `services/approval-svc/internal/db/db.go` (new — mirrors `workflow-svc/internal/db`)
   - `services/approval-svc/internal/db/db_test.go` (new)
   - `services/approval-svc/go.mod`, `go.sum` (add `github.com/jackc/pgx/v5/stdlib`)
   Interface:
   ```go
   type Repo interface {
       Insert(ctx context.Context, in ApprovalInput) (*Approval, error)
       GetByID(ctx context.Context, id string) (*Approval, error)
       ListPending(ctx context.Context) ([]Approval, error)
       Decide(ctx context.Context, id string, in DecideInput) (*Approval, error)
   }
   ```
   Both `*MemRepo` and `*PgRepo` satisfy this. `IsNotFound(err)` continues to work across both backends — Pg wraps `sql.ErrNoRows` into the same package-level `errNotFound`.

3. **Handler refactor + main.go selection** (Phase C)
   - `services/approval-svc/internal/handlers/approvals.go` (modify — accept `approvals.Repo` not `*approvals.MemRepo`)
   - `services/approval-svc/internal/handlers/approvals_test.go` (no test code change needed — `*MemRepo` still satisfies `Repo`)
   - `services/approval-svc/cmd/server/main.go` (pick Pg if `DATABASE_URL` set, MemRepo otherwise; mirror workflow-svc pattern)

## Decisions on `Decide` semantics in Pg

- `Decide` runs `UPDATE approvals SET status=$1, decided_by_user_id=$2, decided_at=NOW() WHERE id=$3 AND status='pending' RETURNING …`. The `AND status='pending'` predicate enforces "first-decide-wins" at the row level. If the WHERE matches zero rows, the handler returns 409 `already_decided` (distinct from 404 not_found, so the caller can distinguish a genuinely missing id from a terminal row). To preserve that distinction, Pg `Decide` does a `GetByID` first; if the row is missing, return errNotFound (404). If the row exists but `UpdateStatus` matches zero rows, return a new `errAlreadyDecided` (409). This is two queries per Decide, which is fine — Decide is a low-throughput admin action.
- **Behavior change in MemRepo:** today MemRepo silently allows re-decide (lines 79–96 of repo.go); a second Decide overwrites the first. To converge with Pg, MemRepo gets the same first-decide-wins guard. This is technically a behavior change separate from "Postgres persistence" — it ships as **its own commit** (Phase B0) sandwiched between Phase A (migration) and Phase B (Pg repo), so the convergence is documented and reviewable in isolation, not buried in the Pg-repo diff.

## Out of scope (deferred follow-ups)

- Multi-approver chain (approver list per resource, threshold, escalation). The current single-approval-row model is what MemRepo + handlers already expose; this slice keeps that surface area unchanged.
- Webhook callback to workflow-svc on approval (so a product transition is automatically attempted when its required approval lands). Separate slice; needs an event bus or a direct HTTP call decision first.
- Approval expiration / SLA tracker (PRD §10 mentions approval SLA tracking).
- Pagination on `ListPending` (mirrors product list pagination work — separate follow-up once portal needs it).
- Cursor for the approval-chain audit join.

## Verification gates

After each phase commit:
- Phase A: `psql $DATABASE_URL -f db/postgres/migrations/0005_approvals.sql` against the test DB (port 5433); `psql … -c "\d approvals"` confirms shape (8 columns, two indexes, FKs to tenants and users); manual `INSERT ... RETURNING id` round-trip with a real tenant_id. **Important:** the test container persists data via the `hydrax-pg-test-data` volume, so re-running `apply.sh` against an already-migrated DB will fail on duplicates. Apply 0005 alone with `psql -f` for the running container, OR `docker compose down -v && docker compose up -d` then `apply.sh` for a clean state.
- Phase B0 (MemRepo parity): `cd services/approval-svc && go test ./internal/approvals` — new MemRepo test asserts re-decide returns errAlreadyDecided.
- Phase B (Pg repo): `cd services/approval-svc && GOWORK=off go build ./... && DATABASE_URL=postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable go test ./internal/approvals ./internal/db -run Pg`. MemRepo tests stay green without DATABASE_URL.
- Phase C: `cd services/approval-svc && GOWORK=off go build ./... && go test ./...`. Run service locally with DATABASE_URL set; curl POST /v1/approvals + GET /v1/approvals/{id} + POST /v1/approvals/{id}/decide round-trip; restart service; GET the same id and confirm it persists.

Per CLAUDE.md `GOWORK=off go build` is the discipline gate before any go.mod commit (logged Past Mistake — Go Docker vs go.work divergence).

## Commit plan

1. `feat(db): add approvals table for approval-svc persistence` — migration + env.md
2. `fix(approval-svc): memrepo first-decide-wins for backend parity` — MemRepo guard + test (small, isolated, names the behavior change)
3. `feat(approval-svc): pg-backed approvals repo behind Repo interface` — interface + pg_repo + db package + Pg tests + go.mod/go.sum
4. `feat(approval-svc): wire pg repo when DATABASE_URL set, fall back to in-memory` — handler interface refactor + main.go

Four commits, each ≤8 files, each gated by per-phase verification. Splitting the MemRepo parity into its own commit (per code-review feedback) keeps the behavior change visible and reviewable in isolation rather than bundled into the Pg repo diff.

## Staging discipline (per CLAUDE.md Past Mistakes)

- Always `git add <named paths>` — never `git add -A` or `git commit -a`. The repo currently has untracked files from a parallel auth slice 2b session (`services/integration-svc/src/auth/notify-client.{ts,test.ts}`) that must NOT ride into these commits.
- Before each `git commit`, run `git diff --cached --name-only` and reconcile against the commit's stated scope; `git restore --staged <path>` any unrelated entry.
- STATE.yaml is on the concurrent-edit list — append `verification_log` lines per commit; re-read STATE.yaml immediately before any edit to `summary`/`current_focus` to avoid clobbering a concurrent session's update.

## Risks

- **Pg dependency add.** approval-svc's `go.mod` currently has zero non-stdlib deps. Adding `pgx/v5/stdlib` follows the workflow-svc precedent — no architectural concern but is a new transitive surface. Mitigation: pin the same pgx version workflow-svc uses for parity.
- **Test infra dependency on docker compose Postgres.** Pg tests require `DATABASE_URL` exactly as workflow-svc subscriptions tests do. If unset, tests `t.Fatal` — never silent-skip. Documented in repo_test.
- **Behavior divergence (MemRepo Decide allows re-decide today).** Tightening MemRepo to match Pg's "first-decide-wins" is a small behavior change. Logged inline. Tests added to lock the new behavior in both backends.
- **Migration ordering.** This is migration `0005`, sitting after `0004_magic_links.sql` (auth slice 2b). If auth slice 2b lands or rebases concurrently, renumber to `0006_*`. Cheap fix.
