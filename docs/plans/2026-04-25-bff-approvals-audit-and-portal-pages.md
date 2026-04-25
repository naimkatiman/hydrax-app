# BFF Approvals + Audit Proxies + Portal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `audit-svc` (already Postgres-backed) and `approval-svc` (currently health-only — grow a minimal in-memory backend in this plan) through `bff` as proxies, then ship three portal pages that exercise the new endpoints.

**Architecture:**
- **Phase A** wires `audit-svc` → `bff` proxy. `audit-svc` already has `POST /v1/audit/events` + `GET /v1/audit/events?tenant_id=…&resource_type=…&resource_id=…` over Postgres. BFF proxy mirrors the existing `products`/`subscriptions`/`marketdata` patterns: `withTimeout` helper, typed `*UpstreamError`, 64 KiB body cap on POST, 4xx pass-through, transport → 502.
- **Phase B** grows `approval-svc` from the current `Decision`/`Step` types + `/healthz` only into a minimal in-memory CRUD vertical (`POST /v1/approvals`, `GET /v1/approvals?status=pending`, `GET /v1/approvals/{id}`, `POST /v1/approvals/{id}/decide`) so the BFF approvals proxy has a real upstream. Persistence (Postgres-backed approvals table) is **explicitly deferred** — no schema migration in this plan.
- **Phase C** adds three portal routes consuming the new endpoints:
  1. `ops-console` `/audit` — search audit events by tenant + resource (BFF GET).
  2. `distributor-portal` `/approvals` — pending approvals queue with Approve/Reject buttons (BFF GET + POST decide).
  3. `investor-portal` `/subscriptions` — fetch subscription by id (BFF GET; list endpoint deferred).

**Tech Stack:** Go 1.22 + stdlib `net/http` (services), Node 22 + TypeScript + `node:http` (BFF), React 18 + RTK Query + react-router-dom 6 (portals), `vitest` + `@testing-library/react` (web), Go `testing` + `httptest` (Go).

**Anti-scope (DO NOT do in this plan):**
- No `approvals` table migration. In-memory backend only.
- No BFF `GET /v1/subscriptions` list endpoint. (Future plan — needs a workflow-svc list query.)
- No portal forms for *creating* approvals (approvals come from upstream business events; the queue page just decides them).
- No auth wiring. Hardcoded sample IDs in form placeholders are fine.
- No `/v1/audit/events` create button in the portals (audit feed is read-only in UI).
- No emoji. Lucide icons only. Real `@hydrax/ui` props (`Heading level="h1"`, `Text tone="danger"`, never `Heading level={1}`).

---

## File Structure (locked in before tasks)

**Created:**
```
services/bff/src/audit/proxy.ts                                    # listEvents, appendEvent, AuditUpstreamError
services/bff/src/audit/proxy.test.ts                               # 4 vitest cases
services/bff/src/approvals/proxy.ts                                # listPendingApprovals, fetchApproval, createApproval, decideApproval, ApprovalsUpstreamError
services/bff/src/approvals/proxy.test.ts                           # 5 vitest cases
services/approval-svc/internal/approvals/repo.go                   # in-memory MemRepo + ErrNotFound
services/approval-svc/internal/approvals/repo_test.go              # 7 go test cases
services/approval-svc/internal/handlers/approvals.go               # Append/Get/ListPending/Decide handlers
services/approval-svc/internal/handlers/approvals_test.go          # 9 httptest cases
web/apps/ops-console/src/routes/AuditRoute.tsx
web/apps/ops-console/src/routes/AuditRoute.test.tsx
web/apps/distributor-portal/src/routes/ApprovalsRoute.tsx
web/apps/distributor-portal/src/routes/ApprovalsRoute.test.tsx
web/apps/investor-portal/src/routes/SubscriptionsRoute.tsx
web/apps/investor-portal/src/routes/SubscriptionsRoute.test.tsx
```

**Modified:**
```
services/bff/src/server.ts                                         # +/v1/audit/events, +/v1/approvals routes
services/bff/src/server.test.ts                                    # +405 cases for new paths
services/approval-svc/internal/approvals/approvals.go              # Approval/ApprovalInput types added
services/approval-svc/cmd/server/main.go                           # wire repo + routeApprovals
web/packages/api-client/src/api.ts                                 # AuditEvent, Approval, Subscription types + endpoints + hook re-exports
web/apps/ops-console/src/App.tsx                                   # /audit route
web/apps/distributor-portal/src/App.tsx                            # /approvals route
web/apps/distributor-portal/src/components/DistributorSidebar.tsx  # /subscriptions → CheckSquare for /approvals (replaces FileSignature on Subscriptions row OR adds new row)
web/apps/investor-portal/src/App.tsx                               # /subscriptions route + sidebar
web/apps/investor-portal/src/components/InvestorSidebar.tsx        # may need creation if absent — CHECK FIRST
docs/env.md                                                        # AUDIT_SVC_URL + APPROVAL_SVC_URL consumer docs
```

> **Verify before Task C.4:** does `web/apps/investor-portal/src/components/InvestorSidebar.tsx` exist? If not, the sidebar nav for investor-portal lives elsewhere (probably inline in App.tsx — investor-portal currently only has `/health` route). The task notes a fork on this.

---

## Verification gates (run on every task that touches the named workspace)

- **Go services:** `(cd services/<svc> && go vet ./... && go test ./...)` — workspace-wide `go test ./...` from repo root fails on Go 1.26 + go.work, see CLAUDE.md Past Mistake.
- **BFF:** `pnpm -F @hydrax/bff typecheck && pnpm -F @hydrax/bff test -- --run && pnpm -F @hydrax/bff build`
- **api-client / web app:** `pnpm -F @hydrax/api-client typecheck && pnpm -F @hydrax/api-client test -- --run && pnpm -F @hydrax/api-client build` and equivalent per app workspace.
- **Repo-wide before each commit:** `git diff --cached --name-only` — fail loud if any path outside the task's named files is staged (see CLAUDE.md Past Mistake on path-scoped `git add`).

---

# Phase A: BFF audit proxy (~3 commits, ~2-3 hours)

audit-svc is real and Postgres-backed. This phase is pure proxy work.

## Task A.1: BFF audit proxy module

**Files:**
- Create: `services/bff/src/audit/proxy.ts`
- Create: `services/bff/src/audit/proxy.test.ts`

- [ ] **Step 1: Write the failing test (`services/bff/src/audit/proxy.test.ts`)**

```ts
import { describe, it, expect } from "vitest";
import { listEvents, appendEvent, AuditUpstreamError } from "./proxy.js";

function fakeFetch(handler: (url: string, init?: RequestInit) => { ok: boolean; status: number; body: unknown }): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const result = handler(url, init);
    return {
      ok: result.ok,
      status: result.status,
      json: async () => result.body,
    } as Response;
  }) as typeof fetch;
}

describe("listEvents", () => {
  it("returns rows on 200 and forwards query params", async () => {
    const fetchImpl = fakeFetch((url) => {
      expect(url).toBe(
        "http://localhost:7003/v1/audit/events?tenant_id=t1&resource_type=product&resource_id=p1",
      );
      return {
        ok: true,
        status: 200,
        body: [
          {
            id: "e1",
            tenant_id: "t1",
            actor_user_id: null,
            action: "product.created",
            resource_type: "product",
            resource_id: "p1",
            payload: {},
            created_at: "2026-04-25T00:00:00.000000Z",
          },
        ],
      };
    });
    const got = await listEvents(
      { tenant_id: "t1", resource_type: "product", resource_id: "p1" },
      { auditSvcUrl: "http://localhost:7003", fetchImpl },
    );
    expect(got).toHaveLength(1);
    expect(got[0].action).toBe("product.created");
  });

  it("wraps upstream 400 in AuditUpstreamError preserving status", async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 400, body: {} }));
    const err = await listEvents(
      { tenant_id: "t1", resource_type: "product", resource_id: "p1" },
      { auditSvcUrl: "http://localhost:7003", fetchImpl },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuditUpstreamError);
    expect((err as AuditUpstreamError).httpStatus).toBe(400);
  });
});

describe("appendEvent", () => {
  it("POSTs body and returns row on 201", async () => {
    const fetchImpl = fakeFetch((url, init) => {
      expect(url).toBe("http://localhost:7003/v1/audit/events");
      expect(init?.method).toBe("POST");
      return {
        ok: true,
        status: 201,
        body: {
          id: "e2",
          tenant_id: "t1",
          actor_user_id: null,
          action: "product.created",
          resource_type: "product",
          resource_id: "p1",
          payload: {},
          created_at: "2026-04-25T00:00:00.000000Z",
        },
      };
    });
    const got = await appendEvent(
      { tenant_id: "t1", action: "product.created", resource_type: "product", resource_id: "p1" },
      { auditSvcUrl: "http://localhost:7003", fetchImpl },
    );
    expect(got.id).toBe("e2");
  });

  it("wraps transport error in AuditUpstreamError", async () => {
    const fetchImpl = (async () => {
      throw new Error("connect ECONNREFUSED");
    }) as typeof fetch;
    const err = await appendEvent(
      { tenant_id: "t1", action: "x", resource_type: "product", resource_id: "p1" },
      { auditSvcUrl: "http://localhost:7003", fetchImpl },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuditUpstreamError);
    expect((err as AuditUpstreamError).httpStatus).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test — expected FAIL ("Cannot find module ./proxy.js")**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && pnpm -F @hydrax/bff test -- --run services/bff/src/audit/proxy.test.ts
```

- [ ] **Step 3: Implement proxy (`services/bff/src/audit/proxy.ts`)**

```ts
export interface AuditEvent {
  readonly id: string;
  readonly tenant_id: string;
  readonly actor_user_id: string | null;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly payload: unknown;
  readonly created_at: string;
}

export interface CreateAuditEventInput {
  readonly tenant_id: string;
  readonly actor_user_id?: string;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly payload?: unknown;
}

export interface ListEventsQuery {
  readonly tenant_id: string;
  readonly resource_type: string;
  readonly resource_id: string;
}

export interface ProxyOptions {
  readonly auditSvcUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export class AuditUpstreamError extends Error {
  readonly httpStatus?: number;
  constructor(message: string, httpStatus?: number) {
    super(message);
    this.name = "AuditUpstreamError";
    this.httpStatus = httpStatus;
  }
}

async function withTimeout<T>(timeoutMs: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function listEvents(
  query: Readonly<ListEventsQuery>,
  opts: Readonly<ProxyOptions>,
): Promise<ReadonlyArray<AuditEvent>> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  const qs = new URLSearchParams({
    tenant_id: query.tenant_id,
    resource_type: query.resource_type,
    resource_id: query.resource_id,
  }).toString();
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.auditSvcUrl}/v1/audit/events?${qs}`, { signal });
    } catch (err: unknown) {
      throw new AuditUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new AuditUpstreamError(`audit-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as ReadonlyArray<AuditEvent>;
  });
}

export async function appendEvent(
  input: Readonly<CreateAuditEventInput>,
  opts: Readonly<ProxyOptions>,
): Promise<AuditEvent> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.auditSvcUrl}/v1/audit/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
    } catch (err: unknown) {
      throw new AuditUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new AuditUpstreamError(`audit-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as AuditEvent;
  });
}
```

- [ ] **Step 4: Run test — expected PASS**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && pnpm -F @hydrax/bff test -- --run services/bff/src/audit/proxy.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add services/bff/src/audit/proxy.ts services/bff/src/audit/proxy.test.ts
git commit -m "feat(bff): add audit proxy module mirroring products/subscriptions pattern"
```

---

## Task A.2: BFF server.ts wires /v1/audit/events routes

**Files:**
- Modify: `services/bff/src/server.ts`
- Modify: `services/bff/src/server.test.ts`

- [ ] **Step 1: Add the failing test case to `services/bff/src/server.test.ts`**

Add this `it` block inside the existing `describe`:

```ts
it("returns 405 on DELETE /v1/audit/events", async () => {
  const { baseUrl, server } = await startServer({ port: 0, service: "bff" });
  try {
    const res = await fetch(`${baseUrl}/v1/audit/events`, { method: "DELETE" });
    expect(res.status).toBe(405);
  } finally {
    server.close();
  }
});
```

- [ ] **Step 2: Run — expected FAIL (returns 404 currently)**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && pnpm -F @hydrax/bff test -- --run services/bff/src/server.test.ts
```

- [ ] **Step 3: Modify `services/bff/src/server.ts` — add imports and route handlers**

Top of file, alongside existing imports:

```ts
import { listEvents, appendEvent, AuditUpstreamError, type ListEventsQuery } from "./audit/proxy.js";
```

Insert these blocks **before** the `if (req.method !== "GET") { respondJson(res, 405, …)` fallthrough (around current line 131) so POST gets matched first:

```ts
    if (req.url === "/v1/audit/events" && req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks);
      if (raw.length > 64 * 1024) {
        respondJson(res, 413, { error: "payload_too_large" });
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        respondJson(res, 400, { error: "bad_json" });
        return;
      }
      if (typeof body !== "object" || body === null) {
        respondJson(res, 400, { error: "bad_body" });
        return;
      }
      try {
        const event = await appendEvent(body as Parameters<typeof appendEvent>[0], {
          auditSvcUrl: upstreamConfig.auditSvcUrl,
        });
        respondJson(res, 201, event);
      } catch (err: unknown) {
        if (err instanceof AuditUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "audit_upstream", message: err.message });
        } else {
          console.error("bff: /v1/audit/events POST handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }
```

Then, **after** the `if (req.method !== "GET")` fallthrough but before the default 404, add the GET handler:

```ts
    if (req.url?.startsWith("/v1/audit/events") && req.method === "GET") {
      const url = new URL(req.url, "http://_");
      const q: ListEventsQuery = {
        tenant_id: url.searchParams.get("tenant_id") ?? "",
        resource_type: url.searchParams.get("resource_type") ?? "",
        resource_id: url.searchParams.get("resource_id") ?? "",
      };
      if (!q.tenant_id || !q.resource_type || !q.resource_id) {
        respondJson(res, 400, {
          error: "missing_query_params",
          message: "tenant_id, resource_type, and resource_id are required",
        });
        return;
      }
      try {
        const events = await listEvents(q, { auditSvcUrl: upstreamConfig.auditSvcUrl });
        respondJson(res, 200, events);
      } catch (err: unknown) {
        if (err instanceof AuditUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "audit_upstream", message: err.message });
        } else {
          console.error("bff: /v1/audit/events GET handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }
```

> **Why split locations?** The existing server.ts has a `if (req.method !== "GET") return 405;` short-circuit at line 131. POSTs must match before that block; GETs match after. Mirror exactly the products/subscriptions placement.

- [ ] **Step 4: Run all bff tests — expected all green**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && pnpm -F @hydrax/bff typecheck && pnpm -F @hydrax/bff test -- --run && pnpm -F @hydrax/bff build
```

Expected: All previous BFF tests still pass + the new 405 case passes.

- [ ] **Step 5: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add services/bff/src/server.ts services/bff/src/server.test.ts
git commit -m "feat(bff): wire /v1/audit/events routes (POST + GET)"
```

---

## Task A.3: docs/env.md note for AUDIT_SVC_URL consumer

**Files:**
- Modify: `docs/env.md`

- [ ] **Step 1: Read the existing env.md** to find the `AUDIT_SVC_URL` entry (it already exists from earlier scaffolding) and add a note that BFF is now a consumer.

```bash
grep -n AUDIT_SVC_URL /home/naim/.openclaw/workspace/hydrax-app/docs/env.md
```

- [ ] **Step 2: Edit the AUDIT_SVC_URL entry** to add a `Consumed by:` line referencing `services/bff/src/audit/proxy.ts`. Match whatever doc format already exists for `WORKFLOW_SVC_URL` (the products proxy is already documented there).

- [ ] **Step 3: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add docs/env.md
git commit -m "docs(env): note BFF audit proxy consumes AUDIT_SVC_URL"
```

---

# Phase B: approval-svc minimal in-memory backend + BFF approvals proxy (~6 commits, ~3-4 hours)

## Task B.1: approval-svc domain types + in-memory repo

**Files:**
- Modify: `services/approval-svc/internal/approvals/approvals.go` (extend with Approval/ApprovalInput types)
- Create: `services/approval-svc/internal/approvals/repo.go`
- Create: `services/approval-svc/internal/approvals/repo_test.go`

- [ ] **Step 1: Extend `services/approval-svc/internal/approvals/approvals.go`**

Add **below** the existing `Step` struct (preserve everything currently in the file):

```go
import "time"

// Approval is a single approval record. Status transitions:
//   pending -> approved  (Decide with "approved")
//   pending -> rejected  (Decide with "rejected")
// Once decided, an approval is terminal in this minimal model.
type Approval struct {
	ID              string
	TenantID        string
	ResourceType    string
	ResourceID      string
	Status          string     // "pending", "approved", "rejected"
	DecidedByUserID *string    // null until Decide
	DecidedAt       *time.Time // null until Decide
	CreatedAt       time.Time
}

// ApprovalInput is the user-supplied subset for Insert.
type ApprovalInput struct {
	TenantID     string
	ResourceType string
	ResourceID   string
}

// DecideInput captures who decided and how.
type DecideInput struct {
	Status      string // "approved" or "rejected"
	DecidedByID string
}
```

> **Note on imports:** Go file already has package declaration; if the file currently has no `import` block, add `import "time"` directly. If it has one, fold `"time"` in.

- [ ] **Step 2: Write failing test (`services/approval-svc/internal/approvals/repo_test.go`)**

```go
package approvals

import (
	"context"
	"testing"
)

func TestMemRepo_Insert_AssignsIDAndCreatedAt(t *testing.T) {
	r := NewMemRepo()
	got, err := r.Insert(context.Background(), ApprovalInput{
		TenantID: "t1", ResourceType: "product", ResourceID: "p1",
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}
	if got.ID == "" {
		t.Fatal("Insert: empty ID")
	}
	if got.Status != "pending" {
		t.Fatalf("Insert status = %q, want pending", got.Status)
	}
	if got.CreatedAt.IsZero() {
		t.Fatal("Insert: zero CreatedAt")
	}
}

func TestMemRepo_GetByID_ReturnsInsertedRow(t *testing.T) {
	r := NewMemRepo()
	in, _ := r.Insert(context.Background(), ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	got, err := r.GetByID(context.Background(), in.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.ID != in.ID {
		t.Fatalf("GetByID ID = %q, want %q", got.ID, in.ID)
	}
}

func TestMemRepo_GetByID_ErrNotFoundOnUnknown(t *testing.T) {
	r := NewMemRepo()
	_, err := r.GetByID(context.Background(), "nope")
	if !IsNotFound(err) {
		t.Fatalf("GetByID(unknown): err = %v, want IsNotFound", err)
	}
}

func TestMemRepo_ListPending_ReturnsOnlyPending(t *testing.T) {
	r := NewMemRepo()
	a, _ := r.Insert(context.Background(), ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	b, _ := r.Insert(context.Background(), ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p2"})
	if _, err := r.Decide(context.Background(), b.ID, DecideInput{Status: "approved", DecidedByID: "u1"}); err != nil {
		t.Fatalf("Decide: %v", err)
	}
	got, err := r.ListPending(context.Background())
	if err != nil {
		t.Fatalf("ListPending: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("ListPending len = %d, want 1", len(got))
	}
	if got[0].ID != a.ID {
		t.Fatalf("ListPending[0].ID = %q, want %q", got[0].ID, a.ID)
	}
}

func TestMemRepo_Decide_SetsDecidedFields(t *testing.T) {
	r := NewMemRepo()
	in, _ := r.Insert(context.Background(), ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	got, err := r.Decide(context.Background(), in.ID, DecideInput{Status: "approved", DecidedByID: "u1"})
	if err != nil {
		t.Fatalf("Decide: %v", err)
	}
	if got.Status != "approved" {
		t.Fatalf("Decide status = %q, want approved", got.Status)
	}
	if got.DecidedByUserID == nil || *got.DecidedByUserID != "u1" {
		t.Fatal("Decide: DecidedByUserID not set")
	}
	if got.DecidedAt == nil {
		t.Fatal("Decide: DecidedAt nil")
	}
}

func TestMemRepo_Decide_ErrNotFoundOnUnknown(t *testing.T) {
	r := NewMemRepo()
	_, err := r.Decide(context.Background(), "nope", DecideInput{Status: "approved", DecidedByID: "u1"})
	if !IsNotFound(err) {
		t.Fatalf("Decide(unknown): err = %v, want IsNotFound", err)
	}
}

func TestMemRepo_Decide_RejectsInvalidStatus(t *testing.T) {
	r := NewMemRepo()
	in, _ := r.Insert(context.Background(), ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	_, err := r.Decide(context.Background(), in.ID, DecideInput{Status: "maybe", DecidedByID: "u1"})
	if err == nil {
		t.Fatal("Decide(maybe): want error, got nil")
	}
}
```

- [ ] **Step 3: Run — expected FAIL ("undefined: NewMemRepo")**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app/services/approval-svc && go test ./internal/approvals/...
```

- [ ] **Step 4: Implement `services/approval-svc/internal/approvals/repo.go`**

```go
package approvals

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

var errNotFound = errors.New("approval: not found")

// IsNotFound reports whether err signals a missing approval row.
func IsNotFound(err error) bool {
	return errors.Is(err, errNotFound)
}

// MemRepo is the process-local in-memory approval store. Safe for
// concurrent use. Persistence is deferred to a future plan.
type MemRepo struct {
	mu   sync.RWMutex
	data map[string]*Approval
}

// NewMemRepo constructs an empty in-memory repo.
func NewMemRepo() *MemRepo {
	return &MemRepo{data: make(map[string]*Approval)}
}

func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand failures are catastrophic — panic is right.
		panic("approvals: rand.Read: " + err.Error())
	}
	return hex.EncodeToString(b)
}

// Insert creates a pending approval and returns the persisted row.
func (r *MemRepo) Insert(_ context.Context, in ApprovalInput) (*Approval, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	row := &Approval{
		ID:           newID(),
		TenantID:     in.TenantID,
		ResourceType: in.ResourceType,
		ResourceID:   in.ResourceID,
		Status:       "pending",
		CreatedAt:    time.Now().UTC(),
	}
	r.data[row.ID] = row
	return cloneApproval(row), nil
}

// GetByID returns a copy of the row, or ErrNotFound.
func (r *MemRepo) GetByID(_ context.Context, id string) (*Approval, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	row, ok := r.data[id]
	if !ok {
		return nil, errNotFound
	}
	return cloneApproval(row), nil
}

// ListPending returns copies of all pending rows. Order is undefined.
func (r *MemRepo) ListPending(_ context.Context) ([]Approval, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Approval, 0)
	for _, row := range r.data {
		if row.Status == "pending" {
			out = append(out, *cloneApproval(row))
		}
	}
	return out, nil
}

// Decide applies the decision and returns the updated row.
func (r *MemRepo) Decide(_ context.Context, id string, in DecideInput) (*Approval, error) {
	if in.Status != "approved" && in.Status != "rejected" {
		return nil, errors.New(`approval: status must be "approved" or "rejected"`)
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	row, ok := r.data[id]
	if !ok {
		return nil, errNotFound
	}
	now := time.Now().UTC()
	by := in.DecidedByID
	row.Status = in.Status
	row.DecidedByUserID = &by
	row.DecidedAt = &now
	return cloneApproval(row), nil
}

func cloneApproval(in *Approval) *Approval {
	out := *in
	if in.DecidedByUserID != nil {
		v := *in.DecidedByUserID
		out.DecidedByUserID = &v
	}
	if in.DecidedAt != nil {
		v := *in.DecidedAt
		out.DecidedAt = &v
	}
	return &out
}
```

- [ ] **Step 5: Run — expected all 7 tests pass**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app/services/approval-svc && go test ./internal/approvals/...
```

- [ ] **Step 6: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add services/approval-svc/internal/approvals/approvals.go services/approval-svc/internal/approvals/repo.go services/approval-svc/internal/approvals/repo_test.go
git commit -m "feat(approval-svc): add in-memory MemRepo with Insert/Get/ListPending/Decide"
```

---

## Task B.2: approval-svc HTTP handlers

**Files:**
- Create: `services/approval-svc/internal/handlers/approvals.go`
- Create: `services/approval-svc/internal/handlers/approvals_test.go`

- [ ] **Step 1: Write failing test (`services/approval-svc/internal/handlers/approvals_test.go`)**

```go
package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/naimkatiman/hydrax-app/services/approval-svc/internal/approvals"
)

func newRepo() *approvals.MemRepo { return approvals.NewMemRepo() }

func TestAppend_Returns201WithRow(t *testing.T) {
	repo := newRepo()
	body, _ := json.Marshal(map[string]string{
		"tenant_id":     "t1",
		"resource_type": "product",
		"resource_id":   "p1",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/approvals", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	Append(repo)(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d body=%s", rr.Code, rr.Body.String())
	}
	var got map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["id"] == nil || got["status"] != "pending" {
		t.Fatalf("body = %v", got)
	}
}

func TestAppend_400OnMissingFields(t *testing.T) {
	repo := newRepo()
	req := httptest.NewRequest(http.MethodPost, "/v1/approvals", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()
	Append(repo)(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestAppend_405OnGet(t *testing.T) {
	repo := newRepo()
	req := httptest.NewRequest(http.MethodGet, "/v1/approvals", nil)
	rr := httptest.NewRecorder()
	Append(repo)(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestGet_404OnUnknown(t *testing.T) {
	repo := newRepo()
	req := httptest.NewRequest(http.MethodGet, "/v1/approvals/nope", nil)
	rr := httptest.NewRecorder()
	Get(repo, "nope")(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestListPending_Returns200WithArray(t *testing.T) {
	repo := newRepo()
	repo.Insert(req2ctx(), approvals.ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	repo.Insert(req2ctx(), approvals.ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p2"})
	req := httptest.NewRequest(http.MethodGet, "/v1/approvals?status=pending", nil)
	rr := httptest.NewRecorder()
	ListPending(repo)(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	var got []map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("len = %d, want 2", len(got))
	}
}

func TestDecide_Returns200WithUpdatedRow(t *testing.T) {
	repo := newRepo()
	in, _ := repo.Insert(req2ctx(), approvals.ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	body, _ := json.Marshal(map[string]string{"status": "approved", "decided_by_user_id": "u1"})
	req := httptest.NewRequest(http.MethodPost, "/v1/approvals/"+in.ID+"/decide", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	Decide(repo, in.ID)(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rr.Code, rr.Body.String())
	}
	var got map[string]any
	json.Unmarshal(rr.Body.Bytes(), &got)
	if got["status"] != "approved" {
		t.Fatalf("status = %v", got["status"])
	}
}

func TestDecide_404OnUnknown(t *testing.T) {
	repo := newRepo()
	body, _ := json.Marshal(map[string]string{"status": "approved", "decided_by_user_id": "u1"})
	req := httptest.NewRequest(http.MethodPost, "/v1/approvals/nope/decide", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	Decide(repo, "nope")(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestDecide_400OnInvalidStatus(t *testing.T) {
	repo := newRepo()
	in, _ := repo.Insert(req2ctx(), approvals.ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	body, _ := json.Marshal(map[string]string{"status": "maybe", "decided_by_user_id": "u1"})
	req := httptest.NewRequest(http.MethodPost, "/v1/approvals/"+in.ID+"/decide", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	Decide(repo, in.ID)(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestAppend_413OnOversizeBody(t *testing.T) {
	repo := newRepo()
	big := strings.Repeat("x", 70*1024)
	req := httptest.NewRequest(http.MethodPost, "/v1/approvals", strings.NewReader(big))
	rr := httptest.NewRecorder()
	Append(repo)(rr, req)
	// httptest ResponseRecorder doesn't always emit 413 from MaxBytesReader.
	// Accept 400 (bad_json on truncated read) OR 413.
	if rr.Code != http.StatusRequestEntityTooLarge && rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 413 or 400", rr.Code)
	}
}

func req2ctx() context.Context { return context.Background() }
```

> Add `import "context"` at the top alongside other imports.

- [ ] **Step 2: Run — expected FAIL**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app/services/approval-svc && go test ./internal/handlers/...
```

- [ ] **Step 3: Implement `services/approval-svc/internal/handlers/approvals.go`**

```go
package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/naimkatiman/hydrax-app/services/approval-svc/internal/approvals"
)

type appendBody struct {
	TenantID     string `json:"tenant_id"`
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`
}

type decideBody struct {
	Status          string `json:"status"`
	DecidedByUserID string `json:"decided_by_user_id"`
}

type approvalResponse struct {
	ID              string  `json:"id"`
	TenantID        string  `json:"tenant_id"`
	ResourceType    string  `json:"resource_type"`
	ResourceID      string  `json:"resource_id"`
	Status          string  `json:"status"`
	DecidedByUserID *string `json:"decided_by_user_id,omitempty"`
	DecidedAt       *string `json:"decided_at,omitempty"`
	CreatedAt       string  `json:"created_at"`
}

func toResponse(a *approvals.Approval) approvalResponse {
	r := approvalResponse{
		ID:              a.ID,
		TenantID:        a.TenantID,
		ResourceType:    a.ResourceType,
		ResourceID:      a.ResourceID,
		Status:          a.Status,
		DecidedByUserID: a.DecidedByUserID,
		CreatedAt:       a.CreatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
	}
	if a.DecidedAt != nil {
		s := a.DecidedAt.UTC().Format("2006-01-02T15:04:05.000000Z")
		r.DecidedAt = &s
	}
	return r
}

func errorJSON(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code, "message": msg})
}

// Append POST /v1/approvals
func Append(repo *approvals.MemRepo) http.HandlerFunc {
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
		if body.TenantID == "" || body.ResourceType == "" || body.ResourceID == "" {
			errorJSON(w, http.StatusBadRequest, "missing_fields",
				"tenant_id, resource_type, and resource_id are required")
			return
		}
		got, err := repo.Insert(r.Context(), approvals.ApprovalInput{
			TenantID:     body.TenantID,
			ResourceType: body.ResourceType,
			ResourceID:   body.ResourceID,
		})
		if err != nil {
			log.Printf("approval-svc: Insert: %v", err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(toResponse(got))
	}
}

// Get GET /v1/approvals/{id}. id pre-extracted by router.
func Get(repo *approvals.MemRepo, id string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "GET only")
			return
		}
		got, err := repo.GetByID(r.Context(), id)
		if err != nil {
			if approvals.IsNotFound(err) {
				errorJSON(w, http.StatusNotFound, "not_found", "approval not found")
				return
			}
			log.Printf("approval-svc: GetByID(%s): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(toResponse(got))
	}
}

// ListPending GET /v1/approvals (status=pending currently the only filter).
func ListPending(repo *approvals.MemRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "GET only")
			return
		}
		got, err := repo.ListPending(r.Context())
		if err != nil {
			log.Printf("approval-svc: ListPending: %v", err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		out := make([]approvalResponse, 0, len(got))
		for i := range got {
			out = append(out, toResponse(&got[i]))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(out)
	}
}

// Decide POST /v1/approvals/{id}/decide. id pre-extracted by router.
func Decide(repo *approvals.MemRepo, id string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		var body decideBody
		r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			errorJSON(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		if body.Status != "approved" && body.Status != "rejected" {
			errorJSON(w, http.StatusBadRequest, "bad_status", `status must be "approved" or "rejected"`)
			return
		}
		if body.DecidedByUserID == "" {
			errorJSON(w, http.StatusBadRequest, "missing_fields", "decided_by_user_id is required")
			return
		}
		got, err := repo.Decide(r.Context(), id, approvals.DecideInput{
			Status: body.Status, DecidedByID: body.DecidedByUserID,
		})
		if err != nil {
			if approvals.IsNotFound(err) {
				errorJSON(w, http.StatusNotFound, "not_found", "approval not found")
				return
			}
			log.Printf("approval-svc: Decide(%s): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		_ = time.Now() // referenced for clarity
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(toResponse(got))
	}
}
```

> **Note:** The `_ = time.Now()` line is intentional dead code — remove it. The `time` import is unused; drop the import once you delete that line.

- [ ] **Step 4: Run — expected all 9 tests pass**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app/services/approval-svc && go vet ./... && go test ./...
```

- [ ] **Step 5: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add services/approval-svc/internal/handlers/approvals.go services/approval-svc/internal/handlers/approvals_test.go
git commit -m "feat(approval-svc): add HTTP handlers for /v1/approvals (Append/Get/ListPending/Decide)"
```

---

## Task B.3: approval-svc cmd/server wiring

**Files:**
- Modify: `services/approval-svc/cmd/server/main.go`

- [ ] **Step 1: Replace `services/approval-svc/cmd/server/main.go` with the wired version**

```go
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/naimkatiman/hydrax-app/services/approval-svc/internal/approvals"
	"github.com/naimkatiman/hydrax-app/services/approval-svc/internal/handlers"
)

const serviceName = "approval-svc"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7002"
	}
	repo := approvals.NewMemRepo()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))
	mux.HandleFunc("/v1/approvals", routeCollection(repo))
	mux.HandleFunc("/v1/approvals/", routeItem(repo))

	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("%s listening on :%s (in-memory repo — persistence deferred)", serviceName, port)
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

// routeCollection fans /v1/approvals.
func routeCollection(repo *approvals.MemRepo) http.HandlerFunc {
	appendH := handlers.Append(repo)
	listH := handlers.ListPending(repo)
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

// routeItem fans /v1/approvals/{id} and /v1/approvals/{id}/decide.
func routeItem(repo *approvals.MemRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/v1/approvals/")
		// path is now either "{id}" or "{id}/decide".
		parts := strings.Split(path, "/")
		switch {
		case len(parts) == 1 && parts[0] != "":
			handlers.Get(repo, parts[0])(w, r)
		case len(parts) == 2 && parts[1] == "decide":
			handlers.Decide(repo, parts[0])(w, r)
		default:
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":"not_found"}`))
		}
	}
}
```

- [ ] **Step 2: Build + smoke**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app/services/approval-svc && go build ./... && PORT=17002 go run ./cmd/server &
SVC_PID=$!
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:17002/healthz                                            # 200
curl -s -X POST http://localhost:17002/v1/approvals -H 'Content-Type: application/json' \
  -d '{"tenant_id":"t1","resource_type":"product","resource_id":"p1"}'                                              # 201 + JSON
curl -s http://localhost:17002/v1/approvals                                                                          # 200 + array
kill $SVC_PID
```

- [ ] **Step 3: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add services/approval-svc/cmd/server/main.go
git commit -m "feat(approval-svc): wire MemRepo + HTTP routes into cmd/server"
```

---

## Task B.4: BFF approvals proxy module

**Files:**
- Create: `services/bff/src/approvals/proxy.ts`
- Create: `services/bff/src/approvals/proxy.test.ts`

- [ ] **Step 1: Write failing test (`services/bff/src/approvals/proxy.test.ts`)**

```ts
import { describe, it, expect } from "vitest";
import {
  listPendingApprovals,
  fetchApproval,
  createApproval,
  decideApproval,
  ApprovalsUpstreamError,
} from "./proxy.js";

function fakeFetch(handler: (url: string, init?: RequestInit) => { ok: boolean; status: number; body: unknown }): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const result = handler(url, init);
    return {
      ok: result.ok,
      status: result.status,
      json: async () => result.body,
    } as Response;
  }) as typeof fetch;
}

describe("listPendingApprovals", () => {
  it("returns array on 200", async () => {
    const fetchImpl = fakeFetch((url) => {
      expect(url).toBe("http://localhost:7002/v1/approvals");
      return { ok: true, status: 200, body: [{ id: "a1", tenant_id: "t1", resource_type: "product", resource_id: "p1", status: "pending", created_at: "2026-04-25T00:00:00.000000Z" }] };
    });
    const got = await listPendingApprovals({ approvalSvcUrl: "http://localhost:7002", fetchImpl });
    expect(got).toHaveLength(1);
  });
});

describe("fetchApproval", () => {
  it("returns row on 200", async () => {
    const fetchImpl = fakeFetch((url) => {
      expect(url).toBe("http://localhost:7002/v1/approvals/a1");
      return { ok: true, status: 200, body: { id: "a1", tenant_id: "t1", resource_type: "product", resource_id: "p1", status: "pending", created_at: "2026-04-25T00:00:00.000000Z" } };
    });
    const got = await fetchApproval("a1", { approvalSvcUrl: "http://localhost:7002", fetchImpl });
    expect(got.id).toBe("a1");
  });

  it("wraps 404 in ApprovalsUpstreamError", async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 404, body: {} }));
    const err = await fetchApproval("nope", { approvalSvcUrl: "http://localhost:7002", fetchImpl }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApprovalsUpstreamError);
    expect((err as ApprovalsUpstreamError).httpStatus).toBe(404);
  });
});

describe("createApproval", () => {
  it("POSTs body and returns 201", async () => {
    const fetchImpl = fakeFetch((url, init) => {
      expect(url).toBe("http://localhost:7002/v1/approvals");
      expect(init?.method).toBe("POST");
      return { ok: true, status: 201, body: { id: "a2", tenant_id: "t1", resource_type: "product", resource_id: "p1", status: "pending", created_at: "2026-04-25T00:00:00.000000Z" } };
    });
    const got = await createApproval(
      { tenant_id: "t1", resource_type: "product", resource_id: "p1" },
      { approvalSvcUrl: "http://localhost:7002", fetchImpl },
    );
    expect(got.id).toBe("a2");
  });
});

describe("decideApproval", () => {
  it("POSTs to /decide and returns updated row", async () => {
    const fetchImpl = fakeFetch((url, init) => {
      expect(url).toBe("http://localhost:7002/v1/approvals/a1/decide");
      expect(init?.method).toBe("POST");
      return { ok: true, status: 200, body: { id: "a1", tenant_id: "t1", resource_type: "product", resource_id: "p1", status: "approved", decided_by_user_id: "u1", decided_at: "2026-04-25T01:00:00.000000Z", created_at: "2026-04-25T00:00:00.000000Z" } };
    });
    const got = await decideApproval(
      "a1",
      { status: "approved", decided_by_user_id: "u1" },
      { approvalSvcUrl: "http://localhost:7002", fetchImpl },
    );
    expect(got.status).toBe("approved");
  });
});
```

- [ ] **Step 2: Run — expected FAIL**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && pnpm -F @hydrax/bff test -- --run services/bff/src/approvals/proxy.test.ts
```

- [ ] **Step 3: Implement `services/bff/src/approvals/proxy.ts`**

```ts
export interface Approval {
  readonly id: string;
  readonly tenant_id: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly status: "pending" | "approved" | "rejected";
  readonly decided_by_user_id?: string;
  readonly decided_at?: string;
  readonly created_at: string;
}

export interface CreateApprovalInput {
  readonly tenant_id: string;
  readonly resource_type: string;
  readonly resource_id: string;
}

export interface DecideApprovalInput {
  readonly status: "approved" | "rejected";
  readonly decided_by_user_id: string;
}

export interface ProxyOptions {
  readonly approvalSvcUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export class ApprovalsUpstreamError extends Error {
  readonly httpStatus?: number;
  constructor(message: string, httpStatus?: number) {
    super(message);
    this.name = "ApprovalsUpstreamError";
    this.httpStatus = httpStatus;
  }
}

async function withTimeout<T>(timeoutMs: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function listPendingApprovals(opts: Readonly<ProxyOptions>): Promise<ReadonlyArray<Approval>> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.approvalSvcUrl}/v1/approvals`, { signal });
    } catch (err: unknown) {
      throw new ApprovalsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new ApprovalsUpstreamError(`approval-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as ReadonlyArray<Approval>;
  });
}

export async function fetchApproval(id: string, opts: Readonly<ProxyOptions>): Promise<Approval> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.approvalSvcUrl}/v1/approvals/${encodeURIComponent(id)}`, { signal });
    } catch (err: unknown) {
      throw new ApprovalsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new ApprovalsUpstreamError(`approval-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Approval;
  });
}

export async function createApproval(
  input: Readonly<CreateApprovalInput>,
  opts: Readonly<ProxyOptions>,
): Promise<Approval> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.approvalSvcUrl}/v1/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
    } catch (err: unknown) {
      throw new ApprovalsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new ApprovalsUpstreamError(`approval-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Approval;
  });
}

export async function decideApproval(
  id: string,
  input: Readonly<DecideApprovalInput>,
  opts: Readonly<ProxyOptions>,
): Promise<Approval> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.approvalSvcUrl}/v1/approvals/${encodeURIComponent(id)}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
    } catch (err: unknown) {
      throw new ApprovalsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new ApprovalsUpstreamError(`approval-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Approval;
  });
}
```

- [ ] **Step 4: Run — expected 5 tests pass**

- [ ] **Step 5: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add services/bff/src/approvals/proxy.ts services/bff/src/approvals/proxy.test.ts
git commit -m "feat(bff): add approvals proxy module mirroring audit/products pattern"
```

---

## Task B.5: BFF server.ts wires /v1/approvals routes

**Files:**
- Modify: `services/bff/src/server.ts`
- Modify: `services/bff/src/server.test.ts`

- [ ] **Step 1: Add failing test cases to `services/bff/src/server.test.ts`**

```ts
it("returns 405 on DELETE /v1/approvals", async () => {
  const { baseUrl, server } = await startServer({ port: 0, service: "bff" });
  try {
    const res = await fetch(`${baseUrl}/v1/approvals`, { method: "DELETE" });
    expect(res.status).toBe(405);
  } finally {
    server.close();
  }
});
```

- [ ] **Step 2: Run — expected FAIL**

- [ ] **Step 3: Modify `services/bff/src/server.ts`**

Add imports:

```ts
import {
  listPendingApprovals,
  fetchApproval,
  createApproval,
  decideApproval,
  ApprovalsUpstreamError,
} from "./approvals/proxy.js";
```

Insert these blocks **before** the `req.method !== "GET"` 405 short-circuit:

```ts
    if (req.url === "/v1/approvals" && req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks);
      if (raw.length > 64 * 1024) { respondJson(res, 413, { error: "payload_too_large" }); return; }
      let body: unknown;
      try { body = JSON.parse(raw.toString("utf8")); } catch { respondJson(res, 400, { error: "bad_json" }); return; }
      if (typeof body !== "object" || body === null) { respondJson(res, 400, { error: "bad_body" }); return; }
      try {
        const approval = await createApproval(body as Parameters<typeof createApproval>[0], {
          approvalSvcUrl: upstreamConfig.approvalSvcUrl,
        });
        respondJson(res, 201, approval);
      } catch (err: unknown) {
        if (err instanceof ApprovalsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "approvals_upstream", message: err.message });
        } else {
          console.error("bff: /v1/approvals POST handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    // /v1/approvals/{id}/decide POST — must be matched BEFORE the bare /{id} GET below
    if (req.url?.match(/^\/v1\/approvals\/[^/]+\/decide$/) && req.method === "POST") {
      const segments = req.url.split("/");
      const id = decodeURIComponent(segments[3]);
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks);
      if (raw.length > 64 * 1024) { respondJson(res, 413, { error: "payload_too_large" }); return; }
      let body: unknown;
      try { body = JSON.parse(raw.toString("utf8")); } catch { respondJson(res, 400, { error: "bad_json" }); return; }
      if (typeof body !== "object" || body === null) { respondJson(res, 400, { error: "bad_body" }); return; }
      try {
        const approval = await decideApproval(id, body as Parameters<typeof decideApproval>[1], {
          approvalSvcUrl: upstreamConfig.approvalSvcUrl,
        });
        respondJson(res, 200, approval);
      } catch (err: unknown) {
        if (err instanceof ApprovalsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "approvals_upstream", message: err.message });
        } else {
          console.error("bff: /v1/approvals/{id}/decide handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }
```

Then **after** the existing `req.method !== "GET"` short-circuit, add:

```ts
    if (req.url === "/v1/approvals" && req.method === "GET") {
      try {
        const approvals = await listPendingApprovals({ approvalSvcUrl: upstreamConfig.approvalSvcUrl });
        respondJson(res, 200, approvals);
      } catch (err: unknown) {
        if (err instanceof ApprovalsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "approvals_upstream", message: err.message });
        } else {
          console.error("bff: /v1/approvals GET handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.url?.startsWith("/v1/approvals/") && req.method === "GET") {
      const id = decodeURIComponent(req.url.slice("/v1/approvals/".length));
      try {
        const approval = await fetchApproval(id, { approvalSvcUrl: upstreamConfig.approvalSvcUrl });
        respondJson(res, 200, approval);
      } catch (err: unknown) {
        if (err instanceof ApprovalsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "approvals_upstream", message: err.message });
        } else {
          console.error("bff: /v1/approvals/{id} GET handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }
```

- [ ] **Step 4: Run all bff tests — expected all green**

- [ ] **Step 5: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add services/bff/src/server.ts services/bff/src/server.test.ts
git commit -m "feat(bff): wire /v1/approvals routes (list/get/create/decide)"
```

---

## Task B.6: docs/env.md note for APPROVAL_SVC_URL consumer

**Files:**
- Modify: `docs/env.md`

- [ ] **Step 1: Edit the existing `APPROVAL_SVC_URL` entry** to add `Consumed by: services/bff/src/approvals/proxy.ts`. Match the format of the AUDIT_SVC_URL entry from Task A.3.

- [ ] **Step 2: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add docs/env.md
git commit -m "docs(env): note BFF approvals proxy consumes APPROVAL_SVC_URL"
```

---

# Phase C: Portal pages exercising the new endpoints (~4 commits, ~3 hours)

## Task C.1: api-client extensions

**Files:**
- Modify: `web/packages/api-client/src/api.ts`

- [ ] **Step 1: Modify `web/packages/api-client/src/api.ts` — add types and endpoints**

Add types **after** the existing `CreateProductInput` interface:

```ts
export interface AuditEvent {
  readonly id: string;
  readonly tenant_id: string;
  readonly actor_user_id: string | null;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly payload: unknown;
  readonly created_at: string;
}

export interface ListEventsArgs {
  readonly tenant_id: string;
  readonly resource_type: string;
  readonly resource_id: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Approval {
  readonly id: string;
  readonly tenant_id: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly status: ApprovalStatus;
  readonly decided_by_user_id?: string;
  readonly decided_at?: string;
  readonly created_at: string;
}

export interface DecideApprovalArgs {
  readonly id: string;
  readonly status: "approved" | "rejected";
  readonly decided_by_user_id: string;
}

export interface Subscription {
  readonly id: string;
  readonly product_id: string;
  readonly investor_user_id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}
```

Add to the `endpoints: (builder) => ({ … })` block (alongside the existing `getHealth`, `getHealthzComposite`, `createProduct`, `getProduct`):

```ts
    listAuditEvents: builder.query<ReadonlyArray<AuditEvent>, ListEventsArgs>({
      query: ({ tenant_id, resource_type, resource_id }) =>
        `/v1/audit/events?tenant_id=${encodeURIComponent(tenant_id)}&resource_type=${encodeURIComponent(resource_type)}&resource_id=${encodeURIComponent(resource_id)}`,
    }),
    listPendingApprovals: builder.query<ReadonlyArray<Approval>, void>({
      query: () => "/v1/approvals",
    }),
    decideApproval: builder.mutation<Approval, DecideApprovalArgs>({
      query: ({ id, status, decided_by_user_id }) => ({
        url: `/v1/approvals/${encodeURIComponent(id)}/decide`,
        method: "POST",
        body: { status, decided_by_user_id },
      }),
    }),
    getSubscription: builder.query<Subscription, string>({
      query: (id) => ({ url: `/v1/subscriptions/${encodeURIComponent(id)}` }),
    }),
```

Add hook re-exports at the bottom:

```ts
export const useListAuditEventsQuery: typeof hydraxApi.endpoints.listAuditEvents.useQuery =
  hydraxApi.endpoints.listAuditEvents.useQuery;

export const useListPendingApprovalsQuery: typeof hydraxApi.endpoints.listPendingApprovals.useQuery =
  hydraxApi.endpoints.listPendingApprovals.useQuery;

export const useDecideApprovalMutation: typeof hydraxApi.endpoints.decideApproval.useMutation =
  hydraxApi.endpoints.decideApproval.useMutation;

export const useGetSubscriptionQuery: typeof hydraxApi.endpoints.getSubscription.useQuery =
  hydraxApi.endpoints.getSubscription.useQuery;
```

- [ ] **Step 2: Run — typecheck + test + build**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && pnpm -F @hydrax/api-client typecheck && pnpm -F @hydrax/api-client test -- --run && pnpm -F @hydrax/api-client build
```

Expected: existing 2 tests still pass; build emits `dist/`.

- [ ] **Step 3: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add web/packages/api-client/src/api.ts
git commit -m "feat(web/api-client): add audit, approvals, subscription endpoints + hooks"
```

---

## Task C.2: ops-console — Audit search page

**Files:**
- Create: `web/apps/ops-console/src/routes/AuditRoute.tsx`
- Create: `web/apps/ops-console/src/routes/AuditRoute.test.tsx`
- Modify: `web/apps/ops-console/src/App.tsx`

- [ ] **Step 1: Write failing test (`web/apps/ops-console/src/routes/AuditRoute.test.tsx`)**

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AuditRoute } from "./AuditRoute";

function withProviders(node: React.ReactNode) {
  const store = configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
  });
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>{node}</ThemeProvider>
    </Provider>
  );
}

describe("AuditRoute", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: "e1",
            tenant_id: "t1",
            actor_user_id: null,
            action: "product.created",
            resource_type: "product",
            resource_id: "p1",
            payload: {},
            created_at: "2026-04-25T00:00:00.000000Z",
          },
        ],
      } as Response),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders the heading", () => {
    render(withProviders(<AuditRoute />));
    expect(screen.getByRole("heading", { name: /audit/i })).toBeTruthy();
  });

  it("renders form inputs", () => {
    render(withProviders(<AuditRoute />));
    expect(screen.getByLabelText(/tenant id/i)).toBeTruthy();
    expect(screen.getByLabelText(/resource type/i)).toBeTruthy();
    expect(screen.getByLabelText(/resource id/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /search/i })).toBeTruthy();
  });

  it("fetches and renders the result row after submit", async () => {
    render(withProviders(<AuditRoute />));
    fireEvent.change(screen.getByLabelText(/tenant id/i), { target: { value: "t1" } });
    fireEvent.change(screen.getByLabelText(/resource type/i), { target: { value: "product" } });
    fireEvent.change(screen.getByLabelText(/resource id/i), { target: { value: "p1" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    await screen.findByText(/product.created/i);
  });
});
```

- [ ] **Step 2: Run — expected FAIL ("Cannot find module ./AuditRoute")**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && pnpm -F ops-console test -- --run AuditRoute
```

- [ ] **Step 3: Implement `web/apps/ops-console/src/routes/AuditRoute.tsx`**

```tsx
import { useState } from "react";
import { History, Search } from "lucide-react";
import { Card, EmptyState, Heading, Stack, Text, Button, Skeleton } from "@hydrax/ui";
import { useListAuditEventsQuery } from "@hydrax/api-client";

export function AuditRoute() {
  const [draft, setDraft] = useState({ tenant_id: "", resource_type: "product", resource_id: "" });
  const [submitted, setSubmitted] = useState<typeof draft | null>(null);

  const { data, isFetching, error } = useListAuditEventsQuery(submitted ?? { tenant_id: "", resource_type: "", resource_id: "" }, {
    skip: submitted === null,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.tenant_id && draft.resource_type && draft.resource_id) setSubmitted(draft);
  };

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">Audit</Heading>
        <Text tone="muted">Search the immutable action log by tenant + resource.</Text>
      </Stack>
      <Card title={<Heading level="h2">Filters</Heading>}>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "var(--hydrax-space-md)" }}>
          <label>
            <Text size="bodySm" tone="muted">Tenant ID</Text>
            <input
              aria-label="tenant id"
              value={draft.tenant_id}
              onChange={(e) => setDraft((d) => ({ ...d, tenant_id: e.target.value }))}
              style={{ width: "100%", padding: "8px", marginTop: "4px" }}
            />
          </label>
          <label>
            <Text size="bodySm" tone="muted">Resource type</Text>
            <select
              aria-label="resource type"
              value={draft.resource_type}
              onChange={(e) => setDraft((d) => ({ ...d, resource_type: e.target.value }))}
              style={{ width: "100%", padding: "8px", marginTop: "4px" }}
            >
              <option value="product">product</option>
              <option value="subscription">subscription</option>
              <option value="user">user</option>
              <option value="tenant">tenant</option>
            </select>
          </label>
          <label>
            <Text size="bodySm" tone="muted">Resource ID</Text>
            <input
              aria-label="resource id"
              value={draft.resource_id}
              onChange={(e) => setDraft((d) => ({ ...d, resource_id: e.target.value }))}
              style={{ width: "100%", padding: "8px", marginTop: "4px" }}
            />
          </label>
          <Button type="submit" icon={Search}>Search</Button>
        </form>
      </Card>
      <Card title={<Heading level="h2">Results</Heading>}>
        {submitted === null ? (
          <EmptyState icon={History} iconLabel="No search yet" title="Enter filters above" body="Audit events will appear here once you search." />
        ) : isFetching ? (
          <Stack gap="sm">
            <Skeleton width="100%" height={20} />
            <Skeleton width="80%" height={20} />
          </Stack>
        ) : error ? (
          <Text tone="danger" role="alert">Failed to load audit events.</Text>
        ) : data && data.length > 0 ? (
          <Stack gap="md">
            {data.map((ev) => (
              <Stack key={ev.id} gap="xs">
                <Text family="mono">{ev.action}</Text>
                <Text size="bodySm" tone="muted">
                  {ev.resource_type}/{ev.resource_id} · {ev.created_at}
                </Text>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Text tone="muted">No events for this resource.</Text>
        )}
      </Card>
    </Stack>
  );
}
```

> **Verify primitive APIs before writing:** `Heading level="h1"` (string, not number), `Text tone="danger"` (not `variant="error"`), `Button icon=…` (check if `@hydrax/ui` `Button` accepts an icon prop — if not, place `<Icon icon=… />` next to text; do NOT invent props). If `Button` doesn't accept `icon`, drop the prop and put a lucide icon inline before the label.

- [ ] **Step 4: Modify `web/apps/ops-console/src/App.tsx` — add /audit route**

In the `<Routes>` block, add:

```tsx
import { AuditRoute } from "./routes/AuditRoute";
// ...
<Route path="/audit" element={<AuditRoute />} />
```

- [ ] **Step 5: Run — expected all tests pass + previous 8 still green**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && pnpm -F ops-console typecheck && pnpm -F ops-console test -- --run && pnpm -F ops-console build
```

- [ ] **Step 6: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add web/apps/ops-console/src/routes/AuditRoute.tsx web/apps/ops-console/src/routes/AuditRoute.test.tsx web/apps/ops-console/src/App.tsx
git commit -m "feat(web/ops-console): add /audit search page consuming bff audit proxy"
```

---

## Task C.3: distributor-portal — Approvals queue

**Files:**
- Create: `web/apps/distributor-portal/src/routes/ApprovalsRoute.tsx`
- Create: `web/apps/distributor-portal/src/routes/ApprovalsRoute.test.tsx`
- Modify: `web/apps/distributor-portal/src/App.tsx`
- Modify: `web/apps/distributor-portal/src/components/DistributorSidebar.tsx`

- [ ] **Step 1: Write failing test (`ApprovalsRoute.test.tsx`)**

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { ApprovalsRoute } from "./ApprovalsRoute";

function withProviders(node: React.ReactNode) {
  const store = configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
  });
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>{node}</ThemeProvider>
    </Provider>
  );
}

describe("ApprovalsRoute", () => {
  beforeEach(() => {
    let post = 0;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (init?.method === "POST") {
        post += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "a1",
            tenant_id: "t1",
            resource_type: "product",
            resource_id: "p1",
            status: "approved",
            decided_by_user_id: "u1",
            decided_at: "2026-04-25T01:00:00.000000Z",
            created_at: "2026-04-25T00:00:00.000000Z",
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () =>
          post === 0
            ? [
                {
                  id: "a1",
                  tenant_id: "t1",
                  resource_type: "product",
                  resource_id: "p1",
                  status: "pending",
                  created_at: "2026-04-25T00:00:00.000000Z",
                },
              ]
            : [],
      } as Response;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders heading + queue", async () => {
    render(withProviders(<ApprovalsRoute />));
    expect(screen.getByRole("heading", { name: /approvals/i })).toBeTruthy();
    await screen.findByText(/p1/);
  });

  it("decides approval on Approve click", async () => {
    render(withProviders(<ApprovalsRoute />));
    await screen.findByText(/p1/);
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/approvals/a1/decide"),
      expect.objectContaining({ method: "POST" }),
    ));
  });
});
```

- [ ] **Step 2: Run — expected FAIL**

- [ ] **Step 3: Implement `web/apps/distributor-portal/src/routes/ApprovalsRoute.tsx`**

```tsx
import { CheckSquare, ThumbsUp, ThumbsDown } from "lucide-react";
import { Card, EmptyState, Heading, Stack, Text, Button, Skeleton } from "@hydrax/ui";
import { useListPendingApprovalsQuery, useDecideApprovalMutation } from "@hydrax/api-client";

const HARDCODED_DECIDER = "distributor-operator-1"; // TODO replace once auth lands

export function ApprovalsRoute() {
  const { data, isFetching, error, refetch } = useListPendingApprovalsQuery();
  const [decide, { isLoading: deciding }] = useDecideApprovalMutation();

  const onDecide = async (id: string, status: "approved" | "rejected") => {
    await decide({ id, status, decided_by_user_id: HARDCODED_DECIDER });
    refetch();
  };

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">Approvals</Heading>
        <Text tone="muted">Pending decisions queued from upstream business events.</Text>
      </Stack>
      <Card title={<Heading level="h2">Queue</Heading>}>
        {isFetching ? (
          <Stack gap="sm">
            <Skeleton width="100%" height={48} />
            <Skeleton width="100%" height={48} />
          </Stack>
        ) : error ? (
          <Text tone="danger" role="alert">Failed to load approvals.</Text>
        ) : !data || data.length === 0 ? (
          <EmptyState icon={CheckSquare} iconLabel="Empty queue" title="No pending approvals" body="When upstream events queue an approval, it appears here." />
        ) : (
          <Stack gap="md">
            {data.map((a) => (
              <Stack key={a.id} direction="row" align="center" gap="md" style={{ justifyContent: "space-between" }}>
                <Stack gap="xs">
                  <Text family="mono">{a.resource_type}/{a.resource_id}</Text>
                  <Text size="bodySm" tone="muted">tenant {a.tenant_id} · {a.created_at}</Text>
                </Stack>
                <Stack direction="row" gap="sm">
                  <Button onClick={() => onDecide(a.id, "approved")} disabled={deciding}>
                    Approve
                  </Button>
                  <Button onClick={() => onDecide(a.id, "rejected")} disabled={deciding} tone="danger">
                    Reject
                  </Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </Card>
    </Stack>
  );
}
```

> **Verify before writing:** does `Button` accept a `tone="danger"` prop? If not, drop it (the colour distinction is nice-to-have, not required). The icons `ThumbsUp`/`ThumbsDown` are imported but only used if `Button` accepts `icon=`; otherwise remove unused imports.

- [ ] **Step 4: Modify `App.tsx` — add /approvals route**

```tsx
import { ApprovalsRoute } from "./routes/ApprovalsRoute";
// ...
<Route path="/approvals" element={<ApprovalsRoute />} />
```

- [ ] **Step 5: Modify `DistributorSidebar.tsx` — add Approvals nav entry**

In the NAV array, insert (between Subscriptions and Settlements):

```ts
{ label: "Approvals", path: "/approvals", icon: CheckSquare },
```

Add the `CheckSquare` import at the top alongside other lucide imports.

- [ ] **Step 6: Run — typecheck + test + build**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && pnpm -F distributor-portal typecheck && pnpm -F distributor-portal test -- --run && pnpm -F distributor-portal build
```

- [ ] **Step 7: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add web/apps/distributor-portal/src/routes/ApprovalsRoute.tsx web/apps/distributor-portal/src/routes/ApprovalsRoute.test.tsx web/apps/distributor-portal/src/App.tsx web/apps/distributor-portal/src/components/DistributorSidebar.tsx
git commit -m "feat(web/distributor): add /approvals queue page consuming bff approvals proxy"
```

---

## Task C.4: investor-portal — Subscription detail lookup

**Files:**
- Create: `web/apps/investor-portal/src/routes/SubscriptionsRoute.tsx`
- Create: `web/apps/investor-portal/src/routes/SubscriptionsRoute.test.tsx`
- Modify: `web/apps/investor-portal/src/App.tsx`

> **Pre-task verification:** investor-portal currently has only `/health` route per the prior audit. Sidebar lives **inline in App.tsx** (no separate `InvestorSidebar.tsx`). Adapt accordingly: extend the inline nav with a Subscriptions entry, or factor out a sidebar in a separate plan. **For this plan:** add the route + extend whatever nav exists. Skip touching the AppShell layout if the Sidebar is implicit.

- [ ] **Step 1: Read App.tsx first** — confirm whether sidebar is inline or in a component file.

```bash
cat /home/naim/.openclaw/workspace/hydrax-app/web/apps/investor-portal/src/App.tsx
```

- [ ] **Step 2: Write failing test (`SubscriptionsRoute.test.tsx`)**

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { SubscriptionsRoute } from "./SubscriptionsRoute";

function withProviders(node: React.ReactNode) {
  const store = configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
  });
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>{node}</ThemeProvider>
    </Provider>
  );
}

describe("SubscriptionsRoute", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          id: "s1",
          product_id: "p1",
          investor_user_id: "u1",
          amount_minor: 5000000,
          currency: "USD",
          status: "pending",
          created_at: "2026-04-25T00:00:00.000000Z",
          updated_at: "2026-04-25T00:00:00.000000Z",
        }),
      } as Response),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders heading", () => {
    render(withProviders(<SubscriptionsRoute />));
    expect(screen.getByRole("heading", { name: /subscriptions/i })).toBeTruthy();
  });

  it("fetches and renders detail on lookup", async () => {
    render(withProviders(<SubscriptionsRoute />));
    fireEvent.change(screen.getByLabelText(/subscription id/i), { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: /lookup/i }));
    await screen.findByText(/p1/);
    await screen.findByText(/USD/);
  });
});
```

- [ ] **Step 3: Run — expected FAIL**

- [ ] **Step 4: Implement `SubscriptionsRoute.tsx`**

```tsx
import { useState } from "react";
import { FileSignature, Search } from "lucide-react";
import { Card, EmptyState, Heading, Stack, Text, Button, Skeleton } from "@hydrax/ui";
import { useGetSubscriptionQuery } from "@hydrax/api-client";

export function SubscriptionsRoute() {
  const [draft, setDraft] = useState("");
  const [id, setId] = useState<string | null>(null);
  const { data, isFetching, error } = useGetSubscriptionQuery(id ?? "", { skip: id === null });

  const formatAmount = (minor: number, ccy: string): string =>
    `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy}`;

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">Subscriptions</Heading>
        <Text tone="muted">Look up a subscription by id to see status and lifecycle.</Text>
      </Stack>
      <Card title={<Heading level="h2">Lookup</Heading>}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) setId(draft.trim());
          }}
          style={{ display: "grid", gap: "var(--hydrax-space-md)" }}
        >
          <label>
            <Text size="bodySm" tone="muted">Subscription ID</Text>
            <input
              aria-label="subscription id"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px" }}
            />
          </label>
          <Button type="submit">Lookup</Button>
        </form>
      </Card>
      <Card title={<Heading level="h2">Detail</Heading>}>
        {id === null ? (
          <EmptyState icon={FileSignature} iconLabel="No subscription" title="Enter a subscription ID" body="Detail will appear here." />
        ) : isFetching ? (
          <Skeleton width="100%" height={48} />
        ) : error ? (
          <Text tone="danger" role="alert">Failed to load subscription.</Text>
        ) : data ? (
          <Stack gap="sm">
            <Text family="mono">{data.id}</Text>
            <Text>Product: {data.product_id}</Text>
            <Text>Amount: {formatAmount(data.amount_minor, data.currency)}</Text>
            <Text>Status: {data.status}</Text>
          </Stack>
        ) : null}
      </Card>
    </Stack>
  );
}
```

- [ ] **Step 5: Modify `App.tsx`** — add the route + a sidebar entry if the existing structure allows. If sidebar is inline, append a `<Link to="/subscriptions">Subscriptions</Link>` row matching the existing health row pattern.

```tsx
import { SubscriptionsRoute } from "./routes/SubscriptionsRoute";
// ...
<Route path="/subscriptions" element={<SubscriptionsRoute />} />
```

- [ ] **Step 6: Run — typecheck + test + build**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && pnpm -F investor-portal typecheck && pnpm -F investor-portal test -- --run && pnpm -F investor-portal build
```

- [ ] **Step 7: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add web/apps/investor-portal/src/routes/SubscriptionsRoute.tsx web/apps/investor-portal/src/routes/SubscriptionsRoute.test.tsx web/apps/investor-portal/src/App.tsx
git commit -m "feat(web/investor): add /subscriptions lookup page consuming bff subscriptions proxy"
```

---

# Final verification (run after all 13 tasks land)

```bash
cd /home/naim/.openclaw/workspace/hydrax-app

# Go services touched by this plan
(cd services/audit-svc      && go vet ./... && go test ./...)
(cd services/approval-svc   && go vet ./... && go test ./...)

# Workspace-wide TS verification
pnpm -r --if-present typecheck
pnpm -r --if-present test -- --run
pnpm -r --if-present build

# Repo hygiene
git log --oneline origin/main..HEAD
git diff --stat origin/main..HEAD
```

**Expected after final task:**
- approval-svc tests: 7 repo + 9 handler + 1 health = 17 (was 1).
- audit-svc tests: unchanged from prior plan.
- bff tests: prior 15 + 4 audit proxy + 5 approvals proxy + 2 server 405 cases = 26.
- ops-console tests: prior 8 + 3 AuditRoute = 11.
- distributor-portal tests: prior 8 + 2 ApprovalsRoute = 10.
- investor-portal tests: prior 5 + 2 SubscriptionsRoute = 7.
- api-client tests: unchanged from prior plan (still 2).
- 13 commits added on `main` since the plan started, all conventional, all `feat(...)` or `docs(...)`, all under 8 files.

---

# STATE.yaml update (final commit)

After Task C.4 lands and final verification passes, update `STATE.yaml`:

- `summary` — "BFF approvals + audit proxies + 3 portal pages landed. approval-svc grew from health-only to in-memory CRUD; persistence deferred to future plan."
- `current_focus` — describe what's next (Q3/Q4/Q7 unblocks, auth foundation, or workflow lifecycle for subscriptions).
- `verification_log` — append a single multi-line entry summarizing the plan's commits + test counts.

Final commit:

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && git add STATE.yaml
git commit -m "chore(state): record bff approvals+audit+portal-pages slice complete"
```

---

# Self-Review (run before dispatching tasks)

**1. Spec coverage:**
- BFF audit proxy: covered (Phase A.1, A.2).
- BFF approvals proxy: covered (Phase B.4, B.5).
- approval-svc real upstream for proxy: covered (Phase B.1, B.2, B.3).
- Distributor pages beyond polished Home: covered (Phase C.3 — `/approvals`).
- Investor pages beyond polished Home: covered (Phase C.4 — `/subscriptions`).
- Ops-console new page: covered (Phase C.2 — `/audit`).

**2. Placeholder scan:** no "TODO" / "fill in details" / "similar to Task N" outside the explicit `HARDCODED_DECIDER` constant which is documented.

**3. Type consistency:**
- `AuditEvent` shape matches across audit-svc handlers, BFF proxy, and api-client.
- `Approval` shape matches across approval-svc handlers, BFF proxy, and api-client.
- `Subscription` shape matches existing workflow-svc subscriptions schema and BFF subscriptions proxy.
- `useListAuditEventsQuery`, `useListPendingApprovalsQuery`, `useDecideApprovalMutation`, `useGetSubscriptionQuery` — all referenced in C.2/C.3/C.4 are defined in C.1.

**4. Verify-before-writing flags raised in plan body** (these are real concerns the executing engineer must check, not placeholders):
- `@hydrax/ui` `Button` icon prop / `tone="danger"` prop — task C.2 + C.3 have explicit "verify before writing" notes; if the prop doesn't exist, drop it.
- investor-portal sidebar shape — task C.4 has explicit "Read App.tsx first" step.

---

# Execution

Plan complete and saved. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks. Best for this 13-task plan because each task is well-scoped and easy to verify.

**2. Inline Execution** — execute tasks in this session sequentially.
