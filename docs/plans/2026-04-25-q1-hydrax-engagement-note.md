# Q1 Engagement Note — HydraX API Surface for Workflow-Layer Integration

> **Status:** DRAFT engagement note written autonomously under auto mode. Not sent. **The user has to forward it (or a derivative) to HydraX management/engineering to unblock PRD-v2 §14 Q1.** Override or rewrite freely; this is a starting point, not a final ask.
>
> **Not a build plan.** This is a Q1 unblock artifact. v1 keeps shipping against `services/hydrax-adapter`'s `MockRails` interface (per Decision 2026-04-25) until HydraX returns answers.

- **Date:** 2026-04-25
- **Resolves:** PRD-v2 §14 Q1 — HydraX API surface available for workflow-layer integration
- **Audience:** HydraX engineering lead + HydraX product/commercial owner
- **Sender (you):** Naim Katiman, hydrax-app workflow platform
- **Status of v1 build:** unblocked-on-our-side via `MockRails`; will swap when HydraX delivers a real surface

---

## 1. One-paragraph context

We are building `hydrax-app` — a white-label institutional workflow platform that sits **above** HydraX's tokenisation, custody, and trading rails. It owns onboarding, issuance launch, subscription servicing, approvals, audit, notifications. It does not compete with the rails — it is the operator-facing control plane that calls them. v1 wedge is institutional onboarding + issuance + subscription servicing for the first tokenised product (proposed: short-duration credit, see `docs/plans/2026-04-25-q3-default-short-duration-credit.md`). To finalise v1 scope, we need a confirmed read on the HydraX API surface we'll be calling.

## 2. The actual ask

A 30-minute working session and a written response to the eight questions in §3, in any form (Notion page, doc, or email). Outcome we need: **enough confirmed surface to delete `MockRails` from `services/hydrax-adapter` and replace it with a real client.**

## 3. Eight questions we need answered

### 3.1 Integration protocol
- Is the HydraX surface REST/JSON, gRPC, GraphQL, Daml-Ledger-API direct, or a mix?
- Recommendation we are designing against (overridable): REST + JSON over HTTPS for command submission, server-sent events or gRPC streaming for ledger events.

### 3.2 Tokenisation — issuing a product
- Endpoint or RPC for "issue tokenised product instance" (what we model today as `Rails.IssueProduct(ctx, IssueRequest{TenantID, ProductCode})`).
- Required vs optional input fields per product type (see Q3 default proposal for the v1 product shape).
- Synchronous result vs async with callback?
- Idempotency contract (idempotency key support, or do we dedupe on our side)?

### 3.3 Custody — lock / release / report
- Endpoints for: lock investor commitment, release on cancellation, report holdings per investor and per product.
- Authorization model: does HydraX hold the keys, or does the tenant?
- Multi-currency handling for stablecoin vs fiat-rail settlement.

### 3.4 Trading / settlement
- Subscription confirmation flow: do we submit "subscribe" through HydraX trading rails, or just record off-ledger and reconcile?
- Settlement instruction format and confirmation event.
- Failed-trade and reversal semantics.

### 3.5 Event stream
- How do we subscribe to lifecycle events (issuance live, subscription accepted, settlement confirmed, redemption due, redemption settled)?
- Delivery semantics: at-least-once, exactly-once, or fire-and-forget?
- Replay window if our consumer is down (hours, days, or "from genesis")?

### 3.6 Daml / Canton boundary
- Confirm: does HydraX expose Daml templates we participate in directly, or only an abstraction over them?
- If direct: which packages, which versions, how often do they upgrade?
- If abstraction: where is the contract documented?
- Single-synchronizer vs multi-domain assumption (PRD-v2 §15) — confirm v1 is single.

### 3.7 Sandbox + auth
- Sandbox / dev environment URL + credentials we can issue ourselves keys for.
- Auth model: per-tenant API key, OAuth client-credential, mTLS, or signed-JWT?
- Rate limits per environment.
- Test-data reset cadence.

### 3.8 SLA + commercial coupling
- Production SLA targets (uptime %, p99 latency for command submission, event-stream lag).
- Whether SLA is part of the same contract as Q7 pricing or separate.
- Incident notification channel.

## 4. What we have already built that this unblocks

- `services/hydrax-adapter` — Go service with `Rails` interface and `MockRails` impl. Replacing `MockRails` with a real `HydraXRailsClient` is a single-file change once §3 answers are in.
- `services/canton-adapter` — Go bridge alongside the Daml `hydrax-governance` spike. Becomes load-bearing once §3.6 confirms the Daml boundary.
- `services/workflow-svc`, `services/approval-svc`, `services/audit-svc` — orchestrate against the adapter interface. No change needed regardless of HydraX's answer.

## 5. What stays moving while we wait

- Frontend portals (`web/apps/`) — see `docs/plans/2026-04-25-web-monorepo-scaffold.md`.
- `market-data-svc` — see `docs/plans/2026-04-25-market-data-adapter.md`. Crypto + FX/commodities, no HydraX dependency.
- BFF + workflow definitions against `MockRails`. We will land the same workflow logic against the real rails when ready.

## 6. What we need by when

- Initial reply (acknowledgement + assigned point of contact): within 1 week of you forwarding this.
- Working session covering §3.1–§3.8: within 2 weeks.
- Sandbox access (§3.7): within 4 weeks.
- Production-shape API stability commitment (§3.8): before v1 first-tenant onboarding kickoff (target: TBD pending Q4 + Q7).

## 7. Worst-case fallback

If §3 returns "not yet defined" on more than half the items, we shrink v1 to the workflow-only slice (no rails calls, just operator workflows + audit + notifications) and re-scope rails integration for v1.5. We do not block v1 launch on rails — we publish what is ready and integrate as the surface lands.

## 8. What this note does NOT decide

- Q3 (first product template) — separate proposal, see `docs/plans/2026-04-25-q3-default-short-duration-credit.md`.
- Q4 (first tenant) — separate proposal, see `docs/plans/2026-04-25-q4-tenant-persona-shortlist.md`.
- Q7 (pricing) — separate proposal, see `docs/plans/2026-04-25-q7-pricing-model-options.md`.

## 9. User actions to actually unblock Q1

1. Read this doc end-to-end. Override anything that misrepresents intent.
2. Identify the right HydraX recipient (engineering lead AND commercial owner — both, not either).
3. Forward (verbatim or rewritten) and CC anyone HydraX-side who needs to be looped in.
4. Track the reply. When §3 answers come back, paste them into this file under a new `## 10. HydraX response` section and re-run `/proceed-with-claude-recommendation` on the resulting deltas.
5. Q1 is unblocked when sandbox access (§3.7) is in our hands.
