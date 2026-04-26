# Canton Demo — Deep-Dive Q&A Prep

**Naim Katiman · April 2026**

> Companion to [canton-homework.md](canton-homework.md) and the 18-slide [canton-homework-deck.html](canton-homework-deck.html). When an interviewer probes one of the seven Canton-related topics, this is what you say.

For each topic this doc gives:
- **Pitch (30 seconds).** What you say first.
- **Slide.** Where to flip in the deck.
- **Portal demo.** The live surface to point at, and what to click.
- **Likely follow-up.** The harder question + your answer.
- **Honest deferral.** What NOT to claim is solved.

The 4 topics deepened in this prep round (slides 14–17 + matching portal surfaces) are listed first. The 3 topics already strong in slides 0–13 are listed at the end with a short cite — no new material needed there.

---

## Topic 1 — Tokenization & tokenomics design

**Pitch.** A token in this stack is a Daml template instance. The interesting design decision isn't the asset model — it's the stakeholder set declared at template definition, the enumerated `choice` transitions allowed on the contract, and which fields stay off-ledger in Postgres (KYC docs, marketing collateral, fee schedules) versus which ones must be on-ledger because they need multi-party signing.

**Slide.** [Slide 14 — Tokens are Daml templates, not new primitives](canton-homework-deck.html#slide-14)

**Portal demo.**
- Open `issuer-portal` → `/products/<any-product-id>` (e.g., the demo subscription product).
- Scroll past the Lifecycle actions card to the **Token Model** section.
- Point out: template name (e.g. `ShortDurationCreditNote`), the four stakeholders (Issuer / Distributor / Investor / Custodian), the lifecycle-state chips with `matured` and `cancelled` styled distinctly as terminal states, and the off-ledger fields (KYC documents, marketing collateral, fee schedule, investor reporting).
- Component: [TokenModelCard.tsx](../../web/apps/issuer-portal/src/components/TokenModelCard.tsx). Helper that maps `product_type` to template name: [ProductDetailRoute.tsx:tokenTemplateForProductType](../../web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx).

**Likely follow-up.** *"What about tokenomics — supply, distribution, fees?"*
> Those live as operational fields, not as protocol-level economics. Supply and unit accounting belong in the on-ledger contract because they need multi-party signing. Fee schedules and distribution waterfalls are off-ledger in `workflow-svc` because they change without requiring re-signing by every stakeholder. The principle: only what needs joint truth lives on the ledger; everything else is faster and more flexible off-ledger.

**Honest deferral.** No native tokenomics layer — supply caps, distribution waterfalls, and fee schedules are operational fields today. The first product type is still open (PRD §14 Q3); my current proposal is short-duration credit, 30–180d institutional tenor. HydraX rails are mocked behind `services/hydrax-adapter` because Q1 is deferred-not-resolved until HydraX shares the API surface.

---

## Topic 2 — DeFi composability under privacy

**Pitch.** Public-chain DeFi composes because state is globally readable. Canton's contract-level privacy disqualifies that pattern — a contract is opaque to non-stakeholders by construction. So composability moves up the stack: cross-contract logic is a deliberate design step at modelling time, and the orchestration plane brings the right principals onto the contract at issuance so downstream `choice`s are even reachable. Compliance-by-construction; you cannot accidentally compose a custodian into a flow they shouldn't see.

**Slide.** [Slide 15 — Composability moves up the stack](canton-homework-deck.html#slide-15)

**Portal demo.**
- Open `admin` → `/composability`.
- Three contract template cards visible: `ShortDurationCreditNote`, `SubscriptionRequest`, `DistributionAgreement`.
- For each card, point out the stakeholder roster + the `added by <workflow>` chip on each principal. That chip is the answer to the question "how does each party get onto the contract."
- Route: [ComposabilityRoute.tsx](../../web/apps/admin/src/routes/ComposabilityRoute.tsx).

**Likely follow-up.** *"Doesn't that kill the kind of innovation we see in DeFi — anyone-can-call money legos?"*
> Yes, intentionally. We trade permissionless composition for compliance-by-construction. We don't get atomic same-block flash composition across protocols built by strangers. We do get two things public chains can't offer regulated institutions: contracts opaque to non-stakeholders by default, and atomicity preserved within a domain via the same Daml `choice` mutating multiple contracts in one signed step. For the institutional workflow we're targeting, the trade is favourable.

**Honest deferral.** This is the design constraint that's hardest to reverse — get the stakeholder set wrong at modelling time and no UI work fixes it. Migration story for adding a stakeholder mid-life is via Daml interfaces + package versioning, isolated in the rails-plane adapters; not pretending it's a solved problem.

---

## Topic 3 — Infrastructure & operational setup

**Pitch.** Production topology is boring on purpose. 8 backend services on Railway (5 Go, 3 Node/TS) each on a stable port with `/healthz` + Dockerfile. 5 white-label React portals as static sites with role-aware shells and CSS-variable tenant theming. One observability roll-up: bff `/healthz/composite` aggregates all 8 upstream probes. Postgres + Mongo as Railway addons; deploy via `railway up --detach` per linked service.

**Slide.** [Slide 16 — 8 services, 5 portals, one Railway project](canton-homework-deck.html#slide-16)

**Portal demo.**
- Open `ops-console` → `/health`.
- The Platform Health card polls bff `/healthz/composite` every 5 seconds. One tile per service: status, latency, HTTP code, error text on failure.
- "Refresh now" button forces an immediate refetch.
- This is the same component already shipping in `investor-portal` (`/health`); reusing the pattern instead of forking.
- Route: [HealthRoute.tsx](../../web/apps/ops-console/src/routes/HealthRoute.tsx).

**Likely follow-up.** *"How do you handle tenant isolation across these portals?"*
> Three layers. (1) Each portal is its own static site shell, not the same SPA with feature flags — role boundaries are deployment-time, not runtime. (2) Tenant theming is CSS variables injected at runtime via `<ThemeProvider>` from `@hydrax/tenant-theme`; no shared mutable state between tenants in the browser. (3) Backend tenancy lives in service-level row-scoped queries (`tenant_id` on every read model) and per-tenant env config; not retrofitted, designed in from day one.

**Honest deferral.** Multi-domain Canton is a Q3 milestone, not a v1 feature. Staying single-synchroniser until a tenant pays for the cross-jurisdiction or latency-isolation complexity. Real HydraX rails plug in via the existing `hydrax-adapter` interface; mock today, real when engagement settles.

---

## Topic 4 — Data management & synchronization across domains

**Pitch.** The ledger holds shared truth. The portals read from off-ledger projections — Postgres for relational reporting + indexed queries (subscriptions, approvals, audit, products), Mongo for flexible tenant-configurable payloads (document metadata, notification envelopes). Daml events stream through `canton-adapter` into `workflow-svc`'s projector, which writes both stores idempotently (keyed on event id, replayable on schema change). Per-projection lag is observable.

**Slide.** [Slide 17 — Ledger truth, read-model speed](canton-homework-deck.html#slide-17)

**Portal demo.**
- Open `admin` → `/projections`.
- Five rows visible: `products_read`, `subscriptions_read`, `approvals_read`, `audit_events`, `notification_envelopes`.
- Point at the **Lag** column — the first four rows are sub-3s (green); `notification_envelopes` shows 17.4s with a red AlertTriangle and inline error text "destination unreachable: smtp-relay timeout". Stale-row threshold is 5 seconds.
- This is the answer to "how do operators know a projection has drifted from the ledger."
- Route: [ProjectionsRoute.tsx](../../web/apps/admin/src/routes/ProjectionsRoute.tsx).

**Likely follow-up.** *"What happens when a projection schema changes — do you need a migration step?"*
> No. Projections are idempotent and keyed on event id, so when the schema changes we replay from offset zero. Two consequences: (1) we can reshape the read model freely without downtime windows; (2) the cost is replay time on schema change — for the table sizes we're operating at, minutes, not hours. The ledger remains the source of truth; projections are the source of speed.

**Likely follow-up 2.** *"Single sync vs. multi-domain — when do you graduate?"*
> Three triggers (slide 11 covers this in detail): cross-jurisdictional flows where regional operators require legal residency; latency isolation when a high-frequency settlement domain shouldn't share an ordering queue with onboarding; regulatory partitioning where supervisory regimes can't share an operator. Until one of those three lands as a real tenant requirement, single-domain is the disciplined default.

**Honest deferral.** The projection lag table renders mock data today; the real wiring drives off the workflow-svc projection as Daml events stream through `canton-adapter`. Multi-domain Canton is a graduation, not a starting position — committing now with no concrete tenant trigger would multiply operational complexity without buying anything.

---

## Topics already covered in slides 0–13 (brief)

These don't need new material. Reach for the existing slides if asked.

- **Web2 vs Web3 architectural considerations** → [Slide 8 — Where Canton stops, where Web2 takes over](canton-homework-deck.html#slide-8) and [Slide 5 — Canton vs public L1 vs traditional permissioned DLT](canton-homework-deck.html#slide-5). The boundary: Web2 owns identity, UI, documents, notifications, reporting; Web3 owns shared truth and controlled state transitions; the browser never touches Daml directly — all ledger I/O goes through Go adapters.

- **Privacy and security model** → [Slide 10 — Privacy & security model](canton-homework-deck.html#slide-10), reinforced by [slide 3 (three primitives)](canton-homework-deck.html#slide-3) and [slide 5](canton-homework-deck.html#slide-5). Contract-level privacy via stakeholder sets is first-class in the data model; tenant isolation + role-based disclosure designed in from day one, not retrofitted.

- **Smart contract design and lifecycle** → [Slide 12 — Daml choices as state transitions](canton-homework-deck.html#slide-12). Lifecycle decisions isolated in rails-plane adapters; Daml interfaces + package versioning for upgrades; deterministic projection of "what's in flight at cutover" with audit trail proving no economic state changes during a swap.

---

## Demo flow recap (5 minutes if all four deep-dives come up)

| Time | Surface | Talking point |
|---|---|---|
| 0:00–0:30 | Slide 14 + issuer-portal Token Model | Token is a Daml template instance; stakeholders + choices + off-ledger split |
| 0:30–1:30 | Slide 15 + admin /composability | Composability moves up the stack; "bring parties to the contract" |
| 1:30–3:00 | Slide 16 + ops-console /health | 8 services + 5 portals on Railway; one composite health roll-up |
| 3:00–4:30 | Slide 17 + admin /projections | Ledger truth, read-model speed; per-projection lag observable; idempotent replay |
| 4:30–5:00 | Slide 13 (trade-offs/roadmap) | What's deliberately deferred; what unblocks next |

If the interviewer goes deeper on any topic, slide-13 + the deep-dive deferral line for that topic is the disciplined fallback.
