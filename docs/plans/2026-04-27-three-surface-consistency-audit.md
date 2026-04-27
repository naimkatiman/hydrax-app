# 3-Surface Consistency Audit — 2026-04-27

**Trigger:** user asked to audit three deployed surfaces and align them, then refresh the README.

**Surfaces in scope:**
- `https://hydrax-portals-production.up.railway.app/` — 5-portal marketing landing + the SPAs themselves
- `https://hydrax-context-production.up.railway.app/` — interview/homework cover page
- `https://hydrax-context-production.up.railway.app/deck` — 18-slide homework deck

## What an interviewer crossing all three sees today

| # | Inconsistency | Where | Severity |
|---|---|---|---|
| 1 | Context site CTA reads **"View 9-Slide Deck"** but `/deck` actually serves 18 slides | `docs/demo/site/index.html:49`, `:234` | factual error |
| 2 | Appendix A description on context site reads **"Thesis, three primitives, wiring, the gap, three planes, end-to-end flow, status, trade-offs"** — that's the OLD 9-slide alternate deck; primary `/deck` is now the 18-slide homework deck | `docs/demo/site/index.html:235` | factual error |
| 3 | Context site repeats **"8 services"** in 3 places; actual count is 9 (`market-data-svc` shipped after the deck content was authored) | `docs/demo/site/index.html:63,147,256` + `deck.html:1966,2443` + slide-16 h1 | factual drift |
| 4 | Portals landing has **zero links** back to the deck or context site — a one-way hop | `web/portal-deploy/index.html` | cross-surface gap |
| 5 | Deck has **zero clickable nav** back to the context landing — text mentions of the URL only, no link | `docs/demo/site/deck.html` | cross-surface gap |
| 6 | Context site links to portals landing but not the OTHER way — discovery is asymmetric | `docs/demo/site/index.html:28,131,142,246` (one direction) | cross-surface gap |
| 7 | Two narratives in flight: **"HydraX Workflow"** (live, marketing tone) vs **"HydraX Rail"** (working tree, parallel-session rebrand, unstaged) | `web/portal-deploy/index.html` (uncommitted) | governance — surface to user |
| 8 | README claims **deck is 14 slides** + Go/TS split is **"5 Go, 4 Node/TS"** | `README.md:55,162` | doc drift (actual: 18 slides + 6 Go / 3 Node) |
| 9 | README slide table only enumerates slides 0–13; slides 14–17 (deep-dives that landed 2026-04-26 per CLAUDE.md "Decisions") are unlisted | `README.md:168-181` | doc drift |
| 10 | Footer/copyright tone diverges: portals = "© 2026 HydraX Workflow. Built above the regulated rails of Hydra X Pte. Ltd." (sales) vs context = "Naim Katiman · April 2026 · Built for HydraX interview" (interview) | `web/portal-deploy/index.html:351` vs `docs/demo/site/index.html:265` | tone drift — by-design split, leave |

## What's actually consistent (don't relitigate)

- Color palette is the same dark + warm-stone accent across all three (`--hydrax-color-bg: hsl(0,0%,8%)` + accent `hsl(30,8%,72%)`).
- Typography stack is the same: Inter + IBM Plex/JetBrains Mono.
- Lucide-only icon mandate is honored on all three (no FontAwesome remnants since 2026-04-26 brand-alignment commit).
- Slide-deck content and slide IDs (`slide-0` through `slide-17`) match canonical source.
- The 5-portal grid + the 4 deep-dive surfaces enumerate the same destinations on both portals landing and context site.

## What this plan-doc changes

### Phase 1 — Context site factual fixes (`docs/demo/site/index.html`)
- "9-Slide" → "18-Slide" (2×)
- Appendix A copy: rewrite to match 18-slide structure (3 sections + 4 deep-dives + cover/close)
- "8 Services" / "8 services" → "9 Services" / "9 services" (3×)
- Backend-services card description: surface the 6 Go / 3 Node split with `market-data-svc` listed

### Phase 2 — Deck factual fixes (`docs/demo/site/deck.html`)
- "8 backend services" → "9 backend services" (line 1966)
- "8 services, 5 portals" → "9 services, 5 portals" (line 2443, slide-16 title)

### Phase 3 — Cross-surface linking
- Portals landing: add a top-nav link **"Architecture"** → `https://hydrax-context-production.up.railway.app/` (places it next to Solutions/Portals/Quickstart/Pricing/Docs/Contact). Target `_blank`.
- Deck: add a fixed-position **"← Context"** back-link in the chrome (top-left, next to the slide counter), targeting `/`.

### Phase 4 — README refresh
- Update Go/Node split: 5 Go / 4 Node/TS → 6 Go / 3 Node/TS.
- Update primary deck count: 14 → 18 slides; append rows for slides 14–17 with their actual h1 titles.
- Add a "Three deployed surfaces" snapshot table (portals / context / deck + URLs + what each one is).
- Add demo-mode disclosure (per `AUDIT-2026-04-27.md` Path B-demo).

### Phase 5 — Surface to user (no code change)
- The "HydraX Workflow" → "HydraX Rail" rebrand sitting unstaged in 5 files is left **untouched** per the past-mistake rule about parallel-session edits. The user picks: deploy "HydraX Rail" (run the rebrand to completion) or revert to "HydraX Workflow".

## Out of scope

- The 4 missing deep-dive slides (14–17) in `docs/demo/site/deck.html` — already synced per commit `30ee170` per CLAUDE.md.
- Portal SPA content (issuer/distributor/investor/ops/admin internal routes) — not a surface the user named.
- Real BFF deployment — separate Path B in `AUDIT-2026-04-27.md`.
- The `/canton-interview` 9-slide alternate deck — kept for reference per README.

## Verification gates

- `node --check` on all touched HTML files (none — all `.html` and `.md`).
- `wc -l` per touched file before/after.
- `git diff --stat` confirms exactly 4 files changed (context/index, deck.html, portal-deploy/index, README.md) plus this plan-doc and audit summary.
- Live curl spot-check after deploy: titles + key string assertions.
- STATE.yaml `verification_log` line.

## Files touched

- `docs/demo/site/index.html` — phase 1 + phase 3 (deck back-link if added on the context side too is not required; deck owns its own chrome).
- `docs/demo/site/deck.html` — phase 2 + phase 3.
- `docs/demo/canton-homework-deck.html` — phase 2 mirror (canonical source) so re-deploys don't regress.
- `web/portal-deploy/index.html` — phase 3 (single nav link addition).
- `README.md` — phase 4.
- `docs/plans/2026-04-27-three-surface-consistency-audit.md` — this file.
- `STATE.yaml` — verification log line (append, do not overwrite per parallel-session rule).
