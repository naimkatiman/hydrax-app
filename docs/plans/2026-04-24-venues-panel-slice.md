# Plan — Venues Panel Drill-Down Slice

- **Date:** 2026-04-24
- **Status:** locked, ready to implement
- **Predecessor slice:** Orders workbench drill-down (2026-04-23)
- **Parent docs:** [docs/prd-v2.md](../prd-v2.md), [STATE.yaml](../../STATE.yaml)

---

## 1. Why this slice, why now

The Orders workbench established the operator drill-down pattern: selectable rows, a detail rail, rationale + fallback in one surface. Venues is the next product surface that pattern maps onto cleanly.

Against PRD v2:
- Reinforces the **issuer + ops primary persona** stance (§5) — operators need venue-lens visibility, not just order-lens.
- Strengthens the **audit-grade evidence** loop (§4, §11) — venue rationale and failover readiness become inspectable, not tribal knowledge.
- Keeps the frontend prototype aligned with the **workflow + experience layer** role (§8) — no ledger logic, all operator UX.

This is prototype code (`index.html` + `app.js` + `styles.css`), not v1 build. It hardens the UX patterns the issuer-portal and ops-console shells will inherit.

---

## 2. Scope — what ships in this slice

A venue-lane drill-down that mirrors the orders pattern, with these seven surfaces:

1. **Selectable venue rows** — the venues panel renders a table-of-venues (not just the pill list). Each row is keyboard-focusable, click-selectable, and carries a persisted selection key.
2. **Detail-driven operator rail** — on selection, the right rail swaps into a venue-detail card (reusing `.detail-shell` / `.detail-card`) showing state, primary role, operator notes.
3. **Load visibility** — each venue surfaces current load metrics (queue depth, fill quality indicator, posture label) derived from the existing `venues` fixture — extend the fixture if a field is missing, do not invent runtime values.
4. **Routed order links** — the selected venue's detail rail lists orders currently routed through it, linking to the orders lane (clicking an order switches to the orders panel with that row pre-selected).
5. **Failover readiness** — each venue declares its fallback venue and readiness state (armed / degraded / unavailable). Rendered in the detail rail.
6. **Venue rationale** — each venue has a one-line operator rationale ("why this venue is in the route book today") stored in the fixture and displayed in the detail rail.
7. **Panel summaries that switch when the venues lane is active** — the workspace header summary, active-lane pill, and hero counts reflect venue-mode context (e.g. "3 of 9 venues degraded", "1 failover armed") rather than generic order-mode text.

---

## 3. Out of scope

- Real venue feeds (fixture-driven only)
- Venue admin / CRUD
- Multi-select or bulk actions
- Venue history / time-series charts
- Any Canton/Daml integration (this is prototype UX)
- Any change to the v1 services/ or web/apps/ scaffolding (handled in the prd-v2 v1 kickoff plan)

---

## 4. Fixture extension

Extend the existing unified `venues` fixture (the single source feeding hero count, nav count, venue-list, venue-health-list) with the following per-venue fields:

- `role` — `"primary" | "secondary" | "failover"`
- `load` — `{ queueDepth: number, fillQuality: "strong" | "fair" | "weak", posture: string }`
- `fallback` — `{ target: string, readiness: "armed" | "degraded" | "unavailable" }`
- `rationale` — short string, one sentence
- `routedOrderIds` — array of order ids currently routed through this venue (must cross-reference the orders fixture; derivation beats duplication where feasible)

If `routedOrderIds` can be derived from the orders fixture's `venue` field, do that instead of storing it twice.

---

## 5. DOM + module contract

- New panel body markup under `#panel-venues` with a `.venue-lane` table (mirroring `.order-lane`) and a `.detail-rail` host.
- Reuse `.detail-shell`, `.detail-card`, `.detail-meta` CSS primitives. Add only venue-specific classes where the orders pattern does not fit.
- New `renderVenueDetail(selected)` function, sibling to the existing `renderOrderDetail`.
- Selection state persisted to the same `hydrax.workspace.v1` localStorage namespace under a new key (`selectedVenueId`), with the same try/catch fallback discipline.
- Cross-panel linking: clicking a routed order id in the venue detail rail calls the existing orders-selection function and switches the active panel.

---

## 6. Acceptance checks (run before claiming done)

- `node --check app.js` passes.
- Every new `getElementById` / `querySelector` has a matching id/class in `index.html`.
- Every new CSS class used in JS is declared in `styles.css`.
- Hero + nav + lane summary counts all derive from the same `venues` fixture — no hardcoded duplicates.
- Selecting a venue, reloading the page, returning to the venues panel restores the same selection (localStorage round-trip).
- Clicking a routed order id in the venue detail rail lands on the orders panel with that order selected.
- Keyboard: venue rows reachable via Tab, selectable via Enter/Space, same a11y contract as order rows.
- Panel summary text changes when the active lane is venues vs orders (visual diff verifiable).

Record each check in `STATE.yaml` `verification_log` with the date.

---

## 7. Commit shape

Target: **one commit** — this is a single coherent prototype slice under the 15-file cap. If it grows beyond that, split as:

1. `feat(venues): fixture extension with role, load, fallback, rationale`
2. `feat(venues): venue-lane table with selectable rows`
3. `feat(venues): detail rail with rationale + failover + routed orders`
4. `feat(venues): panel summary context switch on active lane`

Do not mix venue work with unrelated cleanup. No drive-by edits to the orders workbench unless a shared primitive genuinely needs to move.

---

## 8. After this slice

Immediate successor candidates (not part of this slice — decide after):

- Extend drill-down to risk panel review-queue (accept / defer actions).
- Replace hardcoded arrays with a typed fixture module (prep for real data wiring).
- Begin v1 build kickoff plan once the four §14 gating questions in prd-v2 are resolved.

The v1 build itself remains blocked on prd-v2 §14 Q1/Q3/Q4/Q7. This slice does not unblock that work; it only tightens the UX pattern library those shells will inherit.
