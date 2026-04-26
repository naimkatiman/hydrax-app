# Auth Slice 2e — Remove `AUTH_DEV_LOGIN=1` Dev Bootstrap

> **For agentic workers:** Use `superpowers:test-driven-development` for the test-update steps. Each commit MUST use the atomic stage+verify+commit chain (see CLAUDE.md past-mistake on parallel-session index races).

**Goal:** Delete the `AUTH_DEV_LOGIN=1` bootstrap path entirely. Slices 2a (passkey) + 2b (magic-link substrate) + 2c (SMTP transport) ship the real production passwordless login. The dev-login backdoor was always transitional — slice 2e is the deletion.

**Why now:** Per CLAUDE.md, `AUTH_DEV_LOGIN=1` was kept fail-closed in prod through 2a/2b/2c as a parallel bootstrap. With 2c shipping real SMTP transport, every code path the dev-login covered has a real-auth replacement. Keeping it adds attack surface (env-flag misconfiguration → prod backdoor) with zero remaining benefit.

**Order matters:** This slice happens BEFORE slice 2d (portal UI). Reason: 2d's `LoginRoute` consumes the magic-link request endpoint exclusively; if 2e lands first, 2d's `auth-ui` package never has to deal with a `login()` method that points at a removed endpoint. If 2d landed first and used `client.login()`, 2e would force a 2d follow-up rewrite.

---

## Decision Log

| Decision | Why | Where to override |
|---|---|---|
| Hard delete, no warn-and-disable phase | Removing transitional code is a one-shot job; a deprecation cycle adds noise without protecting any caller (no external API consumer exists yet) | n/a |
| Keep `Sessions` class, `localStorageTokenStorage`, `WhoamiResult`, `whoami()`, `logout()`, `AuthClient.fetch()` | Slice 1 substrate still in use by 2a/2b/2c — the only thing 2e removes is the `dev/login` route + matching client method | n/a |
| Delete `LoginInput`, `LoginResult`, `AuthClient.login()` from api-client | These were dev-login specific (POST `/v1/auth/dev/login`). Magic-link uses different types (`MagicLinkRequestInput`, `MagicLinkSessionResult`) which slice 2d will introduce | `web/packages/api-client/src/auth.ts` |
| Delete `proxyDevLogin`, `DevLoginInput`, `DevLoginResult` from bff | Same reason | `services/bff/src/auth/proxy.ts` |
| Delete `handleDevLogin`, `devLoginEnabled` config field, env read | Same reason | `services/integration-svc/src/auth/handlers.ts`, `server.ts` |
| Update `docs/env.md` to remove the row + cross-reference paragraphs | Doc rot is the next biggest source of confusion | n/a |
| Keep `AUTH_DEV_LOGIN` mention in CLAUDE.md as historical context (one line in "Past Mistakes" archive) | Future agents reading old plans will encounter the flag; one-line breadcrumb prevents re-introduction | `CLAUDE.md` (no edit this slice; archive happens at quarter-rollover) |

---

## File Structure

```
services/integration-svc/src/auth/handlers.ts             # MODIFY (-65 LOC: remove handleDevLogin + dev/login route + devLoginEnabled flag)
services/integration-svc/src/auth/handlers.test.ts        # MODIFY (-90 LOC: remove 7 dev/login test cases; keep whoami/logout cases)
services/integration-svc/src/server.ts                    # MODIFY (-5 LOC: remove devLoginEnabled? from AuthRoutesOpts, env read, log line, startServer arg)

services/bff/src/auth/proxy.ts                            # MODIFY (-25 LOC: remove DevLoginInput, DevLoginResult, proxyDevLogin)
services/bff/src/auth/proxy.test.ts                       # MODIFY (-50 LOC: remove describe("proxyDevLogin") block)
services/bff/src/server.ts                                # MODIFY (-25 LOC: remove dev/login route handler + import)
services/bff/src/server.test.ts                           # MODIFY (varies: remove any dev/login passthrough tests)

web/packages/api-client/src/auth.ts                       # MODIFY (-30 LOC: remove LoginInput, LoginResult, AuthClient.login())
web/packages/api-client/src/auth.test.ts                  # MODIFY (-40 LOC: remove 2 login test cases)

docs/env.md                                               # MODIFY (-2 LOC: remove AUTH_DEV_LOGIN row + cross-references in 2a/2b sections)
STATE.yaml                                                # MODIFY (verification_log entry)
```

**Bundled commits (atomic stage+verify+commit chain mandatory):**
- Commit 1: `refactor(integration-svc): remove AUTH_DEV_LOGIN dev bootstrap` — 3 files
- Commit 2: `refactor(bff): drop dev/login proxy + route` — 3 files (proxy.ts + proxy.test.ts + server.ts; server.test.ts only if dev/login tests exist there)
- Commit 3: `refactor(api-client): drop AuthClient.login() (dev-login removal)` — 2 files
- Commit 4: `chore(state): record auth slice 2e closure (AUTH_DEV_LOGIN removed)` — 2 files (env.md + STATE.yaml)

Total: 4 commits, max 3 files each.

---

## Required Reading

1. `services/integration-svc/src/auth/handlers.ts` — current shape; identify `handleDevLogin` boundaries
2. `services/integration-svc/src/auth/handlers.test.ts` — identify which tests to delete (everything containing `dev/login`) vs keep (whoami, logout)
3. `services/bff/src/auth/proxy.ts` — `proxyDevLogin` boundaries; nothing else removed
4. `web/packages/api-client/src/auth.ts` — `AuthClient.login()` boundaries; the rest of the AuthClient stays (fetch, whoami, logout, storage)

---

## Task 1: Remove from integration-svc

**Atomic edit:** Replace the dev-login surface in three files in a single commit.

- [ ] **Step 1: Edit `services/integration-svc/src/auth/handlers.ts`**

Remove:
- `devLoginEnabled: boolean;` from `AuthRoutesOpts` interface (line 9)
- The `if (url === "/v1/auth/dev/login")` block (lines 50-60) entirely
- The entire `handleDevLogin` function (lines 84-138)

Keep: everything else (the whoami + logout handlers + the `mountAuthRoutes` function shape minus the dev/login arm).

After editing, run `pnpm --filter @hydrax/integration-svc typecheck` to confirm no orphan type errors. Expect failures from `handlers.test.ts` until Step 2.

- [ ] **Step 2: Edit `services/integration-svc/src/auth/handlers.test.ts`**

Remove the 7 dev/login test cases (lines ~75-180):
- "POST /v1/auth/dev/login returns 200 + token for known user"
- "POST /v1/auth/dev/login returns 404 when devLoginEnabled=false"
- "POST /v1/auth/dev/login returns 401 for unknown tenant"
- "POST /v1/auth/dev/login returns 400 for malformed body"
- "POST /v1/auth/dev/login returns 400 for missing fields"
- "POST /v1/auth/dev/login returns 405 for GET"
- The 2 tests at lines 137 + 167 that use dev/login as a setup step (rewrite to use direct Sessions.createSession() to mint a session, since whoami/logout don't go through dev/login)

Update the `opts = { ... devLoginEnabled: true }` initializer (line 44) to `opts = { repo, ttlSeconds: 60 }` — drop the `devLoginEnabled` field.

- [ ] **Step 3: Edit `services/integration-svc/src/server.ts`**

Remove:
- `devLoginEnabled?: boolean;` from the options interface (line 21)
- `devLoginEnabled: opts.devLoginEnabled ?? false` from the options spread (line 37)
- `const devLoginEnabled = process.env.AUTH_DEV_LOGIN === "1";` (line 95)
- The `if (!devLoginEnabled)` block + log (lines 105-106)
- `devLoginEnabled,` from the `startServer({ ... })` call (line 115)

- [ ] **Step 4: Run gates**

```bash
cd services/integration-svc
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm typecheck
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run
```

Expected: typecheck clean. Test count drops from 95 to 88 (95 - 7 dev/login tests = 88).

- [ ] **Step 5: Atomic stage + commit**

```bash
git add services/integration-svc/src/auth/handlers.ts \
        services/integration-svc/src/auth/handlers.test.ts \
        services/integration-svc/src/server.ts
STAGED=$(git diff --cached --name-only | wc -l)
[ "$STAGED" = "3" ] || { echo "ABORT: expected 3 files, got $STAGED"; exit 1; }
git commit -m "refactor(integration-svc): remove AUTH_DEV_LOGIN dev bootstrap"
```

---

## Task 2: Remove from bff

- [ ] **Step 1: Edit `services/bff/src/auth/proxy.ts`**

Remove `DevLoginInput`, `DevLoginResult` interfaces, and the `proxyDevLogin` function. Keep `AuthUpstreamConfig`, `AuthUpstreamError`, `readJsonOrThrow`, `proxyWhoami`, `proxyLogout`.

- [ ] **Step 2: Edit `services/bff/src/auth/proxy.test.ts`**

Remove the entire `describe("proxyDevLogin", ...)` block. Remove `proxyDevLogin` from the imports list. Keep `proxyWhoami` and `proxyLogout` test blocks intact.

- [ ] **Step 3: Edit `services/bff/src/server.ts`**

Remove:
- `proxyDevLogin` from the import on line 23 → keep `proxyLogout, AuthUpstreamError`
- The entire `if (req.url === "/v1/auth/dev/login" && req.method === "POST")` block (lines 52-72)

- [ ] **Step 4: Check `services/bff/src/server.test.ts`**

Search for `dev/login` in this file. If any tests exist that exercise the BFF's dev/login passthrough, delete them. Otherwise leave the file untouched (don't add it to the staging area in Step 5).

- [ ] **Step 5: Run gates**

```bash
cd services/bff
pnpm typecheck
pnpm test -- --run
```

Expected: typecheck clean. Test count drops from 83 to 78 (83 - 5 dev-login proxy tests = 78). If `server.test.ts` had passthrough tests, that count drops further.

- [ ] **Step 6: Atomic stage + commit**

```bash
git add services/bff/src/auth/proxy.ts \
        services/bff/src/auth/proxy.test.ts \
        services/bff/src/server.ts
# Conditionally add server.test.ts only if it was modified:
if ! git diff --quiet services/bff/src/server.test.ts; then
  git add services/bff/src/server.test.ts
fi
STAGED=$(git diff --cached --name-only)
echo "Staged: $STAGED"
case "$STAGED" in
  *"services/bff/src/auth/proxy.ts"*"services/bff/src/auth/proxy.test.ts"*"services/bff/src/server.ts"*) ;;
  *) echo "ABORT: missing core files"; exit 1 ;;
esac
git commit -m "refactor(bff): drop dev/login proxy + route"
```

---

## Task 3: Remove from api-client

- [ ] **Step 1: Edit `web/packages/api-client/src/auth.ts`**

Remove:
- `LoginInput` interface (lines 13-16)
- `LoginResult` interface (lines 18-27)
- `login(input: LoginInput): Promise<LoginResult>;` from `AuthClient` interface
- The `async login(input) { ... }` method body (lines 60-69)

Keep: `TokenStorage`, `AuthClientOptions`, `WhoamiResult`, `AuthClientError`, `whoami()`, `logout()`, `fetch()`, and `localStorageTokenStorage`.

- [ ] **Step 2: Edit `web/packages/api-client/src/auth.test.ts`**

Remove the 2 login test cases:
- "login POSTs body and stores token on success"
- "login throws on non-2xx and does NOT store token"

Other tests (`whoami`, `logout`, `fetch`-with-bearer, `localStorageTokenStorage` round-trip) stay.

- [ ] **Step 3: Run gates**

```bash
pnpm --filter @hydrax/api-client typecheck
pnpm --filter @hydrax/api-client test -- --run
```

Expected: typecheck clean. Test count drops by 2 (was 12, now 10). No portal app should fail typecheck because no portal calls `client.login()` today (verified by grep before this slice).

- [ ] **Step 4: Atomic stage + commit**

```bash
git add web/packages/api-client/src/auth.ts \
        web/packages/api-client/src/auth.test.ts
STAGED=$(git diff --cached --name-only | wc -l)
[ "$STAGED" = "2" ] || { echo "ABORT: expected 2 files, got $STAGED"; exit 1; }
git commit -m "refactor(api-client): drop AuthClient.login() (dev-login removal)"
```

---

## Task 4: Docs + state

- [ ] **Step 1: Edit `docs/env.md`**

Remove the `AUTH_DEV_LOGIN` table row (line 79).

Update `SESSION_TTL_SECONDS` row (line 80) — change "TTL for sessions issued via dev/login" to "TTL for all bearer sessions issued by integration-svc (magic-link consume + passkey verify)".

In the slice 2a paragraph, replace "Slice 2a's prototype path uses `AUTH_DEV_LOGIN=1` to bootstrap, which is fail-closed in production." with "Slice 2a's bootstrap is provided by slice 2b's magic-link enrollment path."

In the slice 2b paragraph, replace "before `AUTH_DEV_LOGIN=1` can come down (slice 2e)" with "(slice 2e: AUTH_DEV_LOGIN removed 2026-04-27)."

- [ ] **Step 2: Edit `STATE.yaml`**

Append verification_log entry. Update `current_focus` to reflect 2e landed; update `next_actions` to remove the 2e item and surface 2d as the next pick.

- [ ] **Step 3: Final gate**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm -r --if-present typecheck
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm -r --if-present test -- --run
python3 -c "import yaml; yaml.safe_load(open('STATE.yaml')); print('YAML OK')"
```

Three green or no commit.

- [ ] **Step 4: Atomic stage + commit**

```bash
git add docs/env.md STATE.yaml
STAGED=$(git diff --cached --name-only | wc -l)
[ "$STAGED" = "2" ] || { echo "ABORT: expected 2 files"; exit 1; }
git commit -m "chore(state): record auth slice 2e closure (AUTH_DEV_LOGIN removed)"
```

---

## Acceptance Criteria

- [ ] All 4 tasks above checked off
- [ ] 4 commits on main: integration-svc / bff / api-client / docs+state
- [ ] `grep -rn "AUTH_DEV_LOGIN\|dev/login\|devLoginEnabled\|proxyDevLogin\|handleDevLogin" services web docs --include="*.ts" --include="*.tsx" --include="*.md" | grep -v node_modules` returns ZERO matches in product code; only historical commit messages or archived plan docs may mention the flag
- [ ] `pnpm -r --if-present typecheck && pnpm -r --if-present test -- --run` green at repo root with `INTEGRATION_SVC_DATABASE_URL` set
- [ ] Test count deltas: integration-svc -7 (95 → 88), bff -5+ (83 → 78 or fewer), api-client -2 (12 → 10), all others unchanged
- [ ] No portal app's typecheck fails — verifies `AuthClient.login()` had no live portal callers
- [ ] STATE.yaml verification_log captures the 4-commit removal
- [ ] env.md no longer mentions `AUTH_DEV_LOGIN`

---

## Out-of-scope follow-ups

- Database cleanup of any sessions issued via the (now-deleted) dev/login route — not needed; sessions naturally expire in 12h
- Removal of the `Sessions` class — KEEP, slice 2a/2b/2c all use it
- Removal of `WhoamiResult`, `localStorageTokenStorage` — KEEP, slice 2d will rely on these
- Removal of `LoginRoute` style — N/A, doesn't exist yet (slice 2d adds it, with magic-link semantics)

## Self-review notes

- ✓ **Spec coverage:** every dev/login surface enumerated in the file structure section has an explicit removal step
- ✓ **No orphan types:** `LoginInput`, `LoginResult`, `DevLoginInput`, `DevLoginResult` are all dev-login specific. `WhoamiResult` (still used) survives intact
- ✓ **Atomic commits:** each commit's stage step uses the verify-then-commit chain to defeat parallel-session index races
- ✓ **Per-commit file caps:** ≤3 files each (well under the 15-file limit)
- ✓ **Acceptance gate is grep-checkable:** the zero-match grep is the proof-of-removal
- ✓ **Order-of-operations rationale:** explicit reason for landing 2e BEFORE 2d (avoids 2d→2e rewrite churn)
- ✓ **YAGNI honored:** no warn-and-disable cycle, no env-var shim, no migration tool — hard delete

## Slice trigger — open after slice 2e lands

After slice 2e lands, slice 2d (portal auth UI) is next. Plan at `docs/plans/2026-04-27-auth-slice-2d-execution.md`. The first slice 2d task (`@hydrax/auth-ui` workspace scaffold) has no dependency on dev-login; subsequent tasks consume only magic-link + passkey + whoami + logout endpoints, all of which survive 2e untouched.
