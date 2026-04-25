# audit-svc Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take `services/audit-svc` from a `/healthz`-only stub to a Postgres-backed append-only event log with two HTTP endpoints — POST `/v1/audit/events` (append) and GET `/v1/audit/events?tenant_id=&resource_type=&resource_id=` (list-by-resource). Mirrors the workflow-svc persistence pattern landed at commits `7114fcc..35e1060` so reviewers can lift conventions wholesale.

**Architecture:** `internal/db` owns the Postgres pool (pgx v5 via stdlib). `internal/audit` owns the immutable Event domain model + repository (Append + ListByResource). `internal/handlers` owns HTTP routing + JSON shape + body cap + error masking. `cmd/server/main.go` reads `DATABASE_URL` — if set, it pings (3s) and registers product-event routes; if unset, only `/healthz` is served (deploy-without-DB stays viable, same gate as workflow-svc).

**Tech Stack:** Go 1.22, `database/sql` + `github.com/jackc/pgx/v5/stdlib` (already pinned), Postgres 16 via existing `db/postgres/docker-compose.test.yml` on `:5433`, plain-SQL migrations via `db/postgres/apply.sh`. **No new deps** — every import path already exists in workflow-svc.

---

## Boundary Conditions (read before starting)

1. **Schema is canonical.** `audit_events` is already migrated (see `db/postgres/migrations/0001_initial.sql:56-67`). Do not invent new columns. Do not write a 0002 migration in this slice.
2. **Existing `audit.Event` struct will be REWRITTEN.** Current fields (`ActorID`, `TargetType`, `TargetID`, `OccurredAt`, `Metadata`) do not match the migrated schema. Replace, do not extend. Nothing else in the repo imports this struct yet — the rewrite is safe.
3. **Append-only by design.** No `Update`, no `Delete` — the audit log is immutable post-write. Updates happen by writing a new event referencing the same resource.
4. **Slice does NOT touch workflow-svc, BFF, or any portal app.** Cross-service wiring (workflow-svc emitting audit events on product create) is a SEPARATE slice — out of scope here.
5. **Slice does NOT add Railway service or addon.** Local stack only. Deploy is documented but not executed.
6. **Per-commit caps still apply.** ≤15 files per commit. One concern per commit. Lead commit messages with the outcome.
7. **Verification gates from CLAUDE.md are mandatory** before each commit:
   - `(cd services/audit-svc && go vet ./...)` silent
   - `(cd services/audit-svc && DATABASE_URL=... go test ./...)` green
8. **Container runtime needed for tests.** The test DB lives in `db/postgres/docker-compose.test.yml`. If docker is unavailable, halt and surface — do not skip tests, do not mock the DB layer (per user's testing rule: "integration tests must hit a real database, not mocks").
9. **Safe staging only.** Use `git add <specific files>`. Never `git add -A` (parallel sessions may have unrelated working-tree changes — see CLAUDE.md Past Mistakes 2026-04-25 entry on multi-agent working trees).

## File Structure

```
hydrax-app/
  services/
    audit-svc/
      go.mod                                          # MODIFY — add pgx import
      cmd/server/main.go                              # MODIFY — DATABASE_URL gate + route wire
      internal/
        db/
          db.go                                       # NEW — OpenPool helper (mirror of workflow-svc/internal/db/db.go)
          db_test.go                                  # NEW — Ping test
        audit/
          audit.go                                    # MODIFY — rewrite Event struct to match schema
          repo.go                                     # NEW — Append + ListByResource
          repo_test.go                                # NEW — txn-rollback isolation
        handlers/
          health.go                                   # UNCHANGED
          health_test.go                              # UNCHANGED
          events.go                                   # NEW — POST + GET list handlers
          events_test.go                              # NEW — handler-level tests with httptest
  docs/plans/
    2026-04-25-audit-svc-persistence.md               # THIS FILE
  STATE.yaml                                          # MODIFY at slice close
```

**Why `events.go` not `audit.go` for the handler file:** `audit.go` already exists in `internal/audit/` (the domain). Naming the handler file the same as the package would shadow the namespace mentally. `events.go` mirrors the URL shape (`/v1/audit/events`) and reads more clearly in stack traces.

---

## Precedent: Read These First

Before starting, the implementer should skim these files to absorb the established conventions. **Do not reinvent — copy the shape.**

- `services/workflow-svc/internal/db/db.go` — exact pool config (`SetMaxOpenConns(20)`, `SetMaxIdleConns(5)`)
- `services/workflow-svc/internal/db/db_test.go` — `requireDSN` helper that fatals (does not skip) when `DATABASE_URL` unset
- `services/workflow-svc/internal/products/repo.go` — querier interface, `IsNotFound`, `Insert` shape with `RETURNING`
- `services/workflow-svc/internal/products/repo_test.go` — `withTx` returning `(ctx, repo, *sql.Tx)`, `seedTenant` taking the Tx
- `services/workflow-svc/internal/handlers/products.go` — body cap (`http.MaxBytesReader`), error masking (`log.Printf` then static message), `errorJSON` helper, SQLSTATE 23505 duck-typed detection
- `services/workflow-svc/cmd/server/main.go` — DATABASE_URL gate, 3s `PingContext` fail-fast, `url.Parse → u.Redacted()` for log safety

---

## Task 1: Postgres Connection Helper

**Files:**
- Create: `services/audit-svc/internal/db/db.go`
- Create: `services/audit-svc/internal/db/db_test.go`
- Modify: `services/audit-svc/go.mod` (via `go mod tidy`)

- [ ] **Step 1: Write the failing test**

Create `services/audit-svc/internal/db/db_test.go`:

```go
package db

import (
	"context"
	"os"
	"testing"
	"time"
)

// requireDSN aborts the test if DATABASE_URL is not set. We do not skip
// — missing DB during test is a regression, not an environmental
// excuse. Run db/postgres/docker-compose.test.yml first.
func requireDSN(t *testing.T) string {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Fatal("DATABASE_URL not set; run docker compose -f db/postgres/docker-compose.test.yml up -d")
	}
	return dsn
}

func TestOpenPoolPings(t *testing.T) {
	dsn := requireDSN(t)
	pool, err := OpenPool(dsn)
	if err != nil {
		t.Fatalf("OpenPool: %v", err)
	}
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := pool.PingContext(ctx); err != nil {
		t.Fatalf("PingContext: %v", err)
	}
}

func TestOpenPoolRejectsEmptyDSN(t *testing.T) {
	if _, err := OpenPool(""); err == nil {
		t.Fatal("expected error for empty DSN, got nil")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/audit-svc && go test ./internal/db/...
```

Expected: build failure — `OpenPool` undefined.

- [ ] **Step 3: Write minimal implementation**

Create `services/audit-svc/internal/db/db.go`:

```go
// Package db is audit-svc's Postgres helper. Owns connection-pool
// construction. Repositories under sibling packages depend on a
// *sql.DB built here.
package db

import (
	"database/sql"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// OpenPool returns a *sql.DB backed by pgx's database/sql driver.
// dsn is a libpq-style connection string, e.g.
// "postgres://user:pass@host:5432/db?sslmode=disable".
//
// Caller owns the pool and must Close it at shutdown.
func OpenPool(dsn string) (*sql.DB, error) {
	if dsn == "" {
		return nil, fmt.Errorf("db.OpenPool: empty dsn")
	}
	pool, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("db.OpenPool: open: %w", err)
	}
	pool.SetMaxOpenConns(20)
	pool.SetMaxIdleConns(5)
	return pool, nil
}
```

- [ ] **Step 4: Add pgx dep**

```bash
cd services/audit-svc && go mod tidy
```

Expected: `go.mod` now imports `github.com/jackc/pgx/v5 v5.9.2` (or whatever workflow-svc has — they MUST match).

**Critical:** verify the `go` directive in `services/audit-svc/go.mod` is still `1.22` (not `1.25.0`). `go mod tidy` may bump it to the local toolchain. If bumped, fix manually:

```bash
sed -i 's/^go 1\.[0-9]*\(\.[0-9]*\)*$/go 1.22/' services/audit-svc/go.mod
```

This is a known footgun — see CLAUDE.md Past Mistakes 2026-04-25 entry on `go mod tidy` toolchain promotion.

- [ ] **Step 5: Run tests**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
docker compose -f db/postgres/docker-compose.test.yml up -d
sleep 2
cd services/audit-svc
DATABASE_URL='postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' go test ./internal/db/...
```

Expected: `PASS` for both `TestOpenPoolPings` and `TestOpenPoolRejectsEmptyDSN`.

- [ ] **Step 6: Verify go vet clean**

```bash
cd services/audit-svc && go vet ./...
```

Expected: silent (zero output).

- [ ] **Step 7: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git add services/audit-svc/internal/db/ services/audit-svc/go.mod services/audit-svc/go.sum
git commit -m "$(cat <<'EOF'
feat(audit-svc): add Postgres connection helper (pgx via database/sql)

Mirrors services/workflow-svc/internal/db. Same pool config,
same requireDSN test helper that fatals (not skips) on missing
DATABASE_URL.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Domain Model Rewrite

**Files:**
- Modify: `services/audit-svc/internal/audit/audit.go`

The existing `Event` struct does not match the schema. Rewrite to align field-by-field with `audit_events` columns. Nothing else in the codebase imports this package yet (verified — only `cmd/server/main.go` uses the audit-svc package indirectly via handlers).

- [ ] **Step 1: Verify no external callers**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
grep -rn "audit-svc/internal/audit" services/ web/ 2>/dev/null
```

Expected: zero hits (only `main.go` uses other audit-svc internals, never this package directly).

- [ ] **Step 2: Replace audit.go**

Overwrite `services/audit-svc/internal/audit/audit.go`:

```go
// Package audit holds the immutable action-log domain model and the
// Postgres-backed repository. Append-only — events are never updated
// or deleted; corrections happen by appending a new event that
// references the same resource.
package audit

import (
	"encoding/json"
	"time"
)

// Event is one row of audit_events. Field names map 1:1 to the schema:
// id, tenant_id, actor_user_id, action, resource_type, resource_id,
// payload, created_at. ActorUserID is *string because the schema
// permits NULL (system-generated events have no user actor).
type Event struct {
	ID           string
	TenantID     string
	ActorUserID  *string
	Action       string
	ResourceType string
	ResourceID   string
	Payload      json.RawMessage
	CreatedAt    time.Time
}

// EventInput is the user-supplied subset for Append. Server fills id,
// created_at via DB defaults.
type EventInput struct {
	TenantID     string
	ActorUserID  *string
	Action       string
	ResourceType string
	ResourceID   string
	Payload      json.RawMessage
}
```

- [ ] **Step 3: Verify build**

```bash
cd services/audit-svc && go vet ./...
```

Expected: silent.

- [ ] **Step 4: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git add services/audit-svc/internal/audit/audit.go
git commit -m "$(cat <<'EOF'
refactor(audit-svc): align Event struct with audit_events schema

Old field names (ActorID, TargetType, TargetID, OccurredAt,
Metadata) did not match the migrated columns. Rewrite to map 1:1
with the schema. Adds EventInput as the user-supplied subset for
Append. Nothing else in the codebase imported the old shape.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Repository — Append + ListByResource

**Files:**
- Create: `services/audit-svc/internal/audit/repo.go`
- Create: `services/audit-svc/internal/audit/repo_test.go`

- [ ] **Step 1: Write the failing tests**

Create `services/audit-svc/internal/audit/repo_test.go`:

```go
package audit

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// openTestDB connects to the compose-stack DB. Each test wraps its work
// in a Tx that t.Cleanup rolls back, so no fixture reset is needed.
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Fatal("DATABASE_URL not set; run docker compose -f db/postgres/docker-compose.test.yml up -d")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

// withTx wraps a test in a Tx that always rolls back. Returns the
// context, an *Events bound to that Tx, and the raw *sql.Tx for
// direct seed queries.
func withTx(t *testing.T) (context.Context, *Events, *sql.Tx) {
	t.Helper()
	db := openTestDB(t)
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("BeginTx: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback() })
	return context.Background(), New(tx), tx
}

// seedTenant inserts a throwaway tenant inside the given Tx and
// returns its id.
func seedTenant(t *testing.T, ctx context.Context, tx *sql.Tx) string {
	t.Helper()
	var id string
	err := tx.QueryRowContext(ctx,
		`INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
		"acme-audit-test", "Acme Audit Test",
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedTenant: %v", err)
	}
	return id
}

// seedProduct inserts a throwaway product so we have a valid
// resource_id to reference.
func seedProduct(t *testing.T, ctx context.Context, tx *sql.Tx, tenantID string) string {
	t.Helper()
	var id string
	err := tx.QueryRowContext(ctx,
		`INSERT INTO products (tenant_id, code, name, product_type)
		 VALUES ($1, 'AUDIT-TEST-001', 'Audit Test Product', 'short_duration_credit')
		 RETURNING id`,
		tenantID,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedProduct: %v", err)
	}
	return id
}

func TestAppendReturnsRowWithDefaults(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	productID := seedProduct(t, ctx, tx, tenantID)

	got, err := repo.Append(ctx, EventInput{
		TenantID:     tenantID,
		Action:       "product.created",
		ResourceType: "product",
		ResourceID:   productID,
		Payload:      json.RawMessage(`{"code":"AUDIT-TEST-001"}`),
	})
	if err != nil {
		t.Fatalf("Append: %v", err)
	}
	if got.ID == "" {
		t.Error("expected generated ID, got empty")
	}
	if got.CreatedAt.IsZero() {
		t.Error("expected CreatedAt populated")
	}
	if got.Action != "product.created" {
		t.Errorf("Action mismatch: got %q", got.Action)
	}
}

func TestAppendAcceptsNilActorAndEmptyPayload(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	productID := seedProduct(t, ctx, tx, tenantID)

	got, err := repo.Append(ctx, EventInput{
		TenantID:     tenantID,
		ActorUserID:  nil,
		Action:       "system.heartbeat",
		ResourceType: "product",
		ResourceID:   productID,
		Payload:      nil,
	})
	if err != nil {
		t.Fatalf("Append: %v", err)
	}
	if got.ActorUserID != nil {
		t.Errorf("expected nil ActorUserID, got %v", got.ActorUserID)
	}
	if string(got.Payload) != "{}" {
		t.Errorf("expected default payload {}, got %s", string(got.Payload))
	}
}

func TestAppendRejectsBadResourceType(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	productID := seedProduct(t, ctx, tx, tenantID)

	_, err := repo.Append(ctx, EventInput{
		TenantID:     tenantID,
		Action:       "weird.action",
		ResourceType: "spaceship",
		ResourceID:   productID,
		Payload:      json.RawMessage(`{}`),
	})
	if err == nil {
		t.Fatal("expected CHECK constraint to reject 'spaceship', got nil error")
	}
}

func TestListByResourceReturnsAppendedEventsNewestFirst(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	productID := seedProduct(t, ctx, tx, tenantID)

	for _, action := range []string{"product.created", "product.approved", "product.activated"} {
		if _, err := repo.Append(ctx, EventInput{
			TenantID:     tenantID,
			Action:       action,
			ResourceType: "product",
			ResourceID:   productID,
			Payload:      json.RawMessage(`{}`),
		}); err != nil {
			t.Fatalf("Append %s: %v", action, err)
		}
	}

	got, err := repo.ListByResource(ctx, tenantID, "product", productID)
	if err != nil {
		t.Fatalf("ListByResource: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("expected 3 events, got %d", len(got))
	}
	// newest first
	if got[0].Action != "product.activated" {
		t.Errorf("expected newest first, got %q at index 0", got[0].Action)
	}
	if got[2].Action != "product.created" {
		t.Errorf("expected oldest last, got %q at index 2", got[2].Action)
	}
}

func TestListByResourceReturnsEmptySliceForNoMatches(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)

	got, err := repo.ListByResource(ctx, tenantID, "product",
		"00000000-0000-0000-0000-000000000000")
	if err != nil {
		t.Fatalf("ListByResource: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty slice, got %d events", len(got))
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd services/audit-svc && DATABASE_URL='postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' go test ./internal/audit/...
```

Expected: build failure — `Events`, `New`, `Append`, `ListByResource` undefined.

- [ ] **Step 3: Write the repository**

Create `services/audit-svc/internal/audit/repo.go`:

```go
package audit

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
)

// querier is the subset of *sql.DB / *sql.Tx the repo actually uses.
// Lets callers (and tests) bind the repo to a Tx for rollback semantics.
type querier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

// Events is the audit_events repository. Caller owns lifetime of the
// underlying querier.
type Events struct {
	tx querier
}

// New binds an Events repo to the given querier (typically *sql.DB or
// *sql.Tx). Use *sql.Tx in tests for rollback isolation.
func New(tx querier) *Events {
	return &Events{tx: tx}
}

// Tx returns the underlying querier — only useful in tests that need
// to seed FK rows inside the same transaction. Production callers
// should not depend on this.
func (e *Events) Tx() querier {
	return e.tx
}

// Append persists a new audit event and returns the row including
// server defaults (id, created_at, payload default).
func (e *Events) Append(ctx context.Context, in EventInput) (*Event, error) {
	payload := in.Payload
	if payload == nil {
		payload = json.RawMessage(`{}`)
	}
	const q = `
		INSERT INTO audit_events
			(tenant_id, actor_user_id, action, resource_type, resource_id, payload)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, tenant_id, actor_user_id, action, resource_type, resource_id, payload, created_at
	`
	var got Event
	err := e.tx.QueryRowContext(ctx, q,
		in.TenantID, in.ActorUserID, in.Action, in.ResourceType, in.ResourceID, payload,
	).Scan(
		&got.ID, &got.TenantID, &got.ActorUserID, &got.Action,
		&got.ResourceType, &got.ResourceID, &got.Payload, &got.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("audit.Append: %w", err)
	}
	return &got, nil
}

// ListByResource returns audit events for the given resource, newest
// first. Returns an empty slice (not nil-error nil-slice) when no
// matches exist.
func (e *Events) ListByResource(ctx context.Context, tenantID, resourceType, resourceID string) ([]Event, error) {
	const q = `
		SELECT id, tenant_id, actor_user_id, action, resource_type, resource_id, payload, created_at
		FROM audit_events
		WHERE tenant_id = $1 AND resource_type = $2 AND resource_id = $3
		ORDER BY created_at DESC, id DESC
	`
	rows, err := e.tx.QueryContext(ctx, q, tenantID, resourceType, resourceID)
	if err != nil {
		return nil, fmt.Errorf("audit.ListByResource: %w", err)
	}
	defer rows.Close()

	out := make([]Event, 0)
	for rows.Next() {
		var ev Event
		if err := rows.Scan(
			&ev.ID, &ev.TenantID, &ev.ActorUserID, &ev.Action,
			&ev.ResourceType, &ev.ResourceID, &ev.Payload, &ev.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("audit.ListByResource scan: %w", err)
		}
		out = append(out, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("audit.ListByResource rows: %w", err)
	}
	return out, nil
}
```

**Notes on the secondary `id DESC` tiebreak:** `created_at` has microsecond resolution but two events appended back-to-back inside one Tx can share a timestamp. The secondary sort by `id DESC` makes the order stable for tests.

- [ ] **Step 4: Run tests**

```bash
cd services/audit-svc && DATABASE_URL='postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' go test ./internal/audit/... -v
```

Expected: 5 PASS (`TestAppendReturnsRowWithDefaults`, `TestAppendAcceptsNilActorAndEmptyPayload`, `TestAppendRejectsBadResourceType`, `TestListByResourceReturnsAppendedEventsNewestFirst`, `TestListByResourceReturnsEmptySliceForNoMatches`).

- [ ] **Step 5: Verify go vet**

```bash
cd services/audit-svc && go vet ./...
```

Expected: silent.

- [ ] **Step 6: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git add services/audit-svc/internal/audit/repo.go services/audit-svc/internal/audit/repo_test.go
git commit -m "$(cat <<'EOF'
feat(audit-svc): Append + ListByResource Postgres repository

Mirrors services/workflow-svc/internal/products. Tx-bound querier
interface, txn-rollback test isolation, no fixture reset. Sort
order is created_at DESC with id DESC tiebreak so tests are
stable when multiple events share a microsecond.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: HTTP Handlers

**Files:**
- Create: `services/audit-svc/internal/handlers/events.go`
- Create: `services/audit-svc/internal/handlers/events_test.go`

- [ ] **Step 1: Write the failing tests**

Create `services/audit-svc/internal/handlers/events_test.go`:

```go
package handlers

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/naimkatiman/hydrax-app/services/audit-svc/internal/audit"
)

// requireDB opens the compose-stack DB. Handler tests are full end-to-end:
// real Postgres, real INSERT. We do NOT mock the repo (per testing rule:
// integration tests must hit a real database).
func requireDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Fatal("DATABASE_URL not set")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

// seedTenantAndProduct inserts throwaway rows OUTSIDE a Tx so the handler
// (which uses its own pool connection) can see them. Cleanup deletes them
// in dependency order: products has ON DELETE RESTRICT for tenant_id, so
// products must go before tenants. audit_events cascades from tenants.
func seedTenantAndProduct(t *testing.T, db *sql.DB) (tenantID, productID string) {
	t.Helper()
	suffix := randSuffix()
	err := db.QueryRow(
		`INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
		"audit-handler-test-"+suffix, "Audit Handler Test",
	).Scan(&tenantID)
	if err != nil {
		t.Fatalf("seed tenant: %v", err)
	}
	err = db.QueryRow(
		`INSERT INTO products (tenant_id, code, name, product_type)
		 VALUES ($1, $2, 'Test', 'short_duration_credit') RETURNING id`,
		tenantID, "AHT-"+suffix,
	).Scan(&productID)
	if err != nil {
		t.Fatalf("seed product: %v", err)
	}
	t.Cleanup(func() {
		// Order matters: products RESTRICT tenant delete; audit_events
		// cascades from tenant, so deleting tenant cleans events too,
		// but products must go first.
		_, _ = db.Exec(`DELETE FROM products WHERE tenant_id = $1`, tenantID)
		_, _ = db.Exec(`DELETE FROM tenants WHERE id = $1`, tenantID)
	})
	return tenantID, productID
}

// randSuffix produces an 8-char hex tag (4 random bytes) so parallel
// runs do not collide on UNIQUE (tenants.slug) or UNIQUE
// (products.tenant_id, code). crypto/rand is overkill for tests but
// avoids the deterministic-suffix bug that comes with hand-rolled
// pseudo-random over a fixed-length byte slice.
func randSuffix() string {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		// rand.Read on Linux never errors in practice; fall back to a
		// fixed string just so the test does not panic.
		return "00000000"
	}
	return hex.EncodeToString(b)
}

func TestAppendHandlerReturns201(t *testing.T) {
	db := requireDB(t)
	tenantID, productID := seedTenantAndProduct(t, db)

	repo := audit.New(db)
	handler := Append(repo)

	body := map[string]any{
		"tenant_id":     tenantID,
		"action":        "product.created",
		"resource_type": "product",
		"resource_id":   productID,
		"payload":       map[string]string{"code": "AHT-x"},
	}
	buf := &bytes.Buffer{}
	if err := json.NewEncoder(buf).Encode(body); err != nil {
		t.Fatalf("encode: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/audit/events", buf)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d, body=%s", rec.Code, rec.Body.String())
	}
	var got map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got["id"] == nil || got["id"] == "" {
		t.Errorf("expected id in response, got %v", got)
	}
	if got["action"] != "product.created" {
		t.Errorf("expected action=product.created, got %v", got["action"])
	}
}

func TestAppendHandlerRejectsBadJSON(t *testing.T) {
	db := requireDB(t)
	repo := audit.New(db)
	handler := Append(repo)

	req := httptest.NewRequest(http.MethodPost, "/v1/audit/events", strings.NewReader("not json"))
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestAppendHandlerRejectsMissingFields(t *testing.T) {
	db := requireDB(t)
	repo := audit.New(db)
	handler := Append(repo)

	body := bytes.NewReader([]byte(`{"action":"x"}`))
	req := httptest.NewRequest(http.MethodPost, "/v1/audit/events", body)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d, body=%s", rec.Code, rec.Body.String())
	}
}

func TestAppendHandlerRejectsNonPOST(t *testing.T) {
	db := requireDB(t)
	repo := audit.New(db)
	handler := Append(repo)

	req := httptest.NewRequest(http.MethodGet, "/v1/audit/events", nil)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

func TestAppendHandlerRejectsOversizeBody(t *testing.T) {
	db := requireDB(t)
	repo := audit.New(db)
	handler := Append(repo)

	// 100 KB payload — over the 64 KB cap
	huge := bytes.Repeat([]byte("x"), 100*1024)
	body := []byte(`{"tenant_id":"x","action":"y","resource_type":"product","resource_id":"z","payload":"` + string(huge) + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/v1/audit/events", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 400 or 413 for oversize body, got %d", rec.Code)
	}
}

func TestListHandlerReturnsAppendedEvents(t *testing.T) {
	db := requireDB(t)
	tenantID, productID := seedTenantAndProduct(t, db)

	repo := audit.New(db)
	for _, action := range []string{"product.created", "product.approved"} {
		if _, err := repo.Append(context.TODO(), audit.EventInput{
			TenantID:     tenantID,
			Action:       action,
			ResourceType: "product",
			ResourceID:   productID,
			Payload:      json.RawMessage(`{}`),
		}); err != nil {
			t.Fatalf("seed Append: %v", err)
		}
	}

	listHandler := List(repo)
	url := "/v1/audit/events?tenant_id=" + tenantID + "&resource_type=product&resource_id=" + productID
	req := httptest.NewRequest(http.MethodGet, url, nil)
	rec := httptest.NewRecorder()
	listHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", rec.Code, rec.Body.String())
	}
	var got []map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 events, got %d", len(got))
	}
	// newest first
	if got[0]["action"] != "product.approved" {
		t.Errorf("expected newest first, got %v", got[0]["action"])
	}
}

func TestListHandlerRejectsMissingQueryParams(t *testing.T) {
	db := requireDB(t)
	repo := audit.New(db)
	handler := List(repo)

	req := httptest.NewRequest(http.MethodGet, "/v1/audit/events", nil)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing query params, got %d", rec.Code)
	}
}

func TestListHandlerRejectsNonGET(t *testing.T) {
	db := requireDB(t)
	repo := audit.New(db)
	handler := List(repo)

	req := httptest.NewRequest(http.MethodDelete, "/v1/audit/events?tenant_id=x&resource_type=product&resource_id=y", nil)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd services/audit-svc && DATABASE_URL='postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' go test ./internal/handlers/...
```

Expected: build failure — `Append` and `List` handlers undefined in this package.

- [ ] **Step 3: Write handlers**

Create `services/audit-svc/internal/handlers/events.go`:

```go
package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/naimkatiman/hydrax-app/services/audit-svc/internal/audit"
)

type appendBody struct {
	TenantID     string          `json:"tenant_id"`
	ActorUserID  *string         `json:"actor_user_id,omitempty"`
	Action       string          `json:"action"`
	ResourceType string          `json:"resource_type"`
	ResourceID   string          `json:"resource_id"`
	Payload      json.RawMessage `json:"payload,omitempty"`
}

type eventResponse struct {
	ID           string          `json:"id"`
	TenantID     string          `json:"tenant_id"`
	ActorUserID  *string         `json:"actor_user_id,omitempty"`
	Action       string          `json:"action"`
	ResourceType string          `json:"resource_type"`
	ResourceID   string          `json:"resource_id"`
	Payload      json.RawMessage `json:"payload"`
	CreatedAt    string          `json:"created_at"`
}

func toResponse(e *audit.Event) eventResponse {
	return eventResponse{
		ID:           e.ID,
		TenantID:     e.TenantID,
		ActorUserID:  e.ActorUserID,
		Action:       e.Action,
		ResourceType: e.ResourceType,
		ResourceID:   e.ResourceID,
		Payload:      e.Payload,
		CreatedAt:    e.CreatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
	}
}

func errorJSON(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code, "message": msg})
}

// Append handles POST /v1/audit/events. Body cap 64 KB. Required
// fields: tenant_id, action, resource_type, resource_id. Returns 201
// with the persisted row, 400 on bad input, 405 on non-POST, 500
// otherwise (with internal detail logged, generic message returned).
func Append(repo *audit.Events) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		var body appendBody
		r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			errorJSON(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		if body.TenantID == "" || body.Action == "" || body.ResourceType == "" || body.ResourceID == "" {
			errorJSON(w, http.StatusBadRequest, "missing_fields",
				"tenant_id, action, resource_type, and resource_id are required")
			return
		}
		got, err := repo.Append(r.Context(), audit.EventInput{
			TenantID:     body.TenantID,
			ActorUserID:  body.ActorUserID,
			Action:       body.Action,
			ResourceType: body.ResourceType,
			ResourceID:   body.ResourceID,
			Payload:      body.Payload,
		})
		if err != nil {
			log.Printf("audit-svc: events.Append: %v", err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(toResponse(got))
	}
}

// List handles GET /v1/audit/events?tenant_id=&resource_type=&resource_id=
// Returns 200 with newest-first array, 400 if any of the three query
// params are missing, 405 on non-GET, 500 otherwise.
func List(repo *audit.Events) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "GET only")
			return
		}
		q := r.URL.Query()
		tenantID := q.Get("tenant_id")
		resourceType := q.Get("resource_type")
		resourceID := q.Get("resource_id")
		if tenantID == "" || resourceType == "" || resourceID == "" {
			errorJSON(w, http.StatusBadRequest, "missing_query_params",
				"tenant_id, resource_type, and resource_id query params are required")
			return
		}
		got, err := repo.ListByResource(r.Context(), tenantID, resourceType, resourceID)
		if err != nil {
			log.Printf("audit-svc: events.List(%s/%s/%s): %v", tenantID, resourceType, resourceID, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		out := make([]eventResponse, 0, len(got))
		for i := range got {
			out = append(out, toResponse(&got[i]))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(out)
	}
}
```

- [ ] **Step 4: Run tests**

```bash
cd services/audit-svc && DATABASE_URL='postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' go test ./internal/handlers/... -v
```

Expected: 8 PASS (5 Append + 3 List).

If `TestAppendHandlerRejectsOversizeBody` returns something other than 400/413, investigate — `MaxBytesReader` should surface the cap as a JSON decode error caught by the bad_json branch.

- [ ] **Step 5: Verify go vet**

```bash
cd services/audit-svc && go vet ./...
```

Expected: silent.

- [ ] **Step 6: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git add services/audit-svc/internal/handlers/events.go services/audit-svc/internal/handlers/events_test.go
git commit -m "$(cat <<'EOF'
feat(audit-svc): POST + GET /v1/audit/events handlers

Append handler caps body at 64 KB, validates required fields,
masks internal errors. List handler accepts ?tenant_id, ?resource_type,
?resource_id, returns newest-first array. 405 on wrong method.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire main.go

**Files:**
- Modify: `services/audit-svc/cmd/server/main.go`

- [ ] **Step 1: Replace main.go**

Overwrite `services/audit-svc/cmd/server/main.go`:

```go
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/naimkatiman/hydrax-app/services/audit-svc/internal/audit"
	"github.com/naimkatiman/hydrax-app/services/audit-svc/internal/db"
	"github.com/naimkatiman/hydrax-app/services/audit-svc/internal/handlers"
)

const serviceName = "audit-svc"

func redactDSN(dsn string) string {
	u, err := url.Parse(dsn)
	if err != nil {
		return "<unparseable>"
	}
	return u.Redacted()
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7003"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("%s: DATABASE_URL unset — audit event routes disabled, only /healthz served", serviceName)
	} else {
		pool, err := db.OpenPool(dsn)
		if err != nil {
			log.Fatalf("%s: db.OpenPool(%s): %v", serviceName, redactDSN(dsn), err)
		}
		defer pool.Close()
		pingCtx, pingCancel := context.WithTimeout(context.Background(), 3*time.Second)
		if err := pool.PingContext(pingCtx); err != nil {
			pingCancel()
			log.Fatalf("%s: PingContext: %v", serviceName, err)
		}
		pingCancel()
		log.Printf("%s: DB pool ready (%s)", serviceName, redactDSN(dsn))

		repo := audit.New(pool)
		mux.HandleFunc("/v1/audit/events", routeEvents(repo))
	}

	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("%s listening on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

// routeEvents fans /v1/audit/events to Append (POST) or List (GET) by method.
// Single-path mux keeps the surface tight; method gate inside each handler
// returns 405 for the unsupported verb.
func routeEvents(repo *audit.Events) http.HandlerFunc {
	appendH := handlers.Append(repo)
	listH := handlers.List(repo)
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			appendH(w, r)
		case http.MethodGet:
			listH(w, r)
		default:
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusMethodNotAllowed)
			_, _ = w.Write([]byte(`{"error":"method_not_allowed","message":"GET or POST only"}`))
		}
	}
}
```

- [ ] **Step 2: Build and smoke test**

```bash
cd services/audit-svc && go build -o /tmp/audit-svc-bin ./cmd/server
DATABASE_URL='postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' /tmp/audit-svc-bin &
SVC_PID=$!
sleep 1

# Health check
curl -sS http://localhost:7003/healthz
echo

# Seed a tenant + product first (use psql since handlers don't expose tenant CRUD)
TENANT_ID=$(psql 'postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' -At -c \
  "INSERT INTO tenants (slug, name, persona) VALUES ('smoke-test-$(date +%s)', 'Smoke', 'issuer') RETURNING id;")
PRODUCT_ID=$(psql 'postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' -At -c \
  "INSERT INTO products (tenant_id, code, name, product_type) VALUES ('$TENANT_ID', 'SMOKE-001', 'Smoke', 'short_duration_credit') RETURNING id;")

# POST an audit event
curl -sS -X POST http://localhost:7003/v1/audit/events \
  -H 'Content-Type: application/json' \
  -d "{\"tenant_id\":\"$TENANT_ID\",\"action\":\"product.created\",\"resource_type\":\"product\",\"resource_id\":\"$PRODUCT_ID\",\"payload\":{\"smoke\":true}}"
echo

# GET the events for this resource
curl -sS "http://localhost:7003/v1/audit/events?tenant_id=$TENANT_ID&resource_type=product&resource_id=$PRODUCT_ID"
echo

# Cleanup
psql 'postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' -c "DELETE FROM tenants WHERE id = '$TENANT_ID';"
kill $SVC_PID
wait $SVC_PID 2>/dev/null
rm /tmp/audit-svc-bin
```

Expected:
- `/healthz` returns 200 with `{"status":"ok","service":"audit-svc"}`
- POST returns 201 with the created event
- GET returns a 1-element array with the event

- [ ] **Step 3: Smoke without DATABASE_URL (regression check)**

```bash
cd services/audit-svc && go build -o /tmp/audit-svc-bin ./cmd/server
unset DATABASE_URL
/tmp/audit-svc-bin &
SVC_PID=$!
sleep 1
curl -sS http://localhost:7003/healthz
echo
# Should NOT have audit routes
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:7003/v1/audit/events
# Expected: 404 (route not registered)
kill $SVC_PID
wait $SVC_PID 2>/dev/null
rm /tmp/audit-svc-bin
```

Expected log line on startup: `audit-svc: DATABASE_URL unset — audit event routes disabled, only /healthz served`. POST should 404.

- [ ] **Step 4: Run full test suite**

```bash
cd services/audit-svc && DATABASE_URL='postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' go test ./...
```

Expected: all green (db + audit + handlers).

- [ ] **Step 5: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git add services/audit-svc/cmd/server/main.go
git commit -m "$(cat <<'EOF'
feat(audit-svc): wire DATABASE_URL gate + route /v1/audit/events

Mirror of services/workflow-svc/cmd/server pattern. If DATABASE_URL
is unset, only /healthz is served (deploy-without-DB stays viable).
With DATABASE_URL set, ping(3s) on startup, then route POST+GET
through one mux entry that fans to Append/List by method.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: STATE.yaml + Verification Log Update

**Files:**
- Modify: `STATE.yaml` (`summary`, `current_focus`, `recently_verified`, `next_actions`, `verification_log`)

- [ ] **Step 1: Run full verification one last time**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
docker compose -f db/postgres/docker-compose.test.yml up -d
sleep 2
DATABASE_URL='postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable'
export DATABASE_URL
(cd services/audit-svc && go vet ./... && go test ./...)
(cd services/workflow-svc && go vet ./... && go test ./...)  # regression check
```

Expected: silent vet, all tests green for both services.

- [ ] **Step 2: Update STATE.yaml**

Read current STATE.yaml, then edit these specific fields (do NOT rewrite unrelated ones — parallel sessions may have changed them):

- `updated`: today's ISO datetime
- `summary`: replace the old persistence-foundation note with: `"audit-svc persistence slice complete (POST + GET /v1/audit/events backed by Postgres)"`
- `current_focus`: replace with `["Slice closed; user picks next Tier 1 item (workflow lifecycle, issuer-portal /products page, or auth)"]`
- `recently_verified`: prepend a new entry summarizing the audit-svc verification (counts: `go vet ./... silent for audit-svc + workflow-svc; go test ./... = N tests green for audit-svc + N for workflow-svc; smoke POST/GET round-trip succeeded`)
- `next_actions`: drop the audit-svc bullet (item 3), keep the rest
- `verification_log`: append:
  - `"YYYY-MM-DD — audit-svc persistence: 5 commits land Postgres schema bind (5 MVP tables), internal/db, internal/audit Event+EventInput rewrite, repo Append+ListByResource, handlers Append+List with body cap + error masking, cmd/server DATABASE_URL gate. Tests: N green via docker-compose Postgres :5433 with txn-rollback isolation. Smoke: POST 201 + GET returns 1-element array. Plan: docs/plans/2026-04-25-audit-svc-persistence.md"`

Use the actual test counts from Step 1 output, not placeholders.

- [ ] **Step 3: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git add STATE.yaml
git commit -m "$(cat <<'EOF'
chore(state): record audit-svc persistence slice closure

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Slice Closure Checklist

Before declaring the slice done, verify all of these are true:

- [ ] `git status` shows clean working tree (no leftover binaries, no stat-cache phantoms)
- [ ] `git log --oneline -6` shows 5-6 commits matching the task structure (~1 commit per task)
- [ ] `(cd services/audit-svc && go vet ./...)` silent
- [ ] `(cd services/audit-svc && DATABASE_URL=... go test ./...)` all green
- [ ] `(cd services/workflow-svc && go vet ./... && DATABASE_URL=... go test ./...)` still green (regression check)
- [ ] STATE.yaml `verification_log` has the new entry
- [ ] `docker compose -f db/postgres/docker-compose.test.yml down` (clean up the test DB if you like — or leave it running for the next slice)

## Anti-Scope (do not smuggle in)

These belong to other slices. Refuse them inside this plan:

- workflow-svc emitting audit events on product-create (cross-service wiring; separate plan)
- BFF proxy for `/v1/audit/events` (separate plan)
- Pagination on the List endpoint (defer until a real consumer needs it)
- Filter by `action` or `actor_user_id` (defer until a real consumer needs it)
- Soft delete or update endpoints (audit log is append-only by design)
- Multi-resource batch query (defer until a real consumer needs it)
- A separate `audit-events-svc` Railway service (deploy is documented in persistence-foundation plan; not executed here)
- Auth middleware (auth slice is a separate Tier 1 item)

## Self-Review Notes

Plan author check before handoff:

- **Spec coverage:** Each of the 6 tasks maps to a concrete deliverable. Tasks 1-5 mirror workflow-svc's persistence-foundation tasks 1-5; Task 6 mirrors that plan's Task 6 (STATE.yaml). No spec line is unaddressed.
- **Placeholder scan:** Search of "TODO", "TBD", "fill in", "implement later", "appropriate", "validation as needed" returns zero hits in this plan. All code blocks are complete and copy-pasteable.
- **Type consistency:** `Events` is the repo type across Tasks 3, 4, 5. `EventInput` is the input shape across Tasks 2, 3, 4. `audit.New(querier)` returns `*Events` consistently. `audit.Event.ActorUserID` is `*string` everywhere.
- **Cross-task dependencies:** Task 2 (domain rewrite) must precede Task 3 (repo) because the repo binds field-by-field to the new struct. Task 5 (main.go) requires Tasks 1-4 because it imports all three packages.
- **Footgun: `go mod tidy` toolchain bump.** Already called out inline in Task 1 Step 4.
- **Footgun: missing `actor_user_id` in handler validation.** Intentional — actor is optional (system events). Schema permits NULL.
- **Footgun: handler body-cap test edge case.** `MaxBytesReader` returns the cap error on `Read`, which `json.Decoder` surfaces as a generic decode error. The test accepts both 400 (decode caught it) and 413 (theoretical alternative if we explicitly check); current implementation will hit 400.
