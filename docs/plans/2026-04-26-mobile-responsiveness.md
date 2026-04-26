# Mobile responsiveness — web/ portals

**Date:** 2026-04-26
**Slug:** `2026-04-26-mobile-responsiveness`
**Trigger:** User: "fix all the responsiveness in mobile view" → `/proceed-with-claude-recommendation`.
**Recommendation routed:** Phase 1 of "fix mobile responsiveness" — start with `<AppShell>` + shared `@hydrax/ui` primitives so one fix cascades to all 5 portals. Per-portal route polish is deferred to follow-up commits.

## Problem (current state, 2026-04-26)

Read of [web/packages/ui/src/AppShell.tsx](../../web/packages/ui/src/AppShell.tsx) and the 5 portal TopBars confirms three concrete gaps below 768px:

1. **No mobile navigation access.** `<AppShell>` line 67 sets `.hydrax-app-shell-sidebar { display: none; }` at `max-width: 768px`. There is no hamburger toggle, no drawer, no menu — sidebar nav is completely unreachable on phones. This is the show-stopper.
2. **TopBar overflow at small widths.** Each portal TopBar renders: `[search box with long placeholder text] [flex spacer] [bell] [PersonaSwitcher with text label] [Avatar]`. At <600px the placeholder text ("Search products, approvals, investors…") plus PersonaSwitcher label plus other items push past the viewport — wrapping or horizontal scroll.
3. **Topbar padding** drops from `xl` to `md` at <600px (good) but elements inside still don't collapse, so the saved padding is consumed by overflow anyway.

Routes themselves use `repeat(auto-fit, minmax(220px, 1fr))` for stat tiles and a single `<Card>` for content — those collapse fine. No route-level fixes needed in this commit.

## Will build

A single shared fix in `<AppShell>` plus a tagged-element pattern that all 5 TopBars opt into:

1. **Hamburger button + drawer in `<AppShell>`** ([web/packages/ui/src/AppShell.tsx](../../web/packages/ui/src/AppShell.tsx)).
   - Internal `useState<boolean>` for `sidebarOpen`. No new public props — keeps the API stable across all 5 portals.
   - Render `<button class="hydrax-app-shell-hamburger" aria-label="Open navigation" aria-expanded={...} aria-controls="hydrax-sidebar">` at the start of the topbar slot when both `hasSidebar` and `hasTopbar` are true.
   - Hamburger is `display: none` on desktop, `display: inline-flex` at `<=768px`.
   - At `<=768px`, sidebar becomes `position: fixed`, `transform: translateX(-100%)`, transitions to `translateX(0)` when `[data-sidebar-open="true"]` is set on the shell root.
   - Backdrop overlay (`<div role="presentation" class="hydrax-app-shell-backdrop">`) renders only when `sidebarOpen` AND `<=768px` (CSS-controlled). Click closes drawer.
   - ESC key closes drawer (effect with `keydown` listener while open).
   - Nav-link click inside the drawer closes it (delegated `onClick` on the `<nav>` body that closes if the target is a link/button).
   - Body scroll-lock when drawer is open (`document.body.style.overflow = "hidden"` in effect, restored on close/unmount). Otherwise iOS Safari rubber-bands behind the drawer.
2. **Mobile-collapse CSS rules in `<AppShell>`** for opt-in tagging.
   - `[data-mobile-collapse="search-label"] > span[aria-hidden]` → `display: none` at `<=600px`.
   - `[data-mobile-collapse="persona-label"]` → `display: none` at `<=480px` (selector targets the visible `<span>` label inside PersonaSwitcher; we'll tag it).
3. **TopBar updates (5 files)** — each adds two `data-mobile-collapse` attributes:
   - The search container gets `data-mobile-collapse="search-label"` (so its placeholder text hides on phones; icon stays).
   - The PersonaSwitcher visible label gets `data-mobile-collapse="persona-label"` (so the label hides on extra-small phones; icon stays).
4. **PersonaSwitcher** ([web/packages/ui/src/PersonaSwitcher.tsx](../../web/packages/ui/src/PersonaSwitcher.tsx)) — add `data-mobile-collapse="persona-label"` to the trigger button's visible `<span>{currentPersona.label}</span>`. One-line change.
5. **AppShell tests** ([web/packages/ui/src/AppShell.test.tsx](../../web/packages/ui/src/AppShell.test.tsx)) — add 4 tests:
   - hamburger renders when sidebar+topbar both present
   - hamburger does NOT render when only one is present
   - clicking hamburger toggles `data-sidebar-open` on shell root
   - ESC keydown closes the drawer

## Will NOT build (deferred follow-ups)

- Per-route mobile polish (e.g. table-heavy `ProductsListRoute` horizontal scroll). Audit after this commit ships.
- Focus trap inside the drawer. Adding `focus-trap-react` is a dependency add and out of scope. Today's behavior: open drawer focuses the first nav item; ESC closes; tabbing stays within natural document order. Acceptable for v1.
- A controlled-mode prop API (`sidebarOpen` / `onSidebarOpenChange`). Not needed yet — internal state is sufficient.
- Investor-portal `/health` route layout polish (separate concern; route-specific).
- Touch gestures (swipe-to-open / swipe-to-close). Out of scope.

## Verification

Per project gate (`pnpm -r --if-present typecheck && pnpm -r --if-present test -- --run && pnpm -r --if-present build`) — all three green or no commit.

Smallest per-item proof:

| Item | Verification |
|---|---|
| AppShell hamburger + drawer | New AppShell.test.tsx tests assert `data-sidebar-open` toggling + ESC handling |
| Mobile-collapse CSS rules | AppShell.test.tsx already asserts the `@media (max-width: 768px)` and `(max-width: 600px)` blocks exist; extend to assert `(max-width: 480px)` block also exists |
| TopBar tagging (5 files) | Test infra is light here (each portal has `App.test.tsx` which renders AppShell+TopBar). Existing tests must remain green; that proves the structural change didn't break rendering |
| Visual proof on real viewport | Start `issuer-portal` dev server (`pnpm --filter @hydrax/issuer-portal dev`), open `http://localhost:5173`, DevTools → device toolbar → iPhone SE (375x667). Hamburger visible, taps open drawer, links close drawer, ESC closes drawer, no horizontal scroll, search placeholder hidden, PersonaSwitcher label hidden. Record evidence in STATE.yaml |

## Files touched

| File | Reason |
|---|---|
| `web/packages/ui/src/AppShell.tsx` | Hamburger button + drawer state + new CSS |
| `web/packages/ui/src/AppShell.test.tsx` | New tests for hamburger, ESC, drawer toggle |
| `web/packages/ui/src/PersonaSwitcher.tsx` | Tag persona label for mobile collapse |
| `web/apps/issuer-portal/src/components/IssuerTopBar.tsx` | Tag search container |
| `web/apps/distributor-portal/src/components/DistributorTopBar.tsx` | Tag search container |
| `web/apps/investor-portal/src/components/InvestorTopBar.tsx` | Tag search container |
| `web/apps/ops-console/src/components/OpsTopBar.tsx` | Tag search container |
| `web/apps/admin/src/components/AdminTopBar.tsx` | Tag search container |
| `docs/plans/2026-04-26-mobile-responsiveness.md` | This plan |
| `STATE.yaml` | Append verification log |

**Total: 10 files**, well under the 15-file commit cap. **Single concern (mobile responsiveness in shared UI)**, ships as one commit.

## Stop conditions

- Verification fails on any of the 3 gates → fix smallest thing, re-verify, do not advance
- A new dep is required (focus-trap, etc.) → STOP, ask
- An existing portal test breaks because the AppShell behavior changed in a way I didn't anticipate → fix or roll back; do not silently delete tests
- Drawer animation requires `prefers-reduced-motion` consideration — if motion turns out to be jarring without it, add the media query before claiming done

## Reflection (filled at end of run)

To be appended after Phase 6.
