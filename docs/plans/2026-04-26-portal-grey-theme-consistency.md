# Portal grey-core theme + cross-portal consistency

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolor the deployed Railway portal stack (landing + 5 React portals at `https://hydraxrail.up.railway.app/`) onto a single neutral-grey design language, fix responsive collapse on the shared `<AppShell>`, and align typography and spacing tokens across the static landing and React portals so the tenant default looks like one product across all six surfaces.

**Architecture:** Two parallel token systems exist today — `--hx-*` in `web/portal-deploy/styles.css` (landing only) and `--hydrax-*` from `@hydrax/tenant-theme` (5 React portals). Both currently render blue-grey base + cyan/blue accent. The slice rewrites both palettes to a neutral-grey base + warm-grey accent (no hue chroma in the base; only a single low-sat warm grey for accent surfaces), and fixes the shared shell's known responsive gaps. Per-portal route content (HomeRoute, Sidebar, TopBar) inherits via tokens; no per-app cosmetic edits.

**Tech Stack:** TypeScript, React 18, Vite 5, vitest, pnpm 9 workspaces, plain CSS variables, lucide-react icons.

---

## Files

- Modify: `web/packages/tenant-theme/src/default-theme.ts` — recolor 12 color tokens to grey-core. No new tokens; no token removals.
- Modify: `web/portal-deploy/styles.css` — recolor `--hx-bg`, `--hx-bg-elevated`, `--hx-ink*`, `--hx-accent*`, `--hx-border`, `--hx-glass-*` to grey-core matching the React-portal palette. Remove blue chroma from glass tints. No layout changes.
- Modify: `web/packages/ui/src/AppShell.tsx` — replace inline `gridTemplateColumns: "240px 1fr"` with a media-query-aware layout that collapses sidebar to off-canvas overlay below 768px, and tightens main padding below 600px. Adds `<style>` block alongside the existing shimmer keyframes.
- Modify: `web/packages/ui/src/AppShell.test.tsx` — add one test asserting the responsive collapse class hook is present in the rendered DOM.
- Modify: `web/portal-deploy/index.html` — verify zero hard-coded blue accent colors that bypass `--hx-*` tokens; if any, swap to var references. Read-only confirmation step in most cases.
- Rebuild: `web/portal-deploy/{issuer,distributor,investor,ops,admin}/` — vite-emitted JS bundles + index.html for each app, copied from `web/apps/<app>/dist/` after the theme change rebuild.
- Modify: `STATE.yaml` — append `verification_log` entry, update `current_focus` and `recently_verified`.
- Create: `docs/plans/2026-04-26-portal-grey-theme-consistency.md` — this file.

---

## Decisions (locked before tasks)

1. **Grey-core palette (HSL).** Single hue (`0`) for true neutral, low chroma. No blue, no cyan. Defined once and used by both token systems verbatim.
   - bg: `hsl(0, 0%, 8%)` near-black neutral
   - bg raised: `hsl(0, 0%, 14%)`
   - surface: `hsl(0, 0%, 12%)`
   - text: `hsl(0, 0%, 92%)`
   - text strong: `hsl(0, 0%, 98%)`
   - text muted: `hsl(0, 0%, 64%)`
   - border: `hsl(0, 0%, 22%)`
   - accent: `hsl(30, 8%, 72%)` — warm desaturated grey (slight 30° hue, 8% sat) so accent visually separates from neutral text without reintroducing brand-blue
   - accent soft: `hsla(30, 8%, 72%, 0.12)`
   - focus ring: `hsla(30, 8%, 72%, 0.55)` — slightly stronger than tonal accent so a11y outline reads at distance
   - danger: `hsl(0, 72%, 58%)` (unchanged — semantic red kept)
   - success: `hsl(140, 60%, 50%)` (unchanged — semantic green kept)

   Rationale for warm-grey accent over pure neutral: a true `hsl(0, 0%, X%)` accent on a `hsl(0, 0%, 8%)` field reads as "another shade of the same paint" and accent surfaces (active nav, focus ring) visually disappear. 30°/8%/72% keeps the surface unmistakably neutral but gives accents 1-2 LCh steps of visual separation. The danger and success channels retain hue because they are semantic, not branded.

2. **Responsive breakpoints.** Two breakpoints only:
   - `(max-width: 768px)` — sidebar becomes hidden (CSS `display: none`) since the deploy is a demo / institutional desktop tool. Main grid collapses to single column. Topbar height kept at 56px. No drawer, no hamburger — out of scope. Future work: drawer + toggle button.
   - `(max-width: 600px)` — main content padding drops from `--hydrax-space-xl` (24px) to `--hydrax-space-md` (12px); topbar padding mirrors.

3. **Landing alignment.** Landing already uses 8pt scale (`--hx-space-*`); portals use 4pt scale (`--hydrax-space-*`). Do not unify scales in this slice — both produce the same final px values at the spots that matter (24px container padding, 56px topbar). Unifying would touch every CSS rule in styles.css; defer.

4. **No content changes.** No copy edits. No new sections on landing. No new components. Only tokens + AppShell shell.

---

## Task 1: Recolor tenant-theme defaults to grey-core

**Files:**
- Modify: `web/packages/tenant-theme/src/default-theme.ts`

- [ ] **Step 1: Update tokens.** Replace 9 color values exactly as below; leave everything else untouched.

```typescript
// web/packages/tenant-theme/src/default-theme.ts (color block only)
colorBg: "hsl(0, 0%, 8%)",
colorBgRaised: "hsl(0, 0%, 14%)",
colorSurface: "hsl(0, 0%, 12%)",
colorText: "hsl(0, 0%, 92%)",
colorTextStrong: "hsl(0, 0%, 98%)",
colorTextMuted: "hsl(0, 0%, 64%)",
colorBorder: "hsl(0, 0%, 22%)",
colorAccent: "hsl(30, 8%, 72%)",
colorAccentSoft: "hsla(30, 8%, 72%, 0.12)",
colorFocusRing: "hsla(30, 8%, 72%, 0.55)",
// colorDanger and colorSuccess unchanged
```

Also update `shadowSm` and `shadowMd` HSL hues from `220` to `0`:

```typescript
shadowSm: "0 1px 2px hsla(0, 0%, 0%, 0.45)",
shadowMd: "0 6px 16px hsla(0, 0%, 0%, 0.5)",
```

- [ ] **Step 2: Run tenant-theme tests.**

Run: `pnpm --filter @hydrax/tenant-theme test -- --run`
Expected: 7 tests pass (none assert literal default colors).

- [ ] **Step 3: Run web typecheck.**

Run: `pnpm -r --if-present typecheck`
Expected: clean across all 12 workspaces (no type changes; only string-literal token values).

---

## Task 2: Recolor portal-deploy landing styles to grey-core

**Files:**
- Modify: `web/portal-deploy/styles.css` — `:root` block lines 5-60.

- [ ] **Step 1: Rewrite the `:root` color tokens.** Replace the current `--hx-*` color values with grey-core equivalents. Glass tint loses blue chroma.

```css
:root {
  --hx-bg: hsl(0, 0%, 8%);
  --hx-bg-elevated: hsl(0, 0%, 14%);
  --hx-ink: hsl(0, 0%, 96%);
  --hx-ink-soft: hsla(0, 0%, 96%, 0.72);
  --hx-ink-muted: hsla(0, 0%, 96%, 0.55);
  --hx-accent: hsl(30, 8%, 78%);
  --hx-accent-strong: hsl(30, 8%, 92%);
  --hx-success: hsl(140, 60%, 50%);
  --hx-border: hsla(0, 0%, 96%, 0.12);

  --hx-glass-bg: hsla(0, 0%, 14%, 0.55);
  --hx-glass-bg-strong: hsla(0, 0%, 14%, 0.78);
  --hx-glass-tint: hsla(0, 0%, 96%, 0.04);
  --hx-glass-border: hsla(0, 0%, 96%, 0.10);
  --hx-glass-highlight: hsla(0, 0%, 96%, 0.08);
  --hx-glass-blur: blur(24px) saturate(140%);
  --hx-glass-blur-nav: blur(18px) saturate(160%);
  /* typography, spacing, radii, motion, shadows: unchanged */
}
```

- [ ] **Step 2: Audit the rest of styles.css for blue literals.** Anything that hard-codes a blue (`#5EA8FF`, `#2B6FE6`, `rgb(94,168,255,…)`) outside `:root` must be swapped to a `var(--hx-accent)` reference. Run the audit:

Run: `grep -nE "#5EA8FF|#2B6FE6|94, ?168, ?255" web/portal-deploy/styles.css`
Expected: zero hits after edits.

- [ ] **Step 3: Audit `index.html` and `app.js` for hard-coded blue.**

Run: `grep -nE "#5EA8FF|#2B6FE6|94, ?168, ?255" web/portal-deploy/index.html web/portal-deploy/app.js`
Expected: zero hits. If any present, replace inline color refs with `var(--hx-accent)` (in HTML inline style) or token-driven CSS class.

- [ ] **Step 4: Verify static-asset still serves.**

Run: `python3 -c "open('web/portal-deploy/styles.css').read()" && echo OK`
Expected: `OK` printed (file readable, no truncation).

- [ ] **Step 5: Eyeball locally.**

Run: `cd web/portal-deploy && python3 -m http.server 8765 &` then open `http://localhost:8765/`. Verify: dark-grey base, no visible blue cast, accent reads as warm-grey on hover/focus. Kill server when done.

---

## Task 3: AppShell responsive collapse

**Files:**
- Modify: `web/packages/ui/src/AppShell.tsx`
- Modify: `web/packages/ui/src/AppShell.test.tsx`

- [ ] **Step 1: Write the failing test.** Append to `AppShell.test.tsx`.

```typescript
it("includes a responsive media query that hides the sidebar at small viewports", () => {
  const { container } = render(
    <AppShell appName="x" brand={<span>B</span>} sidebar={<span>SB</span>}>
      <span>main</span>
    </AppShell>,
  );
  const styleTags = Array.from(container.querySelectorAll("style"));
  const haveResponsive = styleTags.some((tag) =>
    (tag.textContent ?? "").includes("@media (max-width: 768px)"),
  );
  expect(haveResponsive).toBe(true);
});
```

- [ ] **Step 2: Run test, confirm it fails.**

Run: `pnpm --filter @hydrax/ui test -- --run AppShell`
Expected: FAIL — `expected false to be true` on the new test.

- [ ] **Step 3: Implement responsive layout in AppShell.tsx.** Replace the inline grid styling with a class hook + a `<style>` block carrying the media queries. Keep the existing shimmer keyframes.

Key edits:
- Add a unique class string (e.g. `hydrax-app-shell`) to the root `<div>`.
- Move grid-template props into a CSS rule keyed on that class so they can be overridden by media queries.
- Append two `@media` blocks to the inline `<style>`:

```typescript
const SHELL_STYLES = `
${SHIMMER_KEYFRAMES}
.hydrax-app-shell {
  min-height: 100vh;
  height: 100vh;
  background: var(--hydrax-color-bg);
  color: var(--hydrax-color-text);
  font-family: var(--hydrax-font-sans);
  font-size: var(--hydrax-type-body-size);
  line-height: var(--hydrax-type-body-line-height);
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: 56px 1fr;
  grid-template-areas: "sidebar topbar" "sidebar main";
}
.hydrax-app-shell[data-no-sidebar="true"] { grid-template-columns: 1fr; grid-template-areas: "topbar" "main"; }
.hydrax-app-shell[data-no-topbar="true"] { grid-template-rows: 1fr; }
.hydrax-app-shell[data-no-sidebar="true"][data-no-topbar="true"] { grid-template-areas: "main"; }
.hydrax-app-shell-main { grid-area: main; padding: var(--hydrax-space-xl); overflow-y: auto; }
.hydrax-app-shell-topbar { grid-area: topbar; border-bottom: 1px solid var(--hydrax-color-border); background: var(--hydrax-color-bg); padding: 0 var(--hydrax-space-xl); display: flex; align-items: center; gap: var(--hydrax-space-md); }
.hydrax-app-shell-sidebar { grid-area: sidebar; border-right: 1px solid var(--hydrax-color-border); background: var(--hydrax-color-surface); display: flex; flex-direction: column; }
@media (max-width: 768px) {
  .hydrax-app-shell { grid-template-columns: 1fr; grid-template-areas: "topbar" "main"; }
  .hydrax-app-shell-sidebar { display: none; }
}
@media (max-width: 600px) {
  .hydrax-app-shell-main { padding: var(--hydrax-space-md); }
  .hydrax-app-shell-topbar { padding: 0 var(--hydrax-space-md); }
}
`;
```

Then in the component body, replace inline styles with the class hooks and pass `data-no-sidebar` / `data-no-topbar` attributes for the no-sidebar / no-topbar branches:

```tsx
return (
  <div
    data-app-name={appName}
    data-no-sidebar={hasSidebar ? undefined : "true"}
    data-no-topbar={hasTopbar ? undefined : "true"}
    className="hydrax-app-shell"
  >
    <style>{SHELL_STYLES}</style>
    {hasSidebar ? (
      <aside className="hydrax-app-shell-sidebar">
        {brand ? <div style={sidebarBrandStyle}>{brand}</div> : null}
        {sidebar ? <nav style={sidebarBodyStyle}>{sidebar}</nav> : null}
        {sidebarFooter ? <div style={sidebarFooterStyle}>{sidebarFooter}</div> : null}
      </aside>
    ) : null}
    {hasTopbar ? (
      <header role="banner" className="hydrax-app-shell-topbar">
        {topbar}
      </header>
    ) : null}
    <main className="hydrax-app-shell-main">{children}</main>
  </div>
);
```

Keep `sidebarStyle`, `sidebarBrandStyle`, `sidebarBodyStyle`, `sidebarFooterStyle`, `topbarStyle`, `mainStyle` deletion-safe — drop the ones now superseded by classes (`sidebarStyle`, `topbarStyle`, `mainStyle`); keep the brand/body/footer ones (still used inline because they sit inside `<aside>`).

- [ ] **Step 4: Run AppShell tests.**

Run: `pnpm --filter @hydrax/ui test -- --run AppShell`
Expected: PASS — all original 6 tests + the new responsive test (7 total).

- [ ] **Step 5: Run full UI package tests.**

Run: `pnpm --filter @hydrax/ui test -- --run`
Expected: PASS — full package green (60 tests).

- [ ] **Step 6: Run web typecheck.**

Run: `pnpm -r --if-present typecheck`
Expected: clean.

---

## Task 4: Rebuild + sync portal dist into portal-deploy/

**Files:**
- Touch (regenerated): `web/portal-deploy/{issuer,distributor,investor,ops,admin}/index.html` + `assets/*`

- [ ] **Step 1: Build all 5 portals with `VITE_BASE_PATH` set.**

Run for each portal:

```bash
VITE_BASE_PATH=/issuer/      pnpm --filter @hydrax/issuer-portal      build
VITE_BASE_PATH=/distributor/ pnpm --filter @hydrax/distributor-portal build
VITE_BASE_PATH=/investor/    pnpm --filter @hydrax/investor-portal    build
VITE_BASE_PATH=/ops/         pnpm --filter @hydrax/ops-console        build
VITE_BASE_PATH=/admin/       pnpm --filter @hydrax/admin              build
```

Expected: each emits `web/apps/<app>/dist/index.html` + `dist/assets/*`. No errors.

- [ ] **Step 2: Sync each portal's dist into portal-deploy/.**

Run:

```bash
for app in issuer distributor-portal:distributor investor-portal:investor ops-console:ops admin:admin issuer-portal:issuer; do
  src="${app%%:*}"
  dst="${app##*:}"
  rm -rf "web/portal-deploy/${dst}"
  cp -r "web/apps/${src}/dist" "web/portal-deploy/${dst}"
done
```

(Adjust loop or run per-app `cp` calls if the inline form is awkward; the goal is `web/portal-deploy/<dst>/index.html` + `web/portal-deploy/<dst>/assets/*` for all 5.)

Per-app form is safer:

```bash
for pair in "issuer-portal:issuer" "distributor-portal:distributor" "investor-portal:investor" "ops-console:ops" "admin:admin"; do
  src="${pair%%:*}"
  dst="${pair##*:}"
  rm -rf "web/portal-deploy/${dst}"
  cp -r "web/apps/${src}/dist" "web/portal-deploy/${dst}"
done
```

- [ ] **Step 3: Verify each `web/portal-deploy/<dst>/index.html` exists.**

Run: `ls web/portal-deploy/{issuer,distributor,investor,ops,admin}/index.html`
Expected: all 5 files listed.

- [ ] **Step 4: Verify the bundle paths resolve under the right base.**

Run: `grep -o 'src="[^"]*"' web/portal-deploy/issuer/index.html | head -3`
Expected: `src="/issuer/assets/index-XXXXXX.js"` — leading `/issuer/` confirms `VITE_BASE_PATH` was honored.

- [ ] **Step 5: Eyeball the combined bundle locally.**

Run: `cd web/portal-deploy && npx serve -s . -l 8765 &` then open:
- `http://localhost:8765/` — landing
- `http://localhost:8765/issuer/` — issuer portal
- `http://localhost:8765/investor/` — investor portal

Verify: all surfaces render with grey-core palette, no blue, no broken bundle 404s. Kill server when done.

---

## Task 5: Verification gate (full)

- [ ] **Step 1: Run all gates.**

```bash
pnpm -r --if-present typecheck
pnpm -r --if-present test -- --run
pnpm -r --if-present build
node --check web/portal-deploy/app.js
```

Expected: all green. `app.js` was not modified, but the check confirms no accidental edit.

- [ ] **Step 2: Confirm no rogue blue color literal slipped in.**

Run:

```bash
grep -rnE "(#5EA8FF|#2B6FE6|hsl\\(190|hsl\\(220, ?1[46])" web/packages/tenant-theme/src/ web/packages/ui/src/ web/portal-deploy/styles.css web/portal-deploy/index.html web/portal-deploy/app.js
```

Expected: zero hits across the code we own. (Built dist files under `web/portal-deploy/<portal>/assets/` may contain hashed bundles — those are out of scope of this grep.)

- [ ] **Step 3: Confirm `git diff --stat` matches expected scope per commit.** See Commit Plan below.

---

## Task 6: STATE.yaml + commit plan

- [ ] **Step 1: Append `verification_log` entry.**

Format:
```
2026-04-26 — Portal grey-core theme + AppShell responsive slice. tenant-theme/default-theme.ts recolored to grey-core (HSL hue 0, accent hsl(30,8%,72%)); portal-deploy/styles.css matched grey-core; AppShell.tsx wrapped grid in class+media-query block (≤768px collapse, ≤600px tightened padding) plus 1 new vitest. Verification — pnpm -r typecheck clean across 12 workspaces; pnpm -r test -- --run 60 ui tests + N apps green; pnpm -r build emits 5 dist/ outputs; portal-deploy synced via per-app rm -rf + cp -r dist. node --check app.js passes. Plan: docs/plans/2026-04-26-portal-grey-theme-consistency.md.
```

- [ ] **Step 2: Update `current_focus`** — replace prior portal-landing-liquid-glass entry with grey-core summary.

- [ ] **Step 3: Commit plan (one concern per commit, ≤15 files except generated dist).**

Commit 1 — `feat(theme): grey-core palette across tenant-theme defaults and portal-deploy landing`
- `web/packages/tenant-theme/src/default-theme.ts`
- `web/portal-deploy/styles.css`
- `web/portal-deploy/index.html` (only if blue literal swap was needed)

Commit 2 — `feat(ui/app-shell): responsive collapse below 768px + tightened padding below 600px`
- `web/packages/ui/src/AppShell.tsx`
- `web/packages/ui/src/AppShell.test.tsx`

Commit 3 — `build: rebuild portal bundles with grey-core theme` (purely generated output — files-per-commit cap waived per CLAUDE.md global rule)
- `web/portal-deploy/{issuer,distributor,investor,ops,admin}/**`

Commit 4 — `chore(state): record portal grey-core slice + plan reference`
- `STATE.yaml`
- `docs/plans/2026-04-26-portal-grey-theme-consistency.md` (already created at slice start; commit it here if not already in tree)

---

## Task 7: Deploy (gated on user confirmation)

- [ ] **Step 1: Confirm Railway link.**

Run: `cd web/portal-deploy && railway status`
Expected: `Project: hydrax-portals` (or whatever the linked project is). If unlinked, halt and ask user to run `railway link`.

- [ ] **Step 2: User authorizes deploy.** Halt and ask for explicit `deploy approved` before running `railway up`. Auto mode does not authorize Railway deploys per CLAUDE.md rule.

- [ ] **Step 3: Deploy.**

Run: `cd web/portal-deploy && railway up --detach`
Expected: build id + deploy SUCCESS. Record both in STATE.yaml `verification_log`.

- [ ] **Step 4: Healthcheck.**

Run: `curl -sI https://hydraxrail.up.railway.app/ | head -1`
Expected: `HTTP/2 200`.

- [ ] **Step 5: User visual sign-off.** Open the URL, confirm grey-core palette, click into each portal subpath. Halt for user verdict.

---

## Out of scope (deferred follow-ups)

- Hamburger / drawer toggle for sidebar at small viewports (current slice hides it entirely below 768px).
- Per-portal HomeRoute redesign beyond what tokens drive.
- Unifying `--hx-space-*` 8pt scale with `--hydrax-space-*` 4pt scale (touches every CSS rule on the landing).
- Light mode / `prefers-color-scheme` honor (landing intentionally dark-only today).
- New tenant-theme presets (this slice only edits the default).
- Hero imagery regeneration (current JPEGs may have warm tones that read fine on grey; if not, separate `nano-banana` slice).

---

## Self-Review

**1. Spec coverage.** User asked for: grey core (Task 1, 2 — both token systems), consistent theme across portals (Task 4 syncs the rebuilt bundles), responsiveness (Task 3 AppShell media queries), alignment (covered by single-source token stack — landing and portals share final px values; full 4pt/8pt unification deferred and called out). All four covered.

**2. Placeholder scan.** Task 4 step 2 has an inline shell-loop fragment that's slightly awkward; the per-app `for pair in …` form below it is the canonical version. No TBDs, no "implement later", no missing code blocks. New types: none — only string-literal token edits.

**3. Type consistency.** `AppShellProps` interface unchanged. `TenantThemeTokens` interface unchanged (only token *values* edited, not the contract). Class names referenced from tests (`hydrax-app-shell` data attributes are not asserted; only the `@media (max-width: 768px)` text content is). Consistent.
