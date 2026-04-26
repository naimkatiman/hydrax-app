# Portal Landing Liquid-Glass Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:dispatching-parallel-agents (HTML, CSS, JS, imagery agents work concurrently against the DOM contract in §2). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wrong-product execution-trading landing at `hydrax-portals-production.up.railway.app` with a hydrax.io-aligned institutional workflow landing that gets a visitor from "what is this?" to "I am inside the right portal" in under 10 seconds, with liquid-glass surfaces.

**Architecture:** Single static-site deploy under `web/portal-deploy/`. Three hand-edited files (`index.html`, `styles.css`, `app.js`) plus an `assets/` folder for imagery. The 5 React portals (issuer/distributor/investor/ops/admin) keep their built `dist/` output as subdirectory targets — the React apps themselves are out of scope. Rewrite is destructive, not additive: the workspace/orders/venues/risk/positions/settings/activity sections from the old prototype are deleted from the landing because (a) they describe a trading product that doesn't exist, (b) they have a separate deploy at `hydrax-prototype-production.up.railway.app`, and (c) they bury the actual portal entry CTAs.

**Tech Stack:** Vanilla HTML5, CSS (custom-property tokens + `backdrop-filter: blur()` + `@supports` fallbacks), inline lucide SVG icons, vanilla JS (no framework), `serve` static host on Railway. No build step, no node_modules at runtime, no React on the landing itself.

---

## §0 — Why this plan exists

Read these and stop pretending the current page is fine:

- Title is `HydraX | Adaptive Liquidity Command`. HydraX (hydrax.io) is a "Compliant Ecosystem for Capital Market Assets" — tokenisation, issuance, custody, regulated exchange. Not "adaptive liquidity command".
- Hero h1 is "Route liquidity like a control room, not a spreadsheet." This is execution-trading copy. Our wedge per [docs/prd.md](../prd.md) §1, §6, §23 is institutional onboarding + issuance + subscription servicing.
- Below the hero the page has 530+ lines of workspace/orders/venues/risk/positions/settings/activity demo. None of that is part of the product we are selling. It came from the old prototype and was glued onto the portal-deploy index by commit `908676c`.
- A new visitor cannot answer two questions in 10 seconds: "what is this product?" and "where do I click first?". Both must be answerable.
- hydrax.io's IA: Technology / Services / Industry Applications / About / News / Contact. We do not copy hydrax.io verbatim — we adopt the **structure** (top-nav with grouped solutions, role-aware destinations, customer logos/quotes, footer with sitemap) while keeping our own positioning.

## §1 — File Structure

**Files in scope (all under `/home/naim/.openclaw/workspace/hydrax-app/web/portal-deploy/`):**

| File | Action | Final size target |
|---|---|---|
| `index.html` | Rewrite end-to-end | ~330 lines |
| `styles.css` | Rewrite end-to-end | ~720 lines |
| `app.js` | Rewrite end-to-end | ~110 lines |
| `assets/hero-bg.jpg` | Create (nano-banana) | new |
| `assets/solutions-issuance.jpg` | Create (nano-banana) | new |
| `assets/solutions-distribution.jpg` | Create (nano-banana) | new |
| `assets/solutions-servicing.jpg` | Create (nano-banana) | new |
| `assets/assets-meta.json` | Create | ~80 lines |
| `package.json` | Untouched | — |
| `serve.json` | Untouched | — |
| `railway.json` | Untouched | — |

**Files explicitly NOT in scope:**

- `web/portal-deploy/{issuer,distributor,investor,ops,admin}/` — built React apps, untouched.
- `web/apps/*/` source — untouched.
- `services/` — untouched.
- The original `index.html` / `app.js` / `styles.css` at the **repo root** (the actual prototype) — untouched. That has its own deploy target.

## §2 — Shared DOM Contract (READ THIS BEFORE TOUCHING ANY FILE)

Parallel agents work against this contract. If an agent invents new IDs or class names not listed here, the integration step fails. If you need to add one, update this contract first.

### 2.1 Top-level structure

```
<body>
  <a class="skip-link" href="#main">Skip to main content</a>
  <header class="nav" id="nav">…</header>
  <main id="main">
    <section class="hero" id="hero">…</section>
    <section class="value-strip" id="value">…</section>
    <section class="portals" id="portals">…</section>
    <section class="quickstart" id="quickstart">…</section>
    <section class="solutions" id="solutions">…</section>
    <section class="trust" id="trust">…</section>
    <section class="contact" id="contact">…</section>
  </main>
  <footer class="footer">…</footer>
  <div class="toast-region" id="toastRegion" aria-live="polite"></div>
</body>
```

### 2.2 IDs JS attaches to (must exist in HTML, must be referenced in app.js)

| ID | Element | JS responsibility |
|---|---|---|
| `nav` | `<header>` | apply `is-scrolled` class after 16px scroll |
| `navToggle` | `<button>` | toggle mobile menu open/closed |
| `navMenu` | `<nav>` | mobile menu container (gets `is-open` class) |
| `solutionsTrigger` | `<button>` | desktop dropdown trigger for "Solutions" mega-menu |
| `solutionsMenu` | `<div>` | dropdown panel (gets `is-open` class) |
| `personaTabs` | `<div>` | Quickstart persona switcher (Issuer / Distributor / Investor) |
| `personaPanels` | `<div>` | the three panels matched by `data-persona="…"` |
| `toastRegion` | `<div>` | toast container (announcements when persona changes) |

### 2.3 Class names CSS targets (must match exactly)

**Glass surfaces (the liquid-glass treatment):**

`.glass`, `.glass--nav`, `.glass--card`, `.glass--button`, `.glass--button-primary`, `.glass--inset`

**Layout:**

`.container` (1200px max, 24px gutter), `.section` (96px y-padding, scales down to 56px on mobile), `.section__header`, `.section__eyebrow`, `.section__title`, `.section__lede`

**Hero:**

`.hero`, `.hero__bg`, `.hero__copy`, `.hero__eyebrow`, `.hero__title`, `.hero__lede`, `.hero__actions`, `.hero__metrics`, `.hero__metric`

**Value strip (3 short claims under hero):**

`.value-strip`, `.value-strip__item`, `.value-strip__icon`, `.value-strip__title`, `.value-strip__copy`

**Portals grid (5 cards):**

`.portals`, `.portals__grid`, `.portal-card`, `.portal-card__role`, `.portal-card__title`, `.portal-card__desc`, `.portal-card__suggested`, `.portal-card__cta`, `.portal-card__icon`

**Quickstart (3-step "what to do next" with persona tabs):**

`.quickstart`, `.quickstart__tabs`, `.quickstart__tab`, `.quickstart__panel`, `.quickstart__panel.is-active`, `.quickstart__steps`, `.quickstart__step`, `.quickstart__step-num`, `.quickstart__step-title`, `.quickstart__step-copy`, `.quickstart__step-cta`

**Solutions (4 capability tiles, hydrax.io-style):**

`.solutions`, `.solutions__grid`, `.solution-card`, `.solution-card__media`, `.solution-card__body`, `.solution-card__title`, `.solution-card__copy`, `.solution-card__bullets`

**Trust (logos + quote):**

`.trust`, `.trust__quote`, `.trust__author`, `.trust__logos`, `.trust__logo`

**Contact:**

`.contact`, `.contact__copy`, `.contact__email`, `.contact__sublinks`

**Footer:**

`.footer`, `.footer__cols`, `.footer__col`, `.footer__title`, `.footer__links`, `.footer__legal`

**Nav:**

`.nav`, `.nav__inner`, `.nav__brand`, `.nav__brand-mark`, `.nav__brand-text`, `.nav__menu`, `.nav__link`, `.nav__solutions`, `.nav__cta-row`, `.nav__toggle`, `.nav__toggle-bar`, `.nav.is-scrolled`

**Solutions mega-menu (desktop dropdown under "Solutions"):**

`.solutions-menu`, `.solutions-menu__col`, `.solutions-menu__title`, `.solutions-menu__item`

**Toast:**

`.toast-region`, `.toast`, `.toast.is-leaving`

### 2.4 Asset paths (must match exactly)

| File | Used by |
|---|---|
| `assets/hero-bg.jpg` | `.hero__bg` background-image (CSS) |
| `assets/solutions-issuance.jpg` | first `.solution-card__media` (HTML inline) |
| `assets/solutions-distribution.jpg` | second `.solution-card__media` |
| `assets/solutions-servicing.jpg` | third `.solution-card__media` |
| `assets/assets-meta.json` | provenance log, no runtime use |

The fourth solution card (Compliance & audit) uses no image — it's a glass tile with a lucide icon only, to vary the visual rhythm.

### 2.5 Inline lucide SVGs (no font, no CDN)

Icons live as inline SVG in HTML — never `<img>` or icon font. Per HydraX rules: lucide only, no emoji. Each is wrapped in `<span class="icon" aria-hidden="true">…</span>` inside the appropriate slot.

| Icon name | Where used |
|---|---|
| `building-2` | Issuer portal card |
| `share-2` | Distributor portal card |
| `wallet` | Investor portal card |
| `activity` | Ops portal card |
| `shield-check` | Admin portal card |
| `arrow-right` | Every CTA tail |
| `chevron-down` | Solutions nav trigger |
| `menu` / `x` | Mobile toggle |
| `circle-check` | Value-strip items |
| `lock` | Compliance solution card |
| `mail` | Contact section |

Source SVG paths copied verbatim from `lucide-static@0.378` (the version pinned in `web/packages/ui/package.json`). Do not hand-redraw paths.

## §3 — Liquid-Glass Token System

The CSS rewrite establishes these custom properties on `:root`. Every surface treatment reads from these — no magic numbers in component rules.

```css
:root {
  /* Brand */
  --hx-bg:               #0A0E1A;        /* page base, deep navy */
  --hx-bg-elevated:      #0F1525;
  --hx-ink:              #F4F6FB;        /* primary text */
  --hx-ink-soft:         rgba(244, 246, 251, 0.72);
  --hx-ink-muted:        rgba(244, 246, 251, 0.55);
  --hx-accent:           #5EA8FF;        /* signature blue, used sparingly */
  --hx-accent-strong:    #2B6FE6;
  --hx-success:          #4ADE80;
  --hx-border:           rgba(244, 246, 251, 0.12);

  /* Liquid-glass surfaces */
  --hx-glass-bg:         rgba(20, 28, 48, 0.55);
  --hx-glass-bg-strong:  rgba(20, 28, 48, 0.78);
  --hx-glass-tint:       rgba(94, 168, 255, 0.06);
  --hx-glass-border:     rgba(244, 246, 251, 0.10);
  --hx-glass-highlight:  rgba(244, 246, 251, 0.08);    /* inner top-edge */
  --hx-glass-blur:       blur(24px) saturate(140%);
  --hx-glass-blur-nav:   blur(18px) saturate(160%);

  /* Typography */
  --hx-font-sans:        "Inter", "SF Pro Text", system-ui, -apple-system, sans-serif;
  --hx-font-display:     "Inter", "SF Pro Display", system-ui, -apple-system, sans-serif;
  --hx-display-1:        clamp(2.5rem, 4.4vw + 1rem, 4.25rem);
  --hx-display-2:        clamp(1.875rem, 2.4vw + 1rem, 2.75rem);
  --hx-h3:               1.375rem;
  --hx-body:             1rem;
  --hx-small:            0.875rem;
  --hx-eyebrow:          0.75rem;        /* uppercase, letter-spacing 0.16em */

  /* Spacing scale (8pt) */
  --hx-space-1:          0.5rem;
  --hx-space-2:          1rem;
  --hx-space-3:          1.5rem;
  --hx-space-4:          2rem;
  --hx-space-5:          3rem;
  --hx-space-6:          4rem;
  --hx-space-7:          6rem;

  /* Radii */
  --hx-radius-sm:        8px;
  --hx-radius-md:        14px;
  --hx-radius-lg:        20px;
  --hx-radius-xl:        28px;

  /* Motion */
  --hx-ease:             cubic-bezier(0.22, 1, 0.36, 1);
  --hx-fast:             140ms;
  --hx-medium:           260ms;
  --hx-slow:             420ms;

  /* Shadows (depth on dark) */
  --hx-shadow-glass:     0 12px 32px rgba(0, 0, 0, 0.32), 0 1px 0 rgba(255, 255, 255, 0.05) inset;
  --hx-shadow-elevated:  0 24px 56px rgba(0, 0, 0, 0.42), 0 1px 0 rgba(255, 255, 255, 0.06) inset;
}
```

**The `.glass` mixin** is the heart of the system:

```css
.glass {
  background: var(--hx-glass-bg);
  border: 1px solid var(--hx-glass-border);
  border-radius: var(--hx-radius-lg);
  box-shadow: var(--hx-shadow-glass);
  backdrop-filter: var(--hx-glass-blur);
  -webkit-backdrop-filter: var(--hx-glass-blur);
  position: relative;
  isolation: isolate;
}
.glass::before {
  /* tinted highlight that creates the "wet" look */
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, var(--hx-glass-highlight) 0%, transparent 28%);
  pointer-events: none;
  z-index: 0;
}
.glass::after {
  /* subtle tint pull from accent */
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--hx-glass-tint);
  pointer-events: none;
  z-index: 0;
}
.glass > * { position: relative; z-index: 1; }

@supports not (backdrop-filter: blur(1px)) {
  /* Firefox 99-, older Safari, anything that lacks support: solid surface */
  .glass { background: var(--hx-glass-bg-strong); }
}
```

**Variants:**

- `.glass--nav`: smaller blur (`--hx-glass-blur-nav`), no border-radius, sticky top-0, full-width.
- `.glass--card`: above + hover lifts via `transform: translateY(-2px)` and shadow strengthens to `--hx-shadow-elevated`.
- `.glass--button`: rounded-full pill, hover increases tint opacity, `:active` translateY(1px).
- `.glass--button-primary`: solid `--hx-accent` background, white text, glass border-edge highlight kept.
- `.glass--inset`: inverse — sits ON TOP of glass, used inside cards (e.g., suggested-action chip).

**Anti-pattern guard (per liquid-glass-design skill):** glass surfaces are reserved for nav, cards, buttons, and pop-overs. The page body is `--hx-bg` (opaque) — do NOT apply glass to the whole page or stack many glass layers. Hero uses a JPEG bg + `.hero__overlay` (gradient), with glass appearing on the call-out tile only.

## §4 — Information Architecture (the "easy to navigate" part)

### 4.1 Top nav

Sticky. Inline lucide icons. Three slots:

- **Brand** (left): "HydraX Workflow" wordmark + small mark. Links to `/`.
- **Menu** (center, desktop only): `Solutions ▾`, `Portals`, `Quickstart`, `Docs`, `Contact`. The `Solutions` item opens a 4-column dropdown:
  - Issuance (link `#solutions`)
  - Distribution (link `#solutions`)
  - Servicing (link `#solutions`)
  - Compliance (link `#solutions`)
- **CTA row** (right): "Open Investor Portal" (ghost) + "Request Access" (primary, links `#contact`).

Mobile (<880px): brand + hamburger. Hamburger expands a full-height glass sheet listing all menu items + a single pinned "Request Access" CTA at the bottom.

### 4.2 Hero

- Eyebrow: "INSTITUTIONAL WORKFLOW PLATFORM"
- H1: **"Onboard, issue, and service tokenised products on HydraX rails."**
- Lede: "A white-label workspace for issuers, distributors, investors, and operations teams — sitting above HydraX's regulated tokenisation, custody, and trading infrastructure."
- Primary CTA: "Pick your portal →" (anchor `#portals`)
- Secondary CTA: "See how it works" (anchor `#quickstart`)
- Hero metrics tile (right side, glass card): 3 metrics
  - "5 portals" / "Issuer · Distributor · Investor · Ops · Admin"
  - "Demo mode" / "Canned fixtures, no backend round-trip"
  - "MAS-aligned" / "Built on HydraX's MAS-licensed rails"

### 4.3 Value strip

3 short claims with circle-check icons, single row on desktop, stacked on mobile:

1. **One workspace per role.** No spreadsheets, no shared inboxes.
2. **Multi-party by design.** Issuer, distributor, investor see only what they're entitled to.
3. **Audit trail you can hand to compliance.** Every state change leaves evidence.

### 4.4 Portals (the primary CTA cluster)

Heading: "Pick your portal." Sub: "Each portal is role-scoped. Pick the one that matches your work."

5 glass cards in a responsive grid (3-2 on desktop, 2-2-1 tablet, 1-stack mobile). Each card contains:

- Lucide icon, top-left, in a 40×40 inset glass tile.
- Role label (uppercase eyebrow): `ISSUER`, `DISTRIBUTOR`, `INVESTOR`, `OPS`, `ADMIN`.
- Card title (h3): plain English — "Issuer Workbench", "Distributor Approvals", "Investor Subscriptions", "Operations Console", "Tenant Admin".
- 1-sentence description.
- "Suggested first action" chip (`.portal-card__suggested`): e.g., "Try: Subscribe to a money-market fund" for Investor.
- CTA: "Open portal →" — anchor wraps the entire card; link target is the portal subdir (`/issuer/`, etc.).

Hover behavior: glass card lifts 2px, tint opacity increases, the suggested-action chip's icon pulses once. Reduced-motion users get only the tint.

### 4.5 Quickstart ("what to do next")

Heading: "What to try first." Sub: "Three personas, three guided 60-second flows. The demo data is pre-baked."

Persona tabs (segmented control, glass): **Issuer · Distributor · Investor**. Each panel shows 3 numbered glass tiles, side-by-side on desktop:

**Issuer panel:**

1. **Open the Issuer Workbench** → `/issuer/`. *"Lands on the products list. The pre-baked product `MMF-DEMO-PENDING` is visible at the top."*
2. **Open product detail** → `/issuer/products/MMF-DEMO-PENDING`. *"You'll see the lifecycle state machine — Draft → Pending Approval → Active. The Transition button is wired."*
3. **Approve the transition** → click "Approve transition". *"Audit timeline updates; navigate to Ops to see the same event reflected."*

**Distributor panel:**

1. **Open Distributor Approvals** → `/distributor/`. *"Approval queue lists `SUB-DEMO-PENDING`."*
2. **Inspect a pending subscription** → click the row. *"Detail view shows investor, product, amount, KYC state."*
3. **Approve or reject** → click either action. *"Toast confirms; row drops out of the queue."*

**Investor panel:**

1. **Browse products** → `/investor/products`. *"Demo product `MMF-DEMO-ACTIVE` is subscribable."*
2. **Open a product, click Subscribe** → fill the form, submit. *"Redirects to `/subscriptions/SUB-DEMO-PENDING`."*
3. **Watch the audit timeline** → scroll to "Activity". *"Three pre-baked events trace the lifecycle."*

Each step has a small "→ Take me there" link wired with `target="_self"` so the demo continues in the same window.

JS responsibility: tab switching only — keyboard arrow keys, ARIA `role="tablist"`/`tab`/`tabpanel`, `aria-selected` toggles.

### 4.6 Solutions (4 capability tiles)

Mirrors hydrax.io's "Industry Applications" rhythm. 4-up grid on desktop, 2-up tablet, 1-up mobile. Each:

- **Issuance.** Image. "Spin up a new tokenised product, walk it through approval, and publish to your distribution network."
- **Distribution.** Image. "Approve subscriptions, manage allocations, and track investor onboarding state across your distributor network."
- **Servicing.** Image. "Investor self-service for subscriptions, redemptions, and audit. Read-only by default — entitlements decide what they see."
- **Compliance & audit.** *No image — glass tile with lucide `lock` icon at center.* "Every state transition is logged with actor, timestamp, and evidence. Hand it to your auditors."

### 4.7 Trust (deferred for v1, placeholder rule)

Single quote tile, glass:

> *"Multi-party workflow that holds up under MAS scrutiny is the difference between a tokenisation pilot and a tokenisation business."*  
> — Operating partner, financial services design partner *(placeholder, replace with real attribution post-Q4)*

3 logo placeholders (`.trust__logo`) — render as text wordmarks until real partners land. Marked with `data-placeholder="true"` so they can be swapped without a CSS change.

### 4.8 Contact

- Heading: "Talk to us."
- Sub: "We're picking design partners now. If you're an issuer, distributor, or fund admin running tokenised products on HydraX, we'd like to hear what hurts."
- Big email link (lucide `mail` icon): `partnerships@hydrax-app.dev` *(placeholder address — owner to replace before public launch)*.
- Sub-links row: "View the PRD" (anchor to `/docs/prd.md` if hosted, otherwise external github link), "Read the architecture" (`/docs/architecture.md`), "Open the demo" (anchor `#portals`).

### 4.9 Footer

4 columns:

1. **Product:** Issuer Portal, Distributor Portal, Investor Portal, Ops Console, Admin
2. **Platform:** PRD, Architecture, Demo flow, Status
3. **HydraX rails:** [hydrax.io →](https://www.hydrax.io/) (external link with rel=noopener), Tokenisation, Custody, Exchange (each linking to the relevant hydrax.io page)
4. **Company:** About, Contact, Careers (placeholder), Privacy

Bottom legal: "© 2026 HydraX Workflow. Built above the regulated rails of [Hydra X Pte. Ltd.](https://www.hydrax.io/)."

## §5 — Verification Gate (the "no broken builds" line)

Run all 5 checks before commit. Match the format used in `STATE.yaml.verification_log`:

1. `node --check web/portal-deploy/app.js` — must exit 0.
2. ID audit — every `document.getElementById("x")` in app.js has a matching `id="x"` in index.html. Zero misses.
3. CSS audit — every class referenced in index.html is declared in styles.css.
4. `wc -l web/portal-deploy/{index.html,app.js,styles.css}` — record the three counts.
5. Local smoke: `cd web/portal-deploy && npx serve . -l 3457 --no-clipboard` then `curl -s http://localhost:3457/` returns the new title `HydraX Workflow | Institutional Onboarding & Issuance Workspace`. Stop the server.
6. Asset audit — every path in HTML+CSS resolves on disk (`for f in $(grep -roE "assets/[a-zA-Z0-9_-]+\.(jpg|json|svg|png)" web/portal-deploy/{index.html,styles.css} | cut -d: -f2 | sort -u); do test -f web/portal-deploy/$f || echo "MISSING $f"; done`).
7. `git diff --stat` — confirm exactly the expected files changed.

## §6 — Tasks (the bite-sized list)

Tasks are split across 4 parallel agents (HTML, CSS, JS, imagery) plus a main-session integration step. The DOM contract in §2 is the only shared state. **Run agents in a single message** so they execute concurrently.

### Task 1: Generate hero + solutions imagery (Agent D — imagery, no code)

**Files:**
- Create: `web/portal-deploy/assets/hero-bg.jpg`
- Create: `web/portal-deploy/assets/solutions-issuance.jpg`
- Create: `web/portal-deploy/assets/solutions-distribution.jpg`
- Create: `web/portal-deploy/assets/solutions-servicing.jpg`
- Create: `web/portal-deploy/assets/assets-meta.json`

- [ ] **Step 1: Generate hero-bg via nano-banana**

Prompt (verbatim):

> Abstract architectural photograph for an institutional fintech landing page. Deep navy and graphite, with subtle indigo and teal highlights. A modern bank-vault interior reimagined: long perspective corridor, soft volumetric light from above, hint of brushed-metal partitions, no people, no text. Slightly cinematic, slightly cold, MAS regulator-grade. 16:9, 2400×1350. No logos, no UI, no glass-panel mockups, no charts.

Output: `assets/hero-bg.jpg`. Target 280-380 KB at 80% JPEG quality. Resize if larger than 480 KB.

- [ ] **Step 2: Generate solutions-issuance**

> Editorial macro photo: a single transparent token-shaped acrylic disc resting on a dark slate desk under one warm overhead light, paperwork edge visible at frame margin. Deep navy + warm amber accent. Institutional, calm, document-led. 4:3, 1200×900.

- [ ] **Step 3: Generate solutions-distribution**

> Top-down editorial photo: a network of brushed-metal cables converging into a single hub on dark slate, soft directional lighting, no logos. Suggests routed flow, brokerage allocation. Deep navy + cool steel. 4:3, 1200×900.

- [ ] **Step 4: Generate solutions-servicing**

> Editorial photo of a worn institutional client portfolio binder open at an indexed page on a dark walnut desk, a fountain pen resting beside it, single warm desk-lamp light from upper-left. Suggests servicing, statements, audit. Deep brown + warm cream. 4:3, 1200×900.

- [ ] **Step 5: Write `assets-meta.json`**

```json
{
  "generated_at": "2026-04-26",
  "tool": "nano-banana via openrouter",
  "consumed_by": "web/portal-deploy",
  "assets": [
    {
      "file": "hero-bg.jpg",
      "prompt": "<verbatim prompt from Step 1>",
      "dimensions": "2400x1350",
      "consumed_by": "styles.css :: .hero__bg"
    },
    {
      "file": "solutions-issuance.jpg",
      "prompt": "<verbatim prompt from Step 2>",
      "dimensions": "1200x900",
      "consumed_by": "index.html :: .solution-card__media (Issuance)"
    },
    {
      "file": "solutions-distribution.jpg",
      "prompt": "<verbatim prompt from Step 3>",
      "dimensions": "1200x900",
      "consumed_by": "index.html :: .solution-card__media (Distribution)"
    },
    {
      "file": "solutions-servicing.jpg",
      "prompt": "<verbatim prompt from Step 4>",
      "dimensions": "1200x900",
      "consumed_by": "index.html :: .solution-card__media (Servicing)"
    }
  ]
}
```

- [ ] **Step 6: Verify file sizes**

Run: `ls -lh web/portal-deploy/assets/`. Each .jpg must be 60-450 KB. If any image exceeds 480 KB, re-encode with `cwebp` or `magick` at lower quality.

**Stop condition:** 4 .jpg files + 1 .json file present, total assets folder under 1.5 MB.

---

### Task 2: HTML rewrite (Agent A — HTML)

**Files:**
- Modify (full rewrite): `web/portal-deploy/index.html`

**Constraints:**
- Match §2 DOM contract exactly. No invented IDs or class names.
- Use inline lucide SVG (paths from `lucide-static@0.378`). No `<img>` for icons.
- Asset paths exactly as listed in §2.4. Do not link assets that won't exist (Agent D produces them).
- Title: `HydraX Workflow | Institutional Onboarding & Issuance Workspace`
- `<meta name="description">`: `White-label workflow workspace for issuers, distributors, investors, and ops teams running tokenised products on HydraX rails.`
- No `<script>` tag in head — single `<script src="app.js" defer>` immediately before `</body>`.
- No external CSS or JS — only `<link rel="stylesheet" href="styles.css">`.
- 5 portal cards in §4.4 order.
- 3 quickstart panels in §4.5, only one (`data-persona="issuer"`) initial-active.
- 4 solution cards in §4.6 order — last one is the no-image Compliance variant.

- [ ] **Step 1: Write the file end-to-end matching §2 + §4.**

Lines target: ~330. If you go over 380, it's bloat — trim narrative, not structure.

- [ ] **Step 2: Self-audit**

```
grep -oE 'id="[a-zA-Z][a-zA-Z0-9_-]+"' web/portal-deploy/index.html | sort -u > /tmp/html-ids
```

Ensure these 8 IDs from §2.2 are present: `nav navToggle navMenu solutionsTrigger solutionsMenu personaTabs personaPanels toastRegion`. Any missing → add the section.

- [ ] **Step 3: Asset reference audit**

```
grep -oE 'assets/[a-zA-Z0-9_-]+\.(jpg|json|svg|png)' web/portal-deploy/index.html | sort -u
```

Must list exactly: `assets/solutions-issuance.jpg`, `assets/solutions-distribution.jpg`, `assets/solutions-servicing.jpg`. (Hero bg lives in CSS, not HTML.)

- [ ] **Step 4: Lucide audit**

Every `<svg>` in the file must have an `aria-hidden="true"` attribute (icons are decorative). Every interactive element with an icon-only label must have `aria-label`.

**Return:** Path to file, line count, list of section IDs in order.

---

### Task 3: CSS rewrite (Agent B — CSS)

**Files:**
- Modify (full rewrite): `web/portal-deploy/styles.css`

**Constraints:**
- Implement the token system from §3 verbatim (custom-property names exact).
- Implement `.glass`, `.glass--nav`, `.glass--card`, `.glass--button`, `.glass--button-primary`, `.glass--inset` exactly as described.
- Wrap `backdrop-filter` rules in `@supports (backdrop-filter: blur(1px))` OR provide a fallback solid-bg branch per §3.
- All class names from §2.3 must appear at least once with concrete declarations.
- `prefers-reduced-motion: reduce` block at the bottom: zero out all transition/animation durations and remove transform animations (keep opacity changes).
- `prefers-color-scheme` is NOT honored — the page is dark by design. Document this in a top-of-file comment.
- Mobile breakpoint at 880px (compact nav, stack hero copy + tile, 1-up portal grid below 600px).
- Anti-pattern guard: `.glass` on body or `<main>` is a CSS error — keep glass on cards/nav/buttons only.

- [ ] **Step 1: Write tokens block at the top.**

- [ ] **Step 2: Write base reset + body + container.**

- [ ] **Step 3: Write `.glass` mixin + variants.**

- [ ] **Step 4: Write nav (sticky, glass, mobile sheet).**

- [ ] **Step 5: Write hero (bg image + overlay + grid + glass tile).**

- [ ] **Step 6: Write value-strip + portals + quickstart + solutions + trust + contact + footer.**

- [ ] **Step 7: Write the prefers-reduced-motion block.**

- [ ] **Step 8: Write imagery fail-soft fallbacks.**

`.hero__bg` and every `.solution-card__media` rule must include a gradient fallback that renders if the JPEG 404s. Concrete rules:

```css
.hero__bg {
  background-color: var(--hx-bg-elevated);
  background-image:
    linear-gradient(180deg, rgba(10, 14, 26, 0.55) 0%, rgba(10, 14, 26, 0.92) 100%),
    radial-gradient(ellipse at 20% 30%, rgba(94, 168, 255, 0.18), transparent 55%),
    radial-gradient(ellipse at 80% 60%, rgba(43, 111, 230, 0.14), transparent 60%),
    url("assets/hero-bg.jpg");
  background-size: cover;
  background-position: center;
}
.solution-card__media {
  background:
    linear-gradient(135deg, rgba(94, 168, 255, 0.18) 0%, rgba(20, 28, 48, 0.55) 100%),
    var(--hx-bg-elevated);
  background-size: cover;
  background-position: center;
}
.solution-card__media[data-img="issuance"]    { background-image: linear-gradient(180deg, rgba(10,14,26,0.35), rgba(10,14,26,0.65)), url("assets/solutions-issuance.jpg"); background-size: cover; background-position: center; }
.solution-card__media[data-img="distribution"] { background-image: linear-gradient(180deg, rgba(10,14,26,0.35), rgba(10,14,26,0.65)), url("assets/solutions-distribution.jpg"); background-size: cover; background-position: center; }
.solution-card__media[data-img="servicing"]    { background-image: linear-gradient(180deg, rgba(10,14,26,0.35), rgba(10,14,26,0.65)), url("assets/solutions-servicing.jpg"); background-size: cover; background-position: center; }
```

A missing JPEG falls back to the gradient layer — pages still render acceptably.

- [ ] **Step 9: Self-audit**

```
grep -oE '\.[a-z][a-zA-Z0-9_-]*' web/portal-deploy/styles.css | sort -u > /tmp/css-classes
```

Cross-check against §2.3. Every class listed there must appear in `/tmp/css-classes`.

Lines target: ~720. Anything over 850 → likely duplicated rules.

**Return:** Path to file, line count, list of media-query breakpoints used.

---

### Task 4: JS rewrite (Agent C — JS)

**Files:**
- Modify (full rewrite): `web/portal-deploy/app.js`

**Constraints:**
- IIFE-wrapped, no globals besides one optional `window.HydraxLanding` for debug.
- Every IDed element from §2.2 is queried via `document.getElementById`. If the element is missing, log a console.warn and continue — never throw.
- No event listener targets a class — use IDs and dataset attributes only.
- No external dependencies. No fetch. No localStorage (user signaled in past mistakes that landing-page persistence is over-engineering).
- Keyboard support on persona tabs: arrow-left/arrow-right cycles, home/end jumps to first/last, enter/space activates.
- Solutions dropdown: hover-open on desktop pointer devices, click-toggle on touch and keyboard. Close on outside click, escape, or focus moving outside the menu.
- Mobile menu: trap focus when open, restore on close, scroll-lock body.
- Smooth-scroll on anchor links to in-page sections, but respect `prefers-reduced-motion`.
- Toast helper: `showToast(message, { tone })` — auto-dismisses after 3s, max 2 stacked.

- [ ] **Step 1: Write the IIFE skeleton + element queries with null-safety.**

- [ ] **Step 2: Wire nav scroll-class (`is-scrolled`) via `IntersectionObserver` watching a 1px sentinel at top of `<main>`, NOT a scroll listener.**

- [ ] **Step 3: Wire mobile menu toggle (focus trap + scroll lock).**

- [ ] **Step 4: Wire solutions dropdown (hover/click/keyboard/escape).**

- [ ] **Step 5: Wire persona tabs (`role=tablist`, arrow keys, aria-selected).**

- [ ] **Step 6: Wire smooth-scroll for `a[href^="#"]` with reduced-motion respect.**

- [ ] **Step 7: Wire `showToast` (used: persona switch announces "Switched to <persona> path").**

- [ ] **Step 8: Self-audit**

```
node --check web/portal-deploy/app.js   # must exit 0
grep -oE 'getElementById\("[a-zA-Z]+"\)' web/portal-deploy/app.js | sort -u
```

Cross-check IDs against §2.2.

Lines target: ~110. If you cross 180, you've over-engineered something.

**Return:** Path to file, line count, list of IDs queried.

---

### Task 5: Integration + verification (main session, sequential, after Tasks 1-4 return)

- [ ] **Step 1: Run the prototype gate**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
node --check web/portal-deploy/app.js
echo "---ID audit---"
HTML_IDS=$(grep -oE 'id="[a-zA-Z][a-zA-Z0-9_-]+"' web/portal-deploy/index.html | sort -u)
JS_IDS=$(grep -oE 'getElementById\("[a-zA-Z]+"\)' web/portal-deploy/app.js | sed 's/getElementById("\(.*\)")/id="\1"/' | sort -u)
diff <(echo "$JS_IDS") <(echo "$HTML_IDS" | grep -F "$JS_IDS") || true
echo "---Asset audit (warn-only — CSS has gradient fallbacks)---"
for f in $(grep -rohE 'assets/[a-zA-Z0-9_-]+\.(jpg|json|svg|png)' web/portal-deploy/index.html web/portal-deploy/styles.css | sort -u); do
  test -f "web/portal-deploy/$f" && echo "OK $f" || echo "WARN MISSING $f (gradient fallback active)"
done
echo "---Sizes---"
wc -l web/portal-deploy/{index.html,styles.css,app.js}
```

Expected: zero ID diff. Asset MISSING is a warning — the CSS gradient-fallback rules from Task 3 §8 keep the page rendering acceptably. If `hero-bg.jpg` is missing, the hero gets the gradient mesh; if a `solutions-*.jpg` is missing, the solution card shows its gradient. Update `assets-meta.json` to drop entries for any asset that didn't ship before staging.

- [ ] **Step 2: Local smoke**

```bash
cd web/portal-deploy && (npx serve . -l 3458 --no-clipboard &) && sleep 2
curl -s http://localhost:3458/ | head -20 | grep -F "Institutional Onboarding"
curl -sI http://localhost:3458/styles.css | head -3
curl -sI http://localhost:3458/app.js | head -3
curl -sI http://localhost:3458/assets/hero-bg.jpg | head -3
pkill -f "serve . -l 3458" || true
```

All HTTP heads must return 200.

- [ ] **Step 3: Update STATE.yaml**

Append a `verification_log` entry in the established format. Bump `current_focus` to reference the cleanup. Do NOT overwrite — append.

**Concurrency check (per past-mistake "working tree mutates between Bash calls"):** before staging,

```bash
git diff STATE.yaml | head -40
```

Confirm the only modifications are (a) the new `verification_log` line you appended and (b) the scoped `current_focus` bump. If anything else differs (a parallel session edited it), `git checkout -- STATE.yaml`, then re-apply just your two changes via Edit, then re-diff before staging.

- [ ] **Step 4: Commit (no push, no deploy)**

Single commit. The work is one concern: the landing rewrite. The 5 staged files are the 3 code files + the 5 asset files (4 jpg + 1 json) — within the 15-file commit cap. STATE.yaml is appended in the same commit per the prototype-slice convention.

```bash
git add web/portal-deploy/index.html web/portal-deploy/styles.css web/portal-deploy/app.js
git add web/portal-deploy/assets/
git add STATE.yaml
git diff --cached --name-only   # confirm scope
git diff --cached --stat
git commit -m "$(cat <<'EOF'
feat(deploy/portal-landing): rewrite landing as institutional workflow workspace

Replaces the inherited execution-trading prototype landing (Adaptive
Liquidity Command, orders/venues/risk workspace) with a hydrax.io-aligned
institutional landing focused on the 5 portal entry points and three
60-second persona quickstart flows.

Liquid-glass surface treatment via backdrop-filter, custom-property
token system (--hx-glass-*), reduced-motion-respecting interactions.
Inline lucide SVGs only — no emoji, no icon font.

Changes a single deploy target (web/portal-deploy/). The standalone
prototype at the repo root and the 5 React portal builds are untouched.
EOF
)"
```

- [ ] **Step 5: STOP. Do NOT deploy.** Surface the diff to the user.

Deploy to a public URL (`hydrax-portals-production.up.railway.app`) is a shared-systems modification — auto mode does not authorize it. Run:

```bash
git log -1 --stat
git status
railway status 2>/dev/null | head -20 || echo "railway CLI not linked or not installed"
railway service 2>/dev/null | head -20 || true
```

Report to the user:
- The single commit sha + diff stat.
- Whether `hydrax-portals` Railway service is currently auto-deploy-from-GitHub OR manual `railway up --detach` (do not assume — CLAUDE.md's auto-deploy-OFF note refers to tradeclaw's `web` service, NOT `hydrax-portals`).
- The two deploy options:
  1. If auto-deploy is wired: `git push origin main` and Railway picks it up. State the expected delay.
  2. If manual: user runs `cd web/portal-deploy && railway up --detach` themselves, OR explicitly authorizes you to do so with the phrase `deploy hydrax-portals — approved`.

Wait for explicit user authorization. Do not deploy on a generic "yes" or "continue" — per past-mistake `urgency-as-authorization`, only the named phrase counts.

- [ ] **Step 6: After user authorizes deploy**

Once user authorizes (either by deploying themselves or with the named phrase):
- If user deployed themselves, ask them to confirm the deployment id + status. Curl-check the live URL.
- If user authorized you: run `cd web/portal-deploy && railway up --detach`. Capture deployment id + status. `curl -sI https://hydrax-portals-production.up.railway.app/` must return 200. Curl-check the rendered title contains "Institutional Onboarding".

Append to STATE.yaml `verification_log`:

```
2026-04-26 — portal-landing-cleanup: node --check passes; ID audit clean; asset audit warn-only (gradient fallbacks active); wc -l index.html=N styles.css=N app.js=N; local serve smoke 200; git diff --stat confirms 3 code files + N assets + STATE.yaml; commit <sha>; deploy authorized by user; railway deployment id=<...> status=SUCCESS; live https://hydrax-portals-production.up.railway.app returns 200 with new title. Visual fit verification deferred to user (gate only proves contracts + HTTP, not layout).
```

## §7 — Out of scope (write down so it doesn't creep)

- React portal app changes (untouched).
- Real backend wiring (still demo-mode).
- Real customer logos / quotes (placeholders, marked `data-placeholder="true"`).
- A11y audit beyond skip-link, ARIA on tabs/dropdown, alt-text. (Run a separate WCAG slice later.)
- Multi-language (English only).
- Light theme (dark only by design).
- Standalone prototype landing at the repo root — that's a different deploy.

## §8 — Self-Review Checklist

Run through after writing. Fix in place. Don't re-review.

- [ ] Spec coverage: every section in §4 has a task that produces it.
- [ ] No placeholders in tasks: every `<…>` is a literal value the agent fills.
- [ ] Type/name consistency: every class/ID in §2 appears in HTML, CSS, or JS tasks; nothing referenced that isn't declared.
- [ ] Verification gate (§5) is a single block of bash that an engineer can paste and run.
- [ ] Imagery prompts (Task 1) are verbatim — the agent doesn't have to invent a prompt.
- [ ] DOM contract (§2) is detailed enough that 4 agents can work in isolation.
- [ ] Glass treatment is bounded (anti-pattern guard) — not "make everything glass".
- [ ] Lucide-only / no-emoji / no-icon-font rules are stated for all 4 agents.
- [ ] Single commit, ≤15 files, conventional message — matches CLAUDE.md commit discipline.
- [ ] Railway deploy step is explicit about `up --detach` (auto-deploy off).
