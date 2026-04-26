# HydraX App — Architecture

> The layer **above** Canton + HydraX rails. The rails handle shared multi-party truth and atomic settlement. This app handles the operator UX, tenant onboarding, off-ledger approval ceremonies, and integration glue that the rails by design do not.

For the product spec see [docs/prd-v2.md](prd-v2.md). For a concrete trace through these planes see [docs/example-subscription-flow.md](example-subscription-flow.md).

## The three planes

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Plane 3 — UX                                          (browser, tenant-themed) │
│                                                                                │
│   web/apps/issuer-portal      web/apps/distributor-portal                      │
│   web/apps/investor-portal    web/apps/ops-console        web/apps/admin       │
│   web/packages/{ui, tenant-theme, api-client}                                  │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │  HTTPS / RTK Query
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Plane 2 — Orchestration                       (server-side, off-ledger, web2) │
│                                                                                │
│   services/bff               (Node/TS)  HTTP aggregator, single FE entry       │
│   services/workflow-svc      (Go)       state machines, SLA, lifecycle         │
│   services/approval-svc      (Go)       sign-off chains, escalation            │
│   services/audit-svc         (Go)       append-only evidence (Postgres)        │
│   services/notify-svc        (Node/TS)  email / in-app / webhook fan-out      │
│   services/integration-svc   (Node/TS)  KYC / SSO / CRM glue                   │
│   services/market-data-svc   (Go)       Binance + market-data-hub fan-out      │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │  Daml command/event over gRPC (mocked v1)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Plane 1 — Rails                            (Canton + HydraX, multi-party truth) │
│                                                                                │
│   services/hydrax-adapter    (Go)       translates workflow → HydraX rails     │
│   services/canton-adapter    (Go)       Daml command/event bridge              │
│   services/canton-adapter/daml/hydrax-governance  running Daml spike           │
│                                                                                │
│   ↓                                                                            │
│   Canton synchronizer + participants                                           │
│   HydraX rails (tokenisation, custody, trading)                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

## What each plane owns

### Plane 1 — Rails

**Owns:** shared business truth across institutions; sub-transaction privacy via signatories, controllers, and disclosure; atomic state transitions; controlled cross-domain interoperability.

**Does NOT own:** anything that is not a controlled multi-party state transition. SLAs, retries, document collection, KYC checks, email notifications, branded portals, search.

### Plane 2 — Orchestration

**Owns:** workflow state machines, SLA timers, retries, escalations; approval ceremonies that *gate* on-chain commands; tenant-aware data access; rails credentials (kept inside `hydrax-adapter` and `canton-adapter` only); the IdP boundary; notification fan-out; pricing feeds.

**Does NOT own:** browser rendering; the on-ledger contract logic itself; cross-institution shared truth (that lives one plane down).

### Plane 3 — UX

**Owns:** role-scoped portals (issuer, distributor, investor, ops, admin); tenant theming via CSS variables (`web/packages/tenant-theme`); shared primitives via `web/packages/ui` (lucide icons only); typed BFF client via `web/packages/api-client`.

**Does NOT own:** any direct call to Canton or HydraX rails. The browser never holds rails credentials, Daml party tokens, or HydraX API keys. Every cross-plane call lands at `services/bff` first.

## Why each service exists

The "Canton can't do X, so this exists" justification for every service in `services/`. If a service can't answer this question, it should not exist.

| Service | Why it exists |
|---|---|
| **workflow-svc** | Canton commits state transitions atomically but can't model SLA timers, retries, or human approval timeouts. The product lifecycle state machine (`internal/lifecycle`: Pending → Approved → Active → Matured/Cancelled) lives here. |
| **approval-svc** | Canton's authorization is on-chain (signatories, controllers). It can't model *"VP must sign by Tuesday or escalate to MD."* approval-svc owns the off-ledger sign-off ceremony that gates the on-chain command. |
| **audit-svc** | Canton has its own audit, but it's at ledger grain. audit-svc records the full off-ledger context (who clicked, what document was uploaded, what comment was attached) that ledger events can't capture. Postgres-backed, append-only. |
| **hydrax-adapter** | HydraX rails run outside Canton. The adapter is the only place that holds rails credentials and translates *"workflow says issue token X"* into the right HydraX call. v1 ships against `MockRails` per [docs/plans/2026-04-25-q1-hydrax-engagement-note.md](plans/2026-04-25-q1-hydrax-engagement-note.md). |
| **canton-adapter** | Browsers and product services must never call Daml directly. canton-adapter is the only thing that holds Daml command/event endpoints and party tokens. The Daml spike lives at [services/canton-adapter/daml/hydrax-governance/](../services/canton-adapter/daml/hydrax-governance/). |
| **bff** | 5 portals × N upstreams = N×5 client integrations if each portal calls each service directly. The BFF gives portals one schema-stable HTTP surface, masks upstream errors, and aggregates health (`/healthz/composite`). |
| **notify-svc** | Canton emits ledger events. notify-svc translates events into the shape ops/investors/issuers actually want (email, in-app toast, webhook). |
| **integration-svc** | Identity, KYB, CRM, SSO are off-ledger by definition. integration-svc owns the IdP boundary so other services don't sprinkle SSO logic everywhere. |
| **market-data-svc** | Canton doesn't price assets. Pricing comes from external feeds. market-data-svc gates Binance public REST + the `market-data-hub` Twelve Data proxy behind one normalized API with a Prometheus-instrumented router. |

## What's actually wired today

Status as of 2026-04-26. Dates reference plan docs in `docs/plans/`.

### Live and reachable

- **Operator console prototype** — static HTML/JS, deployed on Railway at `hydrax-prototype-production.up.railway.app`. Reference for UX patterns; not production code per [CLAUDE.md](../CLAUDE.md).
- **market-data-svc** — deployed on Railway at `market-data-svc-production.up.railway.app`. `/healthz`, `/v1/fx/{base}/{quote}`, `/v1/quotes/{symbol}`, `/metrics` all up. `/v1/quotes/BTC/USD` returns 502 from Singapore region due to Binance HTTP 451 geoblock — service-side error handling correct, environmental.

### Wired across services

- BFF ↔ workflow-svc: POST/GET `/v1/products`, GET `/v1/subscriptions/{id}`.
- BFF ↔ audit-svc: POST/GET `/v1/audit/events`.
- BFF ↔ approval-svc: POST `/v1/approvals`, GET pending, POST `/decide`.
- BFF ↔ market-data-svc: GET `/v1/market-data/quotes/{symbol}`.
- workflow-svc ↔ hydrax-adapter: POST `/v1/issue` against `MockRails`.

### Postgres-backed

- workflow-svc: products, lifecycle state.
- audit-svc: append-only event log.

### Daml spike

[services/canton-adapter/daml/hydrax-governance/](../services/canton-adapter/daml/hydrax-governance/) — `GovernanceProposal` template with `Approve`/`Execute`/`Reject` choices and a `Proposal` interface. `daml build` exits 0; 5 Daml Scripts (`testHappyPath`, `testUnauthorizedApprover`, `testDoubleApproval`, `testRejectBlocksExecute`, `testInterfaceView`) all pass on `--ide-ledger`.

### Portal baselines

All five portals at uniform polish: AppShell with sidebar + topbar, Avatar, NavItem-driven nav, 3 stat tiles + EmptyState backed by a generated hero JPEG. See `web/apps/<portal>/src/components/<Brand>{Sidebar,TopBar}.tsx` and `web/apps/<portal>/src/routes/HomeRoute.tsx`.

## What we deliberately do NOT build

- **Competing exchange, custody system, tokenisation protocol, or retail trading app.** That's HydraX rails territory.
- **Browser-direct ledger access.** Every cross-plane call lands at the BFF first.
- **Generic on-chain workflow engine.** Workflow lives in Plane 2 (Postgres-backed Go services). Only the *result* of a workflow — the signed authorization — crosses into Plane 1.
- **Multi-domain Canton from day 1.** Single-synchronizer until multi-domain is justified, per [docs/prd-v2.md](prd-v2.md) §15.

## How a change propagates through the planes

Adding a new product type (example: short-duration credit, the v1 default per [docs/plans/2026-04-25-q3-default-short-duration-credit.md](plans/2026-04-25-q3-default-short-duration-credit.md)):

1. **Plane 1 (rails)** — Daml template for `CreditNote` with `Issue` / `Subscribe` / `Settle` / `Mature` choices. Add to `services/canton-adapter/daml/`.
2. **Plane 1 → Plane 2 boundary** — extend `services/hydrax-adapter/internal/hydraxrails` with the `MockRails` method that calls `Issue`. Real HydraX rails plug in at the same interface (PRD §14 Q1 unblock).
3. **Plane 2** — extend `services/workflow-svc/internal/lifecycle` if the state machine differs; add Postgres schema in `db/postgres/migrations/` for product-specific fields.
4. **Plane 2 → Plane 3 boundary** — extend `services/bff/src/products/` proxy + `web/packages/api-client/src/api.ts` types/hooks.
5. **Plane 3** — add an issuer-portal route and form (`web/apps/issuer-portal/src/routes/`).

Each layer is one commit per [CLAUDE.md](../CLAUDE.md) commit discipline (migration → schema → service → route → client → UI → copy).

## Why this split matters for Canton specifically

Canton models *what was authorized*. The path that *gets* something authorized — collecting documents, walking signatories through their queue, escalating when an approver times out, notifying the CRM — is web2 work. Putting that on-chain is expensive and a privacy leak. Putting it nowhere is what most "blockchain-first" institutional projects do; that is why they fail to ship.

This repo holds the off-ledger half so the on-ledger half can stay small.
