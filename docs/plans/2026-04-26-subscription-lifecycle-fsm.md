# Subscription lifecycle FSM (separate from product FSM)

**Date:** 2026-04-26
**Slug:** subscription-lifecycle-fsm
**Author:** Claude Opus 4.7 (1M context)
**Plan owner:** Naim Katiman
**Routed via:** `/proceed-with-claude-recommendation` (Phase 2 plan)

## Goal

Codify subscription lifecycle as a pure-function FSM and wire a transition endpoint, mirroring the product lifecycle pattern that landed under [docs/plans/2026-04-25-workflow-lifecycle-http.md](2026-04-25-workflow-lifecycle-http.md). Subscriptions are a distinct domain object with their own state machine — keeping it separate from `internal/lifecycle` (product FSM) avoids accidental coupling and keeps each FSM small.

## Why now

`subscriptions` table already exists in `db/postgres/migrations/0001_initial.sql` with a CHECK constraint covering five states: `('pending','approved','allocated','settled','cancelled')`. `services/workflow-svc/internal/subscriptions` already has Insert + GetByID (Tx-bound). Handlers are wired for create + get. The missing layer is transition — without it, subscriptions can be created but never advanced, which blocks any downstream slice (allocation UI, settlement workflow, distributor approvals against subscriptions).

## States and edges

States mirror the migration CHECK constraint exactly (string equality matters — handler will pass through):

```
pending     ──approve──> approved
pending     ──cancel───> cancelled
approved    ──allocate─> allocated
approved    ──cancel───> cancelled
allocated   ──settle───> settled
settled     (terminal)
cancelled   (terminal)
```

Design decisions:
- **No cancellation from `allocated` or `settled`.** Once units are allocated, reversal is a separate compensating workflow (refund/buyback), not a status flip. Keeping the FSM honest about this means the reversal slice has to surface itself rather than hide as an "undo".
- **Self-loops rejected.** A redundant transition is a caller bug, not a no-op. Mirrors `lifecycle.Transition`.
- **No `pending → allocated` shortcut.** Approval is mandatory before allocation.

## Files to touch (one commit per layer)

1. **FSM package** (Phase A)
   - `services/workflow-svc/internal/sublifecycle/sublifecycle.go` (new)
   - `services/workflow-svc/internal/sublifecycle/sublifecycle_test.go` (new)
   Pure functions: `Transition(from, to State) error`, `AllowedNext(from State) []State`, `IsTerminal(s State) bool`. Mirrors `internal/lifecycle/lifecycle.go` shape verbatim. Zero imports beyond `errors` + `fmt`.

2. **Repo Transition method** (Phase B)
   - `services/workflow-svc/internal/subscriptions/repo.go` (extend)
   - `services/workflow-svc/internal/subscriptions/repo_test.go` (extend)
   Add `UpdateStatus(ctx, id, fromStatus, toStatus) (*Subscription, error)` + `errStaleStatus` + `IsStaleStatus(err)`. Optimistic concurrency via `WHERE id=$1 AND status=$2`. Mirror `products.UpdateStatus` exactly. Tests use existing `withTx` + `seedTenant/seedUser/seedProduct` helpers.

3. **HTTP handler** (Phase C)
   - `services/workflow-svc/internal/handlers/subscriptions.go` (extend)
   - `services/workflow-svc/internal/handlers/subscriptions_test.go` (extend)
   - `services/workflow-svc/cmd/server/main.go` (wire route)
   Add `TransitionSubscription(repo *subscriptions.Subscriptions) http.HandlerFunc`. Pattern mirrors `handlers.Transition` for products but **without** AuditEmitter and RailsIssuer side effects — those are deferred to follow-up slices (subscription allocations don't touch hydrax-adapter; audit emission for subscriptions is its own slice). Status codes: 200/400/404/409/422/500. Add `allowed_next` to existing `subscriptionResponse` (mirror products pattern). Route: `POST /v1/subscriptions/{id}/transition`.

## Out of scope (deferred follow-ups, log in STATE.yaml)

- Audit emission on subscription transitions (mirror products audit emission slice; separate plan)
- Rails-adapter call on `approved → allocated` (no rails surface for subscription allocations yet — deferred-not-resolved per CLAUDE.md Decisions)
- BFF + portal UI surface for transitions (separate slice once handler is green)
- Approval-svc integration: distributor portal would route subscription approvals through approval-svc, which calls back into this transition endpoint. Out of scope for this slice; lands when approvals Postgres persistence + a multi-approver chain spec are both in.
- Compensating cancellation/reversal of allocated subscriptions
- Notify-svc emission (investor email on allocated/settled)

## Verification gates (per CLAUDE.md, smallest check that proves correctness)

After each phase commit:
- `cd services/workflow-svc && go vet ./... && GOWORK=off go build ./... && go test ./internal/sublifecycle ./internal/subscriptions ./internal/handlers`
- For Phase B (Tx-bound integration tests): requires `DATABASE_URL` pointing at compose-stack DB. If unset, the existing tests already `t.Fatal` — no new infra.
- After Phase C: spin up service locally with `DATABASE_URL` set, run end-to-end curl:
  ```bash
  # create subscription
  curl -X POST localhost:7001/v1/subscriptions -d '{"product_id":"...","investor_user_id":"...","amount_minor":10000,"currency":"USD"}'
  # transition pending -> approved
  curl -X POST localhost:7001/v1/subscriptions/<id>/transition -d '{"to":"approved"}'
  # transition approved -> allocated
  curl -X POST localhost:7001/v1/subscriptions/<id>/transition -d '{"to":"allocated"}'
  # invalid: settled -> cancelled (422)
  curl -X POST localhost:7001/v1/subscriptions/<id>/transition -d '{"to":"cancelled"}'
  ```

## Commit plan (one concern each, conventional commits)

1. `feat(workflow-svc): subscription lifecycle FSM (pure functions)` — sublifecycle package + test
2. `feat(workflow-svc): subscriptions repo UpdateStatus with optimistic concurrency` — repo + repo_test
3. `feat(workflow-svc): POST /v1/subscriptions/{id}/transition handler` — handler + handler_test + main.go route wire-up

Three commits, each ≤4 files, each gated by per-phase verification.

## Risks

- **Schema drift between FSM string constants and CHECK constraint.** Mitigation: state values in `sublifecycle.go` are documented as mirroring `db/postgres/migrations/0001_initial.sql` lines 49–50. A schema CHECK violation would surface as `sql.ErrNoRows` (because UPDATE ... RETURNING with a constraint violation returns no rows) which IsStaleStatus already handles — so the worst case is a 409, not a 500. Acceptable.
- **No FK/cascade impact.** `subscriptions.product_id REFERENCES products(id) ON DELETE RESTRICT`. Status changes on subscription do not affect products. Safe.
- **Race window between GetByID and UpdateStatus.** Standard optimistic-concurrency pattern; handler returns 409 on stale status, mirroring products. No new risk.
