# Subscriptions Vertical + Products Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. One commit per task.

- **Date:** 2026-04-25
- **Status:** drafted, ready to dispatch
- **Skill lineage:** `/proceed-with-claude-recommendation` → `superpowers:writing-plans` → `superpowers:subagent-driven-development`
- **Prerequisites met:** Postgres migration `0001_initial.sql` already includes `subscriptions` table; workflow-svc has `database/sql` wired and `products` repo as the reference pattern; bff has `/v1/products` proxy as the reference pattern; web/issuer-portal renders `<HomeRoute />` and `react-router-dom` is already in scope.
- **Parent docs:** [docs/plans/2026-04-25-persistence-foundation.md](2026-04-25-persistence-foundation.md), [docs/prd.md](../prd.md) §8

---

**Goal:**
1. **Phase A — Subscriptions vertical slice.** Stand up a subscription record end-to-end: workflow-svc gets a `subscriptions` repo + handlers (`POST /v1/subscriptions`, `GET /v1/subscriptions/{id}`); bff proxies both routes with the same hardening as `/v1/products`. Mirrors the products vertical 1:1.
2. **Phase B — Issuer-portal `/products/new` form.** Add a route at `/products/new` rendering a 4-field form (tenant_id, code, name, product_type) that POSTs through the existing bff `/v1/products` endpoint and routes to the product detail page on success. RTK Query mutation hook in `@hydrax/api-client`.

**Architecture:** No new services. Extends two existing ones (workflow-svc, bff) for Phase A, one for Phase B (issuer-portal + api-client). All subscriptions tests run against a real Postgres started via `db/postgres/docker-compose.test.yml` (txn-isolated, same pattern as products).

**Tech Stack:** Go 1.22 + pgx v5 + database/sql for Phase A backend; Hono-free Node http server (mirroring existing bff pattern) for Phase A bff; React 18 + RTK Query + react-router-dom v6 + vitest + @testing-library/react for Phase B.

**Anti-scope (do NOT do in this plan):**
- Approvals or audit endpoints (each is its own future plan — separate domain, separate service)
- Workflow lifecycle state machine (Subscription state transitions: `pending → approved → allocated → settled` are NOT modeled in this slice; raw CRUD only)
- Authentication / tenant resolution from session (tenant_id is still passed in request body for now)
- HydraX rails dispatch from any new endpoint
- Distributor / investor / ops portal pages
- Real notify-svc dispatching on subscription creation
- Audit append on subscription/product creation (separate plan)
- Form validation library (Zod, react-hook-form) — plain `useState` + manual validation matches the lightness of existing primitives

---

## File Structure (after both phases)

**Phase A — Created:**
- `services/workflow-svc/internal/subscriptions/subscription.go` — Subscription type + Input
- `services/workflow-svc/internal/subscriptions/repo.go` — Insert + GetByID, mirrors products/repo.go
- `services/workflow-svc/internal/subscriptions/repo_test.go` — txn-isolated repo tests
- `services/workflow-svc/internal/handlers/subscriptions.go` — Create + Get HTTP handlers
- `services/workflow-svc/internal/handlers/subscriptions_test.go` — handler tests with mocked repo (or txn-rollback)
- `services/bff/src/subscriptions/proxy.ts` — fetchSubscription + createSubscription, mirrors products/proxy.ts
- `services/bff/src/subscriptions/proxy.test.ts`

**Phase A — Modified:**
- `services/workflow-svc/cmd/server/main.go` — wire subscriptions repo + register routes
- `services/bff/src/server.ts` — `/v1/subscriptions` POST and `/v1/subscriptions/{id}` GET routes
- `services/bff/src/server.test.ts` — append subscription route tests

**Phase B — Created:**
- `web/apps/issuer-portal/src/routes/ProductNewRoute.tsx` — form page
- `web/apps/issuer-portal/src/routes/ProductNewRoute.test.tsx` — RTL tests
- `web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx` — minimal detail page (lands at `/products/:id`)

**Phase B — Modified:**
- `web/packages/api-client/src/api.ts` — add `useCreateProductMutation` + `useGetProductQuery`
- `web/packages/api-client/src/api.test.ts` — append mutation/query tests
- `web/apps/issuer-portal/src/App.tsx` — add `<Route path="/products/new" />` and `<Route path="/products/:id" />`
- `web/apps/issuer-portal/src/components/IssuerSidebar.tsx` — add "New product" nav item linking to `/products/new`

**Total: 7 created + 5 modified = 12 files. Phase A is 9 files (under 15-file cap), Phase B is 7 files (under cap).**

---

## Phase A — Subscriptions Vertical Slice

### Task A.1: Subscription type + Input

**Files:** `services/workflow-svc/internal/subscriptions/subscription.go`

- [ ] **Step 1: Write the type file**

```go
package subscriptions

import "time"

// Subscription mirrors a subscriptions row.
type Subscription struct {
	ID              string
	ProductID       string
	InvestorUserID  string
	AmountMinor     int64
	Currency        string
	Status          string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// SubscriptionInput is the create payload the handler accepts.
type SubscriptionInput struct {
	ProductID      string
	InvestorUserID string
	AmountMinor    int64
	Currency       string
}
```

- [ ] **Step 2: Verify**
```
cd services/workflow-svc && go vet ./internal/subscriptions/...
```
Expected: exit 0.

- [ ] **Step 3: Commit**
```
feat(workflow-svc): add subscriptions Subscription + Input types
```

---

### Task A.2: Subscriptions repo (Insert + GetByID + IsNotFound)

**Files:** `services/workflow-svc/internal/subscriptions/repo.go`, `services/workflow-svc/internal/subscriptions/repo_test.go`

Mirror `services/workflow-svc/internal/products/repo.go` 1:1. Same querier interface, same errNotFound + IsNotFound pattern, same INSERT … RETURNING shape.

- [ ] **Step 1: RED — write a failing repo test**

```go
package subscriptions

import (
	"context"
	"testing"

	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/db"
	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/products"
)

func TestInsertAndGetByID(t *testing.T) {
	t.Parallel()
	tx := db.OpenTestTx(t)
	// seed a tenant + user + product for the FK chain
	tenantID := db.SeedTenant(t, tx, "tenant-A")
	userID := db.SeedUser(t, tx, tenantID, "investor@example.com", "viewer")
	productID := db.SeedProduct(t, tx, tenantID, "P-001")
	_ = products.New(tx) // ensure products package compiles together

	repo := New(tx)
	got, err := repo.Insert(context.Background(), SubscriptionInput{
		ProductID:      productID,
		InvestorUserID: userID,
		AmountMinor:    100_000_00,
		Currency:       "USD",
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}
	if got.Status != "pending" {
		t.Fatalf("status = %q, want pending", got.Status)
	}

	round, err := repo.GetByID(context.Background(), got.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if round.AmountMinor != 100_000_00 {
		t.Fatalf("AmountMinor = %d", round.AmountMinor)
	}
}
```

If `db.SeedTenant`, `db.SeedUser`, `db.SeedProduct` don't exist yet, add them as test helpers in `services/workflow-svc/internal/db/db.go` (they already use `*sql.Tx` per the products tests; reuse the same shape). If they do exist, use them.

- [ ] **Step 2: Run — expect FAIL (no repo yet)**

```
cd services/workflow-svc && go test ./internal/subscriptions/...
```
Expected: compile or runtime FAIL (`undefined: New` or similar).

- [ ] **Step 3: GREEN — write the repo**

```go
package subscriptions

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

var errNotFound = errors.New("subscriptions: not found")

func IsNotFound(err error) bool {
	return errors.Is(err, errNotFound)
}

type querier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

type Subscriptions struct {
	tx querier
}

func New(tx querier) *Subscriptions {
	return &Subscriptions{tx: tx}
}

func (s *Subscriptions) Insert(ctx context.Context, in SubscriptionInput) (*Subscription, error) {
	const q = `
		INSERT INTO subscriptions (product_id, investor_user_id, amount_minor, currency)
		VALUES ($1, $2, $3, $4)
		RETURNING id, product_id, investor_user_id, amount_minor, currency, status, created_at, updated_at
	`
	var got Subscription
	err := s.tx.QueryRowContext(ctx, q, in.ProductID, in.InvestorUserID, in.AmountMinor, in.Currency).Scan(
		&got.ID, &got.ProductID, &got.InvestorUserID, &got.AmountMinor,
		&got.Currency, &got.Status, &got.CreatedAt, &got.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("subscriptions.Insert: %w", err)
	}
	return &got, nil
}

func (s *Subscriptions) GetByID(ctx context.Context, id string) (*Subscription, error) {
	const q = `
		SELECT id, product_id, investor_user_id, amount_minor, currency, status, created_at, updated_at
		FROM subscriptions WHERE id = $1
	`
	var got Subscription
	err := s.tx.QueryRowContext(ctx, q, id).Scan(
		&got.ID, &got.ProductID, &got.InvestorUserID, &got.AmountMinor,
		&got.Currency, &got.Status, &got.CreatedAt, &got.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("subscriptions.GetByID(%q): %w", id, errNotFound)
	}
	if err != nil {
		return nil, fmt.Errorf("subscriptions.GetByID(%q): %w", id, err)
	}
	return &got, nil
}
```

- [ ] **Step 4: Run — expect PASS**

```
cd services/workflow-svc && go test ./internal/subscriptions/...
```
Expected: PASS.

- [ ] **Step 5: Commit**
```
feat(workflow-svc): add subscriptions repository with txn-isolated tests
```

---

### Task A.3: HTTP handlers (Create + Get) with body cap, validation, 404, 405, 500

**Files:** `services/workflow-svc/internal/handlers/subscriptions.go`, `services/workflow-svc/internal/handlers/subscriptions_test.go`

Mirror `services/workflow-svc/internal/handlers/products.go` 1:1. Same `errorJSON` helper (it's already in the package; reuse). Same `MaxBytesReader(64KB)`. Same field validation. Use `IsNotFound` from the subscriptions package.

- [ ] **Step 1: RED — failing handler test (POST happy path)**

```go
func TestCreateSubscriptionHappy(t *testing.T) {
	t.Parallel()
	tx := db.OpenTestTx(t)
	tenantID := db.SeedTenant(t, tx, "tenant-A")
	userID := db.SeedUser(t, tx, tenantID, "investor@example.com", "viewer")
	productID := db.SeedProduct(t, tx, tenantID, "P-001")

	repo := subscriptions.New(tx)
	h := CreateSubscription(repo)

	body := bytes.NewBufferString(fmt.Sprintf(
		`{"product_id":%q,"investor_user_id":%q,"amount_minor":50000,"currency":"USD"}`,
		productID, userID,
	))
	req := httptest.NewRequest(http.MethodPost, "/v1/subscriptions", body)
	rr := httptest.NewRecorder()
	h(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rr.Code, rr.Body.String())
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: GREEN — write the handlers**

```go
package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/subscriptions"
)

type createSubscriptionBody struct {
	ProductID      string `json:"product_id"`
	InvestorUserID string `json:"investor_user_id"`
	AmountMinor    int64  `json:"amount_minor"`
	Currency       string `json:"currency"`
}

type subscriptionResponse struct {
	ID             string `json:"id"`
	ProductID      string `json:"product_id"`
	InvestorUserID string `json:"investor_user_id"`
	AmountMinor    int64  `json:"amount_minor"`
	Currency       string `json:"currency"`
	Status         string `json:"status"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

func toSubscriptionResponse(s *subscriptions.Subscription) subscriptionResponse {
	return subscriptionResponse{
		ID:             s.ID,
		ProductID:      s.ProductID,
		InvestorUserID: s.InvestorUserID,
		AmountMinor:    s.AmountMinor,
		Currency:       s.Currency,
		Status:         s.Status,
		CreatedAt:      s.CreatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
		UpdatedAt:      s.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
	}
}

func CreateSubscription(repo *subscriptions.Subscriptions) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		var body createSubscriptionBody
		r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			errorJSON(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		if body.ProductID == "" || body.InvestorUserID == "" || body.Currency == "" || body.AmountMinor < 0 {
			errorJSON(w, http.StatusBadRequest, "missing_fields",
				"product_id, investor_user_id, currency required and amount_minor >= 0")
			return
		}
		got, err := repo.Insert(r.Context(), subscriptions.SubscriptionInput{
			ProductID:      body.ProductID,
			InvestorUserID: body.InvestorUserID,
			AmountMinor:    body.AmountMinor,
			Currency:       body.Currency,
		})
		if err != nil {
			log.Printf("workflow-svc: subscriptions.Create: %v", err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(toSubscriptionResponse(got))
	}
}

func GetSubscription(repo *subscriptions.Subscriptions) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "GET only")
			return
		}
		id := r.PathValue("id")
		if id == "" {
			errorJSON(w, http.StatusBadRequest, "missing_id", "id path param required")
			return
		}
		got, err := repo.GetByID(r.Context(), id)
		if err != nil {
			if subscriptions.IsNotFound(err) {
				errorJSON(w, http.StatusNotFound, "not_found", "no subscription with that id")
				return
			}
			log.Printf("workflow-svc: subscriptions.Get(%q): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(toSubscriptionResponse(got))
	}
}
```

- [ ] **Step 4: Add 405, missing-id, not-found, body-cap tests**

Mirror tests in `products_test.go`. At minimum: 200/201 happy, 400 missing field, 400 bad_json, 404 not found, 405 wrong method, 413 body cap (write 65KB and assert MaxBytesReader fires).

- [ ] **Step 5: Run all subscription tests**

```
cd services/workflow-svc && go test ./internal/subscriptions/... ./internal/handlers/...
```
Expected: PASS.

- [ ] **Step 6: Commit**
```
feat(workflow-svc): add POST/GET /v1/subscriptions handlers with full validation
```

---

### Task A.4: Wire subscription routes into cmd/server

**Files:** `services/workflow-svc/cmd/server/main.go`

- [ ] **Step 1: Register the routes**

In the route mux that already wires `/v1/products` and `/v1/products/{id}`, add:

```go
subRepo := subscriptions.New(database)
mux.HandleFunc("POST /v1/subscriptions", handlers.CreateSubscription(subRepo))
mux.HandleFunc("GET /v1/subscriptions/{id}", handlers.GetSubscription(subRepo))
```

(Use the same conditional wiring as products: skip if `DATABASE_URL` is unset and log the same message.)

- [ ] **Step 2: Verify compile + run**

```
cd services/workflow-svc && go vet ./... && go build ./cmd/server
```
Expected: exit 0.

- [ ] **Step 3: Commit**
```
feat(workflow-svc): mount /v1/subscriptions routes on cmd/server
```

---

### Task A.5: BFF subscription proxy module + tests

**Files:** `services/bff/src/subscriptions/proxy.ts`, `services/bff/src/subscriptions/proxy.test.ts`

Mirror `services/bff/src/products/proxy.ts` exactly: same `withTimeout` helper (re-import from products if exported, else inline-copy with the same shape per existing convention), same `SubscriptionsUpstreamError extends Error` with `httpStatus`, same `fetchImpl`/`timeoutMs` options.

- [ ] **Step 1: Write proxy.ts**

```ts
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

export interface CreateSubscriptionInput {
  readonly product_id: string;
  readonly investor_user_id: string;
  readonly amount_minor: number;
  readonly currency: string;
}

export interface ProxyOptions {
  readonly workflowSvcUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export class SubscriptionsUpstreamError extends Error {
  readonly httpStatus?: number;
  constructor(message: string, httpStatus?: number) {
    super(message);
    this.name = "SubscriptionsUpstreamError";
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

export async function fetchSubscription(id: string, opts: Readonly<ProxyOptions>): Promise<Subscription> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.workflowSvcUrl}/v1/subscriptions/${encodeURIComponent(id)}`, { signal });
    } catch (err: unknown) {
      throw new SubscriptionsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new SubscriptionsUpstreamError(`workflow-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Subscription;
  });
}

export async function createSubscription(
  input: Readonly<CreateSubscriptionInput>,
  opts: Readonly<ProxyOptions>,
): Promise<Subscription> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 1500;
  return withTimeout(timeoutMs, async (signal) => {
    let res: Response;
    try {
      res = await fetchImpl(`${opts.workflowSvcUrl}/v1/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal,
      });
    } catch (err: unknown) {
      throw new SubscriptionsUpstreamError(err instanceof Error ? err.message : "transport error");
    }
    if (!res.ok) {
      throw new SubscriptionsUpstreamError(`workflow-svc returned ${res.status}`, res.status);
    }
    return (await res.json()) as Subscription;
  });
}
```

- [ ] **Step 2: Write proxy.test.ts**

Mirror `services/bff/src/products/proxy.test.ts`:
- happy POST returns Subscription
- non-ok response throws SubscriptionsUpstreamError with httpStatus
- transport error throws SubscriptionsUpstreamError without httpStatus
- timeout aborts (mock fetch that never resolves)

- [ ] **Step 3: Verify**

```
pnpm -F bff typecheck && pnpm -F bff test
```
Expected: green.

- [ ] **Step 4: Commit**
```
feat(bff): add subscriptions proxy module mirroring products pattern
```

---

### Task A.6: BFF server.ts subscription routes + tests

**Files:** `services/bff/src/server.ts`, `services/bff/src/server.test.ts`

- [ ] **Step 1: Add `/v1/subscriptions` POST handler block**

Insert after the `/v1/products` POST block in `server.ts`. Same shape: read body up to 64KB, parse JSON, call `createSubscription`, map errors:
- `SubscriptionsUpstreamError` with `httpStatus` 4xx/5xx → pass through (400/404/etc)
- `SubscriptionsUpstreamError` without httpStatus → 502 with `{error:"subscriptions_upstream"}`
- other → 500

- [ ] **Step 2: Add `/v1/subscriptions/{id}` GET handler block**

Insert after the `/v1/products/{id}` GET block. Decode `id`, call `fetchSubscription`, same error mapping.

- [ ] **Step 3: Append server.test.ts cases**

At minimum:
- POST happy path with mocked workflow-svc httptest server
- GET 200 with mocked upstream
- GET 404 when upstream returns 404
- POST 502 when upstream throws transport error
- 405 on PUT to either route

- [ ] **Step 4: Verify**

```
pnpm -F bff typecheck && pnpm -F bff test && pnpm -F bff build
```
Expected: green.

- [ ] **Step 5: Commit**
```
feat(bff): mount /v1/subscriptions POST and GET routes
```

---

## Phase B — Issuer-portal Products Form

### Task B.1: api-client mutation + query hooks

**Files:** `web/packages/api-client/src/api.ts`, `web/packages/api-client/src/api.test.ts`

- [ ] **Step 1: Add Product types + endpoints**

In `api.ts`, on the existing `hydraxApi` slice, add:

```ts
export interface Product {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  product_type: string;
  status: string;
  rails_product_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  tenant_id: string;
  code: string;
  name: string;
  product_type: string;
}

// Inside endpoints: builder => ({ ... existing ..., createProduct, getProduct })
createProduct: builder.mutation<Product, CreateProductInput>({
  query: (body) => ({ url: "/v1/products", method: "POST", body }),
}),
getProduct: builder.query<Product, string>({
  query: (id) => ({ url: `/v1/products/${encodeURIComponent(id)}` }),
}),
```

Export the auto-generated hooks: `useCreateProductMutation`, `useGetProductQuery`.

- [ ] **Step 2: Write api.test.ts cases**

Use the existing fetch-mock setup. Test:
- `useCreateProductMutation` POSTs to `/v1/products` with body
- `useGetProductQuery(id)` GETs `/v1/products/<id>`

- [ ] **Step 3: Verify**

```
pnpm -F @hydrax/api-client typecheck && pnpm -F @hydrax/api-client test
```
Expected: green.

- [ ] **Step 4: Commit**
```
feat(web/api-client): add createProduct mutation + getProduct query
```

---

### Task B.2: ProductNewRoute component + tests

**Files:** `web/apps/issuer-portal/src/routes/ProductNewRoute.tsx`, `web/apps/issuer-portal/src/routes/ProductNewRoute.test.tsx`

A 4-field form using `useState` + `useCreateProductMutation`. On success, `useNavigate()` to `/products/${id}`.

- [ ] **Step 1: RED — failing test that asserts the form renders + submits**

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { ProductNewRoute } from "./ProductNewRoute";

afterEach(cleanup);

function renderWith(navigate: () => void) {
  const store = configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (g) => g().concat(hydraxApi.middleware),
  });
  // ... render with MemoryRouter + a stub useNavigate hook
}

describe("ProductNewRoute", () => {
  it("submits the form and navigates to detail on success", async () => {
    // mock fetch to return { id: "abc-123", ... }
    // fill 4 fields, click submit, assert navigate called with "/products/abc-123"
  });
});
```

- [ ] **Step 2: GREEN — write ProductNewRoute.tsx**

```tsx
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateProductMutation } from "@hydrax/api-client";
import { Stack, Heading, Text, Button } from "@hydrax/ui";

export function ProductNewRoute() {
  const navigate = useNavigate();
  const [createProduct, { isLoading, error }] = useCreateProductMutation();
  const [tenantId, setTenantId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [productType, setProductType] = useState("short_duration_credit");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await createProduct({
      tenant_id: tenantId,
      code,
      name,
      product_type: productType,
    });
    if ("data" in result && result.data) {
      navigate(`/products/${result.data.id}`);
    }
  }

  return (
    <Stack gap="lg">
      <Heading level={1}>New product</Heading>
      <Text>Create a tokenized product. Status starts as <code>pending</code> until ops approves.</Text>
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <label>
            Tenant ID
            <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} required />
          </label>
          <label>
            Code
            <input value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Product type
            <select value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="short_duration_credit">Short-duration credit</option>
              <option value="mmf">Money market fund</option>
              <option value="treasury_equivalent">Treasury-equivalent</option>
              <option value="equity_linked">Equity-linked</option>
            </select>
          </label>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Creating…" : "Create product"}
          </Button>
          {error ? <Text variant="error">Failed to create product. Try again.</Text> : null}
        </Stack>
      </form>
    </Stack>
  );
}
```

If the existing `<Button>` from `@hydrax/ui` doesn't accept `type="submit"`, fall back to a plain `<button type="submit" className="…">` styled minimally — do NOT extend the UI primitive in this plan (anti-scope: scope creep into the design system).

- [ ] **Step 3: Run tests**

```
pnpm -F issuer-portal test
```
Expected: green.

- [ ] **Step 4: Commit**
```
feat(issuer-portal): add /products/new form with create-product mutation
```

---

### Task B.3: ProductDetailRoute (minimal) + App.tsx routing + sidebar nav

**Files:** `web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx`, `web/apps/issuer-portal/src/App.tsx`, `web/apps/issuer-portal/src/components/IssuerSidebar.tsx`

- [ ] **Step 1: ProductDetailRoute.tsx**

```tsx
import { useParams } from "react-router-dom";
import { useGetProductQuery } from "@hydrax/api-client";
import { Stack, Heading, Text, Skeleton } from "@hydrax/ui";

export function ProductDetailRoute() {
  const { id = "" } = useParams<{ id: string }>();
  const { data, isLoading, error } = useGetProductQuery(id, { skip: !id });

  if (isLoading) return <Skeleton />;
  if (error || !data) return <Text variant="error">Could not load product.</Text>;

  return (
    <Stack gap="lg">
      <Heading level={1}>{data.name}</Heading>
      <Text>Code: {data.code}</Text>
      <Text>Type: {data.product_type}</Text>
      <Text>Status: {data.status}</Text>
      <Text>Created: {data.created_at}</Text>
    </Stack>
  );
}
```

- [ ] **Step 2: Add routes to App.tsx**

In the `<Routes>` block:
```tsx
<Route path="/" element={<HomeRoute />} />
<Route path="/products/new" element={<ProductNewRoute />} />
<Route path="/products/:id" element={<ProductDetailRoute />} />
```

- [ ] **Step 3: Add sidebar nav item**

In `IssuerSidebar.tsx`, add a `<NavItem to="/products/new">New product</NavItem>` entry. Use `react-router-dom`'s `Link` underneath since `NavItem` already honors React Router (per commit `ce325b0`).

- [ ] **Step 4: Verify**

```
pnpm -F issuer-portal typecheck && pnpm -F issuer-portal test && pnpm -F issuer-portal build
```
Expected: green.

- [ ] **Step 5: Commit**
```
feat(issuer-portal): wire ProductDetailRoute + /products/new sidebar entry
```

---

## Self-Review

**1. Spec coverage:** Goal A and Goal B both have concrete tasks with code + tests + commits. No domain decision is hidden in a "TODO".

**2. Placeholder scan:** No `TBD`, `appropriate`, `handle edge cases`, "tests for the above". Each test step has a code block or names the assertions explicitly.

**3. Type consistency:**
- `Subscription` shape identical between `subscription.go`, `proxy.ts`, `subscriptionResponse`, JSON serialization (snake_case wire, mirrors `Product`).
- `Subscriptions` repo, `subscriptions.IsNotFound`, `subscriptions.New(tx)` consistent across repo, handler, and cmd/server wiring.
- `Product` and `CreateProductInput` in api-client match the existing `Product` type on bff `proxy.ts`. Same field names, same optional `rails_product_id`.
- `useCreateProductMutation` / `useGetProductQuery` are RTK Query–standard auto-generated names — no risk of drift.

**4. Commit hygiene:**
- 9 commits, one concern each (3 backend types/repo/handler, 1 cmd wiring, 2 bff proxy/routes, 1 api-client, 2 portal route+detail+nav).
- Largest commit is the handler+test pair (~6 files including test). All under 15-file cap.

---

## Verification Gate (run before claiming the plan is done)

```
# Backend
cd services/workflow-svc && go vet ./... && go test ./...
# BFF
pnpm -F bff typecheck && pnpm -F bff test && pnpm -F bff build
# Frontend
pnpm -F @hydrax/api-client typecheck && pnpm -F @hydrax/api-client test
pnpm -F issuer-portal typecheck && pnpm -F issuer-portal test && pnpm -F issuer-portal build
```

All green. Then update `STATE.yaml` `verification_log` with one line per phase (do this in a **separate** chore commit).

---

## Execution Handoff

Dispatch via `superpowers:subagent-driven-development`:

- One fresh subagent per task above (A.1, A.2, A.3, A.4, A.5, A.6, B.1, B.2, B.3).
- Two-stage review between tasks. Reviewer checks: tests written before implementation, no drive-bys, no placeholders, commit message leads with outcome.
- A.1–A.6 must run sequentially (later tasks import earlier).
- B.1–B.3 must run sequentially.
- A.5/A.6 (bff) can run in parallel with B.1 (api-client) once A.4 lands — neither depends on the other. Reviewer should not block parallel dispatch when there's no shared file.

Stop conditions per task:
- Tests fail and the fix is non-obvious → halt, surface to user
- A drive-by edit is needed (e.g., the existing `Button` doesn't accept `type="submit"`) → log as deferred, do not silently fix; either work around inline or stop
- Body cap test in A.3 reveals existing products handler regression → log, do not touch products

Final state after plan completes:
- POST `/v1/subscriptions` and GET `/v1/subscriptions/{id}` reachable via bff
- Issuer-portal `/products/new` form posts and routes to detail page
- 9 commits on main; verification gate green
- Approvals + audit endpoints + workflow lifecycle remain explicit anti-scope; queued for next plan
