# Auth Slice 2d — Portal Auth UI (magic-link + passkey)

> **Status:** PLAN ONLY. Implementation deferred — UI work requires `/frontend-design` + `/taste-skill` + `/design-system` invocation per project CLAUDE.md, and the slice is multi-portal + multi-page work that is honestly multi-session.

## Goal

Make the slice 2a (passkey) + slice 2b (magic-link) + slice 2c (SMTP) endpoints user-reachable through a real browser flow. After this slice, an investor (or issuer/distributor/ops/admin) lands on a portal, types email + tenant slug, gets the magic link in their inbox, clicks it, lands on a `?token=…` consume page that mints a session, then is offered "Set up a passkey for next time" → registers a passkey → next visit signs in with passkey directly.

## Scope decision: shared package vs per-portal

**Recommend a new shared workspace `web/packages/auth-ui`** containing:
- `LoginRoute` — magic-link request form
- `MagicLinkConsumeRoute` — reads `?token=…`, posts to BFF, stores session, redirects
- `PasskeyEnrollPrompt` — opt-in card that calls `navigator.credentials.create` against the slice 2a register options + verify endpoints
- `PasskeySignInButton` — alternative entry point that calls `navigator.credentials.get` against the auth options + verify endpoints
- `useSession()` hook — reads/writes `localStorage.hydrax.session.token`, exposes whoami via RTK Query

Each portal mounts these at `/login`, `/auth/magic-link`, and `/auth/passkey`. Shared package keeps the 5 portals consistent and avoids 5x copy-paste — same rule as `@hydrax/ui` for primitives.

**Alternative considered (rejected):** put auth routes only in issuer-portal first as a "vertical slice." Rejected because the bootstrap path needs to work for *any* persona — investor signing up to a fund is the most realistic first-tenant scenario, not an issuer admin.

## Non-goals

- **No tenant-slug autocomplete.** v1: user types it.
- **No "remember this device" UX.** Slice 2a's passkey is the remembered-device equivalent; layering an additional bearer-cookie path is wasteful.
- **No SSO / OIDC.** Slice 2 commitment was passkeys.
- **No multi-step "verify your email is yours" probe.** Magic-link is itself the verification.
- **No password fallback.** v1 is passwordless. Hard requirement.
- **No social login.** Out of v1 scope; could be added as a 2g sometime.

## In scope (8 tasks; commit-per-task discipline)

1. **Task 1** — `web/packages/auth-ui` workspace scaffold (package.json + tsconfig + vitest setup mirroring `@hydrax/ui`'s shape).
2. **Task 2** — `useSession()` hook + `localStorageTokenStorage` in `auth-ui/src/session.ts`. Tests against jsdom.
3. **Task 3** — `LoginRoute` component (form: tenant_slug + email + submit; success state: "check your inbox"; error state for 4xx). 6+ tests.
4. **Task 4** — `MagicLinkConsumeRoute` component (reads `?token=`, calls BFF, stores session, redirects to `/`). 4+ tests.
5. **Task 5** — `PasskeyEnrollPrompt` component + `useEnrollPasskey()` hook wrapping `navigator.credentials.create`. Library mock for `@simplewebauthn/browser` in tests.
6. **Task 6** — `PasskeySignInButton` component + `usePasskeySignIn()` hook wrapping `navigator.credentials.get`. Library mock.
7. **Task 7** — Mount routes in all 5 portals (issuer, distributor, investor, ops-console, admin) — App.tsx adds `/login`, `/auth/magic-link`, `/auth/passkey-enroll`. Sidebar/topbar gain a "Sign out" link in `useSession`'s authenticated state.
8. **Task 8** — Protected-route gate (`<RequireSession>` wrapper) wired around the existing `/products`, `/approvals`, `/subscriptions`, `/audit` routes per portal. Unauthenticated visit redirects to `/login`. docs/env.md + STATE.yaml + Playwright smoke (one happy path per portal).

## Required skills (mandatory invocation)

- **`/frontend-design`** — Task 3, 4, 5, 6 component design. Default LLM auth-form patterns are generic (centered card, primary button, soft shadow). Override with the dark-institutional aesthetic the existing portals already ship.
- **`/taste-skill`** — paired with `/frontend-design` on every UI Task. Strict component rigor; no decorative gradients-as-substitute.
- **`/design-system`** — Task 1 + 7 to ensure shared primitives extend `@hydrax/ui` (no new icons, lucide-only; reuse `Button`, `Input`-if-exists, `Card`, `Stack`, `Heading`, `Text`).
- **`nano-banana`** — only if Task 3's "check your inbox" success state warrants generated illustration (likely overkill — empty-state pattern from existing portals reuses the hero JPEGs).

## Endpoints consumed

All from BFF (already shipping after slice 2c):

| BFF endpoint | Used by |
|---|---|
| `POST /v1/auth/magic-link/request` | LoginRoute |
| `GET /v1/auth/magic-link/consume?token=…` | MagicLinkConsumeRoute |
| `GET /v1/auth/whoami` | `useSession()` to validate stored token, RequireSession gate |
| `POST /v1/auth/logout` | "Sign out" |
| `POST /v1/auth/passkeys/register/options` + `verify` | PasskeyEnrollPrompt |
| `POST /v1/auth/passkeys/auth/options` + `verify` | PasskeySignInButton |

`@hydrax/api-client` already exports the slice 1 + 2a hooks. Slice 2d adds `useRequestMagicLink`, `useConsumeMagicLink`, and possibly `useEnrollPasskey` / `usePasskeySignIn` hooks (or keeps them inside `auth-ui` if they're stateful in ways RTK Query doesn't model well).

## State / storage

- `localStorage.hydrax.session.token` — bearer token, written on consume, cleared on logout.
- `useSession()` reads, validates via `whoami`, exposes `{session, status, signOut}`.
- No cookies — bff is bearer-only by design (slice 1 invariant).

## Acceptance criteria

- [ ] All 8 tasks ship as 8 single-concern commits.
- [ ] `pnpm -r --if-present typecheck && pnpm -r --if-present test -- --run && pnpm -r --if-present build` green.
- [ ] All 5 portals expose `/login`, `/auth/magic-link`, `/auth/passkey-enroll`. The 4 protected routes gate on `RequireSession`.
- [ ] Playwright smoke: one happy path per portal — enter tenant_slug + email → check inbox stub (the test fixture intercepts notify-svc) → click link → land on consume → land on home with header showing email + Sign out.
- [ ] `useSession()` round-trips `localStorage.hydrax.session.token` and clears on whoami 401.
- [ ] No emoji, lucide icons only, dark-institutional aesthetic consistent with existing portals.
- [ ] AUTH_DEV_LOGIN=1 stays untouched (slice 2e removal).

## Dependencies

- `@simplewebauthn/browser@13` (matches integration-svc server version)
- `react-router-dom@6` (already in apps)
- `@hydrax/ui` primitives (Button, Card, Stack, Heading, Text, EmptyState)
- `@hydrax/api-client` (extend with magic-link hooks if not already there from a prior slice)

## Out-of-scope follow-ups

- Multi-tenant tenant-slug picker (autocomplete + recents)
- Account recovery flow (lost passkey, lost email access)
- Audit log of login/enrollment events
- Per-portal branded login screens (would consume tenant theme variables)
- Email template HTML (slice 2c left text-only; portal-side preview tool is its own slice)

## Self-review notes

- ✓ Spec coverage: every endpoint slice 2a-2c ships has a UI consumer.
- ✓ Type consistency: `MagicLinkSessionResult` from BFF proxy lines up with the localStorage token shape (`{token, session: {…}}`).
- ✓ Scope: 8 tasks, ≤6 files each. Total estimate ~1500 LOC. Multi-session work — kept as a plan, NOT implemented in the slice 2c session.
