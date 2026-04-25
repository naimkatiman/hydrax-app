# Audit Emission on Product Transition — Implementation Plan

**Date:** 2026-04-26
**Slug:** audit-emission-on-transition
**Status:** ready to execute

## Goal

Emit an `audit_events` row to `audit-svc` whenever `services/workflow-svc`'s `Transition` handler completes a successful product lifecycle transition. Every successful product status change must leave a durable record in the audit log; today the handler updates `products.status` but writes nothing to `audit_events`. This is the deferred follow-up flagged at the close of the workflow-lifecycle-http slice (STATE.yaml `next_actions`).

## Architecture

- workflow-svc owns the trigger; audit-svc owns the storage. They communicate strictly over HTTP, mirroring the existing `services/workflow-svc/internal/railsclient` pattern that already calls `services/hydrax-adapter` over the network.
- Emission is **inline best-effort**: the audit POST runs on the 2xx happy path with a derived 2-second timeout; any failure is logged via `log.Printf` and the handler still returns 200 to its caller. The `audit_events` table is append-only and replay-safe; durability work is a future slice.
- Handler accepts a small `Emitter` interface; the real implementation lives in `internal/auditclient`. Handler tests inject a fake recorder. The auditclient package has its own httptest tests. This separation matches how railsclient is tested today.

## Required reading already absorbed

- `services/workflow-svc/internal/handlers/products.go` — `Transition` at lines 173-229; 2xx exit at 225-227.
- `services/workflow-svc/internal/railsclient/client.go` + `client_test.go` — the file shape, `ErrUpstream`/`ErrRejected` sentinel pattern, httptest harness style I will mirror.
- `services/audit-svc/internal/audit/audit.go` — `EventInput { TenantID, ActorUserID *string, Action, ResourceType, ResourceID, Payload json.RawMessage }`.
- `services/audit-svc/internal/handlers/events.go` — `appendBody` JSON shape (`tenant_id`, `actor_user_id?`, `action`, `resource_type`, `resource_id`, `payload?`); endpoint `POST /v1/audit/events`; happy-path returns 201.
- `services/workflow-svc/cmd/server/main.go` — `HYDRAX_ADAPTER_URL` reading + `railsclient.New` wiring at lines 28-35.
- `services/workflow-svc/internal/products/repo.go` — `current.TenantID` is the field to read for the audit event tenant.
- `docs/env.md` — registry style ("Consumed by …" pointer per env var).
- `docs/plans/2026-04-25-workflow-lifecycle-http.md` — confirms transition endpoint already shipped end-to-end; this plan emits inside its 2xx path.

## Constants for the emission

| Field | Value | Rationale |
|---|---|---|
| TenantID | `current.TenantID` | Tenant scope of the product being transitioned |
| ActorUserID | `nil` | Workflow-svc has no auth context yet — auth foundation slice 2 follow-up |
| Action | `"product.transitioned"` | Stable verb-resource-noun string |
| ResourceType | `"product"` | Matches `Transition`'s resource scope |
| ResourceID | product id (path param) | Same id mutated |
| Payload | `{"from": "...", "to": "..."}` JSON | Lifecycle pair — minimum useful diff |

## Scope

### In scope (this plan)

1. New `services/workflow-svc/internal/auditclient` package — `Client` type, `New(baseURL, timeout)` constructor, `EmitProductTransitioned(ctx, tenantID, productID, from, to string) error` method, `ErrUpstream`/`ErrRejected` sentinels.
2. httptest tests for the auditclient (happy path, 4xx rejection, 5xx upstream, transport timeout) modeled on `railsclient/client_test.go`.
3. Handler factory signature change: `Transition(repo *products.Products, emitter Emitter) http.HandlerFunc` where `Emitter` is a tiny interface (`EmitProductTransitioned(ctx, tenantID, productID, from, to string) error`).
4. Emission call inside the 2xx branch of `Transition`, using `context.WithTimeout(context.Background(), 2*time.Second)` (NOT `r.Context()` — that is canceled when the response writer closes).
5. Failure logging: `log.Printf("workflow-svc: audit emission failed for product=%s transition=%s→%s: %v", productID, from, to, err)`. The HTTP 200 response is still sent to the original caller.
6. Updated handler tests using a fake `recordingEmitter` that buffers `EmitProductTransitioned` calls.
7. `cmd/server/main.go` reads `AUDIT_SVC_URL`, constructs `auditclient.New(auditURL, 2*time.Second)`, passes into `handlers.Transition(repo, audit)`.
8. `docs/env.md` — add `AUDIT_SVC_URL` row to workflow-svc consumed env vars.

### Out of scope (deferred)

- Retry loop, queue, durable outbox — single best-effort POST is the v1 contract.
- ActorUserID propagation — auth context lives in BFF + integration-svc, not yet propagated to workflow-svc. Will be picked up by auth-foundation slice 2.
- BFF/api-client/UI changes — audit-svc is already proxied through bff for ops-console; no new client surface needed for this emission.
- Touching `services/audit-svc/*` — the POST handler already exists and is the contract this plan consumes.
- Auditing `Create` or `Get` handlers — those handlers do not transition state and are not in the brief.
- Auditing subscription transitions — separate resource, separate plan.
- Pre-record filter / dedup on audit events — append-only with replay safety is the design.

### Anti-scope discoveries (to be logged here if they happen)

If any drive-by improvement opportunity surfaces during execution (e.g. a small bug, a stale comment), it gets noted here as a follow-up rather than fixed in this slice.

- _none yet_

## File list with rough LOC estimate

| File | Action | Rough LOC |
|---|---|---|
| `services/workflow-svc/internal/auditclient/client.go` | new | ~95 |
| `services/workflow-svc/internal/auditclient/client_test.go` | new | ~110 |
| `services/workflow-svc/internal/handlers/products.go` | modify (Transition signature + emission block) | +30 / -1 |
| `services/workflow-svc/internal/handlers/products_test.go` | modify (inject fake emitter, add 1 emission-fired test) | +50 / -10 |
| `services/workflow-svc/cmd/server/main.go` | modify (read AUDIT_SVC_URL, construct client, pass to handler) | +12 / -1 |
| `docs/env.md` | modify (add AUDIT_SVC_URL workflow-svc consumer entry) | +2 |
| `docs/plans/2026-04-26-audit-emission-on-transition.md` | new (this file) | ~180 |

Total ≈ 480 LOC across 7 files spanning 5 commits, all under the 15-file commit cap and within the >150 LOC threshold that mandates a plan doc (which this is).

## Commit sequence (one concern per commit)

| # | Commit | Files | Title |
|---|---|---|---|
| 1 | plan doc only | 1 | `docs(workflow-svc): plan audit emission on product transition` |
| 2 | auditclient package | 2 | `feat(workflow-svc): add internal/auditclient HTTP client for audit-svc` |
| 3 | wire emission into Transition handler | 2 | `feat(workflow-svc): emit audit event on successful product transition` |
| 4 | wire AUDIT_SVC_URL in main.go | 1 | `feat(workflow-svc): wire AUDIT_SVC_URL and pass auditclient into handler` |
| 5 | env doc | 1 | `docs(env): record AUDIT_SVC_URL consumed by workflow-svc` |

Conventional commits, observable-outcome titles, no emoji. Each commit cites this plan in its body.

## Failure modes (what happens, why we accept it)

- **audit-svc completely down** — `c.http.Do(req)` returns transport error; auditclient returns `fmt.Errorf("%w: %v", ErrUpstream, err)`; handler logs and still returns 200 to the original caller. Acceptable: the transition itself succeeded; emission is best-effort.
- **audit-svc returns 5xx** — auditclient returns `ErrUpstream`; handler logs, returns 200. Same rationale.
- **audit-svc returns 4xx (e.g. 400 missing fields)** — auditclient returns `ErrRejected`; handler logs, returns 200. The 4xx case ought to be impossible (we control the JSON shape) but we still treat it as best-effort to avoid blocking real users on a contract drift between workflow-svc and audit-svc.
- **2-second timeout exceeded** — derived context cancels; `c.http.Do` returns transport error; same path as audit-svc down.
- **Caller cancels the request mid-transition** — `r.Context()` is canceled, but our derived context comes from `context.Background()` so the audit POST still completes within its 2-second budget. The 200 response that the handler tried to write may or may not reach the (now-disconnected) caller; we don't care, because the DB is already updated and the audit row is what matters. **Note:** the original 200 write happens BEFORE the audit emission in this design (the response is flushed first via `WriteHeader(200) + json.Encode(...)`), then the emit runs synchronously, then the handler returns. If `r.Context()` was canceled, `json.Encode` will get an error which we already ignore today (`_ = json.NewEncoder(w).Encode(...)`); the audit emission still runs.
  - Wait — actually if we emit AFTER the response is flushed, the handler hasn't returned yet but the bytes are gone. That's fine. The emit completes within the 2-second budget on a fresh `context.Background()`. **This is the chosen ordering.**

## Verification plan

Per CLAUDE.md verification gates, Go services run per-service due to go.work:

- After Commit 2 (auditclient package): `cd services/workflow-svc && go vet ./internal/auditclient/... && go test ./internal/auditclient/...` — must be green.
- After Commit 3 (handler emission): `cd services/workflow-svc && go vet ./... && go test ./internal/handlers/...` — must be green; existing 7 transition-related tests still pass; one new test asserts the emitter was invoked exactly once with the expected `product.transitioned`/`product`/id/from/to/tenantID/nil-actor.
- After Commit 4 (main.go wiring): `cd services/workflow-svc && go vet ./... && go build ./...` — must be green. (`GOWORK=off go build ./...` is a documented pre-existing toolchain divergence per memory `feedback-go-docker-vs-workspace.md`; not a regression caused by this slice. Skip that gate.)
- After Commit 5 (docs/env.md): no Go check needed; visual diff confirms format matches existing `Consumed by` style.

`go test ./internal/handlers/...` requires `DATABASE_URL` per the existing pattern in `products_test.go`; if not set we will fall back to `go test ./internal/auditclient/... ./internal/lifecycle/...` for the smoke and document the partial coverage. The handler test that injects the fake emitter doesn't itself need DB if scoped to a non-DB-touching path — but Transition does GetByID and UpdateStatus, so we keep the existing tx-rollback pattern and depend on DATABASE_URL.

Audit-svc package itself is not touched; no audit-svc verification needed.

## Past-mistake guardrails (carry-forward from CLAUDE.md)

1. **Path-scoped git add doesn't unstage unrelated entries.** Before every commit run `git diff --cached --name-only` and reconcile vs the in-scope file list above. If anything outside the list shows up, `git restore --staged <path>`.
2. **Don't `git add -A` or `git commit -a`.** Stage explicitly.
3. **Per-service go test, not workspace-wide.** `cd services/workflow-svc &&` prefix everywhere.
4. **No `go mod tidy` in this slice.** It bumps go.mod's `go 1.22` line to `go 1.25.0` because of `pgx v5.9.2` minimums (logged Past Mistake `feedback-go-docker-vs-workspace.md`). The auditclient is stdlib-only — net/http, encoding/json, context, errors, fmt, bytes, time — so no new deps land.
5. **No emoji in code, commits, logs.**
6. **One concern per commit.** Five commits as listed above. The 5th file `docs/env.md` is not bundled with the wiring change because env-var registry is documentation, not code.

## Self-review checks before handoff

- [x] Spec coverage — every brief constraint mapped to a step.
- [x] No placeholders (TBD/etc/similar). Each commit lists actual files and rough LOC.
- [x] Type consistency — `Emitter.EmitProductTransitioned(ctx, tenantID, productID, from, to string) error` matches `auditclient.Client.EmitProductTransitioned` signature.
- [x] Failure modes enumerated and accepted with rationale.
- [x] Verification cadence per commit.
- [x] Anti-scope explicit (8 items deferred, 1 placeholder for runtime discoveries).
- [x] Commit hygiene — 5 commits, all ≤2 files except plan-doc commit (1 file).
- [x] Plan doc cited in every commit body.
