# Example: Investor subscription flow

One workflow traced end-to-end across the three planes (rails / orchestration / UX). Cites real file paths in this repo. What is wired today versus what is mocked is called out at every step.

For the architecture this trace exercises see [docs/architecture.md](architecture.md).

## The story in one paragraph

An institutional investor signs in to their portal, looks up a tokenised short-duration credit product they were invited to, submits a subscription request for $5M, and is routed through compliance review, primary distributor approval, and ledger settlement on the HydraX rails. Each step exists somewhere in this repo as code, doc, or mock — none of it is hand-waving.

## Trace

### 1. Investor opens the subscription page

- **Plane:** UX
- **File:** [web/apps/investor-portal/src/routes/SubscriptionsRoute.tsx](../web/apps/investor-portal/src/routes/SubscriptionsRoute.tsx)
- **What happens:** form takes a subscription ID; "Lookup" button calls `useGetSubscriptionQuery(id)` from `@hydrax/api-client`.
- **Wired today?** Yes. The page renders, the handler fires, the ID reaches the BFF. Tenant theming pulled from `<ThemeProvider>` ([web/packages/tenant-theme/src/](../web/packages/tenant-theme/src/)) so the page renders in the investor's institution's brand.
- **Why it lives in Plane 3:** rails has no concept of "investor's portal." Branding, search, tenant theming, role-aware nav are off-ledger by definition.

### 2. BFF validates and forwards

- **Plane:** Orchestration
- **File:** [services/bff/src/subscriptions/](../services/bff/src/subscriptions/), [services/bff/src/server.ts](../services/bff/src/server.ts)
- **What happens:** HTTP `GET /v1/subscriptions/{id}` reaches the BFF. The BFF validates the path, forwards to workflow-svc, masks upstream errors so the browser never sees internal stack traces, echoes JSON back.
- **Wired today?** Yes. The pattern mirrors the products proxy ([services/bff/src/products/proxy.ts](../services/bff/src/products/proxy.ts) — commits `90a4df2`, `31f0aa6`, `ab3d7a4`) and the marketdata proxy. Vitest cases assert 64 KiB body cap, 405 fall-through, error masking.
- **Why it lives in Plane 2:** five portals × N upstreams becomes N×5 client integrations if every portal calls every service directly. The BFF gives portals one schema-stable HTTP surface.

### 3. workflow-svc reads the subscription state

- **Plane:** Orchestration
- **Files:** [services/workflow-svc/internal/subscriptions/](../services/workflow-svc/internal/subscriptions/), [services/workflow-svc/internal/handlers/](../services/workflow-svc/internal/handlers/), [services/workflow-svc/internal/lifecycle/](../services/workflow-svc/internal/lifecycle/)
- **What happens:** workflow-svc looks up the subscription record in Postgres, returns its current lifecycle state (`Pending` / `Approved` / `Active` / `Matured` / `Cancelled`).
- **Wired today?** Partially. The lifecycle state machine ships (commit `8eb8336`, 7 table tests covering valid edges, invalid edges, self-loops, terminal states, `IsTerminal` correctness). The Postgres schema and handler pattern from products are the template. Subscription endpoints are scaffolded; full CRUD wiring is in-flight under [docs/plans/2026-04-25-subscriptions-and-products-form.md](plans/2026-04-25-subscriptions-and-products-form.md).
- **Why a state machine off-ledger?** Canton can commit a `Pending → Approved` transition atomically, but it can't model "VP must respond within 48 hours or this state machine auto-escalates." The state machine has to live where SLA timers can run — that's a Postgres-backed Go service, not a Daml contract.

### 4. Compliance step (KYC + approval chain)

- **Plane:** Orchestration
- **Files:** [services/approval-svc/internal/approvals/](../services/approval-svc/internal/approvals/), [services/approval-svc/internal/handlers/](../services/approval-svc/internal/handlers/), [services/integration-svc/](../services/integration-svc/)
- **What happens:** workflow-svc opens an approval ceremony in approval-svc (`POST /v1/approvals`). approval-svc tracks who must sign, computes SLA, escalates on timeout. Notifications fan out via notify-svc. The distributor's approval queue is rendered at [web/apps/distributor-portal/src/routes/ApprovalsRoute.tsx](../web/apps/distributor-portal/src/routes/ApprovalsRoute.tsx).
- **Wired today?** Partially. approval-svc has `Append` / `Get` / `ListPending` / `Decide` handlers (commits `8de31dc`, `c7c3d7d`, `d3e5e10`, with 7 unit tests + 9 httptest cases). BFF proxy + portal page shipped (`617ebf6`, `29b058a`, `effed03`). KYC integration in `integration-svc` is a scaffold today; the IdP wire is part of [docs/plans/2026-04-25-auth-foundation.md](plans/2026-04-25-auth-foundation.md).
- **Why this is the most important step to keep off-ledger:** Canton's authorization model is signatories and controllers on a Daml contract. It can express *"this contract requires the issuer's and the distributor's signature."* It cannot express *"VP must sign by Tuesday or auto-escalate to MD; show them the queue, send them an email reminder, log when they viewed the document."* That ceremony lives in approval-svc. Only the *result* of the ceremony — the signed authorization — is what we eventually hand to Canton. This is the single most load-bearing architectural choice in the whole repo.

### 5. workflow-svc tells hydrax-adapter to issue

- **Plane:** Orchestration → Rails boundary
- **Files:** [services/workflow-svc/internal/railsclient/](../services/workflow-svc/internal/railsclient/), [services/hydrax-adapter/internal/handlers/](../services/hydrax-adapter/internal/handlers/), [services/hydrax-adapter/internal/hydraxrails/](../services/hydrax-adapter/internal/hydraxrails/)
- **What happens:** workflow-svc POSTs to hydrax-adapter `/v1/issue` (or `/v1/subscribe`). hydrax-adapter translates the workflow command into the shape HydraX rails expect.
- **Wired today?** Yes — against `MockRails`. Commits `c58a6b2` (workflow-svc → hydrax-adapter HTTP client + httptest cases) and `dbcac05` (hydrax-adapter exposes POST `/v1/issue`, 4 unit tests). Real HydraX rails wait on engagement (see [docs/plans/2026-04-25-q1-hydrax-engagement-note.md](plans/2026-04-25-q1-hydrax-engagement-note.md)).
- **Why the adapter exists at all:** browsers must never hold rails credentials. Workflow-svc itself shouldn't either — it might one day talk to multiple ledgers. The adapter is the only process with HydraX API keys + Daml party tokens. Everything above this line is rails-agnostic.

### 6. Canton commits the contract atomically

- **Plane:** Rails
- **Files:** [services/canton-adapter/daml/hydrax-governance/daml/Governance.daml](../services/canton-adapter/daml/hydrax-governance/daml/Governance.daml), [services/canton-adapter/daml/hydrax-governance/daml/Test/GovernanceScript.daml](../services/canton-adapter/daml/hydrax-governance/daml/Test/GovernanceScript.daml)
- **What happens:** A Daml contract (`GovernanceProposal` template, with `Approve` / `Execute` / `Reject` choices and a `Proposal` interface) is created on the synchronizer. Sub-transaction privacy ensures only the proposer + named approvers see the full contract; observers see disclosure-scoped views via `ProposalView`.
- **Wired today?** Spike only. `daml build` runs green; 5 Daml Scripts (`testHappyPath`, `testUnauthorizedApprover`, `testDoubleApproval`, `testRejectBlocksExecute`, `testInterfaceView`) all pass on `--ide-ledger`. Real Canton synchronizer + party allocation deferred per [docs/plans/2026-04-25-daml-governance-spike.md](plans/2026-04-25-daml-governance-spike.md).
- **Why the spike matters even though it's small:** it proves the candidate knows what to put on-ledger (the controlled state transition + the signatory set + the disclosure boundary) versus what to keep off-ledger (the approval ceremony, the SLA timer, the email). Most institutional blockchain projects get this boundary wrong in one of two ways: too much on-chain (Canton becomes a slow CRUD database) or too little (the chain is decorative — institutions could have run a shared Postgres). The `GovernanceProposal` shape is deliberately minimal: it carries only what *must* be multi-party-signed.

### 7. Event flows back, audit captures

- **Plane:** Rails → Orchestration
- **Files:** [services/audit-svc/internal/handlers/](../services/audit-svc/internal/handlers/), [services/notify-svc/](../services/notify-svc/)
- **What happens:** canton-adapter consumes the event stream from the synchronizer. audit-svc appends an event row in Postgres (commits `2929a82` → `08a2519`, 12 tests covering Append/Get/ListByResource + handler-level 64 KiB cap + 405). notify-svc fans out: email to investor, in-app toast in ops-console, webhook to issuer's CRM.
- **Wired today?** audit-svc — yes. POST + GET `/v1/audit/events` green; integration tests gated on `DATABASE_URL` per the established pattern. notify-svc — scaffolded only (Phase 6 of [docs/plans/2026-04-25-backend-services-scaffold.md](plans/2026-04-25-backend-services-scaffold.md) shipped the `/healthz` skeleton; fan-out logic deferred).
- **Why the audit lives off-ledger:** Canton has its own audit at ledger grain. But the question *"who clicked Approve, when, from which IP, with what comment, against which uploaded document?"* is bigger than the ledger event can carry. audit-svc is the off-ledger evidence bank that joins back to the ledger event ID.

### 8. Portals refresh

- **Plane:** UX
- **Files:** [web/apps/ops-console/src/routes/AuditRoute.tsx](../web/apps/ops-console/src/routes/AuditRoute.tsx), [web/apps/investor-portal/src/routes/HealthRoute.tsx](../web/apps/investor-portal/src/routes/HealthRoute.tsx)
- **What happens:** ops-console `/audit` page exposes search across the audit-svc trail (commit `0ca044b`, 3 vitest cases). investor-portal `/subscriptions` re-runs the RTK Query lookup; investor-portal `/health` polls every 5s against `bff /healthz/composite` (commits `7114fcc`, `52ff8e9`).
- **Wired today?** Yes for the audit search and the health page; the same RTK Query polling pattern extends to subscription status when needed.

## What lives where (data plane)

| Surface | What it holds | Why |
|---|---|---|
| Postgres (workflow-svc) | products, subscriptions, lifecycle state | mutable workflow state, queryable by ops, SLA timers |
| Postgres (audit-svc) | append-only audit events | off-ledger evidence trail joined back to ledger event IDs |
| MongoDB (planned, see PRD §10) | flexible per-tenant payloads, document metadata | schema-on-read for white-label per-tenant fields |
| Canton ledger (mocked v1) | `GovernanceProposal` and the signed authorization to issue | shared multi-party truth, atomic commit, sub-transaction privacy |
| HydraX rails (mocked v1) | tokenisation + custody state + trade settlement | regulated rails, outside our trust boundary |
| Off-process (Railway env vars) | DATABASE_URL, MARKET_DATA_HUB_URL, *_URL upstreams | secrets, rotated independently per stage; never in repo |

## What this trace proves

1. **Canton can't model SLA timers for off-ledger approval steps.** That's why `workflow-svc` and `approval-svc` exist as Go services with Postgres state. They are not generic backend bloat; each is justified by something Canton structurally does not do.
2. **Canton can't notify a CRM or render a tenant-themed UI.** That's why `notify-svc`, `integration-svc`, and the five React portals exist.
3. **The same shape of code works against MockRails (v1) and real HydraX rails (post §14 Q1 unblock).** Cutover is one env-var flip in the workflow-svc → hydrax-adapter HTTP path. The workflow stack does not care.
4. **The Daml spike at [services/canton-adapter/daml/hydrax-governance/](../services/canton-adapter/daml/hydrax-governance/) proves the candidate can write and run Daml**, and proves the boundary is drawn correctly: the on-ledger contract is small (a proposal with Approve/Execute/Reject and a disclosure-scoped view) because everything else is one plane up.

## What's deferred (honest)

| Item | Status | Plan |
|---|---|---|
| Real Canton synchronizer + party allocation | Daml runs on `--ide-ledger` only | PRD-v2 §15 |
| Real HydraX rails | MockRails behind a stable interface | [docs/plans/2026-04-25-q1-hydrax-engagement-note.md](plans/2026-04-25-q1-hydrax-engagement-note.md) |
| Real KYC integration | `integration-svc` is a scaffold | [docs/plans/2026-04-25-auth-foundation.md](plans/2026-04-25-auth-foundation.md) |
| Notifications fan-out | `notify-svc` is a scaffold | Phase 6 of backend scaffold plan, not yet expanded |
| Subscription endpoints (full CRUD) | scaffolded; products is the template | [docs/plans/2026-04-25-subscriptions-and-products-form.md](plans/2026-04-25-subscriptions-and-products-form.md) |

None of these undermine the architectural claim. They define what the next slices unlock.
