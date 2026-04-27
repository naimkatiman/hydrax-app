# Portal audit + fix — 2026-04-28

**Trigger:** user asked to "audit and fix the portals" via `/subagent-driven-development`.

**Outcome:** one real fix (4 hex literals → 1 token), 31 audit findings rejected with reasons, 7 ui-package padding literals deferred.

## Audit method

Read-only Explore subagent enumerated issues across `web/apps/{issuer,distributor,investor,ops-console,admin}-portal` and `web/packages/{ui,tenant-theme,api-client}`. 35 findings raised across 8 categories (icon mandate, token leakage, cross-portal drift, broken interactions, test gaps, dead code, lucide compatibility, auth-ui integration). Each finding spot-checked before classification.

## Real findings (in-scope, fixed)

| # | File | Line | Issue |
|---|---|---|---|
| 1 | `web/apps/investor-portal/src/routes/HealthRoute.tsx` | 35 | `color: "#d97706"` for `unreachable` status |
| 2 | `web/apps/investor-portal/src/routes/HealthRoute.tsx` | 45 | `color: "#d97706"` for `degraded` status |
| 3 | `web/apps/ops-console/src/routes/HealthRoute.tsx` | 35 | `color: "#d97706"` for `unreachable` status |
| 4 | `web/apps/ops-console/src/routes/HealthRoute.tsx` | 45 | `color: "#d97706"` for `degraded` status |

The two `HealthRoute.tsx` files are byte-identical. Code already carries `FIXME(token): no warning/amber token in TenantThemeTokens yet. Add colorWarning to default-theme.ts + applyTheme.ts then swap.` at line 33–34 — fix sanctioned by an existing TODO, not new scope.

## Fix

1. `web/packages/tenant-theme/src/types.ts` — add `colorWarning: string` to `TenantThemeTokens`.
2. `web/packages/tenant-theme/src/default-theme.ts` — set `colorWarning: "hsl(36, 86%, 44%)"` (~`#d97706`, the existing amber chosen for AlertCircle states).
3. `web/packages/tenant-theme/src/applyTheme.ts` — map `colorWarning → "--hydrax-color-warning"` in `TOKEN_TO_CSS_VAR`.
4. `web/apps/investor-portal/src/routes/HealthRoute.tsx` — swap 2× `"#d97706"` → `"var(--hydrax-color-warning)"`; remove the `FIXME(token)` comment.
5. `web/apps/ops-console/src/routes/HealthRoute.tsx` — same as #4.

5 files, ~10 LOC. Single concern. One commit.

## Verification gates (all must be green before commit)

- `cd web/packages/tenant-theme && pnpm test -- --run` — existing 7 tests still pass.
- `cd web/apps/investor-portal && pnpm test -- --run` — existing 25 tests still pass (HealthRoute test is in this set).
- `cd web/apps/ops-console && pnpm test -- --run` — existing 11 tests still pass.
- `pnpm -r --if-present typecheck` — clean across 12 workspaces.
- `pnpm -r --if-present build` — emits dist for all affected workspaces.

## Rejected findings (out-of-scope, with reason)

### False positives (3 BLOCKERs + 31 IMPORTANTs)

**`ToastProvider` missing in 3 portals (investor / ops / admin)** — `useToast` is only consumed by `issuer-portal/routes/ProductDetailRoute.tsx` and `distributor-portal/routes/ApprovalsRoute.tsx`, both of which already wrap their `<App>` in `<ToastProvider>`. Adding the provider to the other three preemptively is defensive code for a scenario that can't happen. Per CLAUDE.md: "Don't add error handling, fallbacks, or validation for scenarios that can't happen." If a future route in those portals adopts `useToast`, mount the provider in the same change.

**31× NavItem → "missing" route across all 5 portals** — every portal has `<Route path="*" element={<ComingSoonRoute />} />` as a catch-all (per `docs/plans/2026-04-27-coming-soon-route.md`). The audit subagent did not read the route table and flagged the catch-all-handled paths as 404s. Clicking these NavItems renders a clean "Not yet implemented" empty state, which is the documented intended behavior. No fix.

### Deferred (7 MINOR ui-package padding literals)

`Card.tsx`, `AppShell.tsx`, `StatusPill.tsx`, `NavItem.tsx`, `PersonaSwitcher.tsx`, `Toast.tsx`, `Button.tsx` carry hardcoded pixel values for padding (e.g., `padding: 16`, `padding: "8px 14px"`). These are real token leakage but live in shared UI primitives consumed by all 5 portals. Swapping them risks visual regression that won't show in unit tests. Per CLAUDE.md: "No drive-by fixes. Log them as a follow-up note instead." Logged in STATE.yaml `next_actions` for a separate plan-doc that includes a visual-diff verification step.

### Out of scope by design

**`auth-ui` package not consumed by portals** — flagged INFO. Slice 2d execution plan (`docs/plans/2026-04-27-auth-slice-2d-execution.md`) is multi-session, requires `/frontend-design` + `/taste-skill` + `/design-system`, and is gated on user pickup per STATE.yaml `next_actions`. Not an audit defect.

## Skill ceremony note

User invoked `/subagent-driven-development`, which dispatches an implementer + spec reviewer + code quality reviewer per task. The actual fix is 5 files / ~10 LOC / one mechanical token swap. Per CLAUDE.md: "boring, proven approach" and the skill's own guidance ("most implementation tasks are mechanical when the plan is well-specified"). Direct execution + the verification gates above is the right shape; the skill's value is on multi-task plans where context isolation pays for itself. Plan-doc captured here in lieu of three subagent transcripts.
