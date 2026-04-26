# HydraX × Canton — 5-Minute Script (9-Slide Walkthrough)

**Source deck:** [canton-interview.html](canton-interview.html) — slide-0 … slide-8
**Total runtime:** 5:00 at conversational pace (~130 wpm with screen-pause allowance)
**One paragraph per slide.** Read each paragraph on its slide; advance on the natural break.

---

## Slide 0 — Cover (00:00 → 00:25)

**Anchor:** [#slide-0](canton-interview.html#slide-0) — "Canton Network + the layer above it"

> Hello, I'm Naim. Over the last few weeks I've built a workflow platform for institutional tokenisation that sits on top of HydraX's regulated rails and a Canton synchronizer. Thesis in one sentence: Canton owns the shared truth, we own the path that gets there. It's live on Railway, five Daml scripts run green.

---

## Slide 1 — The Thesis (00:25 → 01:00)

**Anchor:** [#slide-1](canton-interview.html#slide-1) — "Canton owns the rails. We own the layer above."

> The whole presentation hangs on this slide. Clean trust boundary down the middle. On the left, Canton — multi-party truth on Daml, sub-transaction privacy, atomic cross-institution commits. On the right, the application layer — five role-scoped React portals, workflow state machines with SLA timers, approval ceremonies that gate on-chain commands, plus notification, KYC, and audit fabric. The browser never holds rails credentials.

---

## Slide 2 — Three Canton Primitives (01:00 → 01:30)

**Anchor:** [#slide-2](canton-interview.html#slide-2) — "Canton in three primitives"

> Why Canton. Three primitives. First, selective disclosure — signatories see full state, observers get a scoped view, no global state. Privacy by design, the way regulated finance actually needs it. Second, atomic interop — trade and settlement commit together across domains, all-or-nothing, no reconciliation glue between institutions. Third, multi-party coordination — issuer, distributor, custodian, regulator each get authorisation rules enforced by the contract itself.

---

## Slide 3 — How Canton Is Wired (01:30 → 02:00)

**Anchor:** [#slide-3](canton-interview.html#slide-3) — "How Canton is wired"

> Quick wiring diagram. Four layers. Top — the application, our portals and orchestration. Below, participant nodes — each institution runs one, holding its private slice. Below that, the synchronizer — Canton's sequencing fabric, the thing that orders multi-party commits. Underneath, Daml — the contract language and runtime. Commands flow down, events flow back up. Our code only ever talks to the participant node.

---

## Slide 4 — Boundary: Canton vs Application (02:00 → 02:30)

**Anchor:** [#slide-4](canton-interview.html#slide-4) — "Where Canton stops vs what the app must do"

> The boundary slide — load-bearing. Canton handles shared truth, atomic transitions, signatory disclosure, multi-party authorisation. Canton does not handle SLA timers, retry policy, human approvals with escalation, KYC pipelines, audit outside the ledger, role-aware UI, or notifications. Every one of those is on the app side. Put SLA logic inside Daml and you regret it within a week. Recreate Canton's commits in your app and you regret it forever.

---

## Slide 5 — Three Planes Above the Rails (02:30 → 03:05)

**Anchor:** [#slide-5](canton-interview.html#slide-5) — "Three planes above the rails"

> Above the rails, three planes. Plane one, rails. Two adapters — hydrax-adapter and canton-adapter — translate domain commands into HydraX REST calls and Daml commands. The hydrax-adapter mock now covers issue, subscribe, transfer custody, settle, and NAV. The canton-adapter ships an in-memory ledger with parties, commands, and event polling. Plane two, orchestration. Nine Go and Node services — workflow, approval, audit, notify, integration, BFF, market-data, plus the two adapters — each owning one concern. Plane three, UX. Five React portals — issuer, distributor, investor, ops, admin — same component library, role-scoped at the route.

---

## Slide 6 — End-to-End Flow (03:05 → 03:55)

**Anchor:** [#slide-6](canton-interview.html#slide-6) — "One workflow across three planes"

> One workflow end-to-end. An investor opens the portal, submits a subscription. workflow-svc validates and forwards to approval-svc, which opens the ceremony, starts an SLA timer, routes to approvers. notify-svc fans out an email and a toast. The approver clicks accept; workflow-svc reads the lifecycle as approved and calls hydrax-adapter, which posts to the HydraX issuance endpoint. canton-adapter commits the Daml command on the synchronizer. The event flows back through audit-svc, the UI refreshes, the investor sees their subscription allocated. Submit to ledger — every state change provable, attributable, replayable. That's the whole product in one diagram.

---

## Slide 7 — Status (03:55 → 04:25)

**Anchor:** [#slide-7](canton-interview.html#slide-7) — "Status, grounded in commits"

> Status, grounded in commits. Five Daml scripts green. Nine backend services with health checks, persistence, per-service tests. Five React portals live across three Railway services — institutional landing, Canton homework site, original prototype. Auth substrate complete: passkeys, magic-link over SMTP, dev login removed. Subscription lifecycle and approvals persisted in Postgres. Q3 credit FSM wired. The mocked HydraX adapter is a deliberate bet — workflow ships now, real API drops in later.

---

## Slide 8 — Trade-offs and Roadmap (04:25 → 05:00)

**Anchor:** [#slide-8](canton-interview.html#slide-8) — "Trade-offs now, roadmap next"

> Trade-offs and roadmap. Today, scope is disciplined — single synchronizer, mocked rails, demo-mode portals, no secondary market UX. Right cut for v1. Next — ship portal auth UI, connect the real HydraX adapter when the API drops, harden audit-svc for institutional retention, start a pilot with a real issuer and distributor. Four open PRD questions: rails surface, product type, tenant persona, pricing. Decision memos exist for each. None block the stack. The rails are yours. The layer above is moving. Thank you.

---

## Verification

- **Spoken-word count target:** 600–680 across the nine blockquoted paragraphs (≈130 wpm baseline, 5:00 budget).
- **Timestamps:** monotonic 00:00 → 00:25 → 01:00 → 01:30 → 02:00 → 02:30 → 03:05 → 03:55 → 04:25 → 05:00. Slide-6 (the demo paragraph) gets the longest slot at 50s; slide-0 (cover) gets the tightest at 25s.
- **Slide refs:** every `#slide-N` resolves to an `id="slide-N"` in `canton-interview.html`.
- **Per-slide pacing:** target 130–150 wpm (slot/word budgets — slide-0 ≤55w, slide-1 ≤80w, slide-2 ≤70w, slide-3 ≤70w, slide-4 ≤70w, slide-5 ≤80w, slide-6 ≤120w, slide-7 ≤70w, slide-8 ≤80w).
