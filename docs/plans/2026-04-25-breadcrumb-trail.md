# Contextual Breadcrumb Trail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `<p class="panel-label">Dashboard view</p>` eyebrow in the workspace toolbar with a dynamic breadcrumb that always shows `Dashboard view › <Panel>` and appends `› <Selected item>` whenever a panel has a drill-down selection.

**Architecture:** Plain DOM node rewrite on every navigation change. A single `renderBreadcrumb()` function reads `activePanel` and the four existing `selected*Id` variables, resolves the item from the inline fixture arrays, and sets the breadcrumb container's `innerHTML`. The function is called from the five existing navigation entry points (`setActivePanel`, `selectOrder`, `selectVenue`, `selectRisk`, `selectPosition`) and from `resolveRisk` (which can clear `selectedRiskId` as a side effect). No new state, no new event listeners, no persistence changes.

**Tech Stack:** Vanilla DOM + CSS custom properties already in `:root` (`--muted`, `--accent`, `--text`, `--line-strong`).

**Scope:**
- IN: breadcrumb markup in toolbar, `renderBreadcrumb()` + 6 call sites, CSS rules matching the existing `.panel-label` eyebrow aesthetic, STATE.yaml verification log, one `feat(ui)` commit.
- OUT: clickable crumb segments (not in next_recommended_slice wording; defer as follow-up), persistence (nothing new to persist — all inputs are already persisted), breadcrumb for Settings or Activity panels (they have no selection concept; breadcrumb stays at `Dashboard view › <Panel>` for them), ARIA live-region announcement.

**Risk log:**
- Five `select*()` functions and one `resolveRisk()` can change selection state. Missing any call site leaves the breadcrumb stale. Task 4's integration step lists all six.
- The current static `<p class="panel-label">Dashboard view</p>` is replaced, not augmented. If any CSS rule targets `.workspace-toolbar > div > .panel-label` specifically, it would break — grep shows only the single uppercase-eyebrow rule at styles.css:137 which keys off `.panel-label` itself (we retain that class on other labels).

---

### Task 1: Add breadcrumb container to the toolbar

**Files:**
- Modify: `index.html:254`

- [ ] **Step 1: Replace the static eyebrow with the breadcrumb nav**

Before:
```html
                <div>
                  <p class="panel-label">Dashboard view</p>
                  <h3 id="panelTitle">Execution orders</h3>
                </div>
```

After:
```html
                <div>
                  <nav class="breadcrumb-trail" id="breadcrumbTrail" aria-label="Breadcrumb navigation">
                    <span class="crumb-root">Dashboard view</span>
                    <span class="crumb-sep" aria-hidden="true">›</span>
                    <span class="crumb-panel">Execution orders</span>
                  </nav>
                  <h3 id="panelTitle">Execution orders</h3>
                </div>
```

Rationale: The initial inner HTML matches what `renderBreadcrumb()` would output before any user interaction (panel = orders, no selection). This keeps the first paint identical to the post-JS state so there's no flicker.

- [ ] **Step 2: Verify one id, no ripple**

Run:
```bash
grep -c 'id="breadcrumbTrail"' index.html
grep -c 'class="panel-label"' index.html
```
Expected: `1` and `>=1` (other `.panel-label` uses elsewhere stay).

---

### Task 2: Add `renderBreadcrumb()` to `app.js`

**Files:**
- Modify: `app.js` (add element ref near other `getElementById` calls; add function near `renderFilterChips`)

- [ ] **Step 1: Add the element reference**

After line 318 (`const panelTitle = document.getElementById("panelTitle");`), add:

```javascript
const breadcrumbTrail = document.getElementById("breadcrumbTrail");
```

- [ ] **Step 2: Add `renderBreadcrumb()` immediately above `renderFilterChips()` (`app.js:~676`)**

```javascript
function selectedItemForPanel(panel) {
  if (panel === "orders" && selectedOrderId) {
    return orders.find((o) => o.id === selectedOrderId)?.id || null;
  }
  if (panel === "venues" && selectedVenueId) {
    return venues.find((v) => v.id === selectedVenueId)?.name || null;
  }
  if (panel === "risk" && selectedRiskId) {
    return riskAlerts.find((a) => a.id === selectedRiskId)?.id || null;
  }
  if (panel === "positions" && selectedPositionId) {
    return positions.find((p) => p.id === selectedPositionId)?.name || null;
  }
  return null;
}

function renderBreadcrumb() {
  if (!breadcrumbTrail) return;
  const panelName = panelTitles[activePanel] || "Workspace";
  const itemLabel = selectedItemForPanel(activePanel);

  let html =
    '<span class="crumb-root">Dashboard view</span>' +
    '<span class="crumb-sep" aria-hidden="true">›</span>' +
    '<span class="crumb-panel">' + panelName + '</span>';

  if (itemLabel) {
    html +=
      '<span class="crumb-sep" aria-hidden="true">›</span>' +
      '<span class="crumb-item">' + itemLabel + '</span>';
  }

  breadcrumbTrail.innerHTML = html;
}
```

- [ ] **Step 3: Verify syntax**

Run: `node --check app.js`
Expected: exit code 0.

---

### Task 3: Wire `renderBreadcrumb()` into the six navigation entry points

**Files:**
- Modify: `app.js` (`setActivePanel`, `selectOrder`, `selectVenue`, `selectRisk`, `selectPosition`, `resolveRisk`)

- [ ] **Step 1: `setActivePanel` (was app.js:1400)**

At the end of the function, before the closing brace, after `if (!skipLog) logActivity(...)`, add:
```javascript
  renderBreadcrumb();
```

- [ ] **Step 2: `selectOrder` (was app.js:621)**

At the end, after `if (selectedOrderId) logActivity(...)`, add:
```javascript
  renderBreadcrumb();
```

- [ ] **Step 3: `selectVenue` (was app.js:907)**

After the trailing `logActivity(...)` block, add:
```javascript
  renderBreadcrumb();
```

- [ ] **Step 4: `selectRisk` (was app.js:1091)**

After `if (selectedRiskId) logActivity(...)`, add:
```javascript
  renderBreadcrumb();
```

- [ ] **Step 5: `selectPosition` (was app.js:1267)**

After the trailing `logActivity(...)` block, add:
```javascript
  renderBreadcrumb();
```

- [ ] **Step 6: `resolveRisk`**

After the existing `renderRiskAlerts()` / `updateLaneSummary(...)` calls (it mutates `alert.status` which can shift filter-visibility but does NOT clear `selectedRiskId`; still calling `renderBreadcrumb()` keeps the breadcrumb current if the selection becomes filtered out), add:
```javascript
  renderBreadcrumb();
```

- [ ] **Step 7: Call `renderBreadcrumb()` once at the initial boot block**

The bottom of the file has a sequence like `renderVenues(); renderRiskAlerts(); renderPositions(); renderActivityLog(); updateNavCounts(); updateWorkspaceLivePill(); updateMode(); setActivePanel(activePanel, true); ...`. `setActivePanel(activePanel, true)` already fires `renderBreadcrumb()` now (Task 3 Step 1), so no extra call is needed at boot — but verify Step 8.

- [ ] **Step 8: Verify all six entry points are hooked**

Run:
```bash
grep -n 'renderBreadcrumb()' app.js
```
Expected: exactly 6 call sites plus 1 definition line = 7 total matches.

Run: `node --check app.js` → exit 0.

---

### Task 4: Add CSS

**Files:**
- Modify: `styles.css` (append near `.panel-label` at styles.css:137 or at the end of the workspace-toolbar section)

- [ ] **Step 1: Append the breadcrumb rules**

```css
.breadcrumb-trail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px;
}

.crumb-root,
.crumb-sep,
.crumb-panel {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.72rem;
  color: var(--muted);
}

.crumb-panel {
  color: var(--text);
}

.crumb-sep {
  color: var(--line-strong);
  font-size: 0.85rem;
  letter-spacing: 0;
}

.crumb-item {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0;
  text-transform: none;
}
```

Rationale: the first three share the `.panel-label` eyebrow treatment so the breadcrumb reads as a natural evolution of the old static label. `.crumb-item` breaks out — normal case, heavier weight, accent color — because it's the one segment the user is drilling into right now.

- [ ] **Step 2: Verify the classes are declared once**

Run:
```bash
grep -cE '^\.(breadcrumb-trail|crumb-root|crumb-sep|crumb-panel|crumb-item)' styles.css
```
Expected: `5`.

---

### Task 5: Browser verification

**Files:** none

- [ ] **Step 1: Start the dev server**

Run (background): `python3 -m http.server 8000`

- [ ] **Step 2: Open `http://localhost:8000` and walk the cases**

Pass criteria:
- On load (orders panel, no selection): breadcrumb reads `Dashboard view › Execution orders`.
- Click any order row: breadcrumb becomes `Dashboard view › Execution orders › HX-2041` (the clicked id).
- Click the same order row again (deselect): breadcrumb reverts to `Dashboard view › Execution orders`.
- Press `3` (venues shortcut): breadcrumb becomes `Dashboard view › Venue health`. Click a venue: adds `› Singapore Nexus` (or whichever).
- Press `4` (risk), click an alert: `Dashboard view › Risk posture › RA-002`.
- Press `2` (positions), click a book: `Dashboard view › Position overview › Asia macro book`.
- Press `5` (settings) or `6` (activity): breadcrumb reads `Dashboard view › Workspace settings` or `Dashboard view › Activity log` with no third segment.
- `Accept` / `Defer` a risk alert while it is selected: breadcrumb updates cleanly (item may disappear if its status moves out of the active filter).

- [ ] **Step 3: Kill the dev server** (Ctrl-C or `pkill -f "python3 -m http.server 8000"`).

- [ ] **Step 4: On any failed case** — stop, debug, do not commit. Most likely cause: a missing `renderBreadcrumb()` call in one of the six entry points (re-run Task 3 Step 8 grep).

---

### Task 6: Update STATE.yaml and commit

**Files:**
- Modify: `STATE.yaml`
- Commit: `index.html`, `app.js`, `styles.css`, `STATE.yaml`

- [ ] **Step 1: Update STATE.yaml**

Update fields:
- `updated`: bump to current ISO timestamp.
- `summary`: "Contextual breadcrumb trail landed — toolbar eyebrow replaced with Dashboard view › Panel › Selected-item breadcrumb that updates on every navigation change."
- `current_focus`: replace the drill-down-primitive bullets with breadcrumb bullets (nav element, renderBreadcrumb function, six call sites wired, CSS uses existing tokens).
- `next_recommended_slice`: pick the next item — candidates the user may want: clickable crumb segments (item → clear selection, panel → switch panel), keyboard navigation within the breadcrumb, or a different slice entirely. Pending user direction, leave the previous value and let them pick.
- `roadmap_alignment.prototype_sequence`: append `- done — contextual breadcrumb trail (2026-04-25)` above the `next` line.
- `verification_log`: append a line in the existing format:
  ```
  2026-04-25 — breadcrumb trail: node --check app.js passes; 6 renderBreadcrumb() call sites + 1 definition in app.js; breadcrumbTrail id matched in HTML+JS; 5 new CSS classes declared (breadcrumb-trail, crumb-root, crumb-sep, crumb-panel, crumb-item); browser walk passes all 8 cases (orders/venues/risk/positions select+deselect, settings/activity no third segment, resolveRisk updates cleanly); wc -l index.html=<N> app.js=<N> styles.css=<N>; git diff --stat confirms 4 project files changed
  ```
  Fill in the three `<N>` values from `wc -l` before committing.

- [ ] **Step 2: Stage exact files**

Run: `git add index.html app.js styles.css STATE.yaml`

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(ui): add contextual breadcrumb trail to workspace toolbar

Replace the static "Dashboard view" eyebrow with a dynamic breadcrumb
that always shows "Dashboard view > <Panel name>" and appends
"> <Selected item>" whenever a drill-down is active. renderBreadcrumb()
is wired into setActivePanel, the four select* entry points, and
resolveRisk so the trail stays current through every navigation change.

Refs: docs/plans/2026-04-25-breadcrumb-trail.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Verify**

Run: `git log --oneline -1 && git show --stat HEAD`
Expected: 4 files changed, new head commit is `feat(ui): add contextual breadcrumb trail ...`.

---

## Self-Review

1. **Spec coverage:** `next_recommended_slice` wording is "show the current navigation path (panel > selected item) in the toolbar area, updating as the user drills into detail views." Covered: panel+item path ✓, toolbar placement ✓, updates on drill-down ✓.
2. **Placeholder scan:** All steps have concrete code, exact commands, and expected outputs. No `TBD`, no "handle edge cases".
3. **Type consistency:** `renderBreadcrumb`, `breadcrumbTrail`, `selectedItemForPanel` used consistently across definition + call sites. CSS class names (`.breadcrumb-trail`, `.crumb-root`, `.crumb-sep`, `.crumb-panel`, `.crumb-item`) match between HTML markup and styles.
