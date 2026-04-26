# Plan — Demo Prep Codebase Sync

**Date:** 2026-04-27
**Owner:** Naim
**Skill:** `proceed-with-claude-recommendation` (orchestrator) + inline doc fallback
**Scope:** Bring `docs/demo/` materials and the deployed `docs/demo/site/` bundle in sync with the actual codebase as of today. No service code changes, no schema, no new dependencies.

## Why now

User asked: "based on update codebase u need to update too." The demo script + shot list + slim deck were authored 2026-04-26 against a snapshot that has since drifted. Pre-flight verification on 2026-04-27 surfaced concrete drift and one production regression.

## Drift audit (verified 2026-04-27)

| Demo claim | Reality | Source of truth |
|---|---|---|
| "Eight backend services" | **Nine** services on disk | `ls -d services/*/` → approval-svc, audit-svc, bff, canton-adapter, hydrax-adapter, integration-svc, **market-data-svc** (was missing), notify-svc, workflow-svc |
| "Five Daml scripts run green" | Accurate | 5 `Script ()` declarations in `services/canton-adapter/daml/hydrax-governance/daml/Test/GovernanceScript.daml` (testHappyPath, testUnauthorizedApprover, testDoubleApproval, testRejectBlocksExecute, testInterfaceView) |
| "Magic-link auth wired through SMTP" | Accurate but understated | Auth substrate is **complete through slice 2e** (passkeys 2a + magic-link 2b + SMTP 2c + AUTH_DEV_LOGIN removed 2e). Production passwordless login is now the only path. Slice 2d (portal UI) is the next bottleneck. |
| "Subscription lifecycle and approval persistence land this week" | Both **landed** 2026-04-26 | sublifecycle FSM commit 8038f66, approvals Postgres commits 1d5a5ae/45f2e9f/e01c05b/221d5fc/230bef8, audit emission on Transition commit 98a688d |
| "Mocked HydraX adapter" | Accurate but expanded | hydrax-adapter Rails interface now includes Subscribe + TransferCustody + Settle + NAV (commit b67cd74). canton-adapter has an in-memory ledger with parties + commands + events HTTP (commit d1e9879). 31 hydrax-adapter tests, 23 canton-adapter tests. |
| "First product type — short-duration credit, 30 to 180 day tenor (proposed)" | Accurate but advanced | Pure-logic Q3 credit FSM landed in `services/workflow-svc/internal/credit` (commit c8a2daa) with 12 legal edges + 6 negative cases. Q7 decision memo also complete (recommends Option D hybrid). |
| Live URLs (implicit single Railway target) | **Three** Railway services | `hydrax-portals-production.up.railway.app` (institutional landing + 5 portals), `hydrax-context-production.up.railway.app` (Canton homework cover/deck/script bundle), `hydrax-prototype-production.up.railway.app` (bare original prototype) |

## Production regression (discovered during pre-flight)

`hydrax-context-production.up.railway.app` is serving the **operator-prototype landing** at every route (`/`, `/deck`, `/script`, `/interview`) — title `HydraX | Adaptive Liquidity Command` — instead of the Canton homework cover.

- **Source files in `docs/demo/site/` are correct** — `index.html` title is `Canton Network — and the layer above it · Naim Katiman`, `script.html` and `deck.html` carry their right contents.
- **The deploy is wrong**, not the source.
- **Root cause:** STATE.yaml line 66 documents the exact failure mode — `railway up` from a subdirectory uploads the workspace root unless `--path-as-root .` is supplied. A subsequent deploy (origin TBD — possibly a parallel session) appears to have shipped the wrong tree.
- **Fix:** `cd docs/demo/site && railway up --path-as-root . --service hydrax-context --detach`. Requires explicit user authorization phrase (`deploy hydrax-context — approved` or equivalent) per CLAUDE.md auto-mode deploy guard.

## Deliverables (in order)

### 1. Plan doc (this file) — `docs/plans/2026-04-27-demo-prep-codebase-sync.md`
- Status: writing.

### 2. `docs/demo/script-canton-9slides-5min.md`
- WILL update: slide 5 service-count "seven" → enumerate the actual 9 services (5 Go + 3 Node + market-data-svc); slide 7 status — auth substrate complete through 2e (no dev login), mock canton testnet exists, hydrax-adapter expanded with Subscribe/TransferCustody/Settle/NAV, Q3 FSM landed, 3-tier Railway URL inventory; slide 8 roadmap — slice 2d portal auth UI is the next bottleneck.
- Will NOT change: timestamps, slide-id anchors, paragraph structure, total word count budget (~625 words).
- Verification: word count 600-680; slide refs still resolve; per-slide pacing in band 110-160 wpm.

### 3. `docs/demo/script-5min.md`
- WILL update: Segment 4 "eight backend services" → 9 with the new market-data-svc; Segment 5 Q-status — Q1 deferred-not-resolved with mock now expanded, Q3 FSM landed, Q4 shortlist memo, Q7 decision memo (Option D); add a footer URL inventory (3-tier).
- Will NOT change: Segment timestamps, walkthrough sub-segments, prototype element refs.
- Verification: spoken-word count under 800; element refs still resolve in `index.html`.

### 4. `docs/demo/shot-list.md`
- WILL update: preamble "Recording setup" — note that production landing is `hydrax-portals-production.up.railway.app` (use this for executive-facing demos), bare prototype lives at `hydrax-prototype-production.up.railway.app` (use only if showing the operator-console fixture data), Canton bundle at `hydrax-context-production.up.railway.app` (currently regressed — see plan doc).
- Will NOT change: shot table, element-id anchors, recording gotchas.
- Verification: anchor refs still resolve.

### 5. `docs/demo/video-deck.html`
- WILL update: slide 3 architecture — services count and the 9-service list (add market-data-svc); slide 4 Q-status — Q3 status `Proposed` → `FSM landed`, optionally add slice-2d as a fifth open thread.
- Will NOT change: slide structure, timestamps, slide-id anchors `#vd-slide-1` … `#vd-slide-5`.
- Verification: 5 sections still present, balanced markup, slide ids unchanged.

### 6. `docs/demo/site/script.html`
- WILL update: replace the rendered operator-console-walkthrough script with the canton-deck-anchored 9-slide script (which actually matches `/deck` on the same site). Preserve the existing site styling, topnav, and layout — only the body content changes.
- Will NOT change: site styling, topnav, package.json, serve.json, Railway config.
- Verification: file parses as HTML; site/index.html → site/script.html topnav still works locally; preserves the 9 paragraphs (one per slide).
- **Deploy not in scope of this plan** — landing the file change is item 6; the redeploy is item 7 below and is gated.

### 7. **HALT** — surface hydrax-context regression and require user authorization
- Source fix has been ready in `docs/demo/site/index.html` since 2026-04-26. Live deploy is wrong.
- Required authorization phrase: `deploy hydrax-context — approved` (or equivalent named phrase).
- This plan does NOT trigger the redeploy. Item 7 is a documented stop, not a step.

### 8. STATE.yaml verification log line.

## Tagging

| # | Item | Tag | Routed to |
|---|---|---|---|
| 1 | Plan doc | `safe` | inline |
| 2 | canton 9-slide script | `safe` | inline |
| 3 | operator-console script | `safe` | inline |
| 4 | shot list | `safe` | inline |
| 5 | video deck | `safe` | inline |
| 6 | site/script.html | `safe` | inline |
| 7 | hydrax-context redeploy | **`needs-approval`** | **STOP — user phrase required** |
| 8 | STATE.yaml | `safe` | inline |

## Out of scope (deferred)

- Recording the actual video (separate user-only step).
- Updating `canton-interview.html` or `canton-homework-deck.html` slide content (large decks, separate slice if needed — slide-7 status block in canton-interview.html may also drift; flag for follow-up).
- Mirroring updates into `docs/demo/site/index.html` cover article (the cover is current — only the script page is stale).
- The hydrax-context redeploy itself.
- The pricing mockup section in `web/portal-deploy/index.html` (working tree only per STATE line 67 — separate authorization required).

## Commit gate

If user requests a commit after items 2-6 + 8 land, this is **one commit** under the single concern "demo prep codebase sync":

```
docs(demo): sync demo prep with current codebase

Plan: docs/plans/2026-04-27-demo-prep-codebase-sync.md
```

Plan doc + 5 demo updates + 1 site mirror + STATE = 8 files; under the 15-file cap; one concern (demo materials).

## Verification log (filled during execution)

- [x] (1) plan doc written
- [ ] (2) canton 9-slide script — word count + slide refs + pacing
- [ ] (3) operator-console script — word count + element refs
- [ ] (4) shot list — element-id refs still resolve
- [ ] (5) video deck — 5 sections + balanced markup
- [ ] (6) site/script.html — HTML parse + 9 paragraphs
- [ ] STATE.yaml entry appended
