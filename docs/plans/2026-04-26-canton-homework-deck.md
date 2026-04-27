# Canton homework-aligned deck

**Date:** 2026-04-26
**Slug:** canton-homework-deck
**Owner:** Naim
**Status:** Draft — awaiting confirmation on slide structure before HTML build

## Problem

`docs/demo/canton-interview.html` (and its deployed twin `docs/demo/site/deck.html` at `hydrax-layer.up.railway.app`) tells the *architecture-positioning* story — Canton owns the rails, we own the layer above. Nine slides, dense, opinionated, but **not structured to answer the homework prompt's three required sections**.

The homework asks for:

1. **Conceptual Overview** — how Canton works, core components, architecture, design principles, vs public chains, vs traditional permissioned DLT
2. **Building on Canton** — design/build/deploy approach, dev tooling, workflow, integration, practical assumptions
3. **Technical Deep Dive** — pick the areas (privacy, security, infra, multi-domain sync, tokenization, smart contract lifecycle, etc.)

The current deck mixes (1) and (3) and answers (2) only via the prototype. A reviewer who treats it as a homework submission has to reconstruct the mapping themselves.

## Goal

Ship a single homework-aligned deck — `docs/demo/canton-homework-deck.html` — that reads top-to-bottom as a direct answer to the three sections, **without abandoning the architectural opinions** that make the existing deck distinct. Replace the deployed `site/deck.html` with the new deck so reviewers landing on `hydrax-layer.up.railway.app/deck` see the homework answer.

Keep `canton-interview.html` in place as the source / alternate (linked from README "Canton interview deck" section). Two artifacts, one canonical homework answer.

## Non-goals

- Rewrite the visual system. Same dark + warm-grey palette, Inter + IBM Plex Mono, same `slide-container` 1280×720, same nav, same prefers-reduced-motion handling.
- Re-generate hero imagery. Reuse the 9 existing `slide-N-*.jpg` heroes thematically. No new `/nano-banana` runs (no billing, no approval needed).
- Touch any service or portal code. This is documentation-only.

## Proposed structure (14 slides)

| # | Section | Title (working) | Hero (reused) | Reuse / new |
|---|---|---|---|---|
| 0 | Cover | Canton Network — Homework Submission | `deck-bg.jpg` overlay | New cover, repositions deck as homework, lists the 3 sections + author |
| 1 | §1 — Conceptual Overview | Canton in one frame | `slide-0-stack.jpg` | New — opens with "privacy-preserving sync protocol, not a blockchain" thesis |
| 2 | §1 | Three primitives — participants, synchronisers, Daml | `slide-2-three-primitives.jpg` | Reused from existing slide-2, lightly reframed |
| 3 | §1 | How Canton is wired | `slide-3-canton-wiring.jpg` | Reused from existing slide-3, unchanged |
| 4 | §1 | Canton vs public L1s vs traditional permissioned DLT | `slide-4-where-canton-stops.jpg` | New 3-way comparison table, replaces existing "Where Canton Stops" framing |
| 5 | §2 — Building on Canton | Developer toolchain | `slide-3-canton-wiring.jpg` (re-tinted) | New — Daml SDK, `daml build / test / start`, sandbox, Navigator, code-gen, IDE-ledger vs Canton |
| 6 | §2 | Deploy path — local → testnet → mainnet | `slide-1-thesis-split.jpg` | New — promotion pipeline, Global Synchronizer onboarding |
| 7 | §2 | Where Canton stops, where Web2 takes over | `slide-4-where-canton-stops.jpg` | Reframed from existing slide-4 + slide-5 — now scoped to §2 (integration considerations) |
| 8 | §2 | Practical assumptions if I were starting today | `slide-6-one-workflow.jpg` | New — list of opinions: single-domain first, mock rails behind interface, off-ledger workflow plane, etc. |
| 9 | §3 — Technical Deep Dive | Privacy & security model | `slide-4-where-canton-stops.jpg` (re-tinted) | New — signatories vs observers vs controllers, sub-transaction privacy, why this matters for institutional flows |
| 10 | §3 | Multi-domain coordination | `slide-3-canton-wiring.jpg` (re-tinted) | New — single-synchronizer vs Global Synchronizer, when multi-domain becomes necessary |
| 11 | §3 | Tokenization & contract lifecycle | `slide-2-three-primitives.jpg` (re-tinted) | New — Daml choices as state transitions, what makes a contract upgradeable, why tokenization on Canton ≠ ERC-20 |
| 12 | §3 | What I built above Canton (proof, not promise) | `slide-6-one-workflow.jpg` | Reframed from existing slide-5 + slide-6 + slide-7 — collapsed, scoped to §3 as evidence |
| 13 | Close | Trade-offs now, what's next | `slide-8-tradeoffs-roadmap.jpg` | Reused from existing slide-8 |

**Net:** 14 slides. 5 reused largely verbatim (2, 3, 7 reframed, 13, plus parts of 12). 9 new or substantially rewritten.

## Visual / structural reuse from canton-interview.html

- `<head>`, `<style>` block, font preconnect, deck-bg overlay → copy verbatim
- `.slide-container`, `.slide-page`, `#slide-N` selectors → keep pattern, add `#slide-9..13`
- Nav (slide counter, prev/next, dots), keyboard handlers, IntersectionObserver reveal, mouse-wheel paging → copy verbatim
- Section dividers — add 3 visual section markers (§1 / §2 / §3) using the existing watermark pattern (`section-num`)

## Wiring

- New file: `docs/demo/canton-homework-deck.html`
- `docs/demo/site/deck.html` → replace with copy of homework deck (the deployed one)
- `docs/demo/site/index.html` topnav → no change needed (`/deck` already routes to deck.html)
- `docs/demo/canton-homework.md` → update artifact table: link to new deck for homework answer, keep canton-interview.html as alternate
- `README.md` → "Canton interview deck" section retitled to "Canton decks" and listing both:
  - `canton-homework-deck.html` (homework-aligned, 14 slides) — NEW, primary
  - `canton-interview.html` (architecture story, 9 slides) — EXISTING, alternate

## Files touched (5)

1. `docs/plans/2026-04-26-canton-homework-deck.md` — this file
2. `docs/demo/canton-homework-deck.html` — NEW (~2400 LOC)
3. `docs/demo/site/deck.html` — REPLACE (~2400 LOC, mirror of #2)
4. `docs/demo/canton-homework.md` — small edit to artifact table
5. `README.md` — small edit to deck section

## Verification

Before commit:

- Slide count = dot count = 14 (currently 9 in source deck) — count via `grep -c 'id="slide-' canton-homework-deck.html`
- HTML balances — `python3 -c "from html.parser import HTMLParser; ..."` tag balance check
- 0 emoji — `LC_ALL=C grep -P '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' canton-homework-deck.html` returns nothing
- Each `id="slide-N"` has a matching dot in the nav and a matching keyboard target
- All hero JPGs referenced exist in `docs/demo/assets/`
- `node --check` not applicable (no JS module — the script is inline classic JS)
- Open in browser, walk through all 14 slides via keyboard, mouse-wheel, dot-click, swipe (manual)
- `wc -l` recorded in STATE.yaml verification_log

## Open questions before HTML build

1. **Scope confirmation** — replace `site/deck.html` (the deployed Railway artifact)? Or land the homework deck as a new URL (`/homework`) and leave `/deck` untouched?
2. **Section 3 picks** — homework says "pick the areas you find most interesting". Proposed picks: privacy/security model, multi-domain sync, tokenization & contract lifecycle. Drop one or swap for DeFi composability / infra-ops if preferred?
3. **Slide 8 ("practical assumptions")** — keep on the deck or move to the long-form `canton-homework.md` article and skip on the deck? Could free a slot.
4. **Author footer** — current deck has no name. Add "Naim Katiman · April 2026" in slide 0 + slide 13?

## Decision log

- 2026-04-26 — Plan drafted. Awaiting answers to 4 open questions before building HTML. No code/HTML written yet.
- 2026-04-26 — User confirmed defaults via `/proceed-with-claude-recommendation`. Decisions locked:
  - Q1: **Replace** `docs/demo/site/deck.html`. The architecture story stays in `canton-interview.html` only.
  - Q2: §3 deep-dive picks remain **privacy/security model + multi-domain coordination + tokenization & contract lifecycle**.
  - Q3: **Keep** the "practical assumptions" slide (slide 8 in the new deck).
  - Q4: **Add** "Naim Katiman · April 2026" author attribution to slide 0 + slide 13.
- 2026-04-26 — Building HTML now. Routing the large file generation to a `general-purpose` subagent to keep main-session context clean.
