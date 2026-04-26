# 2026-04-26 — Canton interview slide deck

## Goal

Single-file HTML slide deck for the Canton homework + interview demo. Walks the interviewer through the homework brief in 10–15 minutes via the framing already established in [docs/architecture.md](../architecture.md), [docs/example-subscription-flow.md](../example-subscription-flow.md), and [README.md](../../README.md).

## Why now

The homework brief asks for a Canton primer; the differentiator is delivering it as *"Canton primer that ends with the layer above it that I built."* The repo has the substance (9 services, 5 portals, running Daml spike). The deck is the presentation artifact that makes the architectural intent obvious in a sit-down demo.

## Deliverable

`docs/demo/canton-interview.html` — single self-contained HTML file. Inline CSS, inline JS. Zero JS dependencies. Google Fonts loaded via standard `<link>` (allowed by `frontend-slides` skill).

## Style

Bold Signal preset (per `frontend-slides` `STYLE_PRESETS.md`):

- **Vibe:** confident, high-impact, keynote-ready
- **Fonts:** Archivo Black (display) + Space Grotesk (body) + JetBrains Mono (file paths, code)
- **Palette:** charcoal `#0A0A0B`, raised `#161618`, paper `#F5F5F4`, hot orange `#FF6B35`, rule lines `rgba(245,245,244,0.12)`
- **Signature:** oversized section numbers, high-contrast card on dark field, restrained motion, mono accents for code/paths

Rationale: institutional finance audience expects serious treatment. Bold Signal projects "I have a thesis" rather than "here is my research." Pairs well with technical content because the bold treatment forces diagrams and code snippets to breathe.

## Slide outline (14)

1. **Cover** — title + thesis tagline
2. **The split** (the BIG idea) — Canton owns / hydrax-app owns
3. **What Canton is** — 3 things at once: privacy, interop, atomic coordination
4. **Canton's core architecture** — Daml, participants, synchronizers, global synchronizer
5. **How Canton differs** — public chains vs traditional permissioned DLT vs Canton (3-column)
6. **Where Canton stops** — what Canton structurally does *not* model
7. **My architecture: 3 planes** — rails / orchestration / UX (the diagram)
8. **Per-service justification** — table: 9 services × "Canton can't do X"
9. **Daml spike (proof)** — `GovernanceProposal` template snippet, 5 Scripts green
10. **End-to-end trace** — investor subscription flow across the planes
11. **What's wired today** — status table grounded in real commits
12. **Trade-offs** — single-synchronizer, MockRails, Postgres-backed FSM, web2 IdP
13. **What I'd do next** — real Canton sync, real HydraX rails, multi-domain
14. **Closing** — thesis restated, repo pointer, Q&A handoff

Density per skill rules: title ≤1 heading + 1 subtitle + tagline; content ≤4–6 bullets; feature grid ≤6 cards; code ≤8–10 lines.

## Will NOT

- Modify any service code, schema, route, or portal.
- Touch the existing prototype (`index.html`, `app.js`, `styles.css`).
- Generate new images via nano-banana (Bold Signal is geometry + typography only).
- Use stock images, illustrations, or decorative SVG that pretends to be technical content.
- Deploy or publish anywhere — local file only.

## Files touched

- `docs/plans/2026-04-26-canton-interview-deck.md` (this file)
- `docs/demo/canton-interview.html` (new)
- `STATE.yaml` (verification_log entry)

3 files. Within commit budget.

## Verification

- Viewport fit at 1920×1080, 1440×900, 1280×720 (no scrollbars on any slide)
- Keyboard navigation: arrow keys, space, page up/down, home/end
- Touch / swipe navigation on mobile widths
- Mouse wheel navigation
- `prefers-reduced-motion` respected (animations damped to ≤0.2s transitions)
- All cited file paths in the deck resolve (`test -e` audit)
- Zero emoji
- Single file, no external JS, no build step

## Out of scope

- PDF export of the deck (browser print is fine for a one-off)
- Speaker notes mode
- Animated state transitions on the architecture diagram
- Live screensharing aids (mouse highlighters, etc.)
- Auto-advance / timer mode

## Risks

- Bold Signal might be too "pitch deck" for an engineering interviewer. Mitigation: preset is one CSS variable swap away from Swiss Modern (minimal/data-forward). Documented in handoff notes.
- File path drift if user keeps building. Mitigation: cite stable scaffold locations only (services/ subdirs, web/apps/<portal>/src/routes), not internal symbols.
- Long-content slides may overflow on short viewports. Mitigation: short-height breakpoints at 700/600/500px per skill base CSS; all type uses `clamp()`.

## Handoff

Open: `xdg-open docs/demo/canton-interview.html` (Linux) or `open docs/demo/canton-interview.html` (macOS).

Customization points (all CSS variables at top of `<style>`):

- `--accent` — change hot orange to any single signal color
- `--bg` / `--bg-2` — swap charcoal for any dark base
- `--font-display` / `--font-body` — swap Bold Signal fonts for Swiss Modern (Archivo + Nunito) or Terminal Green (JetBrains Mono only)
