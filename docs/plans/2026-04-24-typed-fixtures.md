# Typed Fixture Module Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the four prototype fixture arrays (venues, orders, positions, riskAlerts) out of [app.js](../../app.js) into a new [data/fixtures.js](../../data/fixtures.js) module with JSDoc typedefs, loaded as a classic global before `app.js`.

**Architecture:** Static prototype has no bundler — ES modules would force `<script type="module">` and its CORS/caching quirks. Keep the classic-script model: `data/fixtures.js` exposes one global `window.HydraxFixtures = { venues, orders, positions, riskAlerts }` and is loaded by `<script>` before `app.js`. `app.js` destructures the four arrays from the global at the top, so the rest of the file is unchanged.

**Tech Stack:** Plain ES2020 JS (no TypeScript, no build tool). JSDoc typedefs for editor hints only.

**Scope:**
- IN: extract 4 fixture arrays, JSDoc typedefs for Venue / Order / Position / RiskAlert, load-order wiring, verification, STATE.yaml update, one focused commit.
- OUT: derived-count precomputation (deferred — many call sites filter on live state, each needs inspection). `modes`, `events`, `panelTitles`, `panelFilters` stay in `app.js` (they are UI config, not data fixtures). Storage-key version stays at `v1` (persisted shape unchanged).

**Risk log:**
- Fixture arrays are read-only today — verified via `grep -nE "(venues|orders|positions|riskAlerts)\.(push|splice|shift|unshift|pop)"` which returns zero hits. No mutation needs refactoring.
- Load order is the single failure mode — if `fixtures.js` loads after `app.js`, `const { venues } = window.HydraxFixtures` throws. Mitigation: task 3 places the `<script>` tag immediately before `app.js` and task 5 verifies in a browser.

---

### Task 1: Create `data/fixtures.js` with typedefs + venue array

**Files:**
- Create: `data/fixtures.js`

- [ ] **Step 1: Create the directory**

Run: `mkdir -p data`
Expected: directory `data/` exists (new).

- [ ] **Step 2: Write the module header with JSDoc typedefs and the venue fixture**

Copy the `venues` array verbatim from [app.js:1-92](../../app.js#L1-L92). Do not edit content.

```javascript
/**
 * Prototype fixture module — source of truth for the static workspace demo.
 * Loaded as a classic script before app.js. Exposes one global:
 *     window.HydraxFixtures = { venues, orders, positions, riskAlerts }
 *
 * @typedef {Object} VenueLoad
 * @property {number} queueDepth
 * @property {"strong"|"fair"|"weak"} fillQuality
 * @property {string} posture
 *
 * @typedef {Object} VenueFallback
 * @property {string} target
 * @property {"armed"|"degraded"|"unavailable"} readiness
 *
 * @typedef {Object} Venue
 * @property {string} id
 * @property {string} name
 * @property {"live"|"warm"} state
 * @property {string} uptime
 * @property {"primary"|"secondary"} role
 * @property {VenueLoad} load
 * @property {VenueFallback} fallback
 * @property {string} rationale
 */

/** @type {Venue[]} */
const venues = [
  {
    id: "sg-nexus",
    name: "Singapore Nexus",
    state: "live",
    uptime: "99.2%",
    role: "primary",
    load: { queueDepth: 1842, fillQuality: "strong", posture: "Balanced sweep" },
    fallback: { target: "Tokyo Arc", readiness: "armed" },
    rationale: "Deepest Asia-session book today, lowest adverse selection pressure across the primary cluster.",
  },
  // ... remaining 8 venues verbatim from app.js:12-91
];
```

- [ ] **Step 3: Run `node --check data/fixtures.js`**

Run: `node --check data/fixtures.js`
Expected: exit code 0, no output.

- [ ] **Step 4: No commit yet** — file is incomplete. Proceed to Task 2.

---

### Task 2: Add RiskAlert, Position, Order typedefs and arrays

**Files:**
- Modify: `data/fixtures.js` (append)

- [ ] **Step 1: Append RiskAlert typedef and array**

Copy the `riskAlerts` array verbatim from [app.js:94-143](../../app.js#L94-L143).

```javascript
/**
 * @typedef {Object} RiskAlert
 * @property {string} id
 * @property {string} type
 * @property {string} trigger
 * @property {"high"|"moderate"|"low"} severity
 * @property {"pending"|"accepted"|"deferred"} status
 * @property {string} venue
 * @property {string} timestamp
 * @property {string} rationale
 * @property {string} recommendation
 * @property {string} impact
 */

/** @type {RiskAlert[]} */
const riskAlerts = [
  // ... verbatim from app.js:95-142
];
```

- [ ] **Step 2: Append Position typedef and array**

Copy the `positions` array verbatim from [app.js:145-246](../../app.js#L145-L246).

```javascript
/**
 * @typedef {Object} PositionHolding
 * @property {string} name
 * @property {string} weight
 * @property {string} venue
 *
 * @typedef {Object} PositionVenueShare
 * @property {string} name
 * @property {string} share
 *
 * @typedef {Object} Position
 * @property {string} id
 * @property {string} name
 * @property {string} pnl
 * @property {string} exposure
 * @property {"active"|"watch"|"staged"} status
 * @property {number} instruments
 * @property {PositionHolding[]} topHoldings
 * @property {PositionVenueShare[]} venueAllocation
 * @property {string} rationale
 * @property {string} riskNote
 */

/** @type {Position[]} */
const positions = [
  // ... verbatim from app.js:146-245
];
```

- [ ] **Step 3: Append Order typedef and array**

Copy the `orders` array verbatim from [app.js:276-380](../../app.js#L276-L380).

```javascript
/**
 * @typedef {Object} OrderVenueMix
 * @property {string} name
 * @property {string} share
 *
 * @typedef {Object} Order
 * @property {string} id
 * @property {string} venue
 * @property {string} mode
 * @property {string} exposure
 * @property {"live"|"review"|"queued"} status
 * @property {"Buy"|"Sell"} side
 * @property {string} instrument
 * @property {string} fillQuality
 * @property {string} slippage
 * @property {string} rationale
 * @property {OrderVenueMix[]} venueMix
 * @property {string} fallback
 */

/** @type {Order[]} */
const orders = [
  // ... verbatim from app.js:277-379
];
```

- [ ] **Step 4: Append the global export**

```javascript
if (typeof window !== "undefined") {
  window.HydraxFixtures = { venues, orders, positions, riskAlerts };
}
```

- [ ] **Step 5: Run `node --check data/fixtures.js`**

Run: `node --check data/fixtures.js`
Expected: exit code 0.

- [ ] **Step 6: Count records match source**

Run:
```bash
node -e 'const vm=require("vm"); const fs=require("fs"); const ctx={window:{}}; vm.createContext(ctx); vm.runInContext(fs.readFileSync("data/fixtures.js","utf8"),ctx); const f=ctx.window.HydraxFixtures; console.log("venues",f.venues.length,"orders",f.orders.length,"positions",f.positions.length,"riskAlerts",f.riskAlerts.length);'
```
Expected: `venues 9 orders 6 positions 5 riskAlerts 4`

- [ ] **Step 7: No commit yet** — app.js still has the duplicate arrays. Proceed to Task 3.

---

### Task 3: Wire `fixtures.js` into `index.html`

**Files:**
- Modify: `index.html:598`

- [ ] **Step 1: Add the script tag before `app.js`**

Before: [index.html:598](../../index.html#L598)
```html
    <script src="app.js"></script>
```

After:
```html
    <script src="data/fixtures.js"></script>
    <script src="app.js"></script>
```

- [ ] **Step 2: Verify HTML parses**

Run: `grep -c "data/fixtures.js" index.html`
Expected: `1`

Run: `grep -nE "fixtures\.js|app\.js" index.html`
Expected: fixtures.js line number is less than app.js line number (load order correct).

- [ ] **Step 3: No commit yet** — app.js still has duplicate arrays. Proceed to Task 4.

---

### Task 4: Remove duplicate fixture arrays from `app.js`

**Files:**
- Modify: `app.js:1-246` and `app.js:276-380`

- [ ] **Step 1: Replace `app.js:1-246` with a destructure block**

The block includes: `const venues = [...]` (line 1-92), blank line, `const riskAlerts = [...]` (94-143), blank line, `const positions = [...]` (145-246). Replace ALL of that (lines 1 through 246) with:

```javascript
const { venues, orders, positions, riskAlerts } = window.HydraxFixtures;
```

Note: `orders` moves up into this destructure even though its array lives later in app.js — we will delete that later array in Step 2.

- [ ] **Step 2: Delete the `orders` array declaration at the original `app.js:276-380`**

After Step 1 the line numbers have shifted. Find `const orders = [` and delete from that line through the matching `];` (inclusive). The surrounding context (`const events = [...]` above, `const panelTitles = {` below) stays.

- [ ] **Step 3: Run `node --check app.js`**

Run: `node --check app.js`
Expected: exit code 0.

- [ ] **Step 4: Verify no stray fixture definitions remain**

Run: `grep -nE "^const (venues|orders|positions|riskAlerts) = \[" app.js`
Expected: no matches.

Run: `grep -nE "window\.HydraxFixtures" app.js`
Expected: one match on the destructure line.

- [ ] **Step 5: Verify call sites still resolve**

Run: `grep -c "venues\." app.js; grep -c "orders\." app.js; grep -c "positions\." app.js; grep -c "riskAlerts\." app.js`
Expected: each count is ≥ 1 (call sites intact). Compare to pre-refactor baseline (captured before Task 1):
```
venues.   — X
orders.   — X
positions. — X
riskAlerts. — X
```

- [ ] **Step 6: No commit yet** — verification in browser pending. Proceed to Task 5.

---

### Task 5: Browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `python3 -m http.server 8000` (background)
Expected: server listens on 8000.

- [ ] **Step 2: Load `http://localhost:8000` and manually check**

Pass criteria:
- Page loads without console errors.
- Orders panel shows 6 rows.
- Venues panel shows 9 rows.
- Positions panel shows 5 rows.
- Risk panel shows 4 rows.
- Nav count pills match: orders count, venues count, risk pending count, positions count.
- Clicking an order / venue / position / risk row still opens its drill-down.
- localStorage key `hydrax.workspace.v1` still persists active panel on reload.

- [ ] **Step 3: Kill the dev server**

Run: `pkill -f "python3 -m http.server 8000"` (or Ctrl-C)

- [ ] **Step 4: If any row count or drill-down fails** — stop, debug, do not commit. Most likely cause: load-order mistake in `index.html` or a typo in the destructure.

---

### Task 6: Update STATE.yaml and commit

**Files:**
- Modify: `STATE.yaml`
- Commit: `data/fixtures.js`, `app.js`, `index.html`, `STATE.yaml`

- [ ] **Step 1: Update STATE.yaml**

Update these fields in [STATE.yaml](../../STATE.yaml):
- `updated`: bump to current ISO timestamp.
- `summary`: "Typed fixture module landed — venues, orders, positions, riskAlerts moved to data/fixtures.js with JSDoc typedefs, loaded as a classic global before app.js."
- `current_focus`: replace sortable-columns bullets with the typed-fixtures bullets (module created, JSDoc typedefs, global exposure, app.js destructures).
- `next_actions`: remove "Typed fixture module extraction", leave "Extract the repeated drill-down shell into a shared workbench primitive" as the new top item.
- `next_recommended_slice`: "Extract the repeated drill-down shell into a shared workbench primitive."
- `roadmap_alignment.prototype_sequence`: add `done — typed fixture module extraction (2026-04-24)` above the `next` line. Update the `next` line to reference the drill-down primitive.
- `verification_log`: append a line in the existing format (see CLAUDE.md "STATE.yaml verification_log entry format"):
  ```
  2026-04-24 — typed fixtures: node --check app.js passes; node --check data/fixtures.js passes; window.HydraxFixtures record counts match (9 venues / 6 orders / 5 positions / 4 riskAlerts); browser loads, all 4 panels render, drill-downs and localStorage persistence intact; wc -l data/fixtures.js=<N> app.js=<N> index.html=601 styles.css=1915; git diff --stat confirms 4 files changed
  ```

Fill in the two `<N>` values from `wc -l` output before committing.

- [ ] **Step 2: Stage exact files (never `git add -A`)**

Run: `git add data/fixtures.js app.js index.html STATE.yaml`
Expected: `git status` shows those four files staged, nothing else.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor(data): extract typed fixtures to data/fixtures.js

Move venues, orders, positions, riskAlerts out of app.js into
data/fixtures.js with JSDoc typedefs. Loaded as a classic global
(window.HydraxFixtures) before app.js; app.js destructures the four
arrays at the top so every existing call site still resolves.

Derived counts remain inline in app.js — most depend on filter state
and need per-site inspection, deferred as a follow-up slice.

Refs: docs/plans/2026-04-24-typed-fixtures.md
EOF
)"
```

- [ ] **Step 4: Verify commit**

Run: `git log --oneline -1 && git show --stat HEAD`
Expected: 4 files changed, new head commit is `refactor(data): ...`.

---

## Self-Review

1. **Spec coverage:** STATE.yaml `next_recommended_slice` says "consolidate venue, order, position, risk data into a structured data layer with derived counts." This plan covers the consolidation + structure (typedefs) but defers derived counts. That gap is called out in **Scope → OUT** and logged as the next slice in Task 6 Step 1. OK.
2. **Placeholder scan:** Task 2 Steps 1–3 use `// ... verbatim from app.js:X-Y` as a deliberate instruction to copy from a cited source, not a placeholder for "figure it out later". All other steps have exact code or exact commands.
3. **Type consistency:** `window.HydraxFixtures` spelled the same in fixtures.js export (Task 2 Step 4), index.html load order (Task 3 Step 1), and app.js destructure (Task 4 Step 1). Typedef names (Venue, Order, Position, RiskAlert) used consistently.
