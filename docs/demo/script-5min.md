# HydraX — 5-Minute Video Script

**Total runtime:** 5:00 at ~150 wpm
**Audience:** Canton / HydraX stakeholders, institutional desk, internal review
**Companion deck (slim, video-paced):** [video-deck.html](video-deck.html)
**Companion deck (deep, full detail):** [canton-interview.html](canton-interview.html)
**Shot list:** [shot-list.md](shot-list.md)

---

## Segment 1 — Positioning (00:00 → 00:30)

**On screen:** `video-deck.html` slide 1 — "Workflow layer for institutional tokenization"
**Deep-deck anchor:** `canton-interview.html#slide-0` (cover) and `#slide-1` (positioning)

> HydraX is the regulated rails — tokenization, custody, trading. What's missing above those rails is the institutional workflow layer: onboarding, issuance, subscription, approvals, audit. We are building that layer. Canton-aligned, privacy-preserving, multi-party. Not a competing exchange. Not a custody system. Not another DeFi front end. The control room above the rails.

---

## Segment 2 — The Wedge (00:30 → 01:15)

**On screen:** `video-deck.html` slide 2 — "First wedge: issuance + subscription servicing"
**Deep-deck anchor:** `canton-interview.html#slide-2` (PRD scope), `#slide-3` (wedge)

> The first wedge is institutional onboarding plus issuance plus subscription servicing for tokenized products. One workspace shared across issuer, distributor, investor, and operator — each role sees what their role is allowed to see, and only that. Tenant isolation and least-privilege from day one. Today institutions stitch this workflow across email, spreadsheets, and bilateral PDFs. We replace that surface with a single command-room UI, with a Daml-anchored audit trail underneath, so every state change is provable, attributable, and replayable.

---

## Segment 3 — Live Walkthrough (01:15 → 03:30)

### 3a — Open the workspace (01:15 → 01:35)

**On screen:** `index.html` landing → click `#openDashboardHero` → scroll to `#workspace`
**Deep-deck anchor:** `canton-interview.html#slide-4` (operator console)

> Here is the operator console. Top — system view, mode, drift, primary venue. Below — the operator workspace. Six lanes: orders, positions, venues, risk, settings, activity. Single surface, role-aware, white-labelable per tenant.

### 3b — Orders + drill-down (01:35 → 02:05)

**On screen:** `data-panel="orders"` is active → click a row → `#orderDetail` rail expands
**Deep-deck anchor:** `canton-interview.html#slide-5`

> Orders panel. Sortable by id, venue, mode, exposure, status. Pick a row — the detail rail opens with the route's venue mix, operator rationale, and fallback sequencing. Every venue name is a cross-link; clicking it jumps to that venue's record in the venues panel. The console is built so an operator can trace any decision in two clicks.

### 3c — Mode change + state cycle (02:05 → 02:35)

**On screen:** click `#cycleMode` (System View) → click `#cycleState` (workspace toolbar)
**Deep-deck anchor:** `canton-interview.html#slide-5`

> Mode change. Watch the routing posture flip — Balanced Sweep, Latency Shield, Inventory Protect — and the drift recompute. Now state cycle. The same panel handles loading skeletons, the populated ready state, and an empty filtered state, with no layout jump. This is the pattern every workflow surface in HydraX inherits.

### 3d — Cross-panel jump + risk (02:35 → 03:05)

**On screen:** in orders detail click a venue cross-link → lands on `data-panel="venues"` → click `data-panel="risk"`
**Deep-deck anchor:** `canton-interview.html#slide-6`

> Cross-panel jump — orders to venues, one click, deep-linked. Risk lane. Operator review queue with severity, venue, time, status. Accept or defer is one keystroke. Every action is logged.

### 3d — Activity persistence (03:05 → 03:30)

**On screen:** `data-panel="activity"` → reload page → log persists
**Deep-deck anchor:** `canton-interview.html#slide-6`

> Activity log. Every panel switch, every filter change, every risk decision is recorded. Persisted across sessions in versioned local storage during prototype phase, audit-svc-backed in v1. This is the audit trail an institutional ops desk actually needs.

---

## Segment 4 — Architecture (03:30 → 04:15)

**On screen:** `video-deck.html` slide 3 — services + portals diagram
**Deep-deck anchor:** `canton-interview.html#slide-7`

> Under the surface — nine backend services. Five Go services for performance-critical workflow, approval, audit, HydraX adapter, Canton adapter. Three Node services for notifications, integrations, and a BFF that aggregates for React. Plus market-data-svc for quotes and FX. Five role-aware portals on top: issuer, distributor, investor, ops console, admin. Tenant theming via CSS variables. Lucide icons only — no emoji. Postgres for relational truth, Mongo for tenant-flexible payloads, Daml as the shared multi-party ledger. Browsers never call Daml directly — adapters mediate.

---

## Segment 5 — Roadmap & Open Questions (04:15 → 04:45)

**On screen:** `video-deck.html` slide 4 — Q1 / Q3 / Q4 / Q7 status
**Deep-deck anchor:** `canton-interview.html#slide-8`

> Four open questions from the PRD. Q1 — HydraX rails API surface. Mocked adapter behind a stable interface, now covering issue, subscribe, transfer custody, settle, and NAV. Q3 — first product type. Short-duration credit FSM is wired in workflow-svc. Q4 — first tenant persona. Q7 — pricing model. Decision memos for both in the repo, Q7 recommends a hybrid setup-plus-platform-plus-volume model. None block the workflow stack from shipping.

---

## Segment 6 — Close (04:45 → 05:00)

**On screen:** `video-deck.html` slide 5 — ask + contact
**Deep-deck anchor:** `canton-interview.html#slide-8`

> What we are asking for: validation of the wedge, alignment on the open questions, and a working session on the HydraX adapter contract. Workflow-layer code is moving. The rails are yours. Let's connect them.

---

## Live URL inventory (verified 2026-04-27)

- **Institutional landing + 5 portals (production):** [hydrax-portals-production.up.railway.app](https://hydrax-portals-production.up.railway.app/) — use this for executive-facing demos.
- **Canton homework cover + deck + script bundle:** [hydrax-context-production.up.railway.app](https://hydrax-context-production.up.railway.app/) — pairs with this script's narrative directly. **Status:** currently regressed (serving the operator-prototype landing on every route); see [docs/plans/2026-04-27-demo-prep-codebase-sync.md](../plans/2026-04-27-demo-prep-codebase-sync.md) for the fix runbook.
- **Bare original prototype:** [hydrax-prototype-production.up.railway.app](https://hydrax-prototype-production.up.railway.app/) — historical reference; `index.html` element ids in this script point at the same prototype source.

---

## Verification (recorded 2026-04-26, refreshed 2026-04-27)

- **Spoken-word count:** 527 words across the blockquoted narration. With screen-action dwells in Segment 3 (avg ~95 wpm) and talking-head pacing in Segments 1, 2, 4, 5, 6 (105–135 wpm), this fits 5:00. The 700–800 target in the plan doc assumed pure-narration; the demo segment is intentionally lower wpm.
- **Timestamps:** monotonic 00:00 → 00:30 → 01:15 → 01:35 → 02:05 → 02:35 → 03:05 → 03:30 → 04:15 → 04:45 → 05:00.
- **Slide refs:** all 9 `#slide-N` resolve to existing ids in `canton-interview.html`.
- **Element refs:** `#openDashboardHero`, `#cycleMode`, `#cycleState`, `#orderDetail`, `#workspace`, plus `data-panel="orders|venues|risk|activity"` — all resolve in `index.html` / `app.js` (verified by grep).
