# PRD v2 — HydraX Issuance & Servicing Control Plane

*Subtitle: Launch & Servicing Workspace for Tokenized Treasury and Short-Duration Fund Products.*

**Status:** draft, supersedes `docs/prd.md` once approved.
**Authoritative predecessor:** `docs/prd.md` (v1, kept for reference).
**Date:** 2026-04-24.

---

## 0. What Changed vs v1

v1 was a strategically correct but commercially soft platform document: white-label OS, five personas, eight modules, one generic wedge. v2 cuts surface area by ~40%, names one product beachhead, forces an on-ledger/off-ledger stance, and leads with the economic case. Architecture and privacy thinking from v1 carry over unchanged.

---

## 1. The Pitch

HydraX already has the regulated rails — tokenisation, trading, custody. This product converts those rails into a repeatable revenue workflow for regulated tokenized issuance and servicing.

Buyers don't buy an "OS." They buy the shortest path from *mandate signed* to *subscriptions confirmed* on a tokenized product, with audit-grade evidence at every step.

---

## 2. Hard Product Boundary

**This product IS:** a controlled launch, subscription, approval, and servicing workspace for regulated tokenized products, running above HydraX rails.

**This product is NOT:**
- a marketplace
- a general workflow builder
- a CRM
- a portfolio analytics system
- a secondary-market trading UI
- a competing tokenisation, exchange, or custody engine
- a public-chain DeFi front-end

Anything that pulls us toward those boundaries is deferred or rejected.

---

## 3. First Wedge — One Product, One Workflow

**Wedge:** Tokenized treasury / short-duration fund subscription and servicing.

**Why this wedge:**
- Closest to existing institutional demand (tokenized MMFs, short-duration credit, treasury-like products are the most active regulated tokenisation category).
- Repeatable: same product shape, same investor profile, same servicing cadence across issuers.
- Workflow is compressed enough to ship end-to-end in one release cycle.
- Directly exercises HydraX rails where they are already strong.
- Natural expansion path: structured products → private credit subscription → fund-of-funds servicing.

**Explicitly deferred wedges:** equity-linked issuance, complex structured notes, secondary liquidity flows, retail wrappers.

---

## 4. The Economic Case (Where Money Is Lost Today)

The target buyer is losing money in five places on every regulated tokenized product they launch. This product captures each one.

| Pain today | Cost today | What v1 captures |
|---|---|---|
| Manual onboarding for every investor across issuer + distributor + ops | weeks of ops + compliance time per investor entity | controlled onboarding workflow with document state, eligibility rules, reusable entity profiles |
| Subscription intake via email, spreadsheets, PDF forms | mis-keyed allocations, rework, reconciliation breaks | structured subscription workflow with status, approvals, selective visibility per party |
| Approvals routed via chat and shared inbox | SLA blow-outs, unauditable decisions, compliance findings | explicit approval chains, escalation, action-level audit log |
| Lifecycle events (confirmations, notices, redemptions) handled off-system | servicing team overhead scaling linearly with AUM | servicing workspace with request → approval → confirmation state, linked to ledger truth |
| No shared source of truth between issuer, distributor, ops, investor | double-keyed data, disputes, support load | single workflow spine with role-based disclosure; ledger-backed where shared truth matters |

**Boardroom metric (the one the CFO buys on):** cut onboarding-to-first-subscription cycle time from **weeks to days**, and reduce servicing cost per issuance by a target **30–50%** against the client's current baseline.

---

## 5. Personas v1 — Tight

| Persona | v1 depth | Why |
|---|---|---|
| **Issuer ops** (fund operator / issuer admin) | primary design center | Owns launch, approvals, servicing. Pain is concentrated here. |
| **Platform ops** (HydraX-side ops console) | primary design center | Needed to run the workspace at all; also the surface where HydraX monetizes servicing. |
| **Distributor** (placement agent, private bank ops) | thin — read + submit subscription + upload docs | Required for the subscription workflow to close, but not a full portal. |
| **Investor entity ops** | minimal — confirm identity, receive confirmations, view holdings | Full investor portal is deferred to v2. v1 gives just enough to close the subscription loop. |
| **Platform admin** (tenant config, HydraX super-admin) | bare minimum | Tenant setup + role mapping only. No self-service workflow builder in v1. |

This is a deliberate break from v1, which treated all five personas as equal. v1 gave everyone a module. v2 gives issuer + ops the full workspace and everyone else the narrowest path that closes their loop.

---

## 6. v1 Modules — In vs Out

| Module | v1 scope |
|---|---|
| Tenant framework | **In** — branding, domain, role mapping, module enablement. No self-service workflow builder. |
| Issuer workbench | **In** — product setup for tokenized treasury/fund, issuance checklist, doc room, approval routing, distributor scope. |
| Operations console | **In** — queue, approvals, exceptions, SLA tracking, audit log, reconciliation checkpoints. |
| Onboarding workflow | **In** — issuer, distributor, investor entity onboarding with document state, eligibility logic. |
| Subscription workflow | **In** — intake → review → approval → allocation → confirmation, with selective visibility. |
| Servicing (lite) | **In** — confirmations, notices, redemption requests, transfers. Core servicing only. |
| Audit + evidence | **In** — actor/time/object logs, approval traceability, exportable evidence trail. |
| Distributor portal | **Thin** — entitlement-scoped product access, investor intake handoff, status view. No distribution analytics. |
| Investor portal | **Thin** — login, holdings view, document access, servicing request submission. No dashboards. |
| Relationship / coverage dashboard | **Out** — post-v1. |
| Configurable tenant workflow builder | **Out** — post-v1. Workflows are templated for the treasury/fund product in v1. |
| Multi-domain Canton | **Out** — single synchronizer only in v1. |
| Secondary market / portfolio analytics | **Out** — not this product. |

If a module is not in this table, it is not in v1.

---

## 7. On-Ledger vs Off-Ledger — Hard Stance

This was the hand-wave in v1. v2 decides it.

### On-ledger (Canton / Daml contracts)

Objects where multi-party shared truth is the whole point, and where divergence between systems of record would be a compliance or settlement failure.

- **Product entitlement state** — who is permitted to hold, subscribe, redeem a given tokenized product.
- **Subscription acceptance / confirmation state** — the authoritative record that issuer and investor agree a subscription is confirmed at an allocation.
- **Asset-linked lifecycle transitions** — issuance, allocation, transfer, redemption where the ledger is the system of record.
- **Cross-party approvals where verifiability matters** — approvals that third parties (auditors, regulators, counterparties) must be able to verify without trusting one party's database.

### Off-ledger (Postgres / MongoDB read models)

Everything else. Default off-ledger unless there is a named reason to be on-ledger.

- Documents, document metadata, KYC/KYB evidence
- Messaging, internal notes, external communications
- Operational dashboards, queue state, SLA timers
- CRM notes, coverage activity, relationship history
- Analytics, reporting aggregates, user preferences
- Notification envelopes, email/webhook delivery state
- Audit log (for operational actions outside the ledger scope)

### The decision rule

> If two different parties must independently trust the same value without trusting each other's DB, put it on-ledger. Otherwise, off-ledger.

Every new workflow object gets placed against that rule before it ships. No exceptions.

---

## 8. Architecture Principles (Compressed from v1)

The v1 principles are correct and carry over as-is. The short version:

- HydraX rails are infrastructure. This product is the workflow + experience layer.
- Browser never talks to Daml/HydraX directly. Backend adapters only.
- Web2 owns authN/SSO, UI, docs, notifications, reporting, integrations.
- Shared ledger owns cross-party truth and verifiable transitions.
- Role-based disclosure and tenant isolation are day-one requirements, not bolt-ons.
- Single synchronizer until multi-domain is explicitly justified.
- Institutional UX, not crypto UX.

See v1 §10–§13 for the full treatment.

---

## 9. Tech Stack & Deployment (Anchor, Not Debate)

Decided in `CLAUDE.md`, restated here for completeness.

- **Go services:** workflow, approval, audit, HydraX adapter, Canton adapter.
- **Node/TS services:** notification, integration (KYC/SSO/CRM), BFF for React portals.
- **React + TypeScript + Redux Toolkit + Vite,** shells: `issuer-portal`, `ops-console`, `distributor-portal` (thin), `investor-portal` (thin), `admin`.
- **Postgres** for relational truth (tenants, users, roles, workflow state, audit). **MongoDB** for flexible payloads, document metadata, notification envelopes.
- **Railway** per deployable; Postgres + Mongo as addons; env per stage.
- **Icons: lucide-react only.** No emoji.

---

## 10. Commercialization

### Who buys first (in order)

1. **Tokenized treasury / MMF issuers** — fund operators already running or piloting regulated tokenized short-duration products.
2. **Fund administrators and transfer-agent-style operators** servicing tokenized funds on behalf of issuers.
3. **Distributors** (private banks, wealth platforms) who need controlled onboarding + subscription flow into these products.

### Why they buy (urgency, not features)

- They are already losing ops margin on every manual subscription cycle.
- Their regulators increasingly demand audit-grade evidence trails that email + spreadsheets cannot produce.
- Their distribution partners refuse to onboard onto one-off portals; they need something that looks institutional out of the box.
- Launch cadence is the competitive lever. Faster launches = more AUM at the same ops headcount.

### How HydraX monetizes

- **Setup / implementation fee** per tenant onboarding.
- **Tenant platform fee** (monthly or annual, per tenant).
- **Workflow volume fee** (per subscription, per redemption, per servicing event) — the main scaling line.
- **Servicing fee** (percentage or flat, on servicing events HydraX processes on behalf of the issuer).
- **Integration fee** for custom KYC/SSO/CRM connectors beyond the supported set.

This is a usage-scaling model attached to issuance volume, not a flat seat licence. The commercial story to HydraX management is: *every tokenized product that launches on our rails also routes its workflow fees through our control plane.*

---

## 11. Success Metrics

### Boardroom (the ones HydraX sells on)

- Onboarding-to-first-subscription cycle time (target: **days, not weeks**).
- Servicing cost per issuance (target: **30–50% reduction** against client baseline).
- Time-to-launch a new tokenized product on the platform (target: **under 4 weeks**, tenant-ready).
- Revenue per tenant per quarter (setup + platform + volume + servicing, tracked together).

### Operational (the ones product + eng track)

- Approval SLA breach rate
- Exception resolution time (median + p95)
- Subscription workflow completion rate (started → confirmed)
- Audit log completeness (% of sensitive actions with full actor/object/time)
- Integration success rate (KYC/SSO/CRM)
- Platform uptime, event processing latency

---

## 12. Phased Roadmap

### v1 — Issuance & Servicing Control Plane (this PRD)

Tokenized treasury / short-duration fund wedge. Issuer + ops full workspace. Distributor + investor thin. Templated workflow, single synchronizer, hybrid on/off-ledger per §7.

### v2 — Extend the Wedge

- Full investor portal (dashboards, notices, servicing history)
- Distributor analytics and pipeline
- Additional product templates: structured products, private credit subscription
- Richer servicing (corporate actions, amendments, valuation support)

### v3 — Platform Expansion

- Configurable tenant workflow builder
- Multi-entity distribution networks
- Multi-domain / multi-synchronizer Canton where justified
- AI-assisted ops (exception summarization, document triage)
- Post-v3: relationship / coverage dashboard, template marketplace, institutional self-service configuration

Each phase only unlocks when the prior phase has measurable tenant adoption and the boardroom metrics hold.

---

## 13. Key Risks

1. Scope creep back toward the v1 "everything for everyone" shape. Mitigation: the §2 boundary and §6 module table are commit-enforced.
2. Wedge-product misfit — if the first 2 tenants don't operate tokenized treasury/fund products, the wedge falls apart. Mitigation: validate wedge with 2 named design partners before v1 build starts.
3. On-ledger / off-ledger drift under delivery pressure. Mitigation: §7 decision rule applied per workflow object before implementation.
4. HydraX API gaps that only surface mid-build. Mitigation: resolve §14 Q1 before committing to v1 scope.
5. Institutional workflow variance across tenants forcing per-tenant customisation. Mitigation: workflows are templated, not configurable in v1; customisation requires a v2 workflow builder.
6. Approvals / governance latency on HydraX side slowing release cadence. Mitigation: release trains and versioned contract packages from day one.

---

## 14. Open Questions — Blockers for v1 Build

These must be resolved before implementation begins. Each one has a direct consequence if left open.

1. **HydraX API surface** — which endpoints/services are available for workflow-layer integration, and at what SLA? *Blocks: adapter service design.*
2. **Daml contract scope** — which subscription and lifecycle objects go on-ledger in v1 vs off-ledger read models? Confirm against §7 decision rule. *Blocks: canton-adapter and data model.*
3. **First product template** — tokenized MMF, tokenized short-duration credit, or tokenized treasury-equivalent? Confirm with design partner. *Blocks: product setup wizard and servicing events.*
4. **First tenant design partner** — named issuer + named distributor committed to v1 as pilot. *Blocks: workflow template specificity.*
5. **Deployment model** — managed HydraX platform, dedicated tenant instances, or hybrid per tenant? *Blocks: tenant isolation model and Railway service topology.*
6. **Institutional identity standards** — which SSO / entitlement systems must be supported at v1 launch? *Blocks: integration-svc scope.*
7. **Pricing commitment** — which of the §10 monetization lines does HydraX commit to for the first tenant contract? *Blocks: commercial story and v1 go/no-go.*

Questions 1, 3, 4, 7 are the four that most directly gate v1. If any of these is unresolved at build-start, v1 scope shrinks until it is resolved.

---

## 15. Final Thesis

The winning product is not a white-label OS. It is the shortest, most audit-ready path from *mandate* to *confirmed subscription* to *serviced redemption* for regulated tokenized treasury and fund products, running above HydraX rails.

Built correctly, every new tokenized product launched on HydraX rails also closes its operational loop — and its fee stream — through this control plane.
