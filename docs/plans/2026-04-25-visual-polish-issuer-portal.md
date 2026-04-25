# Visual Polish — Issuer Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Required execution skills (invoke during the matching phases):**
> - `frontend-design` + `taste-skill` — Phases 2, 3, 5 (primitive design, AppShell upgrade, Home polish). These override default LLM aesthetic biases.
> - `design-system` — Phase 1 (token expansion) and Phase 2 (primitive library expansion).
> - `nano-banana` — Phase 4 (hero asset generation). REQUIRED for any image generation.

**Goal:** Take `@hydrax/issuer-portal` from a placeholder Vite shell to a production-grade institutional dashboard — real typography, real spacing, real layout, real sidebar nav, real top bar, one Home route with stat tiles + activity skeleton + empty state, and one nano-banana hero asset for the AppShell empty state. The four other apps remain on the existing scaffold and get a templated polish plan in a separate doc.

**Architecture:** Foundation-up. Phase 1 expands `@hydrax/tenant-theme` tokens (typography scale, spacing scale, shadows, motion). Phase 2 adds primitives to `@hydrax/ui` (Stack, Heading, Text, Skeleton, EmptyState, NavItem, Avatar). Phase 3 upgrades `<AppShell>` with real top bar + sidebar slots that consume the new primitives. Phase 4 generates one hero asset via nano-banana. Phase 5 polishes the issuer-portal Home route. Phase 6 verifies the other four apps still render. Phase 7 locks invariants.

**Tech Stack:** Same as scaffold — pnpm 9, Node 20, TypeScript 5.4, Vite 5, React 18, vitest, jsdom, lucide-react. **No additions.** No Tailwind, no shadcn, no styled-components, no Storybook, no Playwright. CSS variables + inline styles only — matches existing scaffold convention locked in [CLAUDE.md](../../CLAUDE.md) "Web Monorepo — Invariants".

---

## Boundary Conditions (read before starting)

1. **PRD §14 gates remain open.** No real tenant data, no real product types, no auth. Stat tiles render literal `--` for unknown values. Activity feed renders skeleton state by default with no fake data.
2. **No emoji anywhere** ([CLAUDE.md](../../CLAUDE.md) global rule). Lucide icons only.
3. **No new dependencies.** Inline styles consume CSS variables defined in `@hydrax/tenant-theme`. If you reach for a CSS-in-JS library or a utility-class generator, stop and reconsider — the scaffold proved inline styles work for primitive surfaces.
4. **No fake data.** Stat tiles show `--`. Activity feed shows skeleton then empty state. Do not invent product names, deal sizes, tenant logos, etc. — that prejudices PRD §14 Q3/Q4 decisions.
5. **Per-commit caps still apply.** ≤15 files per commit. One concern per commit. Lead commit messages with the outcome.
6. **Cross-app consistency.** Every change to `<AppShell>` props or `@hydrax/ui` exports must keep all 5 apps' tests green. Phase 6 enforces this — do not skip it.
7. **Worktree recommended for execution.** Main has an active multi-agent system (recent example: 4+ commits landed during the previous scaffold plan execution). Use `git worktree add -b feat/visual-polish-issuer-portal /home/naim/.openclaw/workspace/hydrax-app.visual-polish main` to isolate.
8. **STATE.yaml deferred to merge-time.** Per the scaffold plan's pattern, do not edit STATE.yaml inside the worktree — append entries to the "Verification log" section at the bottom of THIS plan doc instead, then migrate at merge.
9. **Out-of-scope, do not smuggle in:** auth screens, login flows, tenant switcher logic, real notifications, real search backend, dark/light mode toggle, multi-language (i18n), animation library (framer-motion etc.), test ID overhaul, accessibility audit beyond what the primitives mandate.

## Aesthetic Direction (locked)

Decisions made now so execution does not relitigate.

| Aspect | Choice | Reference (no fabrications, just direction) |
|---|---|---|
| Mood | Dark, dense, institutional | Linear, Stripe Dashboard, Bloomberg Terminal direction — high information density, restrained color |
| Type — UI | Inter (already in default-theme as fallback chain) | — |
| Type — figures/code | JetBrains Mono (already in default-theme) | — |
| Color usage | Accent only for actions/state. Surface/border via existing CSS vars. | Existing `--hydrax-color-accent` is the lone "go" color |
| Density | Tight: 4px base unit (already in `spaceUnit`), 12-14px body, generous line-height | — |
| Motion | Fade/slide, 150-250ms, ease-out. No bounce, no spring physics. | CSS `transition` only; no JS animation libs |
| Imagery | Generated only where it adds signal — login hero (out of scope) and one major empty state. No stock photos, no decorative gradients-as-substitute. | Phase 4 generates one asset |
| Icons | lucide-react only, wrapped in `<Icon>` (a11y label mandatory) | Already locked in CLAUDE.md |
| Borders | 1px solid `--hydrax-color-border`, occasional 1px accent for selected/active | — |
| Shadows | Two levels max: `sm` for cards, `md` for popovers/menus. No glass, no glow. | New tokens in Phase 1 |
| Radius | Existing 4/8/12 scale stays | — |
| Layout grid | Existing AppShell grid stays. Sidebar 240px, topbar 56px. | — |

**Anti-patterns explicitly forbidden:**
- Gradients-as-decoration (gradients only as button hover/pressed states if needed)
- Glassmorphism (no backdrop-filter)
- Playful illustrations (lucide line-icons only)
- Marketing-page UX in an operator dashboard
- Multiple primary CTAs on one screen
- More than 2 accent-color elements visible at once

## File Structure

```
hydrax-app/
  docs/plans/2026-04-25-visual-polish-issuer-portal.md     # this plan
  web/
    packages/
      tenant-theme/
        src/
          types.ts                                         # MODIFY — extend TenantThemeTokens
          default-theme.ts                                 # MODIFY — populate new tokens
          applyTheme.ts                                    # MODIFY — write new CSS vars
          applyTheme.test.ts                               # MODIFY — assert new vars
      ui/
        src/
          Stack.tsx                                        # NEW — vertical/horizontal layout
          Stack.test.tsx                                   # NEW
          Heading.tsx                                      # NEW — h1-h6 with type scale
          Heading.test.tsx                                 # NEW
          Text.tsx                                         # NEW — body/muted/mono variants
          Text.test.tsx                                    # NEW
          Skeleton.tsx                                     # NEW — loading shimmer
          Skeleton.test.tsx                                # NEW
          EmptyState.tsx                                   # NEW — icon + heading + body + optional CTA
          EmptyState.test.tsx                              # NEW
          NavItem.tsx                                      # NEW — sidebar entry with icon, active, badge
          NavItem.test.tsx                                 # NEW
          Avatar.tsx                                       # NEW — initials fallback
          Avatar.test.tsx                                  # NEW
          AppShell.tsx                                     # MODIFY — real layout slots + brand
          AppShell.test.tsx                                # MODIFY — extend assertions
          index.ts                                         # MODIFY — export new primitives
          assets/
            issuer-empty-state.png                         # NEW (Phase 4 — nano-banana generated)
            assets-meta.json                               # NEW (Phase 4 — generation metadata, see Phase 4 spec)
    apps/
      issuer-portal/
        src/
          App.tsx                                          # MODIFY — real nav + topbar + Home route mount
          App.test.tsx                                     # MODIFY — assert sidebar items + topbar elements
          routes/
            HomeRoute.tsx                                  # NEW — stat tiles + activity skeleton + empty state
            HomeRoute.test.tsx                             # NEW
          components/
            IssuerSidebar.tsx                              # NEW — issuer-portal-specific nav config
            IssuerTopBar.tsx                               # NEW — brand + search placeholder + user menu
```

**Why this split:** Tokens, primitives, and AppShell live in shared packages so the four follow-up apps inherit the upgrade for free. Issuer-portal-specific routes/components stay in the app directory because nav copy and brand are not shared.

## Decision Log (locked before tasks)

| Decision | Choice | Why |
|---|---|---|
| CSS-in-JS lib | None — inline `style` props consuming CSS vars | Scaffold convention; CLAUDE.md invariant |
| Utility CSS | None — no Tailwind | CLAUDE.md invariant |
| Visual regression | None — vitest assertions + manual browser smoke | No new deps; matches existing test discipline |
| Storybook | None | YAGNI for 7 primitives; manual smoke is enough |
| Animation | CSS `transition` only | YAGNI for fade/slide |
| Skeleton shimmer | CSS `@keyframes` in inline `<style>` tag at AppShell root, OR per-component inline | Per-component; keep AppShell simple |
| Stat tile data | `--` literal placeholder | No fake data |
| Activity feed | Skeleton (3 rows) by default; empty state if `connected={false}` prop | No real backend yet |
| Hero image format | PNG, ~1200×800, optimized via vite asset pipeline | Generic enough; vite handles loading |
| Hero placement | Empty-state inside `HomeRoute` activity panel only | Login hero deferred (auth not in scope) |

## Verification Gates (every phase)

After every phase, all of these must pass before the commit:

1. `pnpm -F @hydrax/<workspace> typecheck` — clean
2. `pnpm -F @hydrax/<workspace> test -- --run` — all tests green; no `.skip`, no `.only`
3. `pnpm -F @hydrax/<workspace> build` — emits `dist/`
4. For Phase 3+ (touches AppShell): also run `pnpm -F @hydrax/issuer-portal test -- --run` + `build` — must stay green; if not, fix immediately
5. For Phase 5+: run `pnpm -F @hydrax/issuer-portal dev` and visit `http://localhost:5173/` in a browser. Visually verify the Home route. Capture observations in the commit message if any deviations from the plan.
6. `git diff --stat` — confirm only files listed for the phase changed

If any gate fails, fix the underlying cause. Never `--no-verify`. Never delete a failing test to make the suite pass.

---

## Phase 0: Worktree Setup + Plan Commit

**Files:**
- Create: `docs/plans/2026-04-25-visual-polish-issuer-portal.md` (this file, already exists at write-time)

**Goal:** Establish the worktree branch and commit this plan doc to it as the first action so all subsequent phases run inside isolation.

- [ ] **Step 1: Create worktree from current `main` HEAD**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git worktree add -b feat/visual-polish-issuer-portal \
  /home/naim/.openclaw/workspace/hydrax-app.visual-polish main
git worktree list
```

Expected: `git worktree list` shows two entries — main worktree and the new `hydrax-app.visual-polish` worktree on `feat/visual-polish-issuer-portal`.

- [ ] **Step 2: Switch into the worktree for all subsequent work**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app.visual-polish
git branch --show-current
```

Expected: `feat/visual-polish-issuer-portal`.

- [ ] **Step 3: Confirm the plan doc exists**

```bash
test -f docs/plans/2026-04-25-visual-polish-issuer-portal.md && echo "plan present"
```

Expected: `plan present`. If missing (worktree was branched from a commit before the plan was committed on main), copy the file from the main worktree:

```bash
cp /home/naim/.openclaw/workspace/hydrax-app/docs/plans/2026-04-25-visual-polish-issuer-portal.md docs/plans/
git add docs/plans/2026-04-25-visual-polish-issuer-portal.md
git commit -m "docs(plans): visual polish for issuer-portal plan

Plan: docs/plans/2026-04-25-visual-polish-issuer-portal.md (Phase 0)"
```

- [ ] **Step 4: Confirm gate baseline before any code changes**

```bash
pnpm install --no-frozen-lockfile
pnpm -F "./web/packages/*" build
pnpm -F @hydrax/issuer-portal typecheck
pnpm -F @hydrax/issuer-portal test -- --run
pnpm -F @hydrax/issuer-portal build
```

Expected: install clean, all 3 packages build, issuer-portal typechecks + 2 tests pass + build emits dist/. If any of these fails BEFORE this plan touches code, stop and report — the worktree base is broken.

- [ ] **Step 5: Verify HEAD**

```bash
git log --oneline -3
```

Expected: HEAD is `feat/visual-polish-issuer-portal` with either the plan doc commit (if Step 3's copy path ran) or the plan already present from main. Either way, no other code edits.

---

## Phase 1: Expand `@hydrax/tenant-theme` Tokens

**Files:**
- Modify: `web/packages/tenant-theme/src/types.ts`
- Modify: `web/packages/tenant-theme/src/default-theme.ts`
- Modify: `web/packages/tenant-theme/src/applyTheme.ts`
- Modify: `web/packages/tenant-theme/src/applyTheme.test.ts`

**Goal:** Add typography scale, spacing scale, shadow tokens, motion tokens, and 3 semantic state tokens. Tests assert every new token writes to a `--hydrax-*` CSS variable.

### Token additions

Add to `TenantThemeTokens`:

```
typeDisplaySize, typeDisplayLineHeight, typeDisplayWeight  — for marketing-style hero (1)
typeH1Size, typeH1LineHeight, typeH1Weight                — page title (1)
typeH2Size, typeH2LineHeight, typeH2Weight                — section title (1)
typeBodySize, typeBodyLineHeight                          — default body (1)
typeBodySmSize, typeBodySmLineHeight                      — secondary text (1)
typeMonoSize                                              — figures (1)

spaceXs, spaceSm, spaceMd, spaceLg, spaceXl, space2xl     — 4/8/12/16/24/32 px steps

shadowSm, shadowMd                                        — card / popover

motionFast, motionMedium                                  — 150ms / 250ms
easeOut                                                   — cubic-bezier(0.16, 1, 0.3, 1)

colorTextStrong                                           — heading color (slightly stronger than colorText)
colorBgRaised                                             — slightly lighter than colorSurface; for selected nav rows
colorFocusRing                                            — focus outline (typically accent at 40% alpha)
```

### Step 1: Modify `web/packages/tenant-theme/src/types.ts`

Replace the `TenantThemeTokens` interface with:

```ts
export interface TenantThemeTokens {
  readonly colorBg: string;
  readonly colorBgRaised: string;
  readonly colorSurface: string;
  readonly colorText: string;
  readonly colorTextStrong: string;
  readonly colorTextMuted: string;
  readonly colorBorder: string;
  readonly colorAccent: string;
  readonly colorAccentSoft: string;
  readonly colorFocusRing: string;
  readonly colorDanger: string;
  readonly colorSuccess: string;

  readonly fontSans: string;
  readonly fontMono: string;

  readonly typeDisplaySize: string;
  readonly typeDisplayLineHeight: string;
  readonly typeDisplayWeight: string;
  readonly typeH1Size: string;
  readonly typeH1LineHeight: string;
  readonly typeH1Weight: string;
  readonly typeH2Size: string;
  readonly typeH2LineHeight: string;
  readonly typeH2Weight: string;
  readonly typeBodySize: string;
  readonly typeBodyLineHeight: string;
  readonly typeBodySmSize: string;
  readonly typeBodySmLineHeight: string;
  readonly typeMonoSize: string;

  readonly spaceUnit: string;
  readonly spaceXs: string;
  readonly spaceSm: string;
  readonly spaceMd: string;
  readonly spaceLg: string;
  readonly spaceXl: string;
  readonly space2xl: string;

  readonly radiusSm: string;
  readonly radiusMd: string;
  readonly radiusLg: string;

  readonly shadowSm: string;
  readonly shadowMd: string;

  readonly motionFast: string;
  readonly motionMedium: string;
  readonly easeOut: string;
}
```

### Step 2: Modify `web/packages/tenant-theme/src/default-theme.ts`

Replace the `DEFAULT_TENANT_THEME` with:

```ts
import type { TenantTheme } from "./types";

export const DEFAULT_TENANT_THEME: TenantTheme = {
  id: "default",
  name: "HydraX Default",
  tokens: {
    colorBg: "hsl(220, 16%, 8%)",
    colorBgRaised: "hsl(220, 14%, 14%)",
    colorSurface: "hsl(220, 14%, 12%)",
    colorText: "hsl(220, 12%, 92%)",
    colorTextStrong: "hsl(220, 12%, 98%)",
    colorTextMuted: "hsl(220, 8%, 64%)",
    colorBorder: "hsl(220, 10%, 22%)",
    colorAccent: "hsl(190, 90%, 55%)",
    colorAccentSoft: "hsla(190, 90%, 55%, 0.12)",
    colorFocusRing: "hsla(190, 90%, 55%, 0.45)",
    colorDanger: "hsl(0, 72%, 58%)",
    colorSuccess: "hsl(140, 60%, 50%)",

    fontSans:
      "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",

    typeDisplaySize: "32px",
    typeDisplayLineHeight: "40px",
    typeDisplayWeight: "600",
    typeH1Size: "22px",
    typeH1LineHeight: "28px",
    typeH1Weight: "600",
    typeH2Size: "16px",
    typeH2LineHeight: "22px",
    typeH2Weight: "600",
    typeBodySize: "13px",
    typeBodyLineHeight: "20px",
    typeBodySmSize: "12px",
    typeBodySmLineHeight: "18px",
    typeMonoSize: "13px",

    spaceUnit: "4px",
    spaceXs: "4px",
    spaceSm: "8px",
    spaceMd: "12px",
    spaceLg: "16px",
    spaceXl: "24px",
    space2xl: "32px",

    radiusSm: "4px",
    radiusMd: "8px",
    radiusLg: "12px",

    shadowSm: "0 1px 2px hsla(220, 30%, 4%, 0.45)",
    shadowMd: "0 6px 16px hsla(220, 30%, 4%, 0.5)",

    motionFast: "150ms",
    motionMedium: "250ms",
    easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
};
```

### Step 3: Modify `web/packages/tenant-theme/src/applyTheme.ts`

Replace the entire file with:

```ts
import type { TenantTheme, TenantThemeTokens } from "./types";

const TOKEN_TO_CSS_VAR: Record<keyof TenantThemeTokens, string> = {
  colorBg: "--hydrax-color-bg",
  colorBgRaised: "--hydrax-color-bg-raised",
  colorSurface: "--hydrax-color-surface",
  colorText: "--hydrax-color-text",
  colorTextStrong: "--hydrax-color-text-strong",
  colorTextMuted: "--hydrax-color-text-muted",
  colorBorder: "--hydrax-color-border",
  colorAccent: "--hydrax-color-accent",
  colorAccentSoft: "--hydrax-color-accent-soft",
  colorFocusRing: "--hydrax-color-focus-ring",
  colorDanger: "--hydrax-color-danger",
  colorSuccess: "--hydrax-color-success",

  fontSans: "--hydrax-font-sans",
  fontMono: "--hydrax-font-mono",

  typeDisplaySize: "--hydrax-type-display-size",
  typeDisplayLineHeight: "--hydrax-type-display-line-height",
  typeDisplayWeight: "--hydrax-type-display-weight",
  typeH1Size: "--hydrax-type-h1-size",
  typeH1LineHeight: "--hydrax-type-h1-line-height",
  typeH1Weight: "--hydrax-type-h1-weight",
  typeH2Size: "--hydrax-type-h2-size",
  typeH2LineHeight: "--hydrax-type-h2-line-height",
  typeH2Weight: "--hydrax-type-h2-weight",
  typeBodySize: "--hydrax-type-body-size",
  typeBodyLineHeight: "--hydrax-type-body-line-height",
  typeBodySmSize: "--hydrax-type-body-sm-size",
  typeBodySmLineHeight: "--hydrax-type-body-sm-line-height",
  typeMonoSize: "--hydrax-type-mono-size",

  spaceUnit: "--hydrax-space-unit",
  spaceXs: "--hydrax-space-xs",
  spaceSm: "--hydrax-space-sm",
  spaceMd: "--hydrax-space-md",
  spaceLg: "--hydrax-space-lg",
  spaceXl: "--hydrax-space-xl",
  space2xl: "--hydrax-space-2xl",

  radiusSm: "--hydrax-radius-sm",
  radiusMd: "--hydrax-radius-md",
  radiusLg: "--hydrax-radius-lg",

  shadowSm: "--hydrax-shadow-sm",
  shadowMd: "--hydrax-shadow-md",

  motionFast: "--hydrax-motion-fast",
  motionMedium: "--hydrax-motion-medium",
  easeOut: "--hydrax-ease-out",
};

export function applyTheme(theme: TenantTheme): void {
  const root = document.documentElement;
  (Object.keys(TOKEN_TO_CSS_VAR) as Array<keyof TenantThemeTokens>).forEach((key) => {
    root.style.setProperty(TOKEN_TO_CSS_VAR[key], theme.tokens[key]);
  });
  root.setAttribute("data-tenant", theme.id);
}
```

### Step 4: Modify `web/packages/tenant-theme/src/applyTheme.test.ts`

Replace the entire file with:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { applyTheme } from "./applyTheme";
import { DEFAULT_TENANT_THEME } from "./default-theme";

describe("applyTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-tenant");
  });

  it("writes every color token as a --hydrax-color-* CSS variable on :root", () => {
    applyTheme(DEFAULT_TENANT_THEME);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--hydrax-color-bg")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorBg,
    );
    expect(root.style.getPropertyValue("--hydrax-color-bg-raised")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorBgRaised,
    );
    expect(root.style.getPropertyValue("--hydrax-color-text-strong")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorTextStrong,
    );
    expect(root.style.getPropertyValue("--hydrax-color-focus-ring")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorFocusRing,
    );
  });

  it("writes every typography token as a --hydrax-type-* CSS variable", () => {
    applyTheme(DEFAULT_TENANT_THEME);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--hydrax-type-display-size")).toBe(
      DEFAULT_TENANT_THEME.tokens.typeDisplaySize,
    );
    expect(root.style.getPropertyValue("--hydrax-type-h1-size")).toBe(
      DEFAULT_TENANT_THEME.tokens.typeH1Size,
    );
    expect(root.style.getPropertyValue("--hydrax-type-body-size")).toBe(
      DEFAULT_TENANT_THEME.tokens.typeBodySize,
    );
    expect(root.style.getPropertyValue("--hydrax-type-mono-size")).toBe(
      DEFAULT_TENANT_THEME.tokens.typeMonoSize,
    );
  });

  it("writes spacing, shadow, and motion tokens", () => {
    applyTheme(DEFAULT_TENANT_THEME);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--hydrax-space-md")).toBe(
      DEFAULT_TENANT_THEME.tokens.spaceMd,
    );
    expect(root.style.getPropertyValue("--hydrax-space-2xl")).toBe(
      DEFAULT_TENANT_THEME.tokens.space2xl,
    );
    expect(root.style.getPropertyValue("--hydrax-shadow-sm")).toBe(
      DEFAULT_TENANT_THEME.tokens.shadowSm,
    );
    expect(root.style.getPropertyValue("--hydrax-motion-medium")).toBe(
      DEFAULT_TENANT_THEME.tokens.motionMedium,
    );
    expect(root.style.getPropertyValue("--hydrax-ease-out")).toBe(
      DEFAULT_TENANT_THEME.tokens.easeOut,
    );
  });

  it("stamps data-tenant=<id> on :root for CSS targeting", () => {
    applyTheme({ ...DEFAULT_TENANT_THEME, id: "acme" });
    expect(document.documentElement.getAttribute("data-tenant")).toBe("acme");
  });

  it("overwrites previous token values and updates data-tenant on re-application", () => {
    applyTheme(DEFAULT_TENANT_THEME);
    applyTheme({
      id: "minimal",
      name: "Minimal",
      tokens: { ...DEFAULT_TENANT_THEME.tokens, colorAccent: "red" },
    });
    expect(document.documentElement.style.getPropertyValue("--hydrax-color-accent")).toBe("red");
    expect(document.documentElement.getAttribute("data-tenant")).toBe("minimal");
  });
});
```

### Step 5: Run the gates

```bash
pnpm -F @hydrax/tenant-theme typecheck
pnpm -F @hydrax/tenant-theme test -- --run
pnpm -F @hydrax/tenant-theme build
```

Expected: typecheck clean. 5 tests pass. Build emits dist/. If typecheck fails because a property is missing from `DEFAULT_TENANT_THEME`, the type-driven check has done its job — fix the constant.

### Step 6: Smoke-test downstream consumers

```bash
pnpm -F "./web/packages/*" build
pnpm -F @hydrax/issuer-portal typecheck
pnpm -F @hydrax/issuer-portal test -- --run
```

Expected: clean. The expanded `TenantThemeTokens` is structurally backward-compatible (only additions); existing consumers (Button, Card, AppShell) keep working.

### Step 7: Stage and commit

```bash
git status --short
git add web/packages/tenant-theme
git diff --cached --stat
```

Expected: 4 files modified. `pnpm-lock.yaml` should not be touched.

```bash
git commit -m "feat(web/tenant-theme): expand tokens for typography, spacing, shadow, motion

Adds 30 new tokens to TenantThemeTokens covering display/h1/h2/body/mono
type scale, 6-step spacing scale, two-level shadows, motion durations
plus easing, and three semantic colors (text-strong, bg-raised,
focus-ring) needed by the AppShell upgrade in Phase 3.

DEFAULT_TENANT_THEME populates all new tokens with the institutional
dark palette per docs/plans/2026-04-25-visual-polish-issuer-portal.md
\"Aesthetic Direction\" table.

5 tests pass. Backward-compatible — Button/Card/AppShell unchanged.

Plan: docs/plans/2026-04-25-visual-polish-issuer-portal.md (Phase 1)"
```

### Step 8: Verify the commit

```bash
git show --stat HEAD
git log --oneline -3
```

Expected: HEAD has 4 files changed. Parent is the Phase 0 commit (or main HEAD if Phase 0 didn't need to copy the plan).

---

## Phase 2: `@hydrax/ui` Primitive Expansion

**Files (new):**
- `web/packages/ui/src/Stack.tsx` + `Stack.test.tsx`
- `web/packages/ui/src/Heading.tsx` + `Heading.test.tsx`
- `web/packages/ui/src/Text.tsx` + `Text.test.tsx`
- `web/packages/ui/src/Skeleton.tsx` + `Skeleton.test.tsx`
- `web/packages/ui/src/EmptyState.tsx` + `EmptyState.test.tsx`
- `web/packages/ui/src/NavItem.tsx` + `NavItem.test.tsx`
- `web/packages/ui/src/Avatar.tsx` + `Avatar.test.tsx`

**Files (modified):**
- `web/packages/ui/src/index.ts`

**Goal:** Add 7 layout/typography/state primitives. Each is a thin wrapper around an HTML element consuming the new CSS vars. Each ships with at least 2 vitest tests asserting structure or behavior. **No new runtime deps.**

This phase is a single commit (touches 14-15 files including test sets and the index.ts re-export). If the file count exceeds 15 due to lockfile churn, split per-primitive — but the install step should not produce lockfile changes since no new deps are added.

### Step 1: Create `web/packages/ui/src/Stack.tsx`

```tsx
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type StackDirection = "row" | "column";
type StackAlign = "start" | "center" | "end" | "stretch";
type StackJustify = "start" | "center" | "end" | "between" | "around";
type StackGap = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  readonly direction?: StackDirection;
  readonly gap?: StackGap;
  readonly align?: StackAlign;
  readonly justify?: StackJustify;
  readonly wrap?: boolean;
  readonly children?: ReactNode;
}

const ALIGN_MAP: Record<StackAlign, CSSProperties["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

const JUSTIFY_MAP: Record<StackJustify, CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
};

export function Stack({
  direction = "column",
  gap = "md",
  align = "stretch",
  justify = "start",
  wrap = false,
  style,
  ...rest
}: StackProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: direction,
        gap: `var(--hydrax-space-${gap})`,
        alignItems: ALIGN_MAP[align],
        justifyContent: JUSTIFY_MAP[justify],
        flexWrap: wrap ? "wrap" : "nowrap",
        ...style,
      }}
      {...rest}
    />
  );
}
```

### Step 2: Create `web/packages/ui/src/Stack.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stack } from "./Stack";

describe("<Stack>", () => {
  it("renders its children", () => {
    render(
      <Stack data-testid="stack">
        <span>a</span>
        <span>b</span>
      </Stack>,
    );
    const stack = screen.getByTestId("stack");
    expect(stack).toBeInTheDocument();
    expect(stack.children).toHaveLength(2);
  });

  it("applies CSS variable for the requested gap size", () => {
    const { rerender } = render(<Stack data-testid="stack" gap="lg" />);
    expect(screen.getByTestId("stack").style.gap).toBe("var(--hydrax-space-lg)");
    rerender(<Stack data-testid="stack" gap="2xl" />);
    expect(screen.getByTestId("stack").style.gap).toBe("var(--hydrax-space-2xl)");
  });

  it("supports row direction", () => {
    render(<Stack data-testid="stack" direction="row" />);
    expect(screen.getByTestId("stack").style.flexDirection).toBe("row");
  });
});
```

### Step 3: Create `web/packages/ui/src/Heading.tsx`

```tsx
import type { HTMLAttributes, ReactNode } from "react";

type HeadingLevel = "display" | "h1" | "h2";

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  readonly level?: HeadingLevel;
  readonly as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  readonly children?: ReactNode;
}

const SIZE_MAP: Record<HeadingLevel, { size: string; lineHeight: string; weight: string }> = {
  display: {
    size: "var(--hydrax-type-display-size)",
    lineHeight: "var(--hydrax-type-display-line-height)",
    weight: "var(--hydrax-type-display-weight)",
  },
  h1: {
    size: "var(--hydrax-type-h1-size)",
    lineHeight: "var(--hydrax-type-h1-line-height)",
    weight: "var(--hydrax-type-h1-weight)",
  },
  h2: {
    size: "var(--hydrax-type-h2-size)",
    lineHeight: "var(--hydrax-type-h2-line-height)",
    weight: "var(--hydrax-type-h2-weight)",
  },
};

export function Heading({ level = "h1", as, style, ...rest }: HeadingProps) {
  const Tag = as ?? (level === "display" ? "h1" : level);
  const tokens = SIZE_MAP[level];
  return (
    <Tag
      style={{
        margin: 0,
        fontFamily: "var(--hydrax-font-sans)",
        fontSize: tokens.size,
        lineHeight: tokens.lineHeight,
        fontWeight: tokens.weight as unknown as number,
        color: "var(--hydrax-color-text-strong)",
        letterSpacing: "-0.01em",
        ...style,
      }}
      {...rest}
    />
  );
}
```

### Step 4: Create `web/packages/ui/src/Heading.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Heading } from "./Heading";

describe("<Heading>", () => {
  it("renders an <h1> by default for level=h1", () => {
    render(<Heading>Page Title</Heading>);
    expect(screen.getByRole("heading", { level: 1, name: "Page Title" })).toBeInTheDocument();
  });

  it("renders an <h1> for level=display (display is a visual variant, not a semantic level)", () => {
    render(<Heading level="display">Welcome</Heading>);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome" })).toBeInTheDocument();
  });

  it("renders the requested element when `as` is provided", () => {
    render(
      <Heading as="h3" level="h2">
        Section
      </Heading>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Section" })).toBeInTheDocument();
  });

  it("uses h2 type tokens when level=h2", () => {
    render(<Heading level="h2">Subtitle</Heading>);
    const h = screen.getByRole("heading", { level: 2 });
    expect(h.style.fontSize).toBe("var(--hydrax-type-h2-size)");
  });
});
```

### Step 5: Create `web/packages/ui/src/Text.tsx`

```tsx
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type TextSize = "body" | "bodySm";
type TextTone = "default" | "muted" | "strong" | "danger" | "success";
type TextFamily = "sans" | "mono";

interface TextProps extends HTMLAttributes<HTMLSpanElement> {
  readonly size?: TextSize;
  readonly tone?: TextTone;
  readonly family?: TextFamily;
  readonly as?: "span" | "p" | "div";
  readonly children?: ReactNode;
}

const SIZE_MAP: Record<TextSize, { size: string; lineHeight: string }> = {
  body: {
    size: "var(--hydrax-type-body-size)",
    lineHeight: "var(--hydrax-type-body-line-height)",
  },
  bodySm: {
    size: "var(--hydrax-type-body-sm-size)",
    lineHeight: "var(--hydrax-type-body-sm-line-height)",
  },
};

const TONE_MAP: Record<TextTone, CSSProperties["color"]> = {
  default: "var(--hydrax-color-text)",
  muted: "var(--hydrax-color-text-muted)",
  strong: "var(--hydrax-color-text-strong)",
  danger: "var(--hydrax-color-danger)",
  success: "var(--hydrax-color-success)",
};

export function Text({
  size = "body",
  tone = "default",
  family = "sans",
  as = "span",
  style,
  ...rest
}: TextProps) {
  const Tag = as;
  const tokens = SIZE_MAP[size];
  return (
    <Tag
      style={{
        margin: 0,
        fontFamily:
          family === "mono" ? "var(--hydrax-font-mono)" : "var(--hydrax-font-sans)",
        fontSize:
          family === "mono" ? "var(--hydrax-type-mono-size)" : tokens.size,
        lineHeight: tokens.lineHeight,
        color: TONE_MAP[tone],
        ...style,
      }}
      {...rest}
    />
  );
}
```

### Step 6: Create `web/packages/ui/src/Text.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Text } from "./Text";

describe("<Text>", () => {
  it("renders a <span> by default", () => {
    render(<Text>hello</Text>);
    const el = screen.getByText("hello");
    expect(el.tagName).toBe("SPAN");
  });

  it("renders a <p> when as='p'", () => {
    render(<Text as="p">paragraph</Text>);
    const el = screen.getByText("paragraph");
    expect(el.tagName).toBe("P");
  });

  it("uses muted color when tone='muted'", () => {
    render(<Text tone="muted">muted</Text>);
    expect(screen.getByText("muted").style.color).toBe("var(--hydrax-color-text-muted)");
  });

  it("uses mono font + mono size when family='mono'", () => {
    render(<Text family="mono">123.45</Text>);
    const el = screen.getByText("123.45");
    expect(el.style.fontFamily).toBe("var(--hydrax-font-mono)");
    expect(el.style.fontSize).toBe("var(--hydrax-type-mono-size)");
  });
});
```

### Step 7: Create `web/packages/ui/src/Skeleton.tsx`

```tsx
import type { CSSProperties } from "react";

interface SkeletonProps {
  readonly width?: number | string;
  readonly height?: number | string;
  readonly radius?: "sm" | "md" | "lg";
  readonly style?: CSSProperties;
  readonly "aria-label"?: string;
}

export function Skeleton({
  width = "100%",
  height = 16,
  radius = "sm",
  style,
  "aria-label": ariaLabel = "Loading",
}: SkeletonProps) {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      style={{
        display: "inline-block",
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: `var(--hydrax-radius-${radius})`,
        background:
          "linear-gradient(90deg, var(--hydrax-color-surface) 0%, var(--hydrax-color-bg-raised) 50%, var(--hydrax-color-surface) 100%)",
        backgroundSize: "200% 100%",
        animation:
          "hydrax-skeleton-shimmer var(--hydrax-motion-medium) ease-in-out infinite alternate",
        ...style,
      }}
    />
  );
}
```

NOTE: The `@keyframes hydrax-skeleton-shimmer` rule must live in a globally-loaded stylesheet for this animation to work. It is added as a `<style>` tag inside `<AppShell>` in Phase 3.

### Step 8: Create `web/packages/ui/src/Skeleton.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton } from "./Skeleton";

describe("<Skeleton>", () => {
  it("renders with role=status and aria-busy=true for screen readers", () => {
    render(<Skeleton />);
    const el = screen.getByRole("status");
    expect(el.getAttribute("aria-busy")).toBe("true");
    expect(el.getAttribute("aria-label")).toBe("Loading");
  });

  it("supports custom aria-label", () => {
    render(<Skeleton aria-label="Loading stat tile" />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Loading stat tile");
  });

  it("supports numeric and string width/height", () => {
    const { rerender } = render(<Skeleton width={200} height={24} />);
    let el = screen.getByRole("status");
    expect(el.style.width).toBe("200px");
    expect(el.style.height).toBe("24px");
    rerender(<Skeleton width="50%" height="2rem" />);
    el = screen.getByRole("status");
    expect(el.style.width).toBe("50%");
    expect(el.style.height).toBe("2rem");
  });
});
```

### Step 9: Create `web/packages/ui/src/EmptyState.tsx`

```tsx
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { Stack } from "./Stack";

interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly iconLabel: string;
  readonly title: string;
  readonly body?: ReactNode;
  readonly action?: ReactNode;
  readonly imageSrc?: string;
  readonly imageAlt?: string;
}

export function EmptyState({
  icon,
  iconLabel,
  title,
  body,
  action,
  imageSrc,
  imageAlt,
}: EmptyStateProps) {
  return (
    <Stack
      align="center"
      justify="center"
      gap="md"
      style={{
        textAlign: "center",
        padding: "var(--hydrax-space-2xl) var(--hydrax-space-xl)",
        color: "var(--hydrax-color-text-muted)",
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={imageAlt ?? ""}
          style={{
            maxWidth: 320,
            width: "100%",
            height: "auto",
            opacity: 0.85,
            borderRadius: "var(--hydrax-radius-md)",
          }}
        />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--hydrax-radius-lg)",
            background: "var(--hydrax-color-bg-raised)",
            border: "1px solid var(--hydrax-color-border)",
          }}
        >
          <Icon icon={icon} label={iconLabel} size={20} />
        </div>
      )}
      <Heading level="h2" as="h2">
        {title}
      </Heading>
      {body ? <Text tone="muted">{body}</Text> : null}
      {action ? <div style={{ marginTop: "var(--hydrax-space-sm)" }}>{action}</div> : null}
    </Stack>
  );
}
```

### Step 10: Create `web/packages/ui/src/EmptyState.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState } from "./EmptyState";

describe("<EmptyState>", () => {
  it("renders title as a level-2 heading", () => {
    render(<EmptyState icon={Inbox} iconLabel="Inbox" title="No items yet" />);
    expect(
      screen.getByRole("heading", { level: 2, name: "No items yet" }),
    ).toBeInTheDocument();
  });

  it("renders the icon when no image is provided", () => {
    render(<EmptyState icon={Inbox} iconLabel="Inbox" title="Empty" />);
    expect(screen.getByLabelText("Inbox")).toBeInTheDocument();
  });

  it("renders an image (without an icon) when imageSrc is provided", () => {
    render(
      <EmptyState
        icon={Inbox}
        iconLabel="Inbox"
        title="Empty"
        imageSrc="/empty.png"
        imageAlt="Illustration of an empty inbox"
      />,
    );
    expect(screen.getByAltText("Illustration of an empty inbox")).toBeInTheDocument();
    expect(screen.queryByLabelText("Inbox")).not.toBeInTheDocument();
  });

  it("renders body and action when provided", () => {
    render(
      <EmptyState
        icon={Inbox}
        iconLabel="Inbox"
        title="Empty"
        body="Connect a feed to start populating this view."
        action={<button type="button">Connect</button>}
      />,
    );
    expect(
      screen.getByText("Connect a feed to start populating this view."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
  });
});
```

### Step 11: Create `web/packages/ui/src/NavItem.tsx`

```tsx
import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

interface NavItemProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly active?: boolean;
  readonly badge?: ReactNode;
  readonly href?: string;
  readonly onClick?: () => void;
}

const baseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--hydrax-space-sm)",
  padding: "var(--hydrax-space-sm) var(--hydrax-space-md)",
  borderRadius: "var(--hydrax-radius-sm)",
  color: "var(--hydrax-color-text-muted)",
  fontFamily: "var(--hydrax-font-sans)",
  fontSize: "var(--hydrax-type-body-size)",
  lineHeight: "var(--hydrax-type-body-line-height)",
  textDecoration: "none",
  cursor: "pointer",
  transition: "background var(--hydrax-motion-fast) var(--hydrax-ease-out), color var(--hydrax-motion-fast) var(--hydrax-ease-out)",
};

const activeStyle: CSSProperties = {
  background: "var(--hydrax-color-bg-raised)",
  color: "var(--hydrax-color-text-strong)",
};

export function NavItem({ icon, label, active = false, badge, href, onClick }: NavItemProps) {
  const content = (
    <>
      <Icon icon={icon} label={label} size={16} />
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {badge ? (
        <span
          style={{
            fontFamily: "var(--hydrax-font-mono)",
            fontSize: "11px",
            color: "var(--hydrax-color-text-muted)",
            padding: "2px 6px",
            borderRadius: "var(--hydrax-radius-sm)",
            background: "var(--hydrax-color-surface)",
            border: "1px solid var(--hydrax-color-border)",
          }}
        >
          {badge}
        </span>
      ) : null}
    </>
  );
  const style = active ? { ...baseStyle, ...activeStyle } : baseStyle;
  if (href) {
    return (
      <a href={href} style={style} aria-current={active ? "page" : undefined}>
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...style, border: "none", textAlign: "left", width: "100%" }}
      aria-current={active ? "page" : undefined}
    >
      {content}
    </button>
  );
}
```

### Step 12: Create `web/packages/ui/src/NavItem.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home } from "lucide-react";
import { NavItem } from "./NavItem";

describe("<NavItem>", () => {
  it("renders a <button> by default with the label", () => {
    render(<NavItem icon={Home} label="Home" />);
    const btn = screen.getByRole("button", { name: /home/i });
    expect(btn).toBeInTheDocument();
  });

  it("renders an <a> when href is provided", () => {
    render(<NavItem icon={Home} label="Home" href="/home" />);
    const link = screen.getByRole("link", { name: /home/i });
    expect(link.getAttribute("href")).toBe("/home");
  });

  it("sets aria-current='page' when active", () => {
    render(<NavItem icon={Home} label="Home" active />);
    expect(screen.getByRole("button").getAttribute("aria-current")).toBe("page");
  });

  it("forwards onClick when provided", async () => {
    const onClick = vi.fn();
    render(<NavItem icon={Home} label="Home" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the badge when provided", () => {
    render(<NavItem icon={Home} label="Inbox" badge={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
```

### Step 13: Create `web/packages/ui/src/Avatar.tsx`

```tsx
interface AvatarProps {
  readonly name: string;
  readonly size?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "??";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function Avatar({ name, size = 28 }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={`Avatar for ${name}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--hydrax-color-bg-raised)",
        border: "1px solid var(--hydrax-color-border)",
        color: "var(--hydrax-color-text-strong)",
        fontFamily: "var(--hydrax-font-sans)",
        fontSize: Math.round(size * 0.42),
        fontWeight: 600,
        userSelect: "none",
      }}
    >
      {initials(name)}
    </span>
  );
}
```

### Step 14: Create `web/packages/ui/src/Avatar.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "./Avatar";

describe("<Avatar>", () => {
  it("renders initials for a two-word name", () => {
    render(<Avatar name="Naim Katiman" />);
    expect(screen.getByLabelText("Avatar for Naim Katiman").textContent).toBe("NK");
  });

  it("renders a single initial for a one-word name", () => {
    render(<Avatar name="Acme" />);
    expect(screen.getByLabelText("Avatar for Acme").textContent).toBe("A");
  });

  it("renders ?? for an empty name", () => {
    render(<Avatar name="" />);
    expect(screen.getByLabelText("Avatar for ").textContent).toBe("??");
  });
});
```

### Step 15: Modify `web/packages/ui/src/index.ts`

Replace the file with:

```ts
export { Icon } from "./Icon";
export { Button } from "./Button";
export { Card } from "./Card";
export { AppShell } from "./AppShell";
export { Stack } from "./Stack";
export { Heading } from "./Heading";
export { Text } from "./Text";
export { Skeleton } from "./Skeleton";
export { EmptyState } from "./EmptyState";
export { NavItem } from "./NavItem";
export { Avatar } from "./Avatar";
```

### Step 16: Run gates

```bash
pnpm -F @hydrax/ui typecheck
pnpm -F @hydrax/ui test -- --run
pnpm -F @hydrax/ui build
ls web/packages/ui/dist
```

Expected: typecheck clean. Test count is now 5 (existing) + 3 + 4 + 4 + 3 + 4 + 5 + 3 = 31 tests. All pass. Build emits `.js` + `.d.ts` for every primitive plus `index.*`.

### Step 17: Smoke-test downstream

```bash
pnpm -F "./web/packages/*" build
pnpm -F @hydrax/issuer-portal typecheck
pnpm -F @hydrax/issuer-portal test -- --run
```

Expected: clean. The new exports do not break existing consumers (additive only).

### Step 18: Stage and commit

```bash
git status --short
git add web/packages/ui
git diff --cached --stat
```

Expected: 15 files changed (14 new + 1 modified). If the count is 16+, the `pnpm-lock.yaml` is staged in error — unstage with `git restore --staged pnpm-lock.yaml`.

```bash
git commit -m "feat(web/ui): add Stack, Heading, Text, Skeleton, EmptyState, NavItem, Avatar primitives

Seven new primitives wrapping the new --hydrax-type-* / --hydrax-space-* /
--hydrax-motion-* tokens from Phase 1.

- Stack: 1D flex with token-driven gap, align, justify, wrap.
- Heading: display/h1/h2 visual scale, semantic <h1>/<h2>/... selectable via 'as'.
- Text: body / bodySm / mono with default/muted/strong/danger/success tones.
- Skeleton: role=status loading shimmer; @keyframes mounted globally in AppShell (Phase 3).
- EmptyState: icon-or-image + heading + optional body + optional action.
- NavItem: button or anchor; icon + label + active state via aria-current; optional badge.
- Avatar: deterministic initials fallback, no remote fetch.

26 new tests + 5 existing = 31 total green. Backward-compatible.

Plan: docs/plans/2026-04-25-visual-polish-issuer-portal.md (Phase 2)"
```

### Step 19: Verify

```bash
git show --stat HEAD
git log --oneline -4
```

Expected: HEAD has 15 files changed. Parent is the Phase 1 commit.

---

## Phase 3: Upgrade `<AppShell>`

**Files:**
- Modify: `web/packages/ui/src/AppShell.tsx`
- Modify: `web/packages/ui/src/AppShell.test.tsx`

**Goal:** AppShell gets a real layout with named slots, a proper `<header role="banner">` topbar (already done), a proper `<aside>` sidebar with a brand area, and a globally-mounted `<style>` tag holding the skeleton shimmer keyframes. Backward-compatible: old `topbar` and `sidebar` props still work — the new props are additive.

### Step 1: Read the current AppShell.tsx for reference

```bash
cat web/packages/ui/src/AppShell.tsx
```

This shows the current 60-line implementation from the scaffold. Verify it matches what's in this plan; if it has drifted (e.g., a parallel agent edited it), reconcile manually before continuing.

### Step 2: Replace `web/packages/ui/src/AppShell.tsx`

```tsx
import type { CSSProperties, ReactNode } from "react";

interface AppShellProps {
  readonly appName: string;
  readonly brand?: ReactNode;
  readonly topbar?: ReactNode;
  readonly sidebar?: ReactNode;
  readonly sidebarFooter?: ReactNode;
  readonly children: ReactNode;
}

const SHIMMER_KEYFRAMES = `
@keyframes hydrax-skeleton-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
`;

const sidebarStyle: CSSProperties = {
  gridArea: "sidebar",
  borderRight: "1px solid var(--hydrax-color-border)",
  background: "var(--hydrax-color-surface)",
  display: "flex",
  flexDirection: "column",
};

const sidebarBrandStyle: CSSProperties = {
  height: 56,
  padding: "0 var(--hydrax-space-lg)",
  display: "flex",
  alignItems: "center",
  borderBottom: "1px solid var(--hydrax-color-border)",
  fontFamily: "var(--hydrax-font-sans)",
  fontWeight: 600,
  color: "var(--hydrax-color-text-strong)",
};

const sidebarBodyStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--hydrax-space-md)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--hydrax-space-xs)",
};

const sidebarFooterStyle: CSSProperties = {
  padding: "var(--hydrax-space-md) var(--hydrax-space-lg)",
  borderTop: "1px solid var(--hydrax-color-border)",
};

const topbarStyle: CSSProperties = {
  gridArea: "topbar",
  borderBottom: "1px solid var(--hydrax-color-border)",
  background: "var(--hydrax-color-bg)",
  padding: "0 var(--hydrax-space-xl)",
  display: "flex",
  alignItems: "center",
  gap: "var(--hydrax-space-md)",
};

const mainStyle: CSSProperties = {
  gridArea: "main",
  padding: "var(--hydrax-space-xl)",
  overflowY: "auto",
};

export function AppShell({
  appName,
  brand,
  topbar,
  sidebar,
  sidebarFooter,
  children,
}: AppShellProps) {
  const hasSidebar = Boolean(sidebar) || Boolean(brand);
  const hasTopbar = Boolean(topbar);

  return (
    <div
      data-app-name={appName}
      style={{
        minHeight: "100vh",
        height: "100vh",
        background: "var(--hydrax-color-bg)",
        color: "var(--hydrax-color-text)",
        fontFamily: "var(--hydrax-font-sans)",
        fontSize: "var(--hydrax-type-body-size)",
        lineHeight: "var(--hydrax-type-body-line-height)",
        display: "grid",
        gridTemplateColumns: hasSidebar ? "240px 1fr" : "1fr",
        gridTemplateRows: hasTopbar ? "56px 1fr" : "1fr",
        gridTemplateAreas: hasSidebar
          ? hasTopbar
            ? `"sidebar topbar" "sidebar main"`
            : `"sidebar main"`
          : hasTopbar
            ? `"topbar" "main"`
            : `"main"`,
      }}
    >
      <style>{SHIMMER_KEYFRAMES}</style>
      {hasSidebar ? (
        <aside style={sidebarStyle}>
          {brand ? <div style={sidebarBrandStyle}>{brand}</div> : null}
          {sidebar ? <nav style={sidebarBodyStyle}>{sidebar}</nav> : null}
          {sidebarFooter ? <div style={sidebarFooterStyle}>{sidebarFooter}</div> : null}
        </aside>
      ) : null}
      {hasTopbar ? (
        <header role="banner" style={topbarStyle}>
          {topbar}
        </header>
      ) : null}
      <main style={mainStyle}>{children}</main>
    </div>
  );
}
```

### Step 3: Modify `web/packages/ui/src/AppShell.test.tsx`

Replace the existing file with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

describe("<AppShell>", () => {
  it("renders sidebar, topbar, and main regions with provided children", () => {
    render(
      <AppShell
        appName="test-app"
        brand={<span data-testid="brand">B</span>}
        sidebar={<span data-testid="sb">SB</span>}
        topbar={<span data-testid="tb">TB</span>}
      >
        <p data-testid="content">hello</p>
      </AppShell>,
    );
    expect(screen.getByTestId("brand")).toBeInTheDocument();
    expect(screen.getByTestId("sb")).toBeInTheDocument();
    expect(screen.getByTestId("tb")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("applies the application name to the root via data-app-name", () => {
    render(<AppShell appName="issuer-portal">x</AppShell>);
    const root = screen.getByRole("main").parentElement;
    expect(root?.getAttribute("data-app-name")).toBe("issuer-portal");
  });

  it("renders a sidebar (no brand) when only sidebar is provided", () => {
    render(
      <AppShell appName="x" sidebar={<span data-testid="sb">SB</span>}>
        <span>main</span>
      </AppShell>,
    );
    expect(screen.getByTestId("sb")).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it("renders sidebarFooter when provided", () => {
    render(
      <AppShell
        appName="x"
        brand={<span>B</span>}
        sidebarFooter={<span data-testid="sf">F</span>}
      >
        <span>main</span>
      </AppShell>,
    );
    expect(screen.getByTestId("sf")).toBeInTheDocument();
  });

  it("renders without sidebar when only topbar is provided", () => {
    render(
      <AppShell appName="x" topbar={<span>tb</span>}>
        <span>main</span>
      </AppShell>,
    );
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("mounts the skeleton shimmer @keyframes globally", () => {
    const { container } = render(
      <AppShell appName="x">
        <span>main</span>
      </AppShell>,
    );
    const styleTag = container.querySelector("style");
    expect(styleTag?.textContent ?? "").toContain("hydrax-skeleton-shimmer");
  });
});
```

### Step 4: Run gates

```bash
pnpm -F @hydrax/ui typecheck
pnpm -F @hydrax/ui test -- --run
pnpm -F @hydrax/ui build
```

Expected: typecheck clean. AppShell now has 6 tests (was 2). Total ui tests = 31 - 2 + 6 = 35 (existing primitives unchanged).

### Step 5: Smoke-test ALL apps still work

```bash
for app in issuer-portal distributor-portal investor-portal ops-console admin; do
  echo "=== $app ==="
  pnpm -F @hydrax/$app typecheck && \
    pnpm -F @hydrax/$app test -- --run && \
    pnpm -F @hydrax/$app build
done
```

Expected: every app passes typecheck + tests + build. **THIS IS A HARD GATE** — if any app breaks, fix immediately. The AppShell change is intentionally backward-compatible (old `topbar` + `sidebar` props still work; `brand` and `sidebarFooter` are optional additions). If something breaks, the issue is in the change, not the consumer.

### Step 6: Stage and commit

```bash
git status --short
git add web/packages/ui/src/AppShell.tsx web/packages/ui/src/AppShell.test.tsx
git diff --cached --stat
```

Expected: 2 files modified. `pnpm-lock.yaml` not staged.

```bash
git commit -m "feat(web/ui): upgrade AppShell with brand slot, sidebarFooter, shimmer keyframes

AppShell gains:
- 'brand' prop: dedicated 56px brand area at the top of the sidebar
  (matches topbar height for grid alignment).
- 'sidebarFooter' prop: optional bottom-pinned slot in the sidebar
  for tenant switcher / user menu / version info.
- A globally-mounted <style> with @keyframes hydrax-skeleton-shimmer
  so the Skeleton primitive's animation works across the app.
- Sidebar gets explicit overflow-y, brand divider, body padding via
  the new --hydrax-space-* tokens.

Backward-compatible: existing topbar + sidebar + children props work
as before. All 5 apps still pass their App.test.tsx (verified).

6 AppShell tests pass (was 2). Plan: docs/plans/2026-04-25-visual-polish-issuer-portal.md (Phase 3)"
```

### Step 7: Verify

```bash
git show --stat HEAD
git log --oneline -5
```

---

## Phase 4: nano-banana Hero Asset

**Files:**
- Create: `web/packages/ui/src/assets/issuer-empty-state.png`
- Create: `web/packages/ui/src/assets/assets-meta.json`

**Goal:** Generate ONE asset for the issuer-portal Home empty-state via the `nano-banana` skill (Gemini image model via OpenRouter). Save metadata for traceability.

### Step 1: Read the nano-banana skill

The skill is `nano-banana`. Read its full description before invoking. It requires an OpenRouter API key set in the environment. If the key is unset, stop and ask the user — do NOT generate placeholder artwork yourself.

### Step 2: Define the prompt

Generate one image with these constraints:

- **Subject:** A minimalist line-art illustration of an empty institutional dashboard / clipboard / data console — abstract, restrained.
- **Style:** Monochrome line art on dark background, thin strokes, geometric, neutral. Matches the dark institutional aesthetic locked in this plan's "Aesthetic Direction" table.
- **Color:** Single accent color matching `--hydrax-color-accent` (cyan, hsl(190, 90%, 55%)) on a near-black background hsl(220, 16%, 8%). No additional colors.
- **Composition:** Centered, ~30-40% subject area, plenty of negative space.
- **Aspect ratio:** 4:3 (e.g., 1200x900 or 1024x768).
- **Format:** PNG with transparent OR solid dark background — solid is fine since we'll overlay it on the same color.
- **Avoid:** Text, logos, gradients, glow, photorealism, multiple competing elements, stock-art tropes, anything sci-fi / futuristic / Web3 / blockchain-themed.

### Step 3: Invoke nano-banana

Use the skill's full prompt format. After generation:
- Save the file to `web/packages/ui/src/assets/issuer-empty-state.png`
- Inspect: `file web/packages/ui/src/assets/issuer-empty-state.png` should report a PNG. `du -h` should report < 500KB; if larger, regenerate or ask the skill for a smaller variant.

### Step 4: Create `web/packages/ui/src/assets/assets-meta.json`

```json
{
  "issuer-empty-state.png": {
    "generated": "2026-04-25",
    "tool": "nano-banana (Gemini via OpenRouter)",
    "prompt_summary": "Minimalist monochrome line-art empty dashboard, accent cyan on near-black, 4:3, no text, no gradients",
    "consumed_by": "web/apps/issuer-portal/src/routes/HomeRoute.tsx (empty-state for activity panel)",
    "license": "Generated; treat as project-owned per nano-banana terms",
    "notes": "Replace if PRD §14 Q4 picks a tenant whose brand mandates different imagery."
  }
}
```

### Step 5: Verify the asset is consumable by Vite

Add a quick smoke import test. Create `web/packages/ui/src/assets/assets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import meta from "./assets-meta.json";

describe("ui asset registry", () => {
  it("includes issuer-empty-state.png metadata", () => {
    expect(meta).toHaveProperty("issuer-empty-state.png");
    expect(meta["issuer-empty-state.png"].consumed_by).toContain("issuer-portal");
  });
});
```

### Step 6: Run gates

```bash
pnpm -F @hydrax/ui test -- --run
pnpm -F @hydrax/ui build
```

Expected: tests pass (now includes the new metadata test). Build does NOT bundle the PNG into `dist/` because tsc only emits `.js` + `.d.ts` — that's fine, the PNG is consumed via Vite's asset pipeline at the app level. The asset is shipped as source, imported by the app, and bundled per app.

### Step 7: Stage and commit

```bash
git status --short
git add web/packages/ui/src/assets
git diff --cached --stat
```

Expected: 3 files added (1 PNG + 1 JSON + 1 test). PNG byte count should appear as binary delta.

```bash
git commit -m "feat(web/ui): add issuer-portal empty-state hero asset (nano-banana)

Generated via nano-banana (Gemini via OpenRouter) under the
'Aesthetic Direction' constraints in the visual-polish plan:
monochrome line-art on dark, accent cyan only, 4:3, no text,
no gradients, restrained negative-space composition.

Saved as web/packages/ui/src/assets/issuer-empty-state.png with
provenance recorded in assets-meta.json. Consumed by the issuer-portal
Home route empty-state in Phase 5.

Plan: docs/plans/2026-04-25-visual-polish-issuer-portal.md (Phase 4)"
```

---

## Phase 5: issuer-portal Home Polish

**Files:**
- Create: `web/apps/issuer-portal/src/routes/HomeRoute.tsx`
- Create: `web/apps/issuer-portal/src/routes/HomeRoute.test.tsx`
- Create: `web/apps/issuer-portal/src/components/IssuerSidebar.tsx`
- Create: `web/apps/issuer-portal/src/components/IssuerTopBar.tsx`
- Modify: `web/apps/issuer-portal/src/App.tsx`
- Modify: `web/apps/issuer-portal/src/App.test.tsx`

**Goal:** Replace the placeholder Card+text Home with a real institutional dashboard layout: 3 stat tiles, an "Recent activity" panel that shows a 3-row Skeleton then an `<EmptyState>` (with the nano-banana hero) when no data is connected. Sidebar gets real nav items. Top bar gets brand label, search placeholder, user menu (Avatar only — no real menu yet). No fake data anywhere.

### Step 1: Create `web/apps/issuer-portal/src/components/IssuerSidebar.tsx`

```tsx
import {
  Building2,
  LayoutDashboard,
  Boxes,
  ClipboardCheck,
  Users,
  History,
  Settings,
} from "lucide-react";
import { NavItem } from "@hydrax/ui";

interface IssuerSidebarProps {
  readonly currentPath: string;
}

const NAV: ReadonlyArray<{
  readonly label: string;
  readonly path: string;
  readonly icon: typeof LayoutDashboard;
}> = [
  { label: "Home", path: "/", icon: LayoutDashboard },
  { label: "Products", path: "/products", icon: Boxes },
  { label: "Approvals", path: "/approvals", icon: ClipboardCheck },
  { label: "Investors", path: "/investors", icon: Users },
  { label: "Activity", path: "/activity", icon: History },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function IssuerSidebar({ currentPath }: IssuerSidebarProps) {
  return (
    <>
      {NAV.map((item) => (
        <NavItem
          key={item.path}
          icon={item.icon}
          label={item.label}
          href={item.path}
          active={currentPath === item.path}
        />
      ))}
    </>
  );
}

export function IssuerBrand() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Building2 aria-label="Issuer Portal" role="img" size={16} />
      <span>Issuer Portal</span>
    </span>
  );
}
```

NOTE: The 6 sidebar items are nav LINKS only — none of /products, /approvals, /investors, /activity, /settings have route handlers yet. They render but clicking them will go to a 404-like state. That's acceptable for the scaffold; routes land in follow-up plans.

### Step 2: Create `web/apps/issuer-portal/src/components/IssuerTopBar.tsx`

```tsx
import { Search, Bell } from "lucide-react";
import { Avatar, Icon, Stack } from "@hydrax/ui";

interface IssuerTopBarProps {
  readonly userName: string;
}

export function IssuerTopBar({ userName }: IssuerTopBarProps) {
  return (
    <Stack direction="row" align="center" gap="md" style={{ flex: 1 }}>
      <div
        role="search"
        style={{
          flex: 1,
          maxWidth: 480,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          background: "var(--hydrax-color-surface)",
          border: "1px solid var(--hydrax-color-border)",
          borderRadius: "var(--hydrax-radius-md)",
          color: "var(--hydrax-color-text-muted)",
          fontFamily: "var(--hydrax-font-sans)",
          fontSize: "var(--hydrax-type-body-size)",
        }}
      >
        <Icon icon={Search} label="Search" size={14} />
        <span aria-hidden="true">Search products, approvals, investors…</span>
      </div>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        aria-label="Notifications"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: "var(--hydrax-radius-sm)",
          background: "transparent",
          border: "1px solid transparent",
          color: "var(--hydrax-color-text-muted)",
          cursor: "pointer",
        }}
      >
        <Icon icon={Bell} label="Notifications" size={16} />
      </button>
      <Avatar name={userName} />
    </Stack>
  );
}
```

NOTE: The search box is a placeholder — clicking it does nothing yet. The notification button has no menu. The avatar is initials-only with no menu. These are visual scaffolds; real interactions land in follow-up plans.

### Step 3: Create `web/apps/issuer-portal/src/routes/HomeRoute.tsx`

```tsx
import { Inbox, TrendingUp, ClipboardList, Wallet } from "lucide-react";
import {
  Card,
  EmptyState,
  Heading,
  Skeleton,
  Stack,
  Text,
  Icon,
} from "@hydrax/ui";
import emptyHero from "@hydrax/ui/src/assets/issuer-empty-state.png";

interface HomeRouteProps {
  readonly connected?: boolean;
}

interface StatTileProps {
  readonly label: string;
  readonly icon: typeof TrendingUp;
  readonly iconLabel: string;
}

function StatTile({ label, icon, iconLabel }: StatTileProps) {
  return (
    <Card>
      <Stack gap="md">
        <Stack direction="row" gap="sm" align="center">
          <Icon icon={icon} label={iconLabel} size={14} />
          <Text size="bodySm" tone="muted">
            {label}
          </Text>
        </Stack>
        <Text family="mono" tone="strong" style={{ fontSize: "20px" }}>
          --
        </Text>
        <Text size="bodySm" tone="muted">
          No data connected yet.
        </Text>
      </Stack>
    </Card>
  );
}

function ActivitySkeleton() {
  return (
    <Stack gap="md" style={{ padding: "var(--hydrax-space-md)" }}>
      {[0, 1, 2].map((i) => (
        <Stack key={i} direction="row" align="center" gap="md">
          <Skeleton width={32} height={32} radius="md" aria-label="Loading row icon" />
          <Stack gap="xs" style={{ flex: 1 }}>
            <Skeleton width="60%" height={14} aria-label="Loading row title" />
            <Skeleton width="35%" height={12} aria-label="Loading row meta" />
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

export function HomeRoute({ connected = false }: HomeRouteProps) {
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">Home</Heading>
        <Text tone="muted">
          Issuer workspace. Connect a product feed to start populating these views.
        </Text>
      </Stack>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--hydrax-space-md)",
        }}
      >
        <StatTile label="Products in flight" icon={Wallet} iconLabel="Products" />
        <StatTile label="Pending approvals" icon={ClipboardList} iconLabel="Approvals" />
        <StatTile label="This week" icon={TrendingUp} iconLabel="Activity" />
      </div>
      <Card title={<Heading level="h2">Recent activity</Heading>}>
        {connected ? (
          <ActivitySkeleton />
        ) : (
          <EmptyState
            icon={Inbox}
            iconLabel="No activity"
            title="No activity yet"
            body="Once a feed is connected, recent product, approval, and investor events will appear here."
            imageSrc={emptyHero}
            imageAlt="Illustration of an empty institutional dashboard"
          />
        )}
      </Card>
    </Stack>
  );
}
```

NOTE: The PNG import path `@hydrax/ui/src/assets/issuer-empty-state.png` works under Vite's resolver because the package's `package.json` `exports` field doesn't restrict subpath imports. If TypeScript complains about the import (unknown PNG type), add `web/apps/issuer-portal/src/png.d.ts` with `declare module "*.png" { const src: string; export default src; }`. If you have to add that declaration file, include it in the same commit.

### Step 4: Create `web/apps/issuer-portal/src/routes/HomeRoute.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeRoute } from "./HomeRoute";

describe("<HomeRoute>", () => {
  it("renders the page heading and three stat tiles", () => {
    render(<HomeRoute />);
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(screen.getByText("Products in flight")).toBeInTheDocument();
    expect(screen.getByText("Pending approvals")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
  });

  it("shows the empty-state with hero image when not connected", () => {
    render(<HomeRoute connected={false} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /no activity yet/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText("Illustration of an empty institutional dashboard"),
    ).toBeInTheDocument();
  });

  it("shows the loading skeleton when connected=true", () => {
    render(<HomeRoute connected />);
    const skeletons = screen.getAllByRole("status");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/no activity yet/i)).not.toBeInTheDocument();
  });

  it("renders -- placeholders in stat tiles (no fake data)", () => {
    render(<HomeRoute />);
    const placeholders = screen.getAllByText("--");
    expect(placeholders.length).toBe(3);
  });
});
```

### Step 5: Modify `web/apps/issuer-portal/src/App.tsx`

Replace the file with:

```tsx
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell } from "@hydrax/ui";
import { IssuerSidebar, IssuerBrand } from "./components/IssuerSidebar";
import { IssuerTopBar } from "./components/IssuerTopBar";
import { HomeRoute } from "./routes/HomeRoute";

const store = configureStore({
  reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
  middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
});

function ShellContents() {
  const location = useLocation();
  return (
    <AppShell
      appName="issuer-portal"
      brand={<IssuerBrand />}
      sidebar={<IssuerSidebar currentPath={location.pathname} />}
      topbar={<IssuerTopBar userName="Naim Katiman" />}
    >
      <Routes>
        <Route path="/" element={<HomeRoute />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <BrowserRouter>
          <ShellContents />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
}
```

NOTE: `userName="Naim Katiman"` is the developer's name and matches the local environment. Replace with the real session user once auth lands. Do NOT replace with a fake name like "Demo User" — that's fake data.

### Step 6: Modify `web/apps/issuer-portal/src/App.test.tsx`

Replace the file with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("<App> (issuer-portal)", () => {
  it("renders the AppShell with the brand and the home heading", () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByLabelText("Issuer Portal")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Home", level: 1 })).toBeInTheDocument();
  });

  it("stamps data-app-name='issuer-portal' on the AppShell wrapper", () => {
    const { container } = render(<App />);
    expect(container.querySelector("[data-app-name='issuer-portal']")).not.toBeNull();
  });

  it("renders sidebar nav items including Products and Approvals", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: /products/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /approvals/i })).toBeInTheDocument();
  });

  it("renders the topbar search placeholder and notifications button", () => {
    render(<App />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
  });
});
```

### Step 7: Run gates

```bash
pnpm -F "./web/packages/*" build
pnpm -F @hydrax/issuer-portal typecheck
pnpm -F @hydrax/issuer-portal test -- --run
pnpm -F @hydrax/issuer-portal build
```

Expected: typecheck clean. issuer-portal tests now: 4 (App) + 4 (HomeRoute) = 8. All pass. Build emits dist/.

If typecheck fails on the PNG import, add `web/apps/issuer-portal/src/png.d.ts`:

```ts
declare module "*.png" {
  const src: string;
  export default src;
}
```

Re-run typecheck. If it still fails, the issue is path-resolution from `@hydrax/ui/src/assets/...` — switch the import to a relative path: `import emptyHero from "../../../packages/ui/src/assets/issuer-empty-state.png";` and re-typecheck.

### Step 8: Browser smoke test

```bash
pnpm -F @hydrax/issuer-portal dev &
sleep 4
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:5173/
```

Expected: prints `200`. Then visit `http://localhost:5173/` in a browser. Verify visually:
- Sidebar shows brand "Issuer Portal" + 6 nav items, "Home" highlighted.
- Topbar shows search placeholder + notifications icon + initials avatar (NK).
- Home heading + intro paragraph.
- 3 stat tiles in a row with "--" values.
- "Recent activity" card with the empty-state hero illustration + "No activity yet" heading + helpful body text.
- Theme: dark institutional palette, no jagged spacing, no overflow.

```bash
kill %1 2>/dev/null
```

Capture observations in the commit message if anything looks off (e.g., "spacing tightened, font-weight rendered correctly on Linux Chrome, hero image loaded from /node_modules/.vite/deps cache").

### Step 9: Stage and commit

```bash
git status --short
git add web/apps/issuer-portal
git diff --cached --stat
```

Expected: 6 files changed (4 new + 2 modified). If `png.d.ts` was needed, 7 files. The image asset is already committed in Phase 4 — should NOT appear here.

```bash
git commit -m "feat(web/issuer-portal): real institutional Home with stat tiles and empty state

Replaces the placeholder Card+text Home with a production-grade layout:
- IssuerBrand + IssuerSidebar (6 nav items: Home, Products, Approvals,
  Investors, Activity, Settings) consumed by AppShell's brand + sidebar
  slots.
- IssuerTopBar with a search placeholder, notifications button, and
  initials Avatar (no fake user — uses developer's session name).
- HomeRoute with a Heading + intro Text, three responsive StatTile cards
  showing '--' (no fake data), and a Recent activity Card containing
  either a 3-row Skeleton (when connected) or an EmptyState with the
  Phase 4 hero asset (default).

8 issuer-portal tests pass. dev server smoke green at http://localhost:5173.

The 5 sidebar items besides Home (Products, Approvals, etc.) currently
render as links to non-existent routes — that's intentional scaffolding;
routes land in follow-up plans gated on PRD §14 Q3/Q4.

Plan: docs/plans/2026-04-25-visual-polish-issuer-portal.md (Phase 5)"
```

### Step 10: Verify

```bash
git show --stat HEAD
git log --oneline -7
```

---

## Phase 6: Cross-App Consistency Verification

**Files:**
- None modified.
- Verification commands only.

**Goal:** Confirm the AppShell upgrade and `@hydrax/ui` expansion did not break the four other apps. They keep their existing simple `topbar`+`sidebar` props (no `brand`, no `sidebarFooter`); the upgrade was additive. A polish plan for these four ships separately.

### Step 1: Run gates for all 4 other apps

```bash
for app in distributor-portal investor-portal ops-console admin; do
  echo "=== $app ==="
  pnpm -F @hydrax/$app typecheck && \
    pnpm -F @hydrax/$app test -- --run && \
    pnpm -F @hydrax/$app build
  echo
done
```

Expected: every command exits 0. No regressions.

### Step 2: Browser-spot-check ONE other app

Pick `distributor-portal` (port 5174):

```bash
pnpm -F @hydrax/distributor-portal dev &
sleep 4
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:5174/
```

Visit the URL. The page should render the old simple shell — no brand area, no sidebar footer, just the existing topbar text and Home card. The shimmer keyframes are still injected globally (from AppShell's `<style>` tag) but no Skeleton uses them yet in this app; that's fine.

```bash
kill %1 2>/dev/null
```

### Step 3: No commit needed for Phase 6 — verification only

If everything passed, proceed to Phase 7. If any app broke, **STOP** and trace the regression to the Phase 3 AppShell change. Common cause: a destructured prop name mismatch between the old and new `<AppShell>` interface.

---

## Phase 7: Final Review + CLAUDE.md + Verification Log

**Files:**
- Modify: `CLAUDE.md` — extend "Web Monorepo — Invariants" with the new tokens, primitives, and AppShell slots.
- Append to bottom of: `docs/plans/2026-04-25-visual-polish-issuer-portal.md` (this file) — verification log entries (one per phase).

**Goal:** Lock the new conventions and record the verification log so the merge-back to main can migrate it to STATE.yaml in one shot.

### Step 1: Extend `CLAUDE.md`

Find the "Web Monorepo — Invariants" section. Add these lines under the existing bullets (do not delete or reorder existing content):

```md
- Token surface (added 2026-04-25 visual-polish): `TenantThemeTokens` carries 30+ tokens covering color, typography (display/h1/h2/body/bodySm/mono), spacing (xs/sm/md/lg/xl/2xl), shadow (sm/md), and motion (fast/medium/easeOut). New tokens land in `TenantThemeTokens` first, then `TOKEN_TO_CSS_VAR`'s map in `applyTheme`, then consumers. Never read `--hydrax-*` vars from a CSS file that did not extend the type registry.
- `@hydrax/ui` primitives extended: `Stack`, `Heading`, `Text`, `Skeleton`, `EmptyState`, `NavItem`, `Avatar` (in addition to the original `Icon`, `Button`, `Card`, `AppShell`). Apps consume these directly; no app re-implements layout or typography primitives. The skeleton shimmer @keyframes lives in `<AppShell>`'s globally-mounted `<style>` tag — components that use `Skeleton` outside an AppShell must inject the keyframes themselves.
- `<AppShell>` slots: `brand` (sidebar header, 56px aligned to topbar), `topbar` (header role=banner), `sidebar` (nav body), `sidebarFooter` (optional bottom-pinned slot), `children` (main). All optional except `appName` and `children`.
- Hero/empty-state imagery comes from `@hydrax/ui/src/assets/` and must be generated via `nano-banana` with provenance recorded in `assets-meta.json`. No stock images, no decorative gradients, no inline SVG placeholders for spaces that warrant real imagery.
```

Run a sanity check after the edit:

```bash
wc -l CLAUDE.md
grep -c "Web Monorepo" CLAUDE.md
```

Expected: line count under 300 (global budget per `~/.claude/CLAUDE.md`). Section heading still present.

### Step 2: Append the verification log to this plan doc

Append the following section to the bottom of `docs/plans/2026-04-25-visual-polish-issuer-portal.md`:

```md

## Verification Log (worktree-local; migrate to STATE.yaml at merge)

- 2026-04-25 — Phase 0: worktree feat/visual-polish-issuer-portal created off main HEAD; gate baseline clean.
- 2026-04-25 — Phase 1: tenant-theme expanded to 30+ tokens (typography/spacing/shadow/motion + 3 semantic colors); 5 applyTheme tests pass; backward-compatible — Button/Card/AppShell unchanged.
- 2026-04-25 — Phase 2: 7 ui primitives added (Stack, Heading, Text, Skeleton, EmptyState, NavItem, Avatar) + 26 new tests; total ui tests = 31; backward-compatible.
- 2026-04-25 — Phase 3: AppShell upgraded with brand + sidebarFooter slots and globally-mounted shimmer keyframes; 6 AppShell tests pass; all 5 apps still typecheck/test/build.
- 2026-04-25 — Phase 4: nano-banana hero asset issuer-empty-state.png generated and committed with assets-meta.json provenance; 1 metadata test pass.
- 2026-04-25 — Phase 5: issuer-portal Home polished — IssuerBrand + IssuerSidebar (6 nav items) + IssuerTopBar (search/notifications/avatar) + HomeRoute (3 stat tiles + activity panel with Skeleton/EmptyState toggle); 8 issuer-portal tests pass; dev server HTTP 200; browser smoke verified.
- 2026-04-25 — Phase 6: cross-app verification — distributor-portal, investor-portal, ops-console, admin all typecheck/test/build clean; distributor-portal browser smoke green.
- 2026-04-25 — Phase 7: CLAUDE.md "Web Monorepo — Invariants" extended with token surface, primitive list, AppShell slots, imagery sourcing rule.
```

### Step 3: Run final cross-workspace gate

```bash
pnpm -F "./web/packages/*" build
pnpm -r --if-present typecheck
pnpm -r --if-present test -- --run
pnpm -r --if-present build
```

Expected:
- typecheck clean across all touched workspaces
- Test count: 5 (tenant-theme) + 35 (ui: 31 primitive + 6 AppShell − the original 2 = 35) + 2 (api-client) + 8 (issuer-portal) + 2 each across 4 other apps = 5 + 35 + 2 + 8 + 8 = 58 web tests, plus services unchanged. (If your count differs by ≤2, that's a counting nit — recount precisely from the test output.)
- All builds emit `dist/`.

### Step 4: Stage and commit

```bash
git status --short
git add CLAUDE.md docs/plans/2026-04-25-visual-polish-issuer-portal.md
git diff --cached --stat
```

Expected: 2 files changed.

```bash
git commit -m "docs(claude.md): record visual-polish invariants and Phase 1-7 verification log

Locks the conventions established by the visual-polish plan: 30+ token
surface in TenantThemeTokens, the seven new @hydrax/ui primitives, the
extended <AppShell> slots, and the rule that hero/empty-state imagery
must be generated via nano-banana with provenance in assets-meta.json.

Plan verification log appended to the plan doc itself (deferred from
STATE.yaml per the merge-time pattern).

Plan: docs/plans/2026-04-25-visual-polish-issuer-portal.md (Phase 7)"
```

### Step 5: Final branch summary

```bash
git log --oneline main..HEAD
git diff --stat main..HEAD | tail -5
```

Expected: 7 commits on the branch (one per phase, excluding the plan-doc commit if it landed on main directly). Diff stat shows ~25-30 files changed, plus the PNG binary delta.

---

## Self-Review Notes

Spec coverage:
- Token expansion → Phase 1. ✓
- 7 primitives → Phase 2. ✓
- AppShell upgrade with brand + sidebarFooter → Phase 3. ✓
- nano-banana hero → Phase 4. ✓
- issuer-portal Home polish → Phase 5. ✓
- Cross-app non-regression → Phase 6. ✓
- CLAUDE.md invariants → Phase 7. ✓
- Aesthetic Direction lock → top of plan. ✓
- Boundary Conditions (no fake data, no auth, no domain decisions) → top of plan. ✓
- Other 4 apps' polish → out of scope, separate plan. ✓ (called out)

Placeholder scan:
- Every code block contains complete code.
- No "TBD" / "TODO" / "implement later".
- No "similar to Phase N" without re-stating the code.
- Test files include real assertions, not "write tests for the above".

Type consistency:
- `TenantThemeTokens` Phase 1 names match `applyTheme` Phase 1 map keys.
- `Stack` props (`direction`, `gap`, `align`, `justify`, `wrap`) match between component (Phase 2 Step 1) and tests (Step 2).
- `EmptyState` props (`icon`, `iconLabel`, `title`, `body`, `action`, `imageSrc`, `imageAlt`) match between component, tests, and consumer (HomeRoute).
- `AppShell` props (`appName`, `brand`, `topbar`, `sidebar`, `sidebarFooter`, `children`) match between component (Phase 3), tests (Phase 3), and consumer (Phase 5 App.tsx).
- `HomeRoute` consumes `connected?: boolean` and `imageSrc` from `EmptyState` — names match.

Out-of-scope items consciously deferred:
- Distributor-portal, investor-portal, ops-console, admin polish passes (separate plans, mechanical from the issuer-portal template).
- Login route + auth flow.
- Real product/approval/investor route handlers.
- Tenant switcher, notifications panel, user menu interactivity.
- Visual regression testing.
- Dark/light mode (the dark theme is the only tenant theme today).
- i18n.
- Real backend wiring (gated on PRD §14 Q1).
