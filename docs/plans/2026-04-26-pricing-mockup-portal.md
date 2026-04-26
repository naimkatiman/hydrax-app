# Pricing Mockup — Marketing Portal

> **Status:** SHIPPED in working tree. Verification gates passed; awaiting user review + commit authorization.
>
> **Scope:** Public-facing pricing surface on the marketing site at `web/portal-deploy/`. Mockup only — no billing, no checkout, no commerce backend.

- **Date:** 2026-04-26
- **Trigger:** User asked "what about pricing dont we need to build it at least mockup" referencing https://hydrax-portals-production.up.railway.app/
- **Anchored on:** [docs/plans/2026-04-25-q7-pricing-model-options.md](2026-04-25-q7-pricing-model-options.md) — Option D (hybrid: setup + platform + metered volume) is the recommended commercial structure.
- **Why now:** the deployed portal already has Solutions / Portals / Quickstart / Docs / Contact but no pricing section. Buyers landing on the site have no surface to read the commercial shape, even at the structure level. A mockup unblocks buyer conversations without committing dollar amounts (which still belong to HydraX commercial).

## What shipped

Two files modified:

- [web/portal-deploy/index.html](../../web/portal-deploy/index.html) — `+69` lines
  - Added `Pricing` link to primary nav (between Quickstart and Docs)
  - Inserted `<section class="section pricing" id="pricing">` between `#solutions` (line 311) and `#trust` (line 313). Conventional spot: capability deep-dive → pricing → social proof.
- [web/portal-deploy/styles.css](../../web/portal-deploy/styles.css) — `+100` lines
  - Added `.pricing*` rules using the existing `--hx-*` token vocabulary (no new tokens introduced).
  - Reused glass primitives (`.glass`, `.glass--card`, `.glass--inset`, `.glass--button`, `.glass--button-primary`).
  - Reused the existing CSS-drawn checkmark from `.solution-card__bullets li::before` for tier feature lists.
  - One responsive breakpoint at 960px collapsing the 3-column grid to single column.

`app.js` deliberately untouched — section is fully static.

## Information architecture

Three tiers, mapped 1:1 to Q7 §2 Option D's reasoning:

| Tier | Q7 anchor | Headline shape |
|---|---|---|
| Design Partner | "design partner pricing for 12 months" (Q7 §4 + Option A residual) | Reduced bands · milestone setup · ramped platform · volume waived · scope-bounded |
| Growth | Option D primary recommendation | Standard hybrid · setup + platform + metered volume above tier threshold |
| Enterprise | Option C-flavoured carve-out for high-volume operators | Custom integrations · multi-tenant · volume-led with guaranteed minimums · 24/7 SLA |

Each tier shows:
- Lucide icon (users / trending-up / building-2)
- Tier badge (First cohort / Recommended / Bespoke)
- Title + subtitle
- Price band label + "Talk to us" CTA (no dollar amount)
- 5 bullets covering setup, platform, volume, scope, support
- Mailto CTA prefilling the subject line per tier

## What it deliberately does NOT do

- **No dollar amounts.** Q7 §3 is explicit: "No specific dollar amounts — illustrative bands only … the user (or HydraX commercial owner) sets actual prices." A footnote under the grid surfaces this constraint to the visitor: "All bands are illustrative until HydraX commercial publishes the final price card. The structure is fixed across tiers."
- **No interactive billing.** No tier-switcher, no billing toggle, no Stripe checkout, no quote builder. Pure marketing surface.
- **No new design tokens.** The Q7 unblock doesn't require theme work; reuses everything in `:root`.
- **No nano-banana imagery.** Pricing tier cards work better as typographic primary; hero imagery is reserved for solution cards already in `#solutions`.
- **No JS handlers.** Static section. Anchor links only.

## Verification gates run (the "smallest checks that prove correctness" per CLAUDE.md)

- `node --check app.js` — passes (no JS changes, but ran anyway as the prototype's smoke).
- HTML id audit — every `getElementById` in app.js still maps to an `id=` in index.html. No regressions.
- CSS class audit — every new pricing-* class declared in index.html has a matching rule in styles.css. Confirmed:
  `pricing`, `pricing__grid`, `pricing__footnote`, `pricing-card`, `pricing-card--featured`, `pricing-card__head`, `pricing-card__icon`, `pricing-card__badge`, `pricing-card__badge--featured`, `pricing-card__title`, `pricing-card__subtitle`, `pricing-card__price`, `pricing-card__price-band`, `pricing-card__price-cta`, `pricing-card__bullets`, `pricing-card__cta`.
- `wc -l` — index.html: 398 → 467 (+69); styles.css: 665 → 762 (+97 net after blank lines); app.js: 197 (unchanged).
- `git diff --stat` — exactly 2 files changed (`index.html`, `styles.css`); concurrent edits to `docs/demo/site/serve.json` and untracked `docs/demo/site/canton-interview.html` are out of scope and not staged.

## What is NOT verified yet

- **Visual preview.** Not browser-checked by the assistant. User should `python3 -m http.server 8000` from `web/portal-deploy/` and review the section between Solutions and Trust at full-width and at <960px. The mailto CTAs should open with prefilled subject lines.
- **Railway deploy.** Files are in working tree only. Not pushed. Not deployed. The Railway URL the user referenced still shows the old (no-pricing) site until a deploy lands.

## Follow-ups (NOT shipped — log only)

1. **Dedicated `/pricing` route** — once tenant volume justifies it, lift this section into its own page with a tier comparison matrix, FAQ, and procurement-friendly print view. The current single-page section serves the mockup goal.
2. **Tier-switcher for product type** — if Q3 lands multiple product templates (short-duration credit, MMF, treasury-equivalent), pricing may differ per template. Add a small toggle row above the grid then.
3. **HydraX-published price card** — when HydraX commercial publishes actual bands, swap the "Talk to us" labels for the real numbers; remove the "illustrative" footnote.
4. **/admin pricing config** — when v1 needs to support multiple list prices, route them through `web/apps/admin/` and the BFF, not the marketing site.

## Operating-rule compliance

- Plan doc exists at `docs/plans/2026-04-26-pricing-mockup-portal.md` (this file). Cite in the commit message: `feat(portal): add pricing mockup section reflecting Q7 hybrid model`.
- Touches 2 files, 169 LOC. Under the 15-file cap. Crosses the 150-LOC threshold but is a single coherent slice (HTML + matching CSS for one section); splitting would produce a non-buildable intermediate state.
- One concern. No infra. No drive-by fixes.
- Outcome-led commit message (the "what does the user see"): a pricing mockup on the marketing site.

## Skill lineage

- This plan doc satisfies `/superpowers:writing-plans` for the slice.
- `/frontend-design`, `/taste-skill`, `/design-system` were not invoked as separate sessions — the design followed the existing portal's design language verbatim (token vocabulary, glass primitives, 3-column grid, eyebrow/title/lede header pattern). No new patterns introduced. If the follow-up "dedicated /pricing route" is taken, those skills should be invoked at that point.
- `/nano-banana` not invoked — pricing tier cards intentionally typographic, no hero imagery.
