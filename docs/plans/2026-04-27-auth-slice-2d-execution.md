# Auth Slice 2d — Portal Auth UI (Execution Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. UI tasks (3, 4, 5, 6) ALSO require `/frontend-design` + `/taste-skill` invocation per project CLAUDE.md.

**Goal:** Make slice 2a (passkey) + 2b (magic-link) + 2c (SMTP) endpoints user-reachable through a real browser. After this slice, an investor (or issuer/distributor/ops/admin) lands on a portal, types email + tenant slug, gets the magic link in their inbox, clicks it, lands on a `?token=…` consume page that mints a session, then is offered "Set up a passkey for next time" → registers a passkey → next visit signs in with passkey directly.

**Replaces** the aspirational outline at `docs/plans/2026-04-26-auth-slice-2d-portal-auth-ui.md` (still useful for the high-level scope decision; this doc supersedes it for execution).

**Tech stack:** Vite 5 + React 18 + RTK Query + react-router-dom 6 + vitest + @testing-library/react + jsdom. New dep: `@simplewebauthn/browser@13` (matches integration-svc server version) in the new `@hydrax/auth-ui` package only.

---

## Production-Readiness Disclaimer

After slice 2d ships, the **complete user-facing flow is live for the first time**:
- Investor visits `/login` → submits tenant_slug + email → BFF returns 202 → user gets email
- Investor clicks email link → lands on `/auth/magic-link?token=…` → consume page mints session → redirects home
- Authenticated investor visits `/auth/passkey-enroll` → registers a passkey for next time
- On return visit, investor clicks "Sign in with passkey" → WebAuthn ceremony → session minted

What slice 2d does NOT ship:
- Removal of `AUTH_DEV_LOGIN=1` (slice 2e)
- Tenant-slug autocomplete / picker (UI keeps it as a typed field)
- "Remember this device" UX beyond the passkey itself
- Account recovery flow (lost passkey + lost email access)
- HTML email templates (slice 2c stayed text-only)
- SSO / OIDC / social login

**`AUTH_DEV_LOGIN=1` stays untouched.** Slice 2d adds magic-link + passkey to the portal as parallel bootstraps; the dev-login flag remains fail-closed in prod and is only used for `pnpm dev` workflows. Slice 2e removes it entirely.

---

## Decision Log (read before changing scope)

| Decision | Why | Where to override |
|---|---|---|
| New `@hydrax/auth-ui` workspace package | Five portals, one auth surface — copy-paste across 5 apps would drift fast (same logic as `@hydrax/ui`) | n/a |
| Token storage = `localStorage["hydrax.session.token"]` | Already established by slice 1's `localStorageTokenStorage` in `api-client/src/auth.ts` | `auth-ui/src/session.ts` |
| Bearer-only (no cookies) | BFF is bearer-only by design (slice 1 invariant) | n/a |
| `useSession()` hook = single source of session truth | Reads/writes localStorage, validates via `whoami` on mount, exposes `{session, status, signOut}` | `auth-ui/src/session.ts` |
| `<RequireSession>` wrapper for protected routes | Standard react-router guard; redirects to `/login` on unauthenticated | `auth-ui/src/RequireSession.tsx` |
| Passkey ceremonies via `@simplewebauthn/browser` v13 | Server is already on v13 — using browser v13 keeps types aligned | `web/packages/auth-ui/package.json` |
| RTK Query for magic-link request/consume | Matches existing `api-client` pattern; `useMutation` for request, `useQuery` for consume (URL param lookup) | `web/packages/api-client/src/auth-magic-link.ts` (new) |
| Passkey hooks live in `auth-ui`, NOT `api-client` | Stateful navigator.credentials calls don't model well as pure RTK Query — kept colocated with the components that drive them | `web/packages/auth-ui/src/passkey.ts` |
| All 5 portals mount the SAME 3 routes (`/login`, `/auth/magic-link`, `/auth/passkey-enroll`) | Persona-agnostic auth surface — issuer-portal isn't special | each portal's `App.tsx` |
| Sign-out lives in topbar Avatar dropdown | Existing `Avatar` primitive has no menu — extend to optional `actions` prop with one entry initially | `web/packages/ui/src/Avatar.tsx` (small extension) |
| No emoji, lucide icons only (`LogIn`, `Mail`, `KeyRound`, `LogOut`) | Project rule | n/a |

---

## File Structure

```
web/packages/api-client/src/                              # extend existing
  auth-magic-link.ts                                       # NEW — useRequestMagicLink + useConsumeMagicLink hooks
  auth-magic-link.test.ts                                  # NEW
  index.ts                                                 # MODIFY — re-export the two new hooks + types

web/packages/ui/src/                                       # small extension
  Avatar.tsx                                               # MODIFY — add optional `actions?: AvatarAction[]` prop
  Avatar.test.tsx                                          # MODIFY — 2 new test cases for the actions menu

web/packages/auth-ui/                                      # NEW WORKSPACE PACKAGE
  package.json
  tsconfig.json
  vitest.config.ts                                         # mirrors @hydrax/ui's shape
  src/
    test-setup.ts                                          # 7-line afterEach(cleanup) — same shape as @hydrax/ui
    session.ts                                             # useSession() + localStorageTokenStorage import
    session.test.ts
    RequireSession.tsx                                     # protected-route wrapper
    RequireSession.test.tsx
    LoginRoute.tsx                                         # form: tenant_slug + email + submit
    LoginRoute.test.tsx
    MagicLinkConsumeRoute.tsx                              # reads ?token=, calls BFF, stores session, redirects
    MagicLinkConsumeRoute.test.tsx
    PasskeyEnrollPrompt.tsx                                # uses navigator.credentials.create
    PasskeyEnrollPrompt.test.tsx
    PasskeySignInButton.tsx                                # uses navigator.credentials.get
    PasskeySignInButton.test.tsx
    SignOutButton.tsx                                      # tiny wrapper around useSession().signOut
    SignOutButton.test.tsx
    index.ts                                               # public exports

web/apps/issuer-portal/src/App.tsx                         # MODIFY — mount /login, /auth/magic-link, /auth/passkey-enroll, wrap protected routes in RequireSession
web/apps/issuer-portal/src/App.test.tsx                    # MODIFY — add login route test, add RequireSession redirect test
web/apps/issuer-portal/src/components/IssuerTopBar.tsx     # MODIFY — Avatar gets sign-out action
web/apps/distributor-portal/src/App.tsx                    # MODIFY — same shape
web/apps/distributor-portal/src/App.test.tsx               # MODIFY
web/apps/distributor-portal/src/components/DistributorTopBar.tsx  # MODIFY
web/apps/investor-portal/src/App.tsx                       # MODIFY
web/apps/investor-portal/src/App.test.tsx                  # MODIFY
web/apps/investor-portal/src/components/InvestorTopBar.tsx # MODIFY
web/apps/ops-console/src/App.tsx                           # MODIFY
web/apps/ops-console/src/App.test.tsx                      # MODIFY
web/apps/ops-console/src/components/OpsTopBar.tsx          # MODIFY
web/apps/admin/src/App.tsx                                 # MODIFY
web/apps/admin/src/App.test.tsx                            # MODIFY
web/apps/admin/src/components/AdminTopBar.tsx              # MODIFY

pnpm-workspace.yaml                                        # MODIFY — add web/packages/auth-ui
docs/env.md                                                # MODIFY — note auth-ui consumes existing BFF endpoints (no new env vars)
STATE.yaml                                                 # MODIFY — verification_log entry
```

Hard cap reminder: 15 files per commit unless purely generated. Per-portal commits stay under that easily; the `auth-ui` foundation commit ships 11 files (1 package config + 10 source) which is fine.

**Bundled commits:**
- Task 1 (workspace scaffold) → 1 commit (4 files: package.json, tsconfig.json, vitest.config.ts, src/test-setup.ts + pnpm-workspace.yaml = 5)
- Task 2 (api-client magic-link hooks) → 1 commit
- Task 3 (auth-ui session + RequireSession) → 1 commit
- Task 4 (LoginRoute) → 1 commit
- Task 5 (MagicLinkConsumeRoute) → 1 commit
- Task 6 (PasskeyEnrollPrompt + PasskeySignInButton) → 1 commit
- Task 7 (Avatar.actions extension + SignOutButton) → 1 commit
- Task 8a-8e (per-portal mount, ONE commit per portal — 5 commits total)
- Task 9 (docs + state) → 1 commit

**Total target: 13 commits across 9 tasks.** Bigger than 2b's 7 commits but unavoidable — 5 portals × 1 commit each is non-negotiable per the per-portal-commit rule from the CLAUDE.md past-mistake (five Phases 5-8 of web scaffold shipped 8 commits when plan called for 4 because per-app substitution descriptions weren't called out — this plan calls them out explicitly per task).

---

## Required Reading Before Implementing

Read these BEFORE Task 1 — they define the interfaces and patterns this slice extends:

1. `web/packages/api-client/src/auth.ts` — slice 1's `createAuthClient`, `TokenStorage`, `localStorageTokenStorage`. The new magic-link hooks should reuse `localStorageTokenStorage` and the same `LoginResult` shape.
2. `web/packages/api-client/src/api.ts` — RTK Query setup pattern (`hydraxApi`, `createApi`, `fetchBaseQuery`). New endpoints for magic-link request + consume mount on this same `hydraxApi`.
3. `web/packages/api-client/src/api.test.ts` — fetch-mocking pattern via `vi.fn(async () => new Response(...))`.
4. `web/packages/ui/src/AppShell.tsx` — slot props (`brand`, `topbar`, `sidebar`, `sidebarFooter`, `children`). RequireSession does NOT render an AppShell — it redirects or renders children.
5. `web/packages/ui/src/Avatar.tsx` — current shape (small/medium/large variants). The `actions` prop adds an opt-in dropdown menu — keep current rendering when `actions` is omitted.
6. `web/apps/issuer-portal/src/App.tsx` — provider stack reference (`Provider` → `ThemeProvider` → `ToastProvider` → `BrowserRouter` → `ShellContents`). Slice 2d's protected routes wrap inside `<RequireSession>`; the unprotected `/login`, `/auth/magic-link`, `/auth/passkey-enroll` mount OUTSIDE the AppShell as standalone Routes.
7. `services/integration-svc/src/auth/passkey-handlers.ts` — register options + verify endpoint shapes. The `auth-ui/src/PasskeyEnrollPrompt.tsx` invokes `/v1/auth/passkeys/register/options` then posts the credential to `/verify`.
8. `services/integration-svc/src/auth/magic-link-handlers.ts` — request + consume endpoint shapes. Request returns 202 unconditionally; consume returns `{token, session}` on success or 401 on bad/expired/used token.
9. `web/apps/issuer-portal/src/components/IssuerTopBar.tsx` — current Avatar usage in topbar. Slice 2d adds `actions={[{ label: "Sign out", icon: LogOut, onClick: signOut }]}`.

---

## Task 1: Scaffold `@hydrax/auth-ui` workspace package

**Files:**
- Create: `web/packages/auth-ui/package.json`
- Create: `web/packages/auth-ui/tsconfig.json`
- Create: `web/packages/auth-ui/vitest.config.ts`
- Create: `web/packages/auth-ui/src/test-setup.ts`
- Modify: `pnpm-workspace.yaml` (add `web/packages/auth-ui`)

- [ ] **Step 1: Add workspace entry**

`pnpm-workspace.yaml` already lists `web/packages/*` (per CLAUDE.md "Web Monorepo Invariants"). Verify with `grep -A 5 packages pnpm-workspace.yaml`. If the wildcard catches `auth-ui` automatically, no edit needed. If listed explicitly per-package, add `- "web/packages/auth-ui"`.

- [ ] **Step 2: Write `package.json`**

Same shape as `@hydrax/ui/package.json` (read it first), with the addition of `@simplewebauthn/browser@13.3.0` in dependencies and `@hydrax/api-client` + `@hydrax/ui` + `react-router-dom@^6.23.1` in dependencies (workspace:* for the two internal):

```json
{
  "name": "@hydrax/auth-ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest"
  },
  "peerDependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1"
  },
  "dependencies": {
    "@hydrax/api-client": "workspace:*",
    "@hydrax/ui": "workspace:*",
    "@simplewebauthn/browser": "13.3.0",
    "lucide-react": "0.378.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.4.5",
    "@testing-library/react": "15.0.7",
    "@testing-library/user-event": "14.5.2",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "jsdom": "24.0.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-router-dom": "6.23.1",
    "typescript": "5.4.5",
    "vitest": "1.6.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

Extends `tsconfig.web.json` from repo root (same as `@hydrax/ui`):

```json
{
  "extends": "../../../tsconfig.web.json",
  "include": ["src"],
  "exclude": ["dist", "node_modules"],
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true
  }
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["src/test-setup.ts"],
  },
});
```

- [ ] **Step 5: Write `src/test-setup.ts`** (7-line shape)

```typescript
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 6: Run install + typecheck**

```bash
pnpm install
pnpm --filter @hydrax/auth-ui typecheck   # expects "no source files" or empty pass — that's fine, src/ has only test-setup
```

- [ ] **Step 7: Stage + commit**

```bash
git add web/packages/auth-ui/package.json \
        web/packages/auth-ui/tsconfig.json \
        web/packages/auth-ui/vitest.config.ts \
        web/packages/auth-ui/src/test-setup.ts \
        pnpm-workspace.yaml
git diff --cached --name-only   # confirm 5 files
git commit -m "feat(auth-ui): scaffold @hydrax/auth-ui workspace package"
```

---

## Task 2: api-client magic-link hooks (TDD)

**Files:**
- Create: `web/packages/api-client/src/auth-magic-link.ts`
- Create: `web/packages/api-client/src/auth-magic-link.test.ts`
- Modify: `web/packages/api-client/src/api.ts` — add 2 endpoints
- Modify: `web/packages/api-client/src/index.ts` — re-export hooks + types

- [ ] **Step 1: Write failing test for the new endpoints**

Test cases (10 total):
1. `useRequestMagicLink` POSTs body to `/v1/auth/magic-link/request` and returns `{accepted: true}` on 202
2. `useRequestMagicLink` returns error on 429 with shape `{error: "rate_limited"}`
3. `useRequestMagicLink` does NOT throw on unknown user (202 always)
4. `useConsumeMagicLink` GETs `/v1/auth/magic-link/consume?token=…` and returns `{token, session}`
5. `useConsumeMagicLink` returns error on 401
6. `useConsumeMagicLink` URL-encodes the token query param
7. `MagicLinkRequestInput` type has `tenant_slug` + `email` (snake_case to match BFF)
8. `MagicLinkSessionResult` type has `token: string` + nested `session` with `id, user_id, tenant_id, tenant_slug, email, role, expires_at`
9. Demo mode (`isDemoMode === true`) short-circuits request to a synthetic 202
10. Demo mode short-circuits consume to a synthetic session result

Use the same fetch-mock pattern as `api.test.ts`.

- [ ] **Step 2: Implement endpoints in `api.ts`**

Add to the existing `hydraxApi.injectEndpoints`:

```typescript
requestMagicLink: build.mutation<{ accepted: true }, MagicLinkRequestInput>({
  query: (body) => ({
    url: "/v1/auth/magic-link/request",
    method: "POST",
    body,
  }),
}),
consumeMagicLink: build.query<MagicLinkSessionResult, { token: string }>({
  query: ({ token }) => ({
    url: `/v1/auth/magic-link/consume?token=${encodeURIComponent(token)}`,
    method: "GET",
  }),
}),
```

The demo-mode synthetic responses live in `demo-fixtures.ts` extension — synthesize a `MagicLinkSessionResult` that matches `DEMO_*` user fixtures.

- [ ] **Step 3: Re-export from `index.ts`**

Add `useRequestMagicLinkMutation`, `useLazyConsumeMagicLinkQuery` to the hook re-exports and `MagicLinkRequestInput`, `MagicLinkSessionResult` to the type re-exports.

- [ ] **Step 4: Typecheck + run tests**

```bash
pnpm --filter @hydrax/api-client typecheck
pnpm --filter @hydrax/api-client test -- --run
```

Expected: typecheck clean. Test count = prior 12 + 10 new = 22.

- [ ] **Step 5: Stage + commit**

```bash
git add web/packages/api-client/src/auth-magic-link.ts \
        web/packages/api-client/src/auth-magic-link.test.ts \
        web/packages/api-client/src/api.ts \
        web/packages/api-client/src/api.test.ts \
        web/packages/api-client/src/index.ts \
        web/packages/api-client/src/demo-fixtures.ts
git commit -m "feat(api-client): magic-link request + consume hooks"
```

---

## Task 3: `useSession()` + `<RequireSession>` (TDD)

**Files:**
- Create: `web/packages/auth-ui/src/session.ts`
- Create: `web/packages/auth-ui/src/session.test.ts`
- Create: `web/packages/auth-ui/src/RequireSession.tsx`
- Create: `web/packages/auth-ui/src/RequireSession.test.tsx`
- Create: `web/packages/auth-ui/src/index.ts` (initial public surface)

`useSession()` shape:

```typescript
export interface SessionState {
  status: "loading" | "authenticated" | "unauthenticated";
  session: WhoamiResult | null;
  signOut: () => Promise<void>;
}
export function useSession(): SessionState;
```

Behavior:
- On mount with no token in localStorage → status=`unauthenticated`, session=null
- On mount with token → status=`loading` → fires `whoami` → on 200 → `authenticated` + session payload; on 401 → clear token, `unauthenticated`
- `signOut()` → POST `/v1/auth/logout` (best-effort), clear localStorage, transition to `unauthenticated`

Test cases (8 total):
1. No token → unauthenticated synchronously
2. Token + 200 whoami → authenticated with session payload
3. Token + 401 whoami → unauthenticated, token cleared
4. Token + network error → status stays `loading` until error surfaces, then unauthenticated
5. `signOut()` POSTs logout, clears storage, transitions to unauthenticated
6. `signOut()` succeeds even if logout endpoint returns 500 (token still cleared client-side)
7. Re-renders are stable — running `whoami` once per token change, not on every render
8. Token written by another tab while session is active → not picked up automatically (acceptable — slice deferred)

`RequireSession` test cases (4):
1. Unauthenticated → renders `<Navigate to="/login" replace state={{ from: pathname }} />`
2. Loading → renders provided `fallback` prop or null
3. Authenticated → renders children
4. Custom `loginPath` prop overrides `/login`

`RequireSession.tsx`:

```typescript
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "./session.js";

export interface RequireSessionProps {
  children: ReactNode;
  loginPath?: string;
  fallback?: ReactNode;
}

export function RequireSession({ children, loginPath = "/login", fallback = null }: RequireSessionProps) {
  const { status } = useSession();
  const location = useLocation();
  if (status === "loading") return <>{fallback}</>;
  if (status === "unauthenticated") {
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 5: Typecheck + run tests**

```bash
pnpm --filter @hydrax/auth-ui typecheck
pnpm --filter @hydrax/auth-ui test -- --run
```

Expected: 12 tests pass.

- [ ] **Step 6: Stage + commit**

```bash
git add web/packages/auth-ui/src/session.ts \
        web/packages/auth-ui/src/session.test.ts \
        web/packages/auth-ui/src/RequireSession.tsx \
        web/packages/auth-ui/src/RequireSession.test.tsx \
        web/packages/auth-ui/src/index.ts
git commit -m "feat(auth-ui): useSession() hook + <RequireSession> wrapper"
```

---

## Task 4: `LoginRoute` component (TDD + frontend-design)

**Required skills before implementing:** `/frontend-design` + `/taste-skill`. Default LLM auth-form patterns are generic — override with the dark-institutional aesthetic the existing portals already ship.

**Files:**
- Create: `web/packages/auth-ui/src/LoginRoute.tsx`
- Create: `web/packages/auth-ui/src/LoginRoute.test.tsx`

Shape:
- Single `<Card>` centered vertically + horizontally (no AppShell wrapping)
- Title: "Sign in"
- Subtitle: "Enter your tenant and email to receive a sign-in link"
- Two `<Stack direction="vertical">` rows: tenant_slug input, email input
- Submit button: "Send magic link" with `<LogIn>` icon
- Below button: "or" divider + `<PasskeySignInButton>` (composed from Task 6 — link import lazily so test order doesn't matter)
- Success state: replace form with `<EmptyState icon={Mail} title="Check your inbox" description="We sent a sign-in link to <email>"/>` + secondary "Resend" button
- Error state: inline error below submit button — "Could not request link, try again" (no error-leak per slice 2b's email-enumeration safety)
- 429 state: "You've requested too many links recently. Try again in a few minutes."

Test cases (8):
1. Renders form with both inputs + submit button
2. Submit calls `useRequestMagicLinkMutation` with snake_case body
3. Empty fields → submit button disabled
4. Invalid email format → submit button disabled
5. Successful 202 → renders EmptyState with email value
6. 429 → renders rate-limit message
7. Network error → renders generic error
8. "Resend" button re-fires the mutation

Visual rules:
- Form input height: 44px (existing Button height for tap-target alignment)
- Card max-width: 480px
- Card centering: `display: grid; place-items: center; min-height: 100vh` on the route's outer div (NOT in AppShell)
- Spacing: `Stack gap="md"` between rows; `Stack gap="lg"` between sections
- Use existing `<Heading>`, `<Text>`, `<Button>`, `<Card>`, `<Stack>`, `<EmptyState>`, `<Icon>` primitives
- New `<Input>` primitive: this slice does NOT add one. Use bare `<input>` styled inline with the existing token CSS vars. If a follow-up wants a real `<Input>` primitive, that's a separate plan in `@hydrax/ui`.

- [ ] **Step 5: Stage + commit**

```bash
git commit -m "feat(auth-ui): LoginRoute with magic-link request form"
```

---

## Task 5: `MagicLinkConsumeRoute` component (TDD + frontend-design)

**Required skills:** `/frontend-design` + `/taste-skill`.

**Files:**
- Create: `web/packages/auth-ui/src/MagicLinkConsumeRoute.tsx`
- Create: `web/packages/auth-ui/src/MagicLinkConsumeRoute.test.tsx`

Shape:
- Route reads `?token=…` from `useSearchParams()`
- On mount: fires `useLazyConsumeMagicLinkQuery` with the token
- Loading: `<Stack><Skeleton width="40%" /><Skeleton /></Stack>` inside a Card
- Success: store `result.token` in `localStorage["hydrax.session.token"]`, then `<Navigate to="/" replace />` (or to `state.from` if present)
- 401 / expired / used: `<EmptyState icon={AlertTriangle} title="Link expired" description="That link is no longer valid. Request a new one." action={<Link to="/login">Back to sign in</Link>}/>`
- No token in URL: same expired-state EmptyState

Test cases (5):
1. With valid token → calls consume hook with that token
2. With valid token + 200 response → writes token to localStorage + renders `<Navigate>`
3. With invalid token → 401 → renders expired-state
4. Without `?token=…` → renders expired-state immediately, no API call
5. Token URL-encoded properly when special chars present (e.g., `+`)

- [ ] **Step 5: Stage + commit**

```bash
git commit -m "feat(auth-ui): MagicLinkConsumeRoute mints session and redirects"
```

---

## Task 6: `PasskeyEnrollPrompt` + `PasskeySignInButton` (TDD + frontend-design)

**Required skills:** `/frontend-design` + `/taste-skill`. Also the **WebAuthn ceremony patterns from slice 2a's plan** — re-read `docs/plans/2026-04-25-auth-slice-2a-passkeys-server.md` Decision Log re: register-options vs auth-options.

**Files:**
- Create: `web/packages/auth-ui/src/PasskeyEnrollPrompt.tsx`
- Create: `web/packages/auth-ui/src/PasskeyEnrollPrompt.test.tsx`
- Create: `web/packages/auth-ui/src/PasskeySignInButton.tsx`
- Create: `web/packages/auth-ui/src/PasskeySignInButton.test.tsx`
- Create: `web/packages/auth-ui/src/passkey.ts` — pure helper: `requestRegisterCeremony(authClient)`, `requestAuthCeremony(authClient, {tenantSlug, email})` — wrapping `@simplewebauthn/browser` `startRegistration` + `startAuthentication`
- Create: `web/packages/auth-ui/src/passkey.test.ts` — mock `@simplewebauthn/browser`

`PasskeyEnrollPrompt` rendered AFTER successful magic-link consume on the home route, OR as a standalone route at `/auth/passkey-enroll`. Shape:
- `<Card>` with `<KeyRound>` icon, title "Set up a passkey", description "Sign in faster next time without an email"
- Primary `<Button>` "Enable passkey" → calls `requestRegisterCeremony` → on success, dismiss the prompt
- Secondary `<Button variant="ghost">` "Maybe later" → dismiss without enrolling

`PasskeySignInButton` rendered inside `LoginRoute` and as a standalone option:
- `<Button>` "Sign in with passkey" — disabled until tenant_slug + email entered (passkey ceremony needs a userHandle hint)
- On click → `requestAuthCeremony({tenantSlug, email})` → on success → store token → redirect

Test cases (12 total = 6 enroll + 6 sign-in):
- Enroll: opens-options → ceremony → verify → 200 dismisses
- Enroll: ceremony cancelled → re-enable button
- Enroll: server returns 401 (session expired) → show error message
- Sign-in: opens-options → ceremony → verify → 200 stores token + redirects
- Sign-in: 404 on options (user has no passkey) → error message "No passkey registered — use email link"
- Sign-in: ceremony cancelled → re-enable button
- All 4 components have separate "renders correctly with default props" tests (4 more = 16 total)

Mock `@simplewebauthn/browser` via `vi.mock("@simplewebauthn/browser", ...)` returning canned ceremony JSON.

- [ ] **Step 7: Stage + commit**

```bash
git commit -m "feat(auth-ui): passkey enroll + sign-in components"
```

---

## Task 7: Avatar dropdown + SignOutButton

**Files:**
- Modify: `web/packages/ui/src/Avatar.tsx` — add optional `actions?: AvatarAction[]` prop with single-level dropdown
- Modify: `web/packages/ui/src/Avatar.test.tsx` — 2 new test cases
- Create: `web/packages/auth-ui/src/SignOutButton.tsx`
- Create: `web/packages/auth-ui/src/SignOutButton.test.tsx`

`AvatarAction` type:

```typescript
export interface AvatarAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
}
```

When `actions?.length > 0`, Avatar wraps in a button + chevron + click-outside-closing menu. Use `@hydrax/ui`'s existing icon primitives — no new dep.

`SignOutButton.tsx` is a 12-line wrapper: takes nothing, calls `useSession().signOut()`. Used by topbars that want a standalone button instead of an Avatar dropdown action.

Test cases:
- Avatar `actions` omitted → renders identical to before (no menu)
- Avatar `actions` + click → menu opens, items shown
- Avatar menu click → onClick fires + menu closes
- Avatar click outside menu → menu closes
- SignOutButton click → calls signOut + lucide LogOut icon present

- [ ] **Step 6: Stage + commit**

```bash
git commit -m "feat(ui): Avatar.actions dropdown menu + auth-ui SignOutButton"
```

---

## Task 8: Mount auth routes + RequireSession in each portal (5 commits)

**One commit per portal.** This is non-negotiable per the past-mistake about per-app commits getting bundled. Each commit touches exactly 3 files: `App.tsx`, `App.test.tsx`, `components/<Brand>TopBar.tsx`.

For each portal in order **issuer → distributor → investor → ops-console → admin**:

- [ ] **Step 1: Modify `App.tsx`**

Insert the new routes BEFORE the AppShell-wrapped `<ShellContents />`:

```typescript
import { LoginRoute, MagicLinkConsumeRoute, PasskeyEnrollPrompt, RequireSession } from "@hydrax/auth-ui";

function ShellContents() {
  // ...existing
}

export function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <ToastProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/auth/magic-link" element={<MagicLinkConsumeRoute />} />
              <Route path="/auth/passkey-enroll" element={
                <RequireSession><PasskeyEnrollPrompt /></RequireSession>
              } />
              <Route path="/*" element={
                <RequireSession><ShellContents /></RequireSession>
              } />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </Provider>
  );
}
```

The inner `ShellContents` keeps its own `<Routes>`. The outer `<Route path="/*">` catches everything not auth-related and gates it on RequireSession.

- [ ] **Step 2: Modify `<Brand>TopBar.tsx`**

Pass `actions={[{ label: "Sign out", icon: LogOut, onClick: signOut }]}` to the existing Avatar. Source `signOut` from `useSession()` imported from `@hydrax/auth-ui`.

- [ ] **Step 3: Modify `App.test.tsx`**

Add 3 new test cases on top of the existing N:
- `renders <LoginRoute> at /login`
- `redirects to /login when unauthenticated and visiting /products` (or whatever protected route exists)
- `renders Sign out option in topbar when authenticated`

Mock `useSession()` via the package's exported `__setMockSession` test helper (or via a `vi.mock("@hydrax/auth-ui", ...)`)

- [ ] **Step 4: Run typecheck + tests + build**

```bash
pnpm --filter @hydrax/<portal> typecheck
pnpm --filter @hydrax/<portal> test -- --run
pnpm --filter @hydrax/<portal> build
```

All green. Test count grows by 3 per portal.

- [ ] **Step 5: Stage + commit (path-scoped, ATOMIC stage+verify+commit)**

```bash
git add web/apps/<portal>/src/App.tsx \
        web/apps/<portal>/src/App.test.tsx \
        web/apps/<portal>/src/components/<Brand>TopBar.tsx
STAGED=$(git diff --cached --name-only | wc -l)
[ "$STAGED" = "3" ] || { echo "ABORT: expected 3 files staged, got $STAGED"; exit 1; }
git commit -m "feat(<portal>): mount /login + /auth/magic-link + RequireSession gate"
```

The atomic `git add && check && git commit` chain is mandatory per the past-mistake about parallel-session index races. Do NOT split this across multiple Bash invocations.

**Per-portal commit names:**
- 8a: `feat(issuer-portal): mount /login + /auth/magic-link + RequireSession gate`
- 8b: `feat(distributor-portal): mount /login + /auth/magic-link + RequireSession gate`
- 8c: `feat(investor-portal): mount /login + /auth/magic-link + RequireSession gate`
- 8d: `feat(ops-console): mount /login + /auth/magic-link + RequireSession gate`
- 8e: `feat(admin): mount /login + /auth/magic-link + RequireSession gate`

---

## Task 9: docs/env.md + STATE.yaml + acceptance gate

**Files:**
- Modify: `docs/env.md`
- Modify: `STATE.yaml`

- [ ] **Step 1: Update `docs/env.md`**

Add a section under "Auth Slice 2c" noting that slice 2d consumes the existing BFF endpoints and adds NO new env vars. The only client-side config is `VITE_BFF_URL` (already documented).

- [ ] **Step 2: Update `STATE.yaml`**

Append a verification_log entry per the format used by prior slice closures (see slice 2b's entry as reference). Include test counts: api-client (was 12, now 22), auth-ui (new package, ~50 tests), ui (was 61, +2 = 63), and per-portal counts (each +3). Update `current_focus` to reflect 2d landed; update `next_actions` to surface 2e (remove AUTH_DEV_LOGIN) as the next pick + manual browser smoke as user-only.

- [ ] **Step 3: Run full repo gate**

```bash
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm -r --if-present typecheck
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm -r --if-present test -- --run
pnpm -r --if-present build
```

Three green or no commit.

- [ ] **Step 4: Stage + commit**

```bash
git add docs/env.md STATE.yaml
git commit -m "chore(state): record auth slice 2d (portal auth UI) closure"
```

---

## Acceptance Criteria — when slice 2d is "done"

- [ ] All 9 tasks above checked off
- [ ] 13 commits on main: 1 scaffold + 1 api-client + 1 session + 1 LoginRoute + 1 MagicLinkConsumeRoute + 1 passkey + 1 Avatar/SignOut + 5 per-portal + 1 docs/state
- [ ] `pnpm -r --if-present typecheck && pnpm -r --if-present test -- --run && pnpm -r --if-present build` green at repo root (with `INTEGRATION_SVC_DATABASE_URL` set)
- [ ] All 5 portals expose `/login`, `/auth/magic-link`, and `/auth/passkey-enroll`
- [ ] Protected routes (everything not under `/login`, `/auth/*`) redirect to `/login` when unauthenticated
- [ ] Topbar Avatar shows "Sign out" action when authenticated; signing out clears localStorage and routes back to `/login`
- [ ] No emoji, lucide icons only (`LogIn`, `Mail`, `KeyRound`, `LogOut`, `AlertTriangle`)
- [ ] AUTH_DEV_LOGIN=1 stays untouched (slice 2e removal)
- [ ] **MANUAL BROWSER SMOKE (user-only):** end-to-end flow works in a real browser — login → email → click link → consume → home → enroll passkey → sign out → sign in with passkey → home

## Manual Browser Smoke (REQUIRED — slice closure gate)

Like slice 2a's gate, slice 2d's CLI tests cover the React rendering + hook behavior but cannot exercise actual `navigator.credentials.create/get` browser ceremonies. The user must:

1. Start postgres + integration-svc + notify-svc + bff in 4 terminals (see slice 2b Task 11 for commands)
2. Run `pnpm --filter @hydrax/issuer-portal dev` (or any portal)
3. Visit `http://localhost:5173/login`
4. Submit tenant_slug + email
5. Tail `/tmp/notify-svc.log` for the magic-link URL — replace `localhost:5173/auth/magic-link` with the portal's actual host:port if different
6. Click the URL in browser — should land on consume page → redirect home
7. Visit `/auth/passkey-enroll` → enroll a passkey via the OS prompt (Touch ID / Windows Hello / etc.)
8. Sign out from the topbar → land back on `/login`
9. Click "Sign in with passkey" → enter same email → ceremony → sign in
10. Verify the home route renders authenticated content for the chosen persona

**The slice is NOT closed until manual smoke passes for at least 2 of the 5 portals.** Smoke result goes in STATE.yaml verification_log.

---

## Out-of-scope follow-ups

- Multi-tenant tenant-slug picker (autocomplete + recents from localStorage history)
- Account recovery flow (lost passkey + lost email access)
- Audit log of login/enrollment events (would feed into audit-svc)
- Per-tenant branded login screens (would consume tenant theme variables for the login Card background)
- Email template HTML (slice 2c left text-only; portal-side preview tool is its own slice)
- Cross-tab session sync via `storage` event listener (current behavior: tabs run independently)
- Session refresh / sliding-window TTL (current behavior: hard 12h TTL, then re-auth)
- `<Input>` primitive in `@hydrax/ui` (slice 2d uses bare `<input>` styled inline)

---

## Self-review notes

- ✓ **Spec coverage:** every endpoint slice 2a-2c ships has a UI consumer (request, consume, register options, register verify, auth options, auth verify, whoami, logout)
- ✓ **Type consistency:** `MagicLinkSessionResult` from BFF proxy matches the localStorage token shape; `WhoamiResult` already established by slice 1's `auth.ts`
- ✓ **Cross-portal consistency:** all 5 portals get the same 3 routes, same Avatar dropdown, same RequireSession gate
- ✓ **Per-portal commit discipline:** 5 separate commits with explicit substitution table — no rerun of the past-mistake (Phases 5-8 of web scaffold shipped 8 commits when plan called for 4)
- ✓ **Atomic stage+commit:** every commit step is a single Bash chain that catches parallel-session index races (past-mistake from 2026-04-25)
- ✓ **YAGNI honored:** no `<Input>` primitive, no tenant-slug autocomplete, no recovery flow, no SSO, no HTML emails, no cross-tab sync, no session refresh
- ✓ **Skill invocations called out:** Tasks 4, 5, 6 require `/frontend-design` + `/taste-skill`; Task 7 is a small primitive extension that does NOT need them
- ✓ **Closure gate is browser-driven:** explicit because the React-Testing-Library tests can't exercise real `navigator.credentials` ceremonies; user runs steps 1-10 above

## Estimated effort

- Total LOC: ~1500-1800 (auth-ui new package ~900, api-client extension ~150, ui extension ~120, 5 portal mounts ~75 each)
- Total tests: api-client +10, auth-ui ~50, ui +2, per-portal +3 = ~77 new tests
- Sessions: 2-3 if dispatched as parallel agents (Task 1+2 sequential, Tasks 3-7 parallel-able with care, Task 8a-e parallel-able, Task 9 sequential)
- Single-agent serial: 4-6 sessions

## Slice trigger — open after slice 2d lands

After slice 2d lands, the next pick is **slice 2e** (remove `AUTH_DEV_LOGIN=1` — see plan at `docs/plans/2026-04-27-auth-slice-2e-remove-dev-login.md`). With 2d landed, real users have a working passwordless flow and the dev-login backdoor can come down without breaking any path.
