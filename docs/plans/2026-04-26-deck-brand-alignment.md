# Plan — Canton demo deck brand alignment

**Date:** 2026-04-26
**Author:** session-driven (audit follow-up)
**Status:** awaiting user decision on Q1 (canton-teal disposition)
**Scope:** [docs/demo/canton-interview.html](../demo/canton-interview.html), [docs/demo/canton-homework-deck.html](../demo/canton-homework-deck.html)
**Driven by:** cross-portal + deck audit on 2026-04-26 (this session). Audit concluded the two decks are cohesive with each other but **alienated from the portal design system**: competing accent (teal vs warm-stone), wrong icon library (FontAwesome vs Lucide), zero `--hydrax-*` consumption.

## Goal

A stakeholder bouncing between the two demo decks and the live portals (issuer-portal, distributor-portal, investor-portal, ops-console, admin) experiences a single visual signature, not visual whiplash.

## Out of scope

- Portal-side token leakage (`HealthRoute.tsx` hex literals, `ProductsListRoute.tsx:121` `fontSize: 14`). Logged in audit as MAJOR D1/D2; will land in a separate ≤30-LOC slice — no plan doc needed.
- CLAUDE.md documentation of NAV-count variance, deck-mode type ramp, deck button radius. Logged as MINOR E1/E2/E3; one-file edit, no plan doc.
- Building a shared `tokens.css` artifact emitted from `default-theme.ts`. Bigger pipeline change — separate plan.
- Re-rendering / re-recording the existing `docs/demo/captures/` images and the [video-deck.html](../demo/video-deck.html). Visual layout will not move significantly; if a capture re-shoot is needed it lands in a follow-up.

## Open questions (block execution until answered)

### Q1 — Canton-teal disposition

The two decks define `--canton-teal: hsl(178, 64%, 48%)` and use it for slide gradients, button states, callouts, and accent text. The portal accent is `hsl(30, 8%, 72%)` (warm stone). These are orthogonal hues — keeping both produces the alienation flagged by the audit.

| Option | Description | Trade-off |
|---|---|---|
| **A — Full remap** *(recommended)* | Decks consume `var(--hydrax-color-accent)` everywhere `--canton-teal*` is used today. Single brand signature across product + presentation. | Loses the deck's "cooler, more saturated" mood. Investor presentations look like the operator console. |
| **B — Document as deck-mode** | Keep teal, but declare it explicitly in [CLAUDE.md](../../CLAUDE.md) as a deliberate presentation accent ("deck-mode = projector contrast"). | Cheaper migration. Preserves audit verdict's "alienated" finding — only papers over it with a label. |

**Default if user does not respond by next session:** Option A. The audit verdict was the catalyst for this plan; preserving teal contradicts the fix. User can override with `Q1: B` or a custom hue.

### Q2 — FontAwesome → Lucide migration approach

Both decks load FontAwesome 6 from CDN and use ~140 `<i class="fas fa-*">` icons. Portal mandates Lucide.

| Option | Description | Trade-off |
|---|---|---|
| **A — Inline raw Lucide SVG** *(recommended)* | At each call site, replace `<i class="fas fa-X">` with the raw Lucide SVG markup for the equivalent icon. Drop the FontAwesome `<link>`. | Largest diff (~140 swaps × 2 files). Self-contained, no build step. |
| B — Lucide-name shortcode + JS resolver | Mark icons as `<span data-lucide="X">`, run a tiny `<script>` that hydrates them via `lucide` UMD bundle. | Smaller diff. Adds runtime JS dependency to a static deck. |

**Default:** Option A. Decks are static HTML artifacts; preserving zero-JS reading is the bigger virtue.

### Q3 — Portal-token wiring approach

Decks hardcode `#F5F5F5 / #CDC8C2 / #BCBCBC / rgba(...)` instead of consuming `--hydrax-*` variables.

| Option | Description | Trade-off |
|---|---|---|
| **A — Inline mirrored `:root`** *(recommended)* | At top of each deck's `<style>` block, declare `:root { --hydrax-color-bg: hsl(0,0%,8%); ... }` mirroring `default-theme.ts`. Reference everywhere via `var(--hydrax-*)`. Decks become token-aware. | Manual sync: when `default-theme.ts` changes, decks must be re-mirrored. Document the sync rule in this plan doc + CLAUDE.md. |
| B — Build-time `tokens.css` | Emit a single `tokens.css` from `default-theme.ts`; both decks `<link>` to it. | Requires a build step / pipeline. Out of scope per "Out of scope" above. |

**Default:** Option A.

## Assumptions

1. The two HTML decks are the only deck surfaces in scope. [video-deck.html](../demo/video-deck.html) and [canton-interview-stills.html](../demo/canton-interview-stills.html) are smaller and inherit fixes by copy-paste once the main two land.
2. Existing image assets under `docs/demo/assets/` and `docs/demo/captures/` do not need re-shooting — slide framing is unchanged.
3. No new dependencies. No npm install. Decks remain zero-JS where possible (Option Q2-A keeps this).
4. Type ramp stays oversized (72/52/32px) — justified for projection at distance. Will be documented in CLAUDE.md (E2) as "deck mode" rather than aligned to portal 32/22/16.

## Phases (one commit per phase)

Each phase ends with `git diff --stat` confirming only the expected files changed and a verification line per **CLAUDE.md → Verification Gates** + **Prototype gates**.

### Phase 1 — Mirror portal tokens at top of each deck *(blocked on Q3, default A)*

**Files:** `docs/demo/canton-interview.html`, `docs/demo/canton-homework-deck.html`
**LOC:** ~80 (40 per file, all in `<style>` `:root`)
**What:** Insert a `:root { ... }` block near the top of each `<style>` mirroring all 41 `default-theme.ts` token values as `--hydrax-*` CSS variables. Do not yet change call sites.
**Verification:**
- Open each file in a browser, confirm visual baseline unchanged (vars are defined but unused).
- `node --check` not applicable (HTML).
- `wc -l` recorded in STATE.yaml verification_log.
**Commit:** `chore(decks): mirror portal token surface as inline :root vars`

### Phase 2 — Resolve canton-teal *(blocked on Q1)*

**Files:** same two decks.
**LOC:** ~30 if Option A (find/replace `var(--canton-teal*)` → `var(--hydrax-color-accent*)`); ~5 if Option B (just delete the canton-teal block and update CLAUDE.md).
**What:** Per Q1 decision.
**Verification:** Browser visual diff of slide-1 in each deck before/after. Document the visual delta in STATE.yaml.
**Commit (Option A):** `feat(decks): replace canton-teal accent with portal warm-stone for brand cohesion`
**Commit (Option B):** `docs(decks): document canton-teal as deliberate deck-mode override`

### Phase 3 — Replace remaining hardcoded colors with token vars

**Files:** same two decks.
**LOC:** ~120 (find-replace `#F5F5F5` → `var(--hydrax-color-text-strong)`, `#CDC8C2` → `var(--hydrax-color-accent)` if not done in Phase 2, `rgba(245,245,245,0.16)` → `var(--hydrax-color-border)`, etc.).
**What:** Token-wire all remaining call sites. Do not change layout, type, or icon markup yet.
**Verification:** Browser visual diff. Should be visually identical (token values mirror the hardcoded values per Phase 1).
**Commit:** `refactor(decks): consume mirrored portal tokens instead of hardcoded hex/rgba`

### Phase 4 — FontAwesome → Lucide *(blocked on Q2, default A)*

**Files:** same two decks.
**LOC:** ~280 (140 icons × 2 files; each swap is `<i class="fas fa-X">` → inline Lucide SVG block ~5 lines).
**What:**
- Drop the FontAwesome CSS `<link>` from `<head>`.
- For each `<i class="fas fa-*">` call site, replace with the equivalent Lucide SVG inline (stroke=currentColor, width/height matched).
- Build a small icon-mapping table at top of plan-doc execution to avoid drift between the two files.
**Verification:**
- Grep should report zero `fa-` or `fas ` matches in either file.
- Browser visual diff per slide — every slide must still render an icon at every prior icon location.
**Commit:** `feat(decks): swap FontAwesome icons for inline Lucide SVG to match portal icon system`

### Phase 5 — Flatten triple-layer per-slide gradients

**Files:** same two decks.
**LOC:** ~60 (replace `linear-gradient(180deg, rgba(...)) , linear-gradient(135deg, --canton-teal-image), url(...)` triple-stack with single `var(--hydrax-color-bg)` overlay + image).
**What:** Remove the teal-glow + grid-decoration layers from per-slide backgrounds; keep only the dark overlay + image. Remove the 60px/40px decorative grid from [canton-interview.html:959-962](../demo/canton-interview.html#L959-L962) and [canton-homework-deck.html:881-885](../demo/canton-homework-deck.html#L881-L885).
**Verification:** Browser visual diff — slides should look flatter/cleaner. Capture before/after stills for STATE.yaml note.
**Commit:** `refactor(decks): flatten gradient stacks and remove decorative grid backgrounds`

### Phase 6 — Capture re-shoot decision (optional)

**Files:** `docs/demo/captures/*` (only if visual delta is significant)
**What:** If Phase 2/4/5 produced visible changes, re-shoot the slide stills using the existing capture script at `docs/demo/site/`. If not, skip.
**Verification:** Open `canton-interview-stills.html` and confirm captures match the live deck.
**Commit:** `chore(demo): refresh canton deck captures after brand alignment`

## Verification gate (cumulative, before merging the series)

Per [CLAUDE.md](../../CLAUDE.md) prototype gates (these are static HTML, not part of the web monorepo):

- Both files open cleanly in Chrome + Safari, no console errors, no broken images.
- Grep:
  - `grep -c "fa-\|fontawesome" docs/demo/canton-*.html` → `0`
  - `grep -c "canton-teal" docs/demo/canton-*.html` → `0` (if Q1=A) or unchanged (if Q1=B)
  - `grep -c -- "--hydrax-color-bg\|--hydrax-color-accent\|--hydrax-color-text" docs/demo/canton-*.html` → `>0` (token vars are now consumed)
- Side-by-side screenshot of slide-1 from each deck against the issuer-portal home — same accent, same heading style register, same icon stroke weight.

## Past-mistakes to avoid

- **2026-04-25 — concurrent-staging risk:** before each commit run `git diff --cached --name-only`; restore staged paths that aren't in the phase scope.
- **2026-04-25 — STATE.yaml concurrency:** append `verification_log` lines per phase; do not overwrite `current_focus` from another session.
- **2026-04-26 (this audit) — wrong-color substitution:** when picking a token to substitute for an undefined var, read the actual HSL values, not the variable name. The audit subagent recommended `text-strong` (white) where `bg` (near-black) was correct. The same trap exists for any deck color swap — verify the resulting contrast in browser, not just by name-matching.

## Estimated effort

| Phase | LOC | Time |
|---|---|---|
| 1 | ~80 | 15 min |
| 2 | 5–30 | 10 min |
| 3 | ~120 | 25 min |
| 4 | ~280 | 60 min |
| 5 | ~60 | 20 min |
| 6 | varies | 0–30 min |
| **Total** | **~575** | **~2.5 h** |

## Rollback

Each phase is a single commit; revert is `git revert <sha>` per phase. Decks are static HTML — no migrations, no data, no shared state.

## Pre-execution checklist

- [ ] Q1 answered (default A)
- [ ] Q2 answered (default A)
- [ ] Q3 answered (default A)
- [ ] User confirms `proceed with deck-alignment plan` (or scopes to a phase subset)
- [ ] Working tree clean before Phase 1 starts
