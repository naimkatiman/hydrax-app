# 2026-04-26 — Teal highlight system across portal landing + canton-interview deck

## Goal

Add a single teal highlight color (and image-overlay tint) to the two static surfaces the user named:

1. `web/portal-deploy/styles.css` — landing page + ambient styling for the 5 sub-portal sub-trees served at `https://hydraxrail.up.railway.app/`
2. `docs/demo/canton-interview.html` — 9-slide standalone deck

Keep the warm-grey core. Teal is *highlight*, not body. Use teal with low opacity for image overlays so photographs pick up a teal cast without losing legibility.

## Out of scope (deferred follow-up)

The 5 React app bundles served from `web/portal-deploy/<portal>/assets/index-<hash>.js` are pre-built Vite outputs. Updating tenant-theme tokens in `web/packages/tenant-theme/src/` and the UI primitives (`NavItem`, `StatusPill`, `Button`) requires a rebuild + recopy into `web/portal-deploy/<portal>/`. **This pass does not touch them.** The user's stated URL is the landing page; sub-portals stay on the existing grey active state until a follow-up rebuild slice. Logged in STATE next_actions.

## Token choice

One teal hue, four roles:

- `--hx-teal: hsl(178, 64%, 48%)` — primary highlight
- `--hx-teal-strong: hsl(178, 60%, 56%)` — hover lift
- `--hx-teal-soft: hsla(178, 64%, 48%, 0.14)` — soft fills, hovered tab background
- `--hx-teal-glow: hsla(178, 64%, 48%, 0.28)` — pulse rings, focus rings, glow

For canton: same three under `--canton-teal-*` prefix in the inline `<style>` block.

For image overlays: drop the existing greyscale chroma layer in the hero gradient stack and replace it with a teal layer at `0.18–0.22` opacity. Preserve the dark legibility layer beneath (text contrast unchanged).

## Highlight vs accent discipline

`web/portal-deploy/styles.css` and `canton-interview.html` use warm-grey `--hx-accent` / `#CDC8C2` for both *body accent* (eyebrow text, dividers, content emphasis) and *highlights* (interactive state, primary CTA, hero ambient glow). Only the highlight set rotates to teal:

| Surface | Teal | Stays grey |
|---|---|---|
| Landing | `:focus-visible` outline; `.glass--button-primary` bg/border/shadow; `.nav__link::after`; `.nav__brand-mark` + `hxBrandPulse` rings; `.solutions-menu__item` hover bg; `.quickstart__tab.is-active`; `.quickstart__step-num`; `.contact__email:hover` + email icon; `.contact__sublinks a::after`; `.footer__legal a` underline; `.hero__bg` chroma radial; `.solution-card__media` gradient overlays | eyebrow text, body copy, section titles, value-strip success icon (semantic green), portal-card eyebrow + role labels, dividers, dashed logo borders |
| Canton deck | `.slide-nav button:hover` border + color; `.accent` and `.bg-accent` utility classes (used as primary highlight in slides); `#slide-0/3/5` hero overlay chroma layer; "Live on Railway" green dot stays green; `.bg-accent` primary indicator dots rotate to teal | header eyebrow text, body copy, content text in slides, status text in cards |

The 334 hardcoded `#CDC8C2` / `205,200,194` references in canton-interview.html are NOT bulk-replaced. Surgical edits only.

## File-level changes

### A. `web/portal-deploy/styles.css` (~30 LOC delta)

1. Inside `:root` add four teal tokens after `--hx-success`.
2. Replace `var(--hx-accent)` with `var(--hx-teal)` *only at the highlight sites in the discipline table*.
3. Update `hxBrandPulse` keyframes to use `var(--hx-teal-glow)` instead of `hsla(30, 8%, 78%, 0.16/0.30)`.
4. Update `.glass--button-primary` background + border + shadow to use teal tokens; keep `color: hsl(0, 0%, 8%)` (the dark text on teal) for AA contrast.
5. Update `.hero__bg` second radial gradient (`radial-gradient(ellipse at 80% 60%, hsla(0, 0%, 96%, 0.06), transparent 60%)`) to teal at 0.18 opacity. First (warm-grey at 20%/30%) stays.
6. Update `.solution-card__media[data-img="..."]` gradients to a teal-tinted overlay (`hsla(178, 64%, 48%, 0.20)` over the dark layer) so the three photographs (issuance / distribution / servicing) read teal-tinted.
7. Update `:focus-visible` outline to `var(--hx-teal)`.
8. Update `.contact__email svg` color and `:hover` color to `var(--hx-teal)`.
9. Footer legal underline `text-decoration-color` switches to `hsla(178, 64%, 48%, 0.4)`.

### B. `docs/demo/canton-interview.html` (~12 LOC delta inline `<style>`, ~6 inline-style sites)

1. Inside the inline `<style>` block (after the body rule), add three teal vars on `:root`.
2. Update `.slide-nav button:hover { border-color: var(--canton-teal); color: var(--canton-teal); }`.
3. Update `.accent` class color and `.bg-accent` background to use the teal var (this is the primary highlight class used across slides).
4. Update `#slide-0`, `#slide-3`, `#slide-5` overlay gradients: keep the dark `rgba(20,20,20,0.78)` layers for legibility, append `linear-gradient(180deg, hsla(178,64%,48%,0.18) 0%, transparent 100%)` as the chroma layer over the JPEG.
5. Body still has `~110+ inline #CDC8C2`. Do NOT touch them. The teal-ification of `.accent` + `.bg-accent` already covers the primary highlight slides because they use these classes for the active dots and the "Live on Railway" / "5 Daml Scripts Green" indicator dots.

Inline `style="background: #CDC8C2"` in a few spots WILL stay grey — that's intentional, those are content-accent indicators (e.g., the smaller secondary dots representing layered architecture). The `--canton-teal` rotation focuses on top-level live-status pulses + the slide-nav primary chrome.

## Verification

After each commit:
- Open `web/portal-deploy/index.html` and `docs/demo/canton-interview.html` directly in a browser; confirm:
  - Brand mark dot pulses teal-ringed
  - Primary CTA button is teal with dark text (AA)
  - Hero photo carries a teal wash, text remains legible (contrast > 4.5:1)
  - Solution cards (issuance / distribution / servicing) photos have teal cast
  - Tab focus shows teal ring
  - Canton slide nav arrows hover teal
  - Slide-0/3/5 hero photos have teal cast over the dark gradient
- `git diff --stat` shows exactly two files per commit.
- No `console.log`, no JS changes (CSS + HTML inline only).

Visual smoke is operator-driven; no test changes in this slice.

## Commit sequence

1. `feat(portal-landing): teal highlight system + image overlay tint` — touches `styles.css` (landing) only.
2. `feat(demo): teal highlight overlay on canton-interview slides` — touches `canton-interview.html` only.

Plan + STATE.yaml verification_log entry land alongside commit 2 (or in a small admin commit if needed).

## Status — phase-1b canton commit deferred

The teal edits described in section B for `docs/demo/canton-interview.html` are applied in the working tree but **not committed in this session**. A parallel session is mid-flight expanding the deck from 3 hero slides (0/3/5) to all 9 (adding `#slide-1/2/4/6/7/8` CSS rules + 6 new `.jpg` assets + an `assets-meta.json` patch). My teal overlay layers were applied on top of the parallel session's working-tree state, so the two concerns intermixed in the same file past the point of clean separation. Per the past-mistake on concurrent staging collisions (CLAUDE.md, 2026-04-25 entry), the discipline is "never commit work that isn't exclusively yours". Canton teal is therefore deferred:

1. Wait for the parallel session to commit its slide-asset expansion (+ assets-meta.json + .jpg files).
2. Re-apply `--canton-teal` overlay to the new slides 1/2/4/6/7/8 if not already present, and confirm the slide-nav hover + status-pulse edits remain.
3. Commit as `feat(demo): teal highlight overlay across canton-interview slides`.

The teal CSS vars and the slide-0/3/5 + slide-nav + status-pulse edits will already be in the working tree when the parallel session finishes — the only follow-up touch is verifying slides 1/2/4/6/7/8 picked up the teal overlay layer (they already did, in the current working tree).

## Sub-portal rebuild — explicit deferred follow-up

After user confirms the teal saturation/hue on the landing + deck, propagate by:
1. Adding `colorHighlight` + `colorHighlightSoft` + `colorHighlightGlow` to `TenantThemeTokens` in `web/packages/tenant-theme/src/types.ts`
2. Adding values to `default-theme.ts` and `TOKEN_TO_CSS_VAR` in `applyTheme.ts`
3. Updating `NavItem` active state, `StatusPill` (active variant), and `Button` (primary variant) to use the new tokens in `@hydrax/ui`
4. Updating per-app HomeRoute hero `EmptyState imageStyle` to add a teal overlay
5. Running `pnpm -r --if-present typecheck`, `pnpm -r --if-present test -- --run`, `pnpm -r --if-present build` (3 green, no commit otherwise)
6. Copying each app's `dist/` into `web/portal-deploy/<portal>/` (per existing pattern — `web/portal-deploy/<portal>/assets/index-<new-hash>.js`)
7. `railway up --detach` from the linked service root

That's a separate plan doc and a separate session.
