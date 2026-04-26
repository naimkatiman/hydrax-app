# Workflow Lifecycle HTTP Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing `lifecycle` state machine in `services/workflow-svc` as a real `POST /v1/products/{id}/transition` HTTP endpoint, proxied through the BFF, surfaced in `@hydrax/api-client` as an RTK mutation, and rendered in `issuer-portal` as conditional Approve/Activate/Mature/Cancel buttons on a product detail route.

**Architecture:** workflow-svc orchestrates per request: `repo.GetByID(ctx, id)` → `lifecycle.Transition(from, to)` → `repo.UpdateStatus(ctx, id, from, to)` (optimistic-concurrency UPDATE). Lifecycle stays a pure-function package; repo stays dumb SQL. BFF proxies the route under the existing typed proxy pattern. UI reads `allowed_next` off the GET response (server is source of truth — no TS duplication of the state machine).

**Tech Stack:** Go 1.22 (stdlib `net/http`, `database/sql` with `pgx` stdlib driver), Node 20 + TypeScript (BFF), React 18 + RTK Query + Vite + lucide-react (issuer-portal), vitest + Go testing.

---

## Scope Check

This is one subsystem (lifecycle transitions for the `products` resource). No split needed. Subscriptions and approvals lifecycle wiring are explicit follow-ups, not part of this plan.

## Decisions Locked Before Coding

1. **Audit emission DEFERRED** to a follow-up plan. Each transition is exactly the kind of event `audit_events` exists for, but bundling audit emission into this slice doubles its surface area and couples two upstreams. The follow-up plan emits via the audit-svc HTTP path on 2xx in workflow-svc. **Tracked as deferred follow-up in STATE.yaml at end of execution.**
2. **Approval-svc boundary EXPLICIT.** The `pending → approved` edge exists in the state machine and is callable via this endpoint, but production user-facing approval UX in distributor-portal routes through `approval-svc`, not this endpoint. The transition endpoint is for **system-driven transitions** (e.g. `active → matured` by future scheduler) and **ops-console operator overrides**. Document this in the workflow-svc handler godoc.
3. **`allowed_next` on GET response** — server is the source of truth. Workflow-svc enriches `productResponse` with `allowed_next []string`; BFF passes it through; api-client types it. UI reads it directly to decide which buttons to render. No TS-side state-machine duplication.
4. **Optimistic-concurrency UpdateStatus.** Repo SQL: `UPDATE products SET status=$3, updated_at=NOW() WHERE id=$1 AND status=$2 RETURNING ...`. Zero rows updated → repo returns `errStaleStatus` (caller maps to 409). Sequence in handler: GetByID → lifecycle.Transition → UpdateStatus. Three error paths to test.
5. **No deploy step.** Workflow-svc Railway deploy is currently gated on the `pgx 5.9.2 → go 1.25.0 vs alpine 1.22` toolchain decision (per memory `feedback-go-docker-vs-workspace.md`). This slice does not touch `services/workflow-svc/go.mod`, so local verification proceeds; a Railway redeploy is **out of scope** and depends on a separate toolchain unblock.

## Commit Boundaries

Six commits, one concern each, all under the 15-file cap:

| # | Title | Files touched |
|---|---|---|
| C1 | `feat(workflow-svc): add products.UpdateStatus repo method with optimistic concurrency` | 2 |
| C2 | `feat(workflow-svc): expose POST /v1/products/{id}/transition with state-machine validation` | 4 |
| C3 | `feat(bff): proxy transitionProduct to workflow-svc` | 2 |
| C4 | `feat(bff): wire POST /v1/products/{id}/transition route` | 2 |
| C5 | `feat(web/api-client): add useTransitionProductMutation + allowed_next type` | 2 |
| C6 | `feat(web/issuer-portal): add /products/:id detail route with lifecycle transition buttons` | 4 |

## File Structure

**Create:**
- `web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx` — product detail view with conditional transition buttons
- `web/apps/issuer-portal/src/routes/ProductDetailRoute.test.tsx` — 4 vitest cases

**Modify:**
- `services/workflow-svc/internal/products/repo.go` — add `UpdateStatus` method + `errStaleStatus` sentinel + `IsStaleStatus` predicate
- `services/workflow-svc/internal/products/repo_test.go` — 3 new test cases for UpdateStatus
- `services/workflow-svc/internal/handlers/products.go` — add `Transition` handler + `allowed_next` field on `productResponse` + helper to compute it
- `services/workflow-svc/internal/handlers/products_test.go` — 4 new test cases for Transition + 1 for allowed_next on GET
- `services/workflow-svc/cmd/server/main.go` — register `POST /v1/products/{id}/transition`
- `services/bff/src/products/proxy.ts` — add `TransitionProductInput` type + `transitionProduct` function + extend `Product.allowed_next?: readonly string[]`
- `services/bff/src/products/proxy.test.ts` — 3 new test cases
- `services/bff/src/server.ts` — register `POST /v1/products/{id}/transition` route
- `services/bff/src/server.test.ts` — 2 new test cases (success + upstream error)
- `web/packages/api-client/src/api.ts` — add `transitionProduct` mutation + extend `Product` with `allowed_next?: readonly string[]`
- `web/apps/issuer-portal/src/App.tsx` — register `/products/:id` route + sidebar entry (or top-bar link)

---

## Task 1: products.UpdateStatus repo method

**Files:**
- Modify: `services/workflow-svc/internal/products/repo.go`
- Test: `services/workflow-svc/internal/products/repo_test.go`

- [ ] **Step 1: Write the first failing test — happy path**

Add this test to `services/workflow-svc/internal/products/repo_test.go` inside the existing test file (matches the existing `setup(t)` helper pattern, which seeds a tenant and returns a repo bound to a `*sql.Tx`):

```go
func TestUpdateStatusHappyPath(t *testing.T) {
	ctx := context.Background()
	repo, _ := setup(t)
	in := ProductInput{
		TenantID:    seedTenantID(t, repo),
		Code:        "T1-CODE",
		Name:        "Tenant One Product",
		ProductType: "credit-note",
	}
	created, err := repo.Insert(ctx, in)
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}
	if created.Status != "pending" {
		t.Fatalf("expected status=pending, got %q", created.Status)
	}

	got, err := repo.UpdateStatus(ctx, created.ID, "pending", "approved")
	if err != nil {
		t.Fatalf("UpdateStatus pending->approved: %v", err)
	}
	if got.Status != "approved" {
		t.Errorf("UpdateStatus returned status=%q, want approved", got.Status)
	}
	if !got.UpdatedAt.After(created.UpdatedAt) {
		t.Errorf("UpdatedAt did not advance: created=%v got=%v", created.UpdatedAt, got.UpdatedAt)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/workflow-svc && go test ./internal/products/ -run TestUpdateStatusHappyPath -v`
Expected: FAIL with compile error `repo.UpdateStatus undefined`.

- [ ] **Step 3: Write minimal implementation**

Add to `services/workflow-svc/internal/products/repo.go`:

```go
// errStaleStatus is unexported; callers branch via IsStaleStatus.
// Returned by UpdateStatus when the (id, fromStatus) row no longer exists
// — either the product was deleted (rare) or its status drifted under us
// (concurrent transition race). Caller maps this to HTTP 409.
var errStaleStatus = errors.New("products: stale status — row not updated")

// IsStaleStatus reports whether err is the optimistic-concurrency miss
// from UpdateStatus.
func IsStaleStatus(err error) bool {
	return errors.Is(err, errStaleStatus)
}

// UpdateStatus performs an optimistic-concurrency status change:
// UPDATE products SET status=$3 WHERE id=$1 AND status=$2.
// If the WHERE matches zero rows, IsStaleStatus(err) returns true.
// Lifecycle validity (is fromStatus -> toStatus a legal edge?) is the
// caller's responsibility — this method writes blindly to whatever pair
// is passed and lets the DB CHECK constraint reject illegal status
// strings as a backstop.
func (p *Products) UpdateStatus(ctx context.Context, id, fromStatus, toStatus string) (*Product, error) {
	const q = `
		UPDATE products
		SET status = $3, updated_at = NOW()
		WHERE id = $1 AND status = $2
		RETURNING id, tenant_id, code, name, product_type, status, rails_product_id, created_at, updated_at
	`
	var got Product
	err := p.tx.QueryRowContext(ctx, q, id, fromStatus, toStatus).Scan(
		&got.ID, &got.TenantID, &got.Code, &got.Name, &got.ProductType,
		&got.Status, &got.RailsProductID, &got.CreatedAt, &got.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("products.UpdateStatus(%q, %q->%q): %w", id, fromStatus, toStatus, errStaleStatus)
	}
	if err != nil {
		return nil, fmt.Errorf("products.UpdateStatus(%q, %q->%q): %w", id, fromStatus, toStatus, err)
	}
	return &got, nil
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/workflow-svc && go test ./internal/products/ -run TestUpdateStatusHappyPath -v`
Expected: PASS.

- [ ] **Step 5: Add the stale-status test**

Append to `services/workflow-svc/internal/products/repo_test.go`:

```go
func TestUpdateStatusStaleStatusReturnsSentinel(t *testing.T) {
	ctx := context.Background()
	repo, _ := setup(t)
	created, err := repo.Insert(ctx, ProductInput{
		TenantID:    seedTenantID(t, repo),
		Code:        "T1-STALE",
		Name:        "Stale Test",
		ProductType: "credit-note",
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}
	// Caller claims fromStatus=approved but row is actually pending.
	_, err = repo.UpdateStatus(ctx, created.ID, "approved", "active")
	if err == nil {
		t.Fatal("UpdateStatus with mismatched fromStatus should fail, got nil")
	}
	if !IsStaleStatus(err) {
		t.Errorf("expected IsStaleStatus(err)==true, got %v", err)
	}
}
```

- [ ] **Step 6: Add the unknown-id test**

Append:

```go
func TestUpdateStatusUnknownIDReturnsStale(t *testing.T) {
	ctx := context.Background()
	repo, _ := setup(t)
	// Bogus UUID — never inserted.
	_, err := repo.UpdateStatus(ctx, "00000000-0000-0000-0000-000000000000", "pending", "approved")
	if err == nil {
		t.Fatal("UpdateStatus on missing id should fail, got nil")
	}
	if !IsStaleStatus(err) {
		t.Errorf("expected IsStaleStatus(err)==true (missing id is indistinguishable from drift), got %v", err)
	}
}
```

The reason a missing id and a drifted status both return `errStaleStatus`: both are 0-row-updated outcomes, the SQL cannot distinguish them, and the handler maps both to 409 anyway. Worth one comment in the godoc on `UpdateStatus` — already added.

- [ ] **Step 7: Run all repo tests**

Run: `cd services/workflow-svc && go test ./internal/products/ -v`
Expected: all existing tests still pass, three new ones pass.

- [ ] **Step 8: Commit C1**

```bash
git add services/workflow-svc/internal/products/repo.go services/workflow-svc/internal/products/repo_test.go
git commit -m "$(cat <<'EOF'
feat(workflow-svc): add products.UpdateStatus repo method with optimistic concurrency

Adds errStaleStatus sentinel + IsStaleStatus predicate so handlers can
distinguish 409 (drift / unknown id) from 500 (DB error). SQL is
WHERE id=$1 AND status=$2 — zero rows updated returns the sentinel.
Lifecycle validity stays handler-side; repo writes whatever status pair
it is handed.
EOF
)"
```

---

## Task 2: workflow-svc Transition handler + allowed_next on responses

**Files:**
- Modify: `services/workflow-svc/internal/handlers/products.go`
- Modify: `services/workflow-svc/internal/handlers/products_test.go`
- Modify: `services/workflow-svc/cmd/server/main.go`

- [ ] **Step 1: Write the first failing handler test (happy path)**

Append to `services/workflow-svc/internal/handlers/products_test.go` (matches existing test infra — `newTestServer(t)` helper that wires `Create`, `Get`, and now `Transition`):

```go
func TestTransitionPendingToApprovedReturns200WithUpdatedProduct(t *testing.T) {
	srv, repo := newTestServer(t)
	defer srv.Close()

	created := mustCreateProduct(t, srv, createBody{
		TenantID: seedTenantID(t, repo), Code: "T-1", Name: "X", ProductType: "credit-note",
	})

	body := strings.NewReader(`{"to":"approved"}`)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/products/"+created.ID+"/transition", body)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST transition: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var got productResponse
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Status != "approved" {
		t.Errorf("status = %q, want approved", got.Status)
	}
	wantNext := []string{"active", "cancelled"}
	if !equalStringSets(got.AllowedNext, wantNext) {
		t.Errorf("allowed_next = %v, want %v (any order)", got.AllowedNext, wantNext)
	}
}
```

Add this helper at the bottom of the test file (sort-and-compare for set equality, since `lifecycle.AllowedNext` returns unordered):

```go
func equalStringSets(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	ac := append([]string(nil), a...)
	bc := append([]string(nil), b...)
	sort.Strings(ac)
	sort.Strings(bc)
	for i := range ac {
		if ac[i] != bc[i] {
			return false
		}
	}
	return true
}
```

Make sure the test file imports `"sort"` and `"strings"` if they aren't already there.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/workflow-svc && go test ./internal/handlers/ -run TestTransitionPendingToApprovedReturns200WithUpdatedProduct -v`
Expected: FAIL — either compile error (`AllowedNext` field undefined, `Transition` handler undefined) or 404 routing miss.

- [ ] **Step 3: Add `allowed_next` to the response shape**

In `services/workflow-svc/internal/handlers/products.go`:

Replace the `productResponse` struct and `toResponse` function with:

```go
type productResponse struct {
	ID             string   `json:"id"`
	TenantID       string   `json:"tenant_id"`
	Code           string   `json:"code"`
	Name           string   `json:"name"`
	ProductType    string   `json:"product_type"`
	Status         string   `json:"status"`
	RailsProductID *string  `json:"rails_product_id,omitempty"`
	AllowedNext    []string `json:"allowed_next"`
	CreatedAt      string   `json:"created_at"`
	UpdatedAt      string   `json:"updated_at"`
}

func toResponse(p *products.Product) productResponse {
	next := lifecycle.AllowedNext(lifecycle.State(p.Status))
	out := make([]string, 0, len(next))
	for _, s := range next {
		out = append(out, string(s))
	}
	sort.Strings(out) // deterministic JSON for tests + clients
	return productResponse{
		ID:             p.ID,
		TenantID:       p.TenantID,
		Code:           p.Code,
		Name:           p.Name,
		ProductType:    p.ProductType,
		Status:         p.Status,
		RailsProductID: p.RailsProductID,
		AllowedNext:    out,
		CreatedAt:      p.CreatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
		UpdatedAt:      p.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
	}
}
```

Add the imports at the top of the file:

```go
import (
	// existing imports...
	"sort"
	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/lifecycle"
)
```

- [ ] **Step 4: Add the Transition handler**

Append to `services/workflow-svc/internal/handlers/products.go`:

```go
type transitionBody struct {
	To string `json:"to"`
}

// Transition handles POST /v1/products/{id}/transition.
//
// This endpoint is for system-driven transitions (e.g. scheduler-driven
// active->matured) and ops-console operator overrides. Production
// user-facing approval UX in distributor-portal routes through
// approval-svc, NOT this endpoint — even though pending->approved is
// reachable here, the approval-svc audit trail and multi-approver
// chain are bypassed if you call this directly.
//
// Returns:
//   200 with updated product on success
//   400 on bad JSON / missing fields
//   404 when the product id does not exist (initial GetByID)
//   409 when status drifted between GetByID and UpdateStatus (race)
//   422 when (current_status, body.to) is not a legal lifecycle edge
//   500 on other errors
func Transition(repo *products.Products) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		id := r.PathValue("id")
		if id == "" {
			errorJSON(w, http.StatusBadRequest, "missing_id", "id path param required")
			return
		}
		var body transitionBody
		r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			errorJSON(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		if body.To == "" {
			errorJSON(w, http.StatusBadRequest, "missing_to", "to field required")
			return
		}

		current, err := repo.GetByID(r.Context(), id)
		if err != nil {
			if products.IsNotFound(err) {
				errorJSON(w, http.StatusNotFound, "not_found", "no product with that id")
				return
			}
			log.Printf("workflow-svc: products.Transition GetByID(%q): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}

		from := lifecycle.State(current.Status)
		to := lifecycle.State(body.To)
		if err := lifecycle.Transition(from, to); err != nil {
			errorJSON(w, http.StatusUnprocessableEntity, "invalid_transition", err.Error())
			return
		}

		updated, err := repo.UpdateStatus(r.Context(), id, current.Status, body.To)
		if err != nil {
			if products.IsStaleStatus(err) {
				errorJSON(w, http.StatusConflict, "stale_status",
					"product status changed under us — refetch and retry")
				return
			}
			log.Printf("workflow-svc: products.Transition UpdateStatus(%q): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(toResponse(updated))
	}
}
```

- [ ] **Step 5: Wire the route in main.go**

Edit `services/workflow-svc/cmd/server/main.go`. Inside the `if dbURL != ""` block, after the existing two product routes and the two subscription routes, add:

```go
mux.HandleFunc("POST /v1/products/{id}/transition", handlers.Transition(repo))
```

Place it adjacent to the existing `mux.HandleFunc("GET /v1/products/{id}", ...)` line so the product routes stay grouped.

- [ ] **Step 6: Run the happy-path test**

Run: `cd services/workflow-svc && go test ./internal/handlers/ -run TestTransitionPendingToApprovedReturns200WithUpdatedProduct -v`
Expected: PASS.

- [ ] **Step 7: Add the invalid-transition test**

Append to `services/workflow-svc/internal/handlers/products_test.go`:

```go
func TestTransitionPendingToActiveReturns422(t *testing.T) {
	srv, repo := newTestServer(t)
	defer srv.Close()
	created := mustCreateProduct(t, srv, createBody{
		TenantID: seedTenantID(t, repo), Code: "T-2", Name: "X", ProductType: "credit-note",
	})

	body := strings.NewReader(`{"to":"active"}`)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/products/"+created.ID+"/transition", body)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST transition: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", resp.StatusCode)
	}

	var errBody map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&errBody); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if errBody["error"] != "invalid_transition" {
		t.Errorf("error code = %q, want invalid_transition", errBody["error"])
	}
}
```

- [ ] **Step 8: Add the unknown-id test**

```go
func TestTransitionUnknownIDReturns404(t *testing.T) {
	srv, _ := newTestServer(t)
	defer srv.Close()

	body := strings.NewReader(`{"to":"approved"}`)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/products/00000000-0000-0000-0000-000000000000/transition", body)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST transition: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}
```

- [ ] **Step 9: Add the missing-`to`-field test**

```go
func TestTransitionMissingToFieldReturns400(t *testing.T) {
	srv, repo := newTestServer(t)
	defer srv.Close()
	created := mustCreateProduct(t, srv, createBody{
		TenantID: seedTenantID(t, repo), Code: "T-3", Name: "X", ProductType: "credit-note",
	})

	body := strings.NewReader(`{}`)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/products/"+created.ID+"/transition", body)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST transition: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}
```

- [ ] **Step 10: Add the allowed_next-on-GET regression test**

```go
func TestGetProductIncludesAllowedNext(t *testing.T) {
	srv, repo := newTestServer(t)
	defer srv.Close()
	created := mustCreateProduct(t, srv, createBody{
		TenantID: seedTenantID(t, repo), Code: "T-4", Name: "X", ProductType: "credit-note",
	})

	resp, err := http.Get(srv.URL + "/v1/products/" + created.ID)
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var got productResponse
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	want := []string{"approved", "cancelled"}
	if !equalStringSets(got.AllowedNext, want) {
		t.Errorf("allowed_next = %v, want %v", got.AllowedNext, want)
	}
}
```

- [ ] **Step 11: Run the full handler test suite**

Run: `cd services/workflow-svc && go test ./internal/handlers/ -v`
Expected: all pre-existing tests pass, four new transition tests pass, GET allowed_next test passes.

- [ ] **Step 12: Run vet across the service**

Run: `cd services/workflow-svc && go vet ./...`
Expected: no output (clean).

- [ ] **Step 13: Commit C2**

```bash
git add services/workflow-svc/internal/handlers/products.go services/workflow-svc/internal/handlers/products_test.go services/workflow-svc/cmd/server/main.go
git commit -m "$(cat <<'EOF'
feat(workflow-svc): expose POST /v1/products/{id}/transition with state-machine validation

Handler orchestrates GetByID -> lifecycle.Transition -> UpdateStatus
with explicit error mapping: 404 unknown id, 409 stale status, 422
invalid transition, 400 missing/bad body. Response now includes
allowed_next derived from lifecycle.AllowedNext so clients render
buttons without duplicating the FSM. This endpoint is for system /
ops transitions; user-facing approval UX still routes through
approval-svc.
EOF
)"
```

---

## Task 3: BFF proxy — transitionProduct

**Files:**
- Modify: `services/bff/src/products/proxy.ts`
- Modify: `services/bff/src/products/proxy.test.ts`

- [ ] **Step 1: Write the failing test (success path)**

Append to `services/bff/src/products/proxy.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  transitionProduct,
  ProductsUpstreamError,
  type Product,
  type TransitionProductInput,
} from "./proxy.js";

describe("transitionProduct", () => {
  it("POSTs to /v1/products/{id}/transition and returns the updated product", async () => {
    const fixture: Product = {
      id: "p-1",
      tenant_id: "t-1",
      code: "C1",
      name: "N",
      product_type: "credit-note",
      status: "approved",
      allowed_next: ["active", "cancelled"],
      created_at: "2026-04-25T00:00:00.000000Z",
      updated_at: "2026-04-25T00:00:01.000000Z",
    };
    let captured: { url?: string; init?: RequestInit } = {};
    const fetchImpl: typeof fetch = async (input, init) => {
      captured = { url: String(input), init };
      return new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const input: TransitionProductInput = { to: "approved" };
    const got = await transitionProduct("p-1", input, {
      workflowSvcUrl: "http://wf",
      fetchImpl,
    });

    expect(got).toEqual(fixture);
    expect(captured.url).toBe("http://wf/v1/products/p-1/transition");
    expect(captured.init?.method).toBe("POST");
    expect(captured.init?.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(captured.init?.body).toBe(JSON.stringify(input));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/bff && pnpm test -- --run`
Expected: FAIL — `transitionProduct` and `TransitionProductInput` not exported.

- [ ] **Step 3: Implement the proxy function**

In `services/bff/src/products/proxy.ts`:

Add `allowed_next` to the existing `Product` interface:

```typescript
export interface Product {
  readonly id: string;
  readonly tenant_id: string;
  readonly code: string;
  readonly name: string;
  readonly product_type: string;
  readonly status: string;
  readonly rails_product_id?: string;
  readonly allowed_next?: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
}
```

(`allowed_next?` not `allowed_next` — leaving it optional means responses from older workflow-svc builds during a rolling deploy don't break the client.)

Append:

```typescript
export interface TransitionProductInput {
  readonly to: string;
}

export async function transitionProduct(
  id: string,
  input: Readonly<TransitionProductInput>,
  opts: Readonly<ProxyOptions>,
): Promise<Product> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(
        `${opts.workflowSvcUrl}/v1/products/${encodeURIComponent(id)}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal,
        },
      );
    } catch (err: unknown) {
      throw new ProductsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new ProductsUpstreamError(`workflow-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Product;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/bff && pnpm test -- --run`
Expected: PASS.

- [ ] **Step 5: Add upstream-error and timeout tests**

Append:

```typescript
it("propagates upstream 422 as ProductsUpstreamError with httpStatus", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ error: "invalid_transition", message: "no" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });

  await expect(
    transitionProduct("p-1", { to: "matured" }, { workflowSvcUrl: "http://wf", fetchImpl }),
  ).rejects.toMatchObject({
    name: "ProductsUpstreamError",
    httpStatus: 422,
  });
});

it("converts a transport error into ProductsUpstreamError without httpStatus", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new TypeError("network down");
  };

  const err = await transitionProduct("p-1", { to: "approved" }, {
    workflowSvcUrl: "http://wf",
    fetchImpl,
  }).catch((e: unknown) => e);

  expect(err).toBeInstanceOf(ProductsUpstreamError);
  expect((err as ProductsUpstreamError).httpStatus).toBeUndefined();
});
```

- [ ] **Step 6: Run all tests in the BFF workspace**

Run: `cd services/bff && pnpm test -- --run`
Expected: all existing tests still pass, three new ones pass.

- [ ] **Step 7: Typecheck the BFF workspace**

Run: `cd services/bff && pnpm typecheck`
Expected: no errors.

- [ ] **Step 8: Commit C3**

```bash
git add services/bff/src/products/proxy.ts services/bff/src/products/proxy.test.ts
git commit -m "$(cat <<'EOF'
feat(bff): proxy transitionProduct to workflow-svc

Adds TransitionProductInput type and transitionProduct() helper that
POSTs to /v1/products/{id}/transition and returns the updated row.
Extends Product with optional allowed_next so callers can render
lifecycle action buttons without duplicating the state machine.
EOF
)"
```

---

## Task 4: BFF route registration

**Files:**
- Modify: `services/bff/src/server.ts`
- Modify: `services/bff/src/server.test.ts`

- [ ] **Step 1: Write the failing route test**

Append to `services/bff/src/server.test.ts`. Match the existing fixture style (it spins up `startServer` against a stub upstream). Add:

```typescript
it("POST /v1/products/{id}/transition forwards to workflow-svc and returns 200", async () => {
  const upstreamPort = await getFreePort();
  const upstream = http.createServer((req, res) => {
    if (req.url === "/v1/products/abc/transition" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        id: "abc",
        tenant_id: "t-1",
        code: "C",
        name: "N",
        product_type: "credit-note",
        status: "approved",
        allowed_next: ["active", "cancelled"],
        created_at: "2026-04-25T00:00:00.000000Z",
        updated_at: "2026-04-25T00:00:01.000000Z",
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((r) => upstream.listen(upstreamPort, () => r()));

  const { server, baseUrl } = await startServer({
    port: 0,
    service: "bff",
    upstreamConfig: stubUpstreamConfig({ workflowSvcUrl: `http://127.0.0.1:${upstreamPort}` }),
  });
  try {
    const res = await fetch(`${baseUrl}/v1/products/abc/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "approved" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: "abc", status: "approved" });
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await new Promise<void>((r) => upstream.close(() => r()));
  }
});
```

If `getFreePort` and `stubUpstreamConfig` already exist in this test file (they do — used by other route tests), reuse them. If not, copy the helper definitions from the existing audit/approvals route tests in this same file.

Add a second test for the upstream-error pass-through:

```typescript
it("POST /v1/products/{id}/transition surfaces upstream 422 as 422", async () => {
  const upstreamPort = await getFreePort();
  const upstream = http.createServer((req, res) => {
    res.writeHead(422, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "invalid_transition", message: "pending->matured" }));
  });
  await new Promise<void>((r) => upstream.listen(upstreamPort, () => r()));

  const { server, baseUrl } = await startServer({
    port: 0,
    service: "bff",
    upstreamConfig: stubUpstreamConfig({ workflowSvcUrl: `http://127.0.0.1:${upstreamPort}` }),
  });
  try {
    const res = await fetch(`${baseUrl}/v1/products/abc/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "matured" }),
    });
    expect(res.status).toBe(422);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await new Promise<void>((r) => upstream.close(() => r()));
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/bff && pnpm test -- --run server.test`
Expected: both new tests FAIL — server returns 404 (route not registered) for the success case, 404 for the error case.

- [ ] **Step 3: Register the route**

In `services/bff/src/server.ts`:

Update the import line:

```typescript
import {
  fetchProduct,
  createProduct,
  transitionProduct,
  ProductsUpstreamError,
} from "./products/proxy.js";
```

Add the route handler. Place it adjacent to the existing `/v1/products/` POST and GET blocks (right before the `if (req.url === "/v1/subscriptions" && req.method === "POST")` block):

```typescript
// /v1/products/{id}/transition POST — match BEFORE the bare /{id} GET below.
if (req.url?.match(/^\/v1\/products\/[^/]+\/transition$/) && req.method === "POST") {
  const segments = req.url.split("/");
  const id = decodeURIComponent(segments[3] ?? "");
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
    const product = await transitionProduct(
      id,
      body as Parameters<typeof transitionProduct>[1],
      { workflowSvcUrl: upstreamConfig.workflowSvcUrl },
    );
    respondJson(res, 200, product);
  } catch (err: unknown) {
    if (err instanceof ProductsUpstreamError) {
      const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600
        ? err.httpStatus
        : 502;
      respondJson(res, status, { error: "products_upstream", message: err.message });
    } else {
      console.error("bff: /v1/products/{id}/transition handler:", err);
      respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
    }
  }
  return;
}
```

The `match BEFORE` comment matters: the existing `req.url?.startsWith("/v1/products/") && req.method === "GET"` matches GET only, but the new POST regex is shape-restrictive (`/transition$`) so order between the two doesn't matter for correctness — the comment is documenting intent for the future reader who adds a `PATCH /v1/products/{id}` and wonders about ordering.

- [ ] **Step 4: Run the BFF route tests**

Run: `cd services/bff && pnpm test -- --run server.test`
Expected: both new tests PASS, all existing route tests still pass.

- [ ] **Step 5: Typecheck the BFF workspace**

Run: `cd services/bff && pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit C4**

```bash
git add services/bff/src/server.ts services/bff/src/server.test.ts
git commit -m "$(cat <<'EOF'
feat(bff): wire POST /v1/products/{id}/transition route

Delegates to the products proxy transitionProduct() helper. Upstream
4xx and 5xx pass through unmodified (422 stays 422, 409 stays 409);
transport failures collapse to 502 per the existing pattern.
EOF
)"
```

---

## Task 5: api-client mutation

**Files:**
- Modify: `web/packages/api-client/src/api.ts`

- [ ] **Step 1: Inspect the existing api-client surface to find the right insertion point**

Run: `grep -n "createProduct\|getProduct\|builder.mutation\|builder.query" web/packages/api-client/src/api.ts | head -40`
Expected: shows existing product endpoints and their RTK shape.

- [ ] **Step 2: Extend the Product type and add the mutation**

In `web/packages/api-client/src/api.ts`:

Find the `Product` type definition. Add `allowed_next?: readonly string[]` alongside the existing fields. Match the file's existing convention (likely a `type` alias or `interface`):

```typescript
export interface Product {
  readonly id: string;
  readonly tenant_id: string;
  readonly code: string;
  readonly name: string;
  readonly product_type: string;
  readonly status: string;
  readonly rails_product_id?: string;
  readonly allowed_next?: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
}
```

(If the existing `Product` type already has different formatting — e.g. uses `type` instead of `interface` or uses non-readonly fields — match the existing convention. Do not unilaterally change the rest of the type's shape.)

Add the mutation. Find the existing `createProduct` mutation in the `endpoints` builder block and add immediately after it:

```typescript
transitionProduct: builder.mutation<Product, { id: string; to: string }>({
  query: ({ id, to }) => ({
    url: `/v1/products/${encodeURIComponent(id)}/transition`,
    method: "POST",
    body: { to },
  }),
  invalidatesTags: (_result, _err, arg) => [{ type: "Product", id: arg.id }],
}),
```

If the api-client file does not currently use `tagTypes` and `providesTags`/`invalidatesTags`, drop the `invalidatesTags` line — it's a no-op without the tag system. The mutation works either way; cache invalidation is a nice-to-have, not load-bearing for this slice.

Find the file's named export block at the bottom (looks like `export const { useGetProductQuery, useCreateProductMutation, ... } = api;`) and add `useTransitionProductMutation` to the destructuring.

- [ ] **Step 3: Typecheck the api-client package and downstream apps**

Run: `cd /home/naim/.openclaw/workspace/hydrax-app && pnpm -r --if-present typecheck`
Expected: no errors anywhere.

- [ ] **Step 4: Run all tests across the web monorepo**

Run: `pnpm -r --if-present test -- --run`
Expected: all existing tests still pass.

- [ ] **Step 5: Build all packages**

Run: `pnpm -r --if-present build`
Expected: clean build, no errors.

- [ ] **Step 6: Commit C5**

```bash
git add web/packages/api-client/src/api.ts
git commit -m "$(cat <<'EOF'
feat(web/api-client): add useTransitionProductMutation + allowed_next type

Mutation hits POST /v1/products/{id}/transition and returns the updated
Product. Product gains optional allowed_next so portals can render
lifecycle action buttons without duplicating the state machine.
EOF
)"
```

---

## Task 6: issuer-portal product detail route with lifecycle buttons

**Files:**
- Create: `web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx`
- Create: `web/apps/issuer-portal/src/routes/ProductDetailRoute.test.tsx`
- Modify: `web/apps/issuer-portal/src/App.tsx`

- [ ] **Step 1: Inspect the existing issuer-portal routing pattern**

Run: `cat web/apps/issuer-portal/src/App.tsx`
Note the current `<Routes>` block, sidebar items, and existing route file conventions (likely under `routes/`).

- [ ] **Step 2: Write the route component**

Create `web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx`:

```typescript
import { useParams } from "react-router-dom";
import { useGetProductQuery, useTransitionProductMutation } from "@hydrax/api-client";
import { Card, Heading, Stack, Text, Button, Icon } from "@hydrax/ui";
import { CheckCircle2, PlayCircle, Flag, XCircle } from "lucide-react";

const ICONS: Record<string, typeof CheckCircle2> = {
  approved: CheckCircle2,
  active: PlayCircle,
  matured: Flag,
  cancelled: XCircle,
};

const LABELS: Record<string, string> = {
  approved: "Approve",
  active: "Activate",
  matured: "Mature",
  cancelled: "Cancel",
};

export function ProductDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const safeId = id ?? "";
  const { data, isLoading, isError, error } = useGetProductQuery(safeId, { skip: !safeId });
  const [transition, transitionState] = useTransitionProductMutation();

  if (!safeId) {
    return <Text>Missing product id in URL.</Text>;
  }
  if (isLoading) {
    return <Text>Loading product…</Text>;
  }
  if (isError || !data) {
    return <Text>Failed to load product: {String((error as { status?: number })?.status ?? "unknown")}</Text>;
  }

  const allowed = data.allowed_next ?? [];

  return (
    <Stack gap="lg">
      <Heading level={1}>{data.name}</Heading>
      <Card title="Status">
        <Stack gap="sm">
          <Text data-testid="product-status">{data.status}</Text>
          <Text>code: {data.code}</Text>
          <Text>type: {data.product_type}</Text>
        </Stack>
      </Card>
      <Card title="Lifecycle actions">
        {allowed.length === 0 ? (
          <Text data-testid="terminal-state">No further actions — product is in a terminal state.</Text>
        ) : (
          <Stack gap="sm" direction="row">
            {allowed.map((next) => {
              const IconCmp = ICONS[next] ?? CheckCircle2;
              return (
                <Button
                  key={next}
                  data-testid={`transition-${next}`}
                  disabled={transitionState.isLoading}
                  onClick={() => {
                    void transition({ id: safeId, to: next });
                  }}
                >
                  <Icon icon={IconCmp} label={LABELS[next] ?? next} />
                  {LABELS[next] ?? next}
                </Button>
              );
            })}
          </Stack>
        )}
        {transitionState.isError && (
          <Text data-testid="transition-error">
            Transition failed: {String((transitionState.error as { status?: number })?.status ?? "unknown")}
          </Text>
        )}
      </Card>
    </Stack>
  );
}
```

If `Button` does not accept arbitrary children + an `Icon` (depends on the existing primitive's type signature), simplify to `<Button onClick={...}>{LABELS[next] ?? next}</Button>` and drop the `<Icon ...>` line. Inspect `web/packages/ui/src/Button.tsx` first to confirm the expected children shape — match it exactly. Do not modify the Button primitive in this slice.

If `Stack` does not support `direction="row"`, replace with two separate `Stack` blocks or fall back to inline flex (`<div style={{ display: "flex", gap: "var(--hydrax-space-sm)" }}>`). Inspect `web/packages/ui/src/Stack.tsx` to confirm.

- [ ] **Step 3: Write the test file**

Create `web/apps/issuer-portal/src/routes/ProductDetailRoute.test.tsx`:

```typescript
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { api } from "@hydrax/api-client";
import { ProductDetailRoute } from "./ProductDetailRoute";

function renderAt(path: string) {
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (g) => g().concat(api.middleware),
  });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/products/:id" element={<ProductDetailRoute />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

const PENDING_PRODUCT = {
  id: "p-1",
  tenant_id: "t-1",
  code: "C1",
  name: "Test Product",
  product_type: "credit-note",
  status: "pending",
  allowed_next: ["approved", "cancelled"],
  created_at: "2026-04-25T00:00:00.000000Z",
  updated_at: "2026-04-25T00:00:00.000000Z",
};

const TERMINAL_PRODUCT = {
  ...PENDING_PRODUCT,
  status: "matured",
  allowed_next: [],
};

describe("ProductDetailRoute", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/v1/products/p-1")) {
        return new Response(JSON.stringify(PENDING_PRODUCT), { status: 200 });
      }
      if (url.endsWith("/v1/products/p-2")) {
        return new Response(JSON.stringify(TERMINAL_PRODUCT), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders Approve and Cancel buttons for a pending product", async () => {
    renderAt("/products/p-1");
    expect(await screen.findByTestId("product-status")).toHaveTextContent("pending");
    expect(screen.getByTestId("transition-approved")).toBeInTheDocument();
    expect(screen.getByTestId("transition-cancelled")).toBeInTheDocument();
    expect(screen.queryByTestId("transition-active")).toBeNull();
  });

  it("renders no transition buttons for a terminal product", async () => {
    renderAt("/products/p-2");
    expect(await screen.findByTestId("product-status")).toHaveTextContent("matured");
    expect(screen.getByTestId("terminal-state")).toBeInTheDocument();
    expect(screen.queryByTestId("transition-approved")).toBeNull();
  });

  it("POSTs the transition when a button is clicked", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch") as unknown as ReturnType<typeof vi.spyOn>;
    renderAt("/products/p-1");
    const btn = await screen.findByTestId("transition-approved");
    btn.click();
    await waitFor(() => {
      const transitionCall = (fetchSpy.mock.calls as unknown as [Request | string, RequestInit?][])
        .find(([u]) => String(u).endsWith("/v1/products/p-1/transition"));
      expect(transitionCall).toBeDefined();
      expect(transitionCall?.[1]?.method).toBe("POST");
    });
  });

  it("renders an error message on a 404 fetch", async () => {
    renderAt("/products/missing");
    expect(await screen.findByText(/Failed to load product/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Wire the route into App.tsx**

Modify `web/apps/issuer-portal/src/App.tsx`:

Add the import:

```typescript
import { ProductDetailRoute } from "./routes/ProductDetailRoute";
```

Add the route inside the existing `<Routes>` block, adjacent to other product routes:

```typescript
<Route path="/products/:id" element={<ProductDetailRoute />} />
```

(No new sidebar entry — this route is reached by clicking through from a future product list; for this slice, it is reachable by URL.)

- [ ] **Step 5: Run the new test file**

Run: `cd web/apps/issuer-portal && pnpm exec vitest run src/routes/ProductDetailRoute.test.tsx`
Expected: 4 PASS.

If a test fails because of a UI primitive mismatch (Button children, Stack direction, Icon prop), inspect the primitive in `web/packages/ui/src/` and adjust `ProductDetailRoute.tsx` to match — do not modify the primitive in this slice.

- [ ] **Step 6: Run the full issuer-portal test suite**

Run: `cd web/apps/issuer-portal && pnpm exec vitest run`
Expected: all pre-existing tests still pass, 4 new ones pass.

- [ ] **Step 7: Typecheck and build**

Run: `cd /home/naim/.openclaw/workspace/hydrax-app && pnpm -r --if-present typecheck && pnpm -r --if-present build`
Expected: no errors.

- [ ] **Step 8: Commit C6**

```bash
git add web/apps/issuer-portal/src/App.tsx web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx web/apps/issuer-portal/src/routes/ProductDetailRoute.test.tsx
git commit -m "$(cat <<'EOF'
feat(web/issuer-portal): add /products/:id detail route with lifecycle transition buttons

Route reads allowed_next off the GET response and renders one button
per legal next state. Terminal products show a "no further actions"
message. Failed transitions surface a short error line. Tests cover
pending product, terminal product, click->POST, and 404.
EOF
)"
```

---

## Final Verification

Run all gates from the project CLAUDE.md verification block. **Local-only — no Railway redeploy in this slice (workflow-svc is gated on the toolchain unblock decision).**

- [ ] **Step 1: workflow-svc per-service gates**

```bash
cd services/workflow-svc && go vet ./... && go test ./...
```
Expected: all pass.

- [ ] **Step 2: bff per-service gates**

```bash
cd services/bff && pnpm typecheck && pnpm test -- --run
```
Expected: all pass.

- [ ] **Step 3: web monorepo gates**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app && pnpm -r --if-present typecheck && pnpm -r --if-present test -- --run && pnpm -r --if-present build
```
Expected: three green commands.

- [ ] **Step 4: log deferred follow-ups in STATE.yaml**

Append a `verification_log` entry and update `next_actions`:

```yaml
verification_log:
  - "2026-04-25 — workflow-lifecycle-http: 6 commits landed; per-svc go vet/test passes; pnpm -r typecheck/test/build green; deferred: audit emission on transition (own plan), Railway redeploy (toolchain unblock)"
next_actions:
  - "Audit emission on transition: emit audit event from workflow-svc handler on 2xx (own plan)"
  - "Workflow-svc Railway redeploy: gated on pgx 5.9.2 + alpine 1.22 toolchain decision"
```

---

## Self-Review Notes (run during plan authoring, before handoff)

- **Spec coverage:** Every requirement from the brief is mapped to a task: workflow-svc HTTP wiring (Tasks 1+2), BFF proxy (Tasks 3+4), api-client (Task 5), UI (Task 6).
- **Placeholder scan:** No "TBD" / "etc" / "similar to". Each step shows the actual code or command.
- **Type consistency:** `allowed_next?: readonly string[]` shape matches in proxy.ts, api.ts, and the Go-side JSON tag (`json:"allowed_next"`). `TransitionProductInput { to: string }` matches `transitionBody { To string \`json:"to"\` }`. The `id` path-param + body shape are consistent across proxy, BFF, and api-client.
- **Audit emission:** Explicitly deferred in the Decisions section, logged as a follow-up in the final verification step.
- **Approval-svc boundary:** Documented in the workflow-svc handler godoc and in the Decisions section.
- **Verification cadence:** Each task ends with the smallest correctness check (single test command), and the final verification block runs the project-wide gates.
- **Commit hygiene:** Six commits, each ≤4 files, each one concern. No layer-bundling.
