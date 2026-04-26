# Relitigate the `lucide-react`-only Icon Invariant

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` ONLY if Section 8 (the implementation phases) is greenlit by the user. The first 7 sections are decision content, not work. No code is written until the user signs off on a specific option in Section 6.

**Goal:** Decide whether the locked "icons are `lucide-react` only" invariant in [CLAUDE.md](../../CLAUDE.md) ("Web Monorepo — Invariants") should be replaced, hybridised, or kept, given the user request to adopt [`itshover`](https://github.com/itshover/itshover) animated icons.

**Architecture:** This is a relitigation document. Sections 1–6 produce a decision. Section 7 captures rollback. Section 8 is a TDD-style implementation plan that **only activates if the user chooses Option B or C**.

**Tech Stack touched if implemented:** `web/packages/ui` (4 primitives — `Icon.tsx`, `NavItem.tsx`, `EmptyState.tsx`, `PersonaSwitcher.tsx`), 5 portals (`web/apps/*-portal`, `web/apps/admin`, `web/apps/ops-console`), `motion/react` (new dep), Vite 5 + React 18, vitest. Bundle, a11y, and brand are first-order concerns.

---

## 1. The Current Invariant

**Source:** [CLAUDE.md "Web Monorepo — Invariants"](../../CLAUDE.md#web-monorepo--invariants), block:

> Icons are `lucide-react` only, wrapped in `<Icon icon=… label=… />` (a11y `aria-label` is mandatory). **No emoji in JSX.**

**Authoring decision context:** Set during the web monorepo scaffold ([docs/plans/2026-04-25-web-monorepo-scaffold.md](2026-04-25-web-monorepo-scaffold.md)). Locked by the line "Do not relitigate without a new plan doc." This file is that plan doc.

**Concrete shape today:**

- `web/packages/ui/src/Icon.tsx` — 11 lines. Single primitive that takes a `LucideIcon` component as a prop and wraps it with `aria-label` + `role="img"`:
  ```tsx
  import { type LucideIcon } from "lucide-react";
  import type { ComponentProps } from "react";

  interface IconProps extends Omit<ComponentProps<LucideIcon>, "ref"> {
    readonly icon: LucideIcon;
    readonly label: string;
  }

  export function Icon({ icon: LucideIconComponent, label, size = 16, ...rest }: IconProps) {
    return <LucideIconComponent aria-label={label} role="img" size={size} {...rest} />;
  }
  ```
- 4 of 11 `@hydrax/ui` primitives import lucide directly: `Icon`, `NavItem`, `EmptyState`, `PersonaSwitcher`. The other 7 (`AppShell`, `StatusPill`, `Button`, `Card`, `Stack`, `Heading`, `Text`, `Skeleton`, `Avatar`, `AuditTimeline`, `Toast`) do not, but they accept `Icon` instances as children/props.
- **36 files across `web/`** (5 apps + UI package) import `lucide-react`.
- **6 `package.json`** files pin `lucide-react@0.378.0`: `web/packages/ui` and each of the 5 apps. (`@hydrax/ui` re-exports `lucide-react` types but every consumer also installs it directly because lucide icons are imported as named exports, not via the wrapper.)
- Tests assert lucide structure indirectly (e.g. `<Icon icon={Settings} label="Settings" />` in the AppShell tests; tests would not need to change for a hover-equivalent of `Settings`, but they would for any swap that drops the prop-shape contract).

**Why the invariant exists:**

1. **A11y contract.** Every icon ships with a mandatory `aria-label`. The invariant is the enforcement vehicle — there's exactly one `Icon` primitive and it cannot be constructed without a label.
2. **One paradigm = one mental model.** Engineers (and dispatched subagents) only need to know `<Icon icon={…} label="…" />`. No per-icon component sprawl, no per-icon import paths, no per-icon API surface.
3. **Consistent stroke/size/color.** Lucide is a uniform stroke-based set. Mixing icon families produces visible inconsistency at the same size/color.
4. **Bundle predictability.** Lucide tree-shakes cleanly. Each named import lands the single SVG path component, ~1–2KB gzipped per icon. Total icon weight across 5 portals is low and bounded.
5. **Institutional brand fit.** HydraX positions as Canton-aligned regulated rails. The current visual register is restrained — no decorative motion on UI chrome.

These five reasons are the bar any replacement must clear.

---

## 2. Trigger for Relitigation

User on 2026-04-26: "can we implement [https://github.com/itshover/itshover] on all of our icon".

Initial response: blanket-swap recommendation declined (3 reasons: locked invariant, coverage gap, brand fit). User chose Option C from the response: write this plan doc.

**Scope of the request:** "all of our icon" — initially total replacement. The recommendation surface in this doc must take that as the starting point and reason about narrower variants.

---

## 3. What `itshover` Actually Is

**Source of truth:** [github.com/itshover/itshover](https://github.com/itshover/itshover) README, fetched 2026-04-26.

| Attribute | Value | Implication for hydrax-app |
|---|---|---|
| Library type | Animated icon library | Each icon is a bespoke React component with motion logic, not a uniform SVG set. |
| Animation runtime | `motion/react` (Framer Motion successor) | New dep ~50KB gzipped (motion runtime + ESM exports). Adds a runtime to every page that renders an animated icon. |
| Distribution | shadcn-style copy-paste via `npx shadcn add https://itshover.com/r/<name>.json` | Icons live in your repo as source. No version pin, no upgrade path, no per-package install. Each adoption = source code addition. |
| Coverage | "186+ animated icons" | Lucide ships ~1500. Confirmed gaps: institutional/finance icons (`Gavel`, `ShieldCheck`, `BadgeCheck`, `Receipt`, `Vault`, `Building2`, `Banknote`, `Landmark`) are not in itshover. |
| API shape | One component per icon: `<GithubIcon className="h-6 w-6" />` | No wrapper, no mandatory `aria-label`. A11y is on the consumer to enforce. |
| Tech stack | Next.js 16 + React 18+ + Tailwind 4 | We are Vite 5 + React 18 + plain CSS. Tailwind classes (`h-6 w-6`) in copied source need substitution. |
| License | MIT | Compatible. |
| Stability | New project (no version tag visible at fetch time) | High churn risk. shadcn-copy distribution makes this a non-issue once copied, but the upstream "registry" can change without warning. |

**The fundamental paradigm difference:** lucide is a *typed prop* (`<Icon icon={Settings} />`); itshover is a *named component* (`<SettingsIcon />`). They cannot coexist in the same `Icon` primitive without a discriminated-union API, which means relitigation isn't just "swap the import" — it's a primitive redesign.

---

## 4. Options

### Option A — Drop. Keep the invariant. No work.

- No changes. Tell the user this was evaluated and declined.
- **Effort:** 0.
- **Risk:** 0.
- **Cost:** the user's stated intent ("implement on all of our icon") is unmet.

### Option B — Hybrid wrapper. Keep lucide as the default; allow opt-in animated icons via the existing `<Icon>` primitive by extending the prop union.

Concretely:

```tsx
// web/packages/ui/src/Icon.tsx (extended)
import { type LucideIcon } from "lucide-react";
import type { ComponentProps, ComponentType } from "react";

type AnimatedIcon = ComponentType<{ className?: string; size?: number }>;

interface BaseIconProps {
  readonly label: string;
  readonly size?: number;
  readonly className?: string;
}

interface LucideIconProps extends BaseIconProps {
  readonly icon: LucideIcon;
  readonly animated?: never;
}

interface AnimatedIconProps extends BaseIconProps {
  readonly icon: AnimatedIcon;
  readonly animated: true;
}

export type IconProps = LucideIconProps | AnimatedIconProps;

export function Icon(props: IconProps) {
  const { icon: IconComponent, label, size = 16, className, ...rest } = props;
  return (
    <span aria-label={label} role="img" className={className}>
      <IconComponent size={size} {...rest} />
    </span>
  );
}
```

- a11y contract (`aria-label`) is preserved by moving it to the wrapper `<span>`.
- Animated icons are copied as source into `web/packages/ui/src/animated-icons/<name>.tsx` (per shadcn-copy paradigm) and re-exported.
- Adoption is **explicit and per-call-site**: `<Icon icon={Settings} label="Settings" />` (lucide, default) vs `<Icon icon={AnimatedSettings} animated label="Settings" />` (motion).
- New dep: `motion` only added to `@hydrax/ui` (one place).
- Initial adoption sites: 0. The hybrid lands as infrastructure; teams pick where to use it.
- **Effort:** ~1 day for primitive + 2–4 hand-picked animated icons + tests. Each subsequent adoption is ~5 min.
- **Risk:** medium — adds runtime dep, expands `Icon` API surface. Reversible by removing the discriminated union.
- **Bundle:** `motion/react` adds ~50KB gzipped to *every page that imports `@hydrax/ui`* unless we lazy-split (see below).
- **Brand risk:** controlled by adoption gate (only opt-in sites animate).

### Option C — Full swap. Replace lucide entirely with itshover.

- Replace 36 import sites, swap 4 UI primitives, change 6 `package.json` files, write a coverage backfill for the ~10 institutional icons itshover doesn't ship (custom motion components), update tests, regenerate types.
- **Effort:** 3–5 days conservative. Coverage backfill alone is ~1 day.
- **Risk:** high. Breaks every test that asserts lucide prop shapes. Bundle size rises. Brand fit unresolved on institutional surfaces (ops-console, admin).
- **Reversibility:** low — once lucide is removed from package.jsons and 36 import sites are rewritten, rollback means another 3-day operation.

### Option D — Demo/marketing site only. Use itshover in `docs/demo/site/`; web monorepo unchanged.

- Was originally Option (b) in the prior chat exchange. The user opted *past* it by choosing C, but it remains valid. This option leaves `web/` invariant intact and uses animated icons only on the public-facing landing page.
- **Effort:** ~1–2h.
- **Risk:** very low.
- **Trade:** does not satisfy "all of our icon"; only landing-page CTAs.

---

## 5. Decision Criteria

The five reasons for the invariant (Section 1) are the bar:

| Criterion | A: drop | B: hybrid | C: full swap | D: demo only |
|---|---|---|---|---|
| Preserves a11y `aria-label` contract | yes | yes (wrapper) | only with custom enforcement | n/a (demo site has its own conventions) |
| Single mental model | yes | mostly (one primitive, two prop shapes) | new model (per-icon component) | yes (web/ untouched) |
| Visual consistency at same size/color | yes | controlled (opt-in mixing) | requires audit per page | n/a |
| Bundle predictable | yes | requires lazy-split for animated | larger, harder to bound | n/a |
| Institutional brand fit | yes | controlled (opt-in only) | unresolved | yes (web/ untouched, demo can be louder) |
| Meets user intent | no | partial | yes | partial |
| Reversibility | n/a | high | low | high |

---

## 6. Recommendation

**Option B (hybrid wrapper).** Reasoning:

- It preserves all five invariant reasons while opening the door to animation where it earns its place.
- It is **the only option that does not require a binary "swap or don't" decision now**. Each adoption site is its own micro-decision.
- It is reversible. If the team finds animated icons distract from operator workflows, the discriminated-union prop shape collapses back to lucide-only with one PR.
- It does not require coverage parity — the institutional finance icons stay lucide because they have no itshover equivalent. There is no pressure to invent or commission custom motion components.
- It does not violate the "Icons are `lucide-react` only" invariant *by replacement*; it replaces the invariant with a stricter version: "Icons are `lucide-react` by default; animated icons are explicit opt-in via `animated` prop, copied source under `web/packages/ui/src/animated-icons/`, never imported directly outside `@hydrax/ui`."

**Option B does NOT mean adopting a single animated icon.** It means landing the infrastructure to do so safely. The first actual `animated` use site is a separate decision.

**Default if the user does not choose:** still Option A (drop). Option B requires explicit greenlight because it does change the locked invariant text in [CLAUDE.md](../../CLAUDE.md), even if no site animates yet.

---

## 7. Rollback Plan

Defined for Option B. Option C/D have their own rollback shapes; not enumerated here.

If Option B lands and is later rejected:

1. Remove `animated-icons/` directory.
2. Revert `Icon.tsx` to the 11-line lucide-only form.
3. Remove `motion` from `web/packages/ui/package.json`.
4. Run `pnpm -r --if-present typecheck` — every animated call site fails fast (TS error: type union no longer accepts `animated` prop). Fix each one to use a lucide equivalent.
5. Restore the invariant block in `CLAUDE.md` to its prior text (commit `<sha>` to be recorded at adoption time).
6. Commit as `revert(ui): drop hybrid icon wrapper, return to lucide-only`.

Worst-case rollback time: ~30 min if zero animated icons are in use; ~1 hour per ~5 in-use animated icons (each needs a lucide substitute).

---

## 8. Implementation Plan (Option B only)

> Activates only if the user explicitly says **"go B"**. If the user picks A, C, or D, this section is dead.

**Files affected:**

- Modify: `web/packages/ui/src/Icon.tsx`
- Create: `web/packages/ui/src/animated-icons/index.ts`
- Modify: `web/packages/ui/package.json` (add `motion` dep)
- Modify: `web/packages/ui/src/Icon.test.tsx` (new — does not exist yet; verified via `ls web/packages/ui/src/`)
- Modify: [CLAUDE.md](../../CLAUDE.md) — replace the "Icons are `lucide-react` only" invariant block with the new text below
- Modify: [STATE.yaml](../../STATE.yaml) — append `verification_log` line

Follow-on (separate plan, not this one): pick first 2–3 animated adoption sites with `frontend-design` + `taste-skill` review.

### Task 1: Add `motion` to `@hydrax/ui`

**Files:**
- Modify: `web/packages/ui/package.json`

- [ ] **Step 1: Add `motion` to dependencies**

In `web/packages/ui/package.json`, under `"dependencies"`, add:
```json
"motion": "^11.11.0"
```
Resolve the exact pin at install time via `pnpm view motion version`. The plan pins `^11.11.0` because that is the current major as of 2026-04-26; verify before commit.

- [ ] **Step 2: Install**

```bash
pnpm install
```

- [ ] **Step 3: Verify install**

```bash
pnpm -F @hydrax/ui list motion
```
Expected: a single row with `motion@<resolved>` and no peer-dep warnings.

- [ ] **Step 4: Commit**

```bash
git add web/packages/ui/package.json pnpm-lock.yaml
git commit -m "chore(ui): add motion runtime for animated icon support"
```

### Task 2: Add `Icon.test.tsx` covering current behavior (RED guard for refactor)

**Files:**
- Create: `web/packages/ui/src/Icon.test.tsx`

- [ ] **Step 1: Write the test for current lucide behavior**

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Settings } from "lucide-react";
import { Icon } from "./Icon";

afterEach(cleanup);

describe("Icon", () => {
  it("renders the lucide icon with aria-label", () => {
    render(<Icon icon={Settings} label="Settings" />);
    const el = screen.getByRole("img", { name: "Settings" });
    expect(el).toBeInTheDocument();
  });

  it("forwards size prop to the lucide component", () => {
    const { container } = render(<Icon icon={Settings} label="Settings" size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });
});
```

- [ ] **Step 2: Run test, expect PASS (current behavior is correct)**

```bash
pnpm -F @hydrax/ui test -- --run src/Icon.test.tsx
```
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add web/packages/ui/src/Icon.test.tsx
git commit -m "test(ui): pin lucide Icon behavior before hybrid refactor"
```

### Task 3: Add a new failing test for the animated branch

**Files:**
- Modify: `web/packages/ui/src/Icon.test.tsx`

- [ ] **Step 1: Append the animated-branch test**

Add to `Icon.test.tsx`:

```tsx
import type { ComponentProps } from "react";

function FakeAnimatedIcon(props: ComponentProps<"svg"> & { size?: number }) {
  return <svg data-testid="fake-animated" width={props.size} height={props.size} />;
}

describe("Icon (animated branch)", () => {
  it("wraps an animated icon with aria-label and role=img", () => {
    render(<Icon icon={FakeAnimatedIcon} label="Animated" animated size={20} />);
    const wrapper = screen.getByRole("img", { name: "Animated" });
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.querySelector("[data-testid=fake-animated]")).toHaveAttribute("width", "20");
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
pnpm -F @hydrax/ui test -- --run src/Icon.test.tsx
```
Expected: 2 passed (existing) + 1 failed (animated branch — TS error or runtime "icon is not a function" depending on union shape).

- [ ] **Step 3: Do NOT commit yet** (RED stays uncommitted; next task makes it GREEN).

### Task 4: Refactor `Icon.tsx` to the discriminated union

**Files:**
- Modify: `web/packages/ui/src/Icon.tsx`

- [ ] **Step 1: Replace the file with the new shape**

```tsx
import { type LucideIcon } from "lucide-react";
import type { ComponentProps, ComponentType } from "react";

type AnimatedIconComponent = ComponentType<{ className?: string; size?: number }>;

interface BaseIconProps {
  readonly label: string;
  readonly size?: number;
  readonly className?: string;
}

interface LucideIconProps extends BaseIconProps, Omit<ComponentProps<LucideIcon>, "ref" | "size" | "className"> {
  readonly icon: LucideIcon;
  readonly animated?: never;
}

interface AnimatedIconProps extends BaseIconProps {
  readonly icon: AnimatedIconComponent;
  readonly animated: true;
}

export type IconProps = LucideIconProps | AnimatedIconProps;

export function Icon(props: IconProps) {
  const { icon: IconComponent, label, size = 16, className, ...rest } = props;
  if (props.animated) {
    return (
      <span aria-label={label} role="img" className={className}>
        <IconComponent size={size} className={className} />
      </span>
    );
  }
  return <IconComponent aria-label={label} role="img" size={size} className={className} {...(rest as Omit<LucideIconProps, "icon" | "label" | "size" | "className" | "animated">)} />;
}
```

- [ ] **Step 2: Run tests, expect PASS**

```bash
pnpm -F @hydrax/ui test -- --run src/Icon.test.tsx
```
Expected: 3 passed.

- [ ] **Step 3: Run typecheck for the whole web tree to catch consumer regressions**

```bash
pnpm -r --if-present typecheck
```
Expected: 0 errors. The lucide branch is unchanged for consumers; no call site should break.

- [ ] **Step 4: Run the full UI package test suite**

```bash
pnpm -F @hydrax/ui test -- --run
```
Expected: all green. NavItem, EmptyState, PersonaSwitcher tests still pass because they consume `Icon` via the lucide-prop branch.

- [ ] **Step 5: Commit**

```bash
git add web/packages/ui/src/Icon.tsx web/packages/ui/src/Icon.test.tsx
git commit -m "feat(ui): icon supports lucide and animated branches via discriminated union"
```

### Task 5: Add `animated-icons/` directory and `index.ts` (empty registry)

**Files:**
- Create: `web/packages/ui/src/animated-icons/index.ts`
- Create: `web/packages/ui/src/animated-icons/README.md`

- [ ] **Step 1: Create the directory and the registry**

`web/packages/ui/src/animated-icons/index.ts`:

```ts
// Animated icons live here as copied source from itshover (or hand-rolled).
// They are imported by consumers as: import { SomeAnimatedIcon } from "@hydrax/ui";
// They MUST be wrapped with <Icon icon={…} animated label="…" /> at the call site.
// Do not export raw motion components — only the typed icon function.

export {};
```

- [ ] **Step 2: Add a README explaining how to add an icon**

`web/packages/ui/src/animated-icons/README.md`:

```markdown
# Animated Icons

Source-copied animated icons from itshover (or custom). License: MIT.

## Adding a new animated icon

1. Run `npx shadcn@latest add https://itshover.com/r/<name>.json` to generate the component.
2. Move the generated file from `components/<name>-icon.tsx` to `web/packages/ui/src/animated-icons/<name>-icon.tsx`.
3. Strip Tailwind classes; rely on `size` and `className` props.
4. Re-export from `index.ts`.
5. Add the icon to `web/packages/ui/src/index.ts` (the public package barrel).
6. Add a usage site only after `frontend-design` + `taste-skill` review.

## Rules

- Every animated icon component must accept `size?: number` and `className?: string`.
- Never render an animated icon outside the `<Icon icon={…} animated label="…" />` wrapper.
- Never import animated icons directly outside `@hydrax/ui`.
```

- [ ] **Step 3: Verify barrel still typechecks**

```bash
pnpm -F @hydrax/ui typecheck
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add web/packages/ui/src/animated-icons
git commit -m "feat(ui): scaffold animated-icons registry"
```

### Task 6: Update the invariant in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (root)

- [ ] **Step 1: Replace the icon invariant line**

Find in `CLAUDE.md` under "Web Monorepo — Invariants":

> Icons are `lucide-react` only, wrapped in `<Icon icon=… label=… />` (a11y `aria-label` is mandatory).

Replace with:

> Icons are `lucide-react` by default, wrapped in `<Icon icon=… label=… />` (a11y `aria-label` mandatory). Animated icons are opt-in via the `animated` prop, must live as copied source under `web/packages/ui/src/animated-icons/`, and must never be imported directly outside `@hydrax/ui`. Adopting a new animated icon requires `frontend-design` + `taste-skill` review on the call site. Lucide `MonitorCog` does NOT exist in v0.378.0 — ops-console uses `Settings` (gear). **No emoji in JSX.**

- [ ] **Step 2: Update the past-mistake-style note in the same file (if applicable)**

If the "Past Mistakes" section is touched in the same plan, add an entry only AFTER the first animated adoption fails — not pre-emptively.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update icon invariant to allow opt-in animated icons"
```

### Task 7: Update STATE.yaml verification_log

**Files:**
- Modify: `STATE.yaml`

- [ ] **Step 1: Append a verification_log line**

Add to STATE.yaml `verification_log`:

```
2026-04-26 — relitigate-lucide-only-invariant: Option B (hybrid wrapper) implemented; pnpm -r typecheck clean; @hydrax/ui Icon test suite 3/3 green; CLAUDE.md invariant updated; no consumer call sites changed; rollback plan in docs/plans/2026-04-26-relitigate-lucide-only-invariant.md §7
```

- [ ] **Step 2: Commit**

```bash
git add STATE.yaml
git commit -m "docs(state): record icon invariant relitigation outcome"
```

### Task 8: End-to-end validation

- [ ] **Step 1: Run the full mandated gate**

```bash
pnpm -r --if-present typecheck
pnpm -r --if-present test -- --run
pnpm -r --if-present build
```
Expected: three green, per CLAUDE.md "Verification Gates".

- [ ] **Step 2: Manually start one portal and check icons render**

```bash
pnpm -F @hydrax/ops-console dev
```
Open `http://localhost:5176`. Icons (Settings gear, NavItem icons, EmptyState icon) all render. No console errors. No visual regression.

- [ ] **Step 3: Stop the dev server and report.**

If any of the above fails, stop and re-enter Phase 5 (Iterate) of `proceed-with-claude-recommendation`. Do not proceed to follow-on adoption.

---

## 9. Decision Needed From User

Choose one and reply with the literal letter:

- **A** — drop. No work. (Default in auto-mode.)
- **B** — hybrid wrapper. Execute Section 8. (Recommendation.)
- **C** — full swap. Reject; this plan does not support it. Would require a separate plan doc.
- **D** — demo site only. Execute the prior `docs/demo/site/` scoped option (not in this plan).

This document covers only options A and B in detail. C and D would each need their own plan.

---

## 10. Self-Review

- **Spec coverage:** the user asked "can we implement [itshover] on all of our icon". This doc evaluates that ask against four options, recommends one, and gives an executable sub-plan for the recommendation. ✓
- **Placeholder scan:** every step in Section 8 has executable code or commands. No "TBD" / "implement later" / "similar to". ✓
- **Type consistency:** the `IconProps` discriminated union, `LucideIconProps`, and `AnimatedIconProps` are referenced in Tasks 3, 4, and 6 with the same shape. ✓
- **File paths:** every path cited (`web/packages/ui/src/Icon.tsx`, `NavItem.tsx`, `EmptyState.tsx`, `PersonaSwitcher.tsx`, `web/packages/ui/package.json`, `CLAUDE.md`, `STATE.yaml`, `docs/plans/`) was verified to exist via `ls` / `wc -l` / `cat` before this doc was written. ✓
- **Reversibility:** Section 7 covers rollback for the recommended option. ✓
- **Verification gates:** Task 8 runs the full CLAUDE.md mandated gate. ✓
