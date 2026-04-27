# Coming-soon route — close 24 blank stub findings

**Date:** 2026-04-27
**Author:** Claude (auto mode)
**Trigger:** Playwright link audit on `web/portal-deploy/` found 24 sidebar nav items resolving to a blank `<main>`. Source: each portal's `<Routes>` is missing entries for half its sidebar nav items, and there is no catch-all.
**Authorization:** User selected "Add a catch-all `<Route path="*" element={<ComingSoonRoute />} />`" from the audit's two-option recommendation. Source-only; out-of-scope: filling the 24 routes with real content.

## Goal

After this change, clicking any nav item in any portal renders **content** — either the real route or a clear "Not yet implemented" empty state — never a blank canvas. Zero net new product features; pure UX hygiene.

## Scope

### In scope

1. New `ComingSoonRoute` primitive in `@hydrax/ui` that calls `useLocation()` and renders `<EmptyState title="Not yet implemented" body={…path…} icon={Construction} />`.
2. Add `react-router-dom` as a peer dep of `@hydrax/ui` (the 5 consumers all already provide it; vitest gets it via devDeps).
3. Re-export from `web/packages/ui/src/index.ts`.
4. Vitest cover for the new component (rendered title + path display + icon a11y label).
5. Wire `<Route path="*" element={<ComingSoonRoute />} />` as the last route in all 5 portal `App.tsx` files.
6. Rebuild the 5 portal Vite bundles into `web/portal-deploy/<portal>/` (matches the existing `build(portals): rebuild …` commit pattern).
7. Re-run the Playwright audit on the rebuilt bundles to prove all 24 findings closed.

### Out of scope

- Filling any of the 24 unimplemented routes with real content (separate feature plans).
- Adding new sidebar nav items.
- Changing existing real routes.
- Touching `docs/demo/site/` (different surface; clean per the prior audit).

## Files touched (estimated)

| File | Change | LOC |
|---|---|---|
| `web/packages/ui/src/ComingSoonRoute.tsx` | new component | ~35 |
| `web/packages/ui/src/ComingSoonRoute.test.tsx` | new test | ~35 |
| `web/packages/ui/src/index.ts` | 1 export line | 1 |
| `web/packages/ui/package.json` | peerDep + devDep `react-router-dom` | 2 |
| `web/apps/issuer-portal/src/App.tsx` | import + 1 `<Route>` line | 2 |
| `web/apps/distributor-portal/src/App.tsx` | import + 1 `<Route>` line | 2 |
| `web/apps/investor-portal/src/App.tsx` | import + 1 `<Route>` line | 2 |
| `web/apps/ops-console/src/App.tsx` | import + 1 `<Route>` line | 2 |
| `web/apps/admin/src/App.tsx` | import + 1 `<Route>` line | 2 |
| `web/portal-deploy/<5 portals>/` | rebuilt assets | (generated) |
| `STATE.yaml` | verification_log entry | ~3 |

Total source LOC: ~85. Plus rebuilt bundles (generated).

## Verification gates (mandatory)

1. `pnpm -r --if-present typecheck` green across all 12 workspaces.
2. `pnpm -r --if-present test -- --run` green; new `ComingSoonRoute` test passes.
3. `pnpm -r --if-present build` green for all 5 portals.
4. Smoke serve `web/portal-deploy/` on `:4321` and re-run `/tmp/hydrax-audit/audit.mjs` — total findings drop from 24 → 0.
5. Visual spot-check: screenshot one stub-formerly route (e.g. `/issuer/settings`) shows the empty state — title, icon, current path body.

## Commit plan

Three single-concern commits, ≤15 files each, conventional format:

1. `feat(ui): add ComingSoonRoute primitive for unregistered routes` — `web/packages/ui/` only (component, test, index, package.json).
2. `feat(portals): wire catch-all ComingSoonRoute in 5 portal Apps` — 5 `App.tsx` files only.
3. `build(portals): rebuild 5 portal bundles with catch-all coverage` — `web/portal-deploy/<portal>/` rebuilds only.

User approval gate: per global CLAUDE.md "NEVER commit unless explicitly asked", I will land the source + verify and **stop short of `git commit`**. Show the diff and ask.

## Risk

- Adding `react-router-dom` as a peer dep of `@hydrax/ui` couples the package to a router. Mitigation: it's an internal package consumed only by 5 apps that already use react-router-dom 6.30; not a public release.
- Rebuilding portal bundles invalidates existing static assets fingerprints. Mitigation: the existing `build(portals)` commit pattern handles this routinely.
- React Router 6 catch-all `path="*"` only fires when no other route matches — so existing real routes are unaffected.

## Rollback

`git revert` of the 3 commits, in reverse order. Each commit is independently revertible (the build commit can be reverted without touching source; source revert auto-stales the bundle until next rebuild).
