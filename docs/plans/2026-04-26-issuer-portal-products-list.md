# Issuer Portal — Products List Page (Tier 1 item 5)

> **For agentic workers:** Required sub-skill `superpowers:subagent-driven-development`. Steps use checkbox (`- [ ]`) syntax. Cite this plan in every commit.

**Goal:** Wire an end-to-end `/products` list page in the issuer portal so issuers can discover their products and click through to the existing `/products/:id` detail route. Production signals: a new `GET /v1/products` endpoint in workflow-svc, a BFF proxy, an api-client RTK Query, and a React route that renders rows linking to the detail page.

**Why now:** The detail route is functional (status, lifecycle transition buttons), but there is no way for an issuer to enumerate their products from the UI. STATE.yaml lists this as Tier 1 item 5 — the entry surface to the now-functional `/products/:id` detail.

**Tenant scoping (gap acknowledgement):** The auth foundation slice 1 closure landed bearer-token auth via integration-svc and the session payload includes `tenant_id` (see `WhoamiResult.tenant_id`, `mockSession.tenant_id = "ten-1"` in server.test.ts). For this slice:

- workflow-svc requires explicit `?tenant_id=` query (400 if missing). Workflow-svc trusts the BFF for tenant scoping — same posture as the existing audit-events list endpoint.
- BFF proxy reads tenant from `session.tenant_id` and forwards it to workflow-svc as `?tenant_id=`. If the session has no tenant_id (defensive — should never happen because integration-svc always returns one), BFF returns 400 `missing_tenant`.
- api-client `listProducts({ limit?, offset? })` does NOT accept `tenantId`. The BFF is the single source of tenant truth — UI never passes one. Future slice could move the query param off the wire entirely once workflow-svc reads the tenant from a header.

---

## Anti-scope (NOT in this slice)

- **Pagination UI controls.** Backend supports `?limit=&offset=` but the React route ships with NO Next/Prev buttons. Just renders up to 50 most-recent products, with a footer note ("Showing N most-recent products. Pagination coming soon.").
- **Search / filter / sort UI.** No text filter, no status filter, no column sort.
- **Row actions / bulk select.** No checkboxes, no inline transition controls. Each row is just a link.
- **Auth role gating beyond `requireSession`.** All authenticated callers can list. Role checks land in a separate slice.
- **New design primitives.** Consume existing `@hydrax/ui` only — no new components, no new hero JPEGs.
- **Tenant-scope hardening at workflow-svc** (covered above; future slice).
- **`signal_history`-style backfill / migrations.** No DB schema change.
- **Drive-by fixes.** If something else looks broken, log it here under "Out of scope" — do NOT fix.

### Out of scope (observations / follow-ups)

- (none yet — append here as we encounter them)

---

## File Structure

**Created:**
```
docs/plans/2026-04-26-issuer-portal-products-list.md   (this file)

services/workflow-svc/internal/handlers/products_list_test.go
                                       # ~150 LOC — 5+ httptest cases for List handler

web/apps/issuer-portal/src/routes/ProductsListRoute.tsx
                                       # ~120 LOC — list view with loading, empty, error states
web/apps/issuer-portal/src/routes/ProductsListRoute.test.tsx
                                       # ~150 LOC — 4 vitest cases (rows, empty, loading, link href)
```

**Modified:**
```
services/workflow-svc/internal/products/repo.go
   # Extend querier interface (QueryContext) + add List method (~40 LOC)
services/workflow-svc/internal/products/repo_test.go
   # Add 2 List integration tests against test Postgres (~60 LOC)
services/workflow-svc/internal/handlers/products.go
   # Add List handler mirroring Get's shape (~50 LOC)
services/workflow-svc/cmd/server/main.go
   # Register `GET /v1/products` route BEFORE `GET /v1/products/{id}`

services/bff/src/products/proxy.ts
   # Add ListProductsResponse + listProducts function mirroring fetchProduct
services/bff/src/products/proxy.test.ts
   # 4 cases: success, upstream 5xx, network error, malformed body
services/bff/src/server.ts
   # Add bare GET /v1/products handler BEFORE the prefix-startsWith /v1/products/ branch
services/bff/src/server.test.ts
   # 1 case: GET /v1/products → 200 with payload, ?tenant_id forwarded

web/packages/api-client/src/api.ts
   # Add ListProductsArgs + ListProductsResponse types and listProducts query
   # Add useListProductsQuery export at the bottom
web/packages/api-client/src/index.ts
   # Re-export useListProductsQuery + ListProductsArgs + ListProductsResponse from barrel
   # (per past mistake 416e753 — barrel re-export is mandatory)

web/apps/issuer-portal/src/App.tsx
   # Add `<Route path="/products" element={<ProductsListRoute />} />` BEFORE the
   # `/products/:id` route
```

**Untouched (do not modify):**
- `STATE.yaml`, `CLAUDE.md` (main session updates)
- `web/apps/issuer-portal/src/components/IssuerSidebar.tsx` (already has a `/products` nav entry pointing to this route — verified in CLAUDE.md context, no change needed)
- The other 4 portals
- `web/packages/ui`, `web/packages/tenant-theme`
- Hero JPEGs in `web/packages/ui/src/assets/`
- `services/workflow-svc/cmd/server/main.go` beyond adding a single route registration
- Any handler other than the new List in workflow-svc
- `go.mod` / `go.work` / `package.json` deps

---

## Commit Sequence (5 commits, each ≤ 15 files, conventional `feat(scope): outcome`)

### Commit 1 — `docs(plan): list products list-page plan`
- Files: `docs/plans/2026-04-26-issuer-portal-products-list.md` (this file)
- Verification: file exists, plan reads cleanly.

### Commit 2 — `feat(workflow-svc): list products by tenant` — **RECOVERED (landed 2026-04-26 in fcf464a)**

> **Status (2026-04-26, post-recovery):** Originally deferred when the implementer hit a concurrent-session collision on `services/workflow-svc/internal/{handlers,products}/` (parallel audit-emission slice was mutating the same files). The hand-written work was preserved in `stash@{0}` and recovered in the main session — landed as commit `fcf464a` (`feat(workflow-svc): GET /v1/products list endpoint with tenant scoping`) with 6 httptest cases (200-with-rows, 200-empty, 400-missing-tenant, 400-bad-limit, 405-non-GET, 200-next-offset-when-page-full). Verification: `go vet ./... && go test ./...` green for workflow-svc; pnpm -r typecheck/test/build green workspace-wide. The end-to-end UI → BFF → workflow-svc path is now wired. Stash dropped post-recovery. See STATE.yaml verification_log entry dated 2026-04-26 for the full recovery audit trail.

- Files (4):
  - `services/workflow-svc/internal/products/repo.go` (querier extended; `List` method added)
  - `services/workflow-svc/internal/products/repo_test.go` (2 List tests appended)
  - `services/workflow-svc/internal/handlers/products.go` (`List` handler added)
  - `services/workflow-svc/internal/handlers/products_list_test.go` (5 List handler tests)
  - `services/workflow-svc/cmd/server/main.go` (route registration)
- Behavior:
  - `GET /v1/products?tenant_id=&limit=&offset=`
  - 400 if `tenant_id` missing or `limit`/`offset` unparseable
  - default `limit=50`, max `limit=100`, default `offset=0`
  - 200 → `{ "products": [...], "next_offset": null | number }` — `next_offset` is `offset+len(products)` if `len == limit`, else `null` (cheap "is there probably more?" hint without a count query)
  - Order by `created_at DESC` (matches detail-route mental model: most recent first)
- Verification: `(cd services/workflow-svc && go vet ./... && GOWORK=off go build ./... && go test ./...)` green.

### Commit 3 — `feat(bff): proxy GET /v1/products`
- Files (4):
  - `services/bff/src/products/proxy.ts` (`ListProductsResponse`, `listProducts`)
  - `services/bff/src/products/proxy.test.ts` (4 cases)
  - `services/bff/src/server.ts` (route registration before `/v1/products/{id}`)
  - `services/bff/src/server.test.ts` (1 case)
- Behavior:
  - `GET /v1/products` (with optional `?tenant_id=&limit=&offset=`) is `requireSession`-protected.
  - If `tenant_id` query is missing, BFF falls back to `session.tenant_id`. If the session has no tenant, 400 with `missing_tenant`.
  - Forwards to `${workflowSvcUrl}/v1/products?tenant_id=...&limit=...&offset=...`.
  - Pass-through 200 response payload as-is.
- Verification: `pnpm -F @hydrax/bff typecheck && pnpm -F @hydrax/bff test -- --run && pnpm -F @hydrax/bff build` green.

### Commit 4 — `feat(api-client): list products query`
- Files (2):
  - `web/packages/api-client/src/api.ts` (types + endpoint + hook export)
  - `web/packages/api-client/src/index.ts` (barrel re-export)
- Behavior: `listProducts({ limit?, offset? })` → `{ products: Product[]; next_offset: number | null }`. NO `tenantId` arg — BFF reads tenant from session. Hook exported as `useListProductsQuery`.
- Verification: `pnpm -F @hydrax/api-client typecheck && pnpm -F @hydrax/api-client build` green.

### Commit 5 — `feat(web/issuer-portal): list products at /products`
- Files (3):
  - `web/apps/issuer-portal/src/routes/ProductsListRoute.tsx`
  - `web/apps/issuer-portal/src/routes/ProductsListRoute.test.tsx`
  - `web/apps/issuer-portal/src/App.tsx` (register route)
- Behavior:
  - Loading: 4 skeleton rows.
  - Empty: `EmptyState` with `Boxes` icon + CTA `Link` to `/products/new`. No image.
  - Error: `Text tone="danger" role="alert"`.
  - Loaded: each row is a `<Card>` wrapped in a `<Link to="/products/${id}">` showing code, name, product_type, status (icon mapped from status — Clock/CheckCircle2/FileX2/Archive consistent with detail route), and created_at locale string.
  - Footer: muted text "Showing N most-recent products. Pagination coming soon." when `products.length > 0`.
  - No `tenantId` passed from React — BFF derives it from the session.
- Verification: `pnpm -F @hydrax/issuer-portal typecheck && pnpm -F @hydrax/issuer-portal test -- --run && pnpm -F @hydrax/issuer-portal build` green.

---

## Failure Modes Considered

| Scenario | Backend | BFF | UI |
|---|---|---|---|
| workflow-svc 500 | Returns 500 with `{error:"internal"}` | Wraps as `ProductsUpstreamError`, returns 502 (or upstream status if 4xx) | `isError` → error card |
| Empty list | Returns 200 `{products:[],next_offset:null}` | Pass-through | `EmptyState` with CTA |
| Invalid limit | Returns 400 `{error:"bad_query"}` | Pass-through 400 | (caller bug — error card) |
| Missing tenant | Returns 400 `{error:"missing_tenant"}` | If session has tenant, never reaches this; otherwise pass-through 400 | error card |
| Network error to BFF | n/a | n/a | RTK Query `isError` → error card |
| Limit > 100 | Clamped to 100 (no error) | Pass-through | (no UI impact in this slice) |

---

## Verification Gates (mandatory before each commit)

- **Commit 2 (workflow-svc):** `(cd services/workflow-svc && go vet ./... && GOWORK=off go build ./... && go test ./...)`
- **Commit 3 (bff):** `pnpm -F @hydrax/bff typecheck && pnpm -F @hydrax/bff test -- --run && pnpm -F @hydrax/bff build`
- **Commit 4 (api-client):** `pnpm -F @hydrax/api-client typecheck && pnpm -F @hydrax/api-client build`
- **Commit 5 (web/issuer-portal):** `pnpm -F @hydrax/issuer-portal typecheck && pnpm -F @hydrax/issuer-portal test -- --run && pnpm -F @hydrax/issuer-portal build`

Workspace-wide gates (`pnpm -r typecheck/test/build`) are the main session's responsibility after this slice returns.

---

## Risks / Open Questions Resolved Inline

- **`@hydrax/ui` `EmptyState` accepts an `imageSrc` prop but we are NOT adding new hero JPEGs in this slice.** The empty state ships imageless, which the component already supports — falls back to a 48x48 icon tile.
- **Mux registration order in workflow-svc:** Go 1.22 ServeMux prefers more-specific patterns regardless of registration order, but to be defensive (and to match the existing pattern for `/v1/products` POST vs `/v1/products/{id}` GET) we register `GET /v1/products` BEFORE `GET /v1/products/{id}`. This way reading the route file top-to-bottom matches request matching.
- **BFF route order:** the existing `req.url?.startsWith("/v1/products/")` check at server.ts line ~174 only matches paths with a trailing slash, so `/v1/products` (no trailing slash) does NOT collide with it. We can register the bare GET anywhere before the existing startsWith branch — chose to put it adjacent to other `/v1/products` matches for readability.

---

## Next Actions After This Slice

1. Update `STATE.yaml` `verification_log` with build/test ids and commit shas (main session).
2. Future slice: propagate tenant claim from session through BFF → workflow-svc as a header (drop the `?tenant_id=` query arg from the API).
3. Future slice: add pagination UI controls, search, sort.
