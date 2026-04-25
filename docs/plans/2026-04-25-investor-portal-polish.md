# Investor-Portal Visual-Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring `web/apps/investor-portal/` to the same NAV+stat-tiles+EmptyState shape as the four polished portals (issuer / distributor / ops-console / admin), while preserving the existing `HealthRoute` (upstream-health grid) and `SubscriptionsRoute` (subscriptions lookup) under the new shell.

**Architecture:** Mirror the distributor-portal pattern exactly — `<App>` mounts `<AppShell>` with `brand` + `topbar` + `sidebar` + `<Routes>`. New `routes/HomeRoute.tsx` follows the stats-tiles + EmptyState pattern using a new `investor-empty-state.jpg` hero. Existing `HealthRoute` and `SubscriptionsRoute` move from flat `src/` into `src/routes/`. Brand icon: `Wallet`. Three stat tiles: Active subscriptions, Holdings, Pending notices. Hero motif (matches existing visual language): line-art doughnut/pie chart on near-black canvas with one slice cyan-accented (portfolio-allocation evocation, parallels the four existing heroes).

**Tech Stack:** Vite 5 + React 18 + RTK Query + react-router-dom 6 + vitest. `@hydrax/{ui,tenant-theme,api-client}` workspace packages. Hero generated via nano-banana (Gemini 3.1 flash image preview / OpenRouter), JPEG output, 1200x896.

---

### Task 1: Hero asset + registry

**Files:**
- Create: `web/packages/ui/src/assets/investor-empty-state.jpg` (via nano-banana)
- Modify: `web/packages/ui/src/assets/assets-meta.json` (extend with 5th entry)
- Modify: `web/packages/ui/src/assets/assets.test.ts` (extend ASSETS + PORTAL_BY_ASSET)

- [ ] **Step 1.1:** Run nano-banana with the prompt below; output to `/tmp/nb-investor/`; copy the resulting JPEG into `web/packages/ui/src/assets/investor-empty-state.jpg`.

```
Minimalist institutional portfolio line art on near-black canvas (hsl(220, 16%, 8%)). A single doughnut/pie chart centered, soft white strokes (1.5px), divided into six approximately-equal slices around a hollow center. One slice accented in cyan (hsl(190, 90%, 55%)). No text, no gradients, no glow, no people, no logos, no photorealism. Subtle data-grid backdrop. Editorial, restrained, 4:3 aspect, 1200x896.
```

- [ ] **Step 1.2:** Extend `assets-meta.json` with a fifth entry mirroring the existing four-entry shape. Required fields: `generated`, `tool`, `subcommand`, `aspect`, `dimensions`, `prompt_summary`, `consumed_by`, `license`, `notes`. Use `consumed_by: "web/apps/investor-portal/src/routes/HomeRoute.tsx (empty-state for activity panel)"`.

- [ ] **Step 1.3:** Extend `assets.test.ts`:

```typescript
const ASSETS = [
  "issuer-empty-state.jpg",
  "distributor-empty-state.jpg",
  "ops-console-empty-state.jpg",
  "admin-empty-state.jpg",
  "investor-empty-state.jpg",
] as const;

const PORTAL_BY_ASSET: Record<(typeof ASSETS)[number], string> = {
  "issuer-empty-state.jpg": "issuer-portal",
  "distributor-empty-state.jpg": "distributor-portal",
  "ops-console-empty-state.jpg": "ops-console",
  "admin-empty-state.jpg": "admin",
  "investor-empty-state.jpg": "investor-portal",
};
```

- [ ] **Step 1.4:** Run `pnpm --filter @hydrax/ui test -- --run` — expect 40+ tests passing including the 3 assets-test cases now covering 5 portals.

- [ ] **Step 1.5:** Commit:

```bash
git add web/packages/ui/src/assets/investor-empty-state.jpg \
        web/packages/ui/src/assets/assets-meta.json \
        web/packages/ui/src/assets/assets.test.ts
git commit -m "feat(web/ui): add investor-portal empty-state hero (nano-banana)"
```

---

### Task 2: Polished investor-portal shell

**Files:**
- Create: `web/apps/investor-portal/src/components/InvestorSidebar.tsx`
- Create: `web/apps/investor-portal/src/components/InvestorTopBar.tsx`
- Create: `web/apps/investor-portal/src/routes/HomeRoute.tsx`
- Create: `web/apps/investor-portal/src/routes/HomeRoute.test.tsx`
- Create: `web/apps/investor-portal/src/img.d.ts`
- Move + Modify: `src/HealthRoute.tsx` → `src/routes/HealthRoute.tsx` (no behavior change; same for `.test.tsx` and `SubscriptionsRoute.tsx` + `.test.tsx`)
- Modify: `web/apps/investor-portal/src/App.tsx` (replace inline scaffold with AppShell-driven shell)
- Modify: `web/apps/investor-portal/src/App.test.tsx` (banner-collision rule: `getAllByRole("banner").length).toBeGreaterThanOrEqual(1)`)

**InvestorSidebar.tsx — NAV (mirror DistributorSidebar.tsx structure exactly, substitute table below):**

| Label | Path | Icon |
|---|---|---|
| Home | `/` | `LayoutDashboard` |
| Subscriptions | `/subscriptions` | `FileSignature` |
| Holdings | `/holdings` | `PieChart` |
| Statements | `/statements` | `FileText` |
| Notices | `/notices` | `Bell` |
| Health | `/health` | `Activity` |
| Settings | `/settings` | `Settings` |

Brand icon: `Wallet` ("Investor Portal").

**InvestorTopBar.tsx — mirror DistributorTopBar.tsx, substitute the search placeholder copy:** `Search holdings, subscriptions, notices…`. Use `<Avatar name={userName} />`. Wire `userName="Investor Operator"`.

**HomeRoute.tsx — mirror DistributorPortal HomeRoute structure, substitute:**
- Heading: `Home`
- Intro: `Investor workspace. Connect a custody feed to start populating these views.`
- 3 stat tiles:
  - `Active subscriptions` icon `FileSignature` iconLabel `Subscriptions`
  - `Holdings` icon `PieChart` iconLabel `Holdings`
  - `Pending notices` icon `Bell` iconLabel `Notices`
- EmptyState title: `No holdings activity yet`
- EmptyState body: `Once a custody feed is connected, recent allocations, settlements, and notices will appear here.`
- EmptyState `imageSrc={emptyHero}` from `../../../../packages/ui/src/assets/investor-empty-state.jpg`
- EmptyState `imageAlt="Illustration of an empty investor portfolio dashboard"`

**HomeRoute.test.tsx — mirror DistributorPortal HomeRoute.test.tsx pattern with substitutions.** 4 tests covering: heading renders, all 3 stat tile labels render, empty state title renders, hero alt text renders.

**App.tsx — mirror distributor-portal App.tsx exactly, substitute:**
- imports: `InvestorSidebar`, `InvestorBrand`, `InvestorTopBar`, `HomeRoute`, `HealthRoute`, `SubscriptionsRoute`
- `appName="investor-portal"`
- `userName="Investor Operator"`
- Routes: `/` → `HomeRoute`, `/health` → `HealthRoute`, `/subscriptions` → `SubscriptionsRoute`

**App.test.tsx — mirror distributor App.test.tsx, substitute:**
- Brand text: `Investor Portal`
- Stat-tile assertion: `Active subscriptions`
- `data-app-name === "investor-portal"`
- Hero alt: `Illustration of an empty investor portfolio dashboard`
- Use `getAllByRole("banner").length).toBeGreaterThanOrEqual(1)` not `getByRole`

- [ ] **Step 2.1:** `git mv` `HealthRoute.tsx`, `HealthRoute.test.tsx`, `SubscriptionsRoute.tsx`, `SubscriptionsRoute.test.tsx` from `src/` to `src/routes/`. Update relative imports inside the moved files (one level deeper from `@hydrax/*` packages — but those use the package alias, so should NOT need import-path edits; verify after move).

- [ ] **Step 2.2:** Create `components/InvestorSidebar.tsx` per the table above.

- [ ] **Step 2.3:** Create `components/InvestorTopBar.tsx` per the substitution above.

- [ ] **Step 2.4:** Create `routes/HomeRoute.tsx` per the substitution above.

- [ ] **Step 2.5:** Create `routes/HomeRoute.test.tsx` per the substitution above.

- [ ] **Step 2.6:** Create `src/img.d.ts` (identical to distributor's: `declare module "*.jpg"` and `*.png` blocks).

- [ ] **Step 2.7:** Replace `src/App.tsx` with the polished shell.

- [ ] **Step 2.8:** Replace `src/App.test.tsx` with the polished test set.

- [ ] **Step 2.9:** Run `pnpm --filter @hydrax/investor-portal typecheck && pnpm --filter @hydrax/investor-portal test -- --run`. Expect typecheck clean and test count ≥ 5 (Home tests + App tests + preserved Health/Subscriptions tests).

- [ ] **Step 2.10:** Commit (one specific path-list, no `-A`):

```bash
git add web/apps/investor-portal/src/
git diff --cached --name-only   # confirm only investor-portal/src/ paths
git commit -m "feat(web/investor-portal): polished Home with NAV, stat tiles, empty state"
```

---

### Task 3: Update CLAUDE.md invariant + STATE.yaml

**Files:**
- Modify: `CLAUDE.md` — update the "Hero asset inventory" bullet under "Web Monorepo — Invariants" to:
  - List five JPEGs (add `investor-empty-state.jpg`)
  - Update the description so it no longer says "uniform across four of five portals" or "Investor-portal's Home is the upstream-health grid… intentionally does not follow the stat-tiles + EmptyState shape." Replace with: the polished baseline is now uniform across all five portals; investor-portal's `/health` route preserves the upstream-health grid.
- Modify: `STATE.yaml` — append a verification_log line for this slice and refresh `summary` / `current_focus`.

- [ ] **Step 3.1:** Edit CLAUDE.md "Hero asset inventory" bullet.
- [ ] **Step 3.2:** Edit STATE.yaml summary + current_focus + append verification_log.
- [ ] **Step 3.3:** Commit:

```bash
git add CLAUDE.md STATE.yaml docs/plans/2026-04-25-investor-portal-polish.md
git commit -m "docs(claude.md,state,plan): record investor-portal polish slice"
```

---

### Verification Gates (mandatory before final commit)

Run all three from repo root:

```bash
pnpm -r --if-present typecheck
pnpm -r --if-present test -- --run
pnpm -r --if-present build
```

Expect:
- 11/11 workspaces typecheck clean
- All tests pass; web test count grows by ~5 (4 HomeRoute + 4 App refresh; existing Health/Subscriptions counts unchanged after move)
- All 5 apps emit `dist/`; investor-portal bundle includes the new hero JPEG

If any gate is red: stop, fix, re-verify before moving on.
