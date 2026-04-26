# Plan — BFF deploy to Railway (and the upstream services it needs)

**Date:** 2026-04-27
**Author:** session-driven (post-deploy follow-up)
**Status:** awaiting user decision on Q1 (deploy depth) before any service is created
**Scope:** [services/bff/](../../services/bff/) + the Go upstream services it proxies; CORS allowlist for the production portal origin; `VITE_BFF_URL` wiring through a non-demo portal rebuild
**Driven by:** the 2026-04-26 portals deploy (commits `134b21f`, `76deb80`) shipped the 5 SPAs but no BFF — currently the portals run via [api-client demo mode](../../web/packages/api-client/src/api.ts#L138-L162) (`VITE_DEMO_MODE=true`) returning canned fixtures. To run on real data, BFF + at least the workflow-svc + approval-svc + audit-svc + hydrax-adapter need a Railway home, plus Postgres, plus CORS, plus a non-demo portal rebuild.

## Goal

A user navigating to `https://hydrax-portals-production.up.railway.app/investor/products` sees real data fetched from a deployed BFF over HTTPS, not fixture data, with the same response shape the portals consume today. Demo mode remains an opt-in fallback for marketing demos and design reviews, not the default.

## Out of scope

- Rewriting BFF or the Go services. v1 ships them as-is with the same Dockerfiles already in [services/](../../services/).
- Multi-tenant routing, SSO, real auth — the portals currently use a stub session pattern; this plan does not change that.
- Daml / Canton governance contracts. canton-adapter remains a mock in v1 per the [2026-04-25 Decision](../../CLAUDE.md) (Q1 deferred-not-resolved).
- notify-svc and integration-svc deploy. v1 BFF deploy can run with these env vars unset; the corresponding routes will surface 502s and the portals' empty/error states will catch them. They land in a follow-up.
- Market-data-svc deploy. It already has a healthy upstream ([market-data-hub](https://affectionate-consideration-production-f0be.up.railway.app)) and isn't required for the portals' main flows.
- Plan-doc-mandated re-deploy of the demo-mode portals after BFF lands. That's part of Phase 5 here, not a separate slice.

## Open questions (block execution until answered)

### Q1 — Deploy depth

BFF is a thin proxy. It returns useful data only when its upstreams (workflow-svc, approval-svc, audit-svc, hydrax-adapter) respond. Three viable depths:

| Option | Description | Trade-off |
|---|---|---|
| **A — BFF only** | Deploy only `services/bff` to Railway. Leave upstream env vars unset → BFF returns 502 on all `/v1/*` routes. Portals' error states catch it. Net effect: portals show "Could not load …" everywhere on real-mode, but Health route at least pings BFF and gets a structured 502. | Cheapest. Doesn't actually demonstrate real data. Not better than demo mode for the user-visible UX. |
| **B — BFF + workflow-svc + Postgres** *(recommended for v1)* | Deploy BFF, workflow-svc, and a Railway Postgres addon. Run workflow-svc migrations. Approvals/audit/hydrax routes still 502 (acceptable per the portals' error states), but `/v1/products` returns real data. | Demonstrates the live-data product list + detail. Portals' write path (POST /v1/products + transition) round-trips through real Postgres. ~2 days. |
| **C — Full backend stack** | All 5 Go services (workflow + approval + audit + hydrax-adapter + canton-adapter) + bff + Postgres. canton-adapter stays as the v1 mock. | Full real-data round trip. ~4-5 days; multi-service deploy machinery; per-service Railway services. Highest cost, highest fidelity. |

**Default if user does not answer:** Option B. Smallest slice that demonstrates a real data path through Postgres without committing to the full backend matrix. workflow-svc → approval-svc → audit-svc are tightly coupled (workflow-svc emits to audit-svc on transitions); shipping just workflow-svc means audit emission no-ops and approvals route 502s — both intentional, both visible in the UI as "no audit yet" and "Could not load approvals". User sees the *primary* product-list flow on real data; the secondary flows are documented as "real-soon".

Override with `Q1: A` (BFF only), `Q1: C` (full stack), or a custom subset.

### Q2 — Postgres provenance

| Option | Description | Trade-off |
|---|---|---|
| **A — Railway Postgres addon** *(recommended)* | Add Railway-managed Postgres to the `hydrax-prototype` project. workflow-svc reads `DATABASE_URL` Railway injects automatically. | Standard Railway pattern; backups + monitoring built-in; ~$5/mo on the same project. |
| B — Reuse market-data-hub Postgres | If market-data-hub already has a Postgres addon in its Railway project, reuse via cross-project networking. | Coupling; migration ownership ambiguity. Skip. |
| C — External Postgres (Supabase, Neon, etc.) | Manage outside Railway. | Adds another vendor; not justified for v1. |

**Default:** A.

### Q3 — Multi-service deploy strategy

If Q1=B or Q1=C, BFF and the Go services each need their own Railway service.

| Option | Description | Trade-off |
|---|---|---|
| **A — Per-service Railway services** *(recommended)* | One Railway service per binary: `hydrax-bff`, `hydrax-workflow-svc`, `hydrax-approval-svc`, `hydrax-audit-svc`, `hydrax-adapter`. Each has its own Dockerfile (already exists per [services/*/Dockerfile](../../services/)). | Isolation, independent rollouts, matches the polyglot-microservices PRD principle. |
| B — Compose-style single container | Build one container running all services via supervisor/process manager. | Anti-pattern; couples release cycles; harder to scale. |

**Default:** A. Service creation is dashboard-only per the [TradeClaw deploy note](../../CLAUDE.md) — user creates services in dashboard, this plan-doc enumerates env vars per service.

### Q4 — CORS

BFF currently has no CORS middleware ([services/bff/src/](../../services/bff/src/) — grepped 2026-04-27, only test-file references to "origin" exist). Production deploy must allow the portal origin.

| Option | Description | Trade-off |
|---|---|---|
| **A — Strict allowlist** *(recommended)* | `Access-Control-Allow-Origin: https://hydrax-portals-production.up.railway.app` (single origin, env-driven). Methods: GET/POST/PATCH. Credentials: false (no cookies in v1 stub auth). | Smallest blast radius; aligns with PRD §13 least-privilege default. |
| B — Wildcard `*` | Easy for development; never ship. | Reject. |

**Default:** A. Plan adds a small CORS module to bff with `BFF_CORS_ALLOWED_ORIGIN` env var consumed at startup.

## Assumptions

1. The 5 SPAs at `hydrax-portals-production.up.railway.app` keep the same routing (`/issuer/`, `/distributor/`, `/investor/`, `/ops/`, `/admin/`). BFF is reached at the new origin via `VITE_BFF_URL` — same-origin is not required.
2. workflow-svc Dockerfile + tests pass per `2026-04-25-backend-services-scaffold.md`. `go vet` + `go test` green per-service before deploy.
3. workflow-svc migrations are reversible and dry-runnable on an empty fixture per [Verification Gates](../../CLAUDE.md). The 3-second `PingContext` startup probe (per CLAUDE.md "If unset, the binary still serves /healthz but logs DATABASE_URL unset") will fail-fast on a bad DSN.
4. Demo mode stays as an opt-in. The post-BFF rebuild does NOT remove the demo flag — the [api-client](../../web/packages/api-client/src/api.ts) keeps both code paths so a `VITE_DEMO_MODE=true` rebuild can ship at any time for design reviews.

## Phases (one commit per phase, no drive-by changes)

### Phase 0 — Prerequisites *(blocked on user)*

**Files:** none (manual, dashboard-side)
**What:**
- User creates Railway services in `hydrax-prototype` per Q1+Q3 default: `hydrax-bff`, `hydrax-workflow-svc` (and 2 more if Q1=C), plus a `Postgres` addon.
- Confirm `DATABASE_URL` is auto-injected to `hydrax-workflow-svc`.
- This plan-doc enumerates the env vars; user pastes them in the dashboard or via `railway variables set` per service.
**Verification:** `railway list` shows the new services; `railway variables --service hydrax-workflow-svc --json` includes `DATABASE_URL`.

### Phase 1 — Add CORS to BFF

**Files:** [services/bff/src/server.ts](../../services/bff/src/server.ts) (or wherever the framework root lives), [services/bff/src/cors.ts](../../services/bff/src/cors.ts) (new), tests
**LOC:** ~40
**What:** Small CORS module reading `BFF_CORS_ALLOWED_ORIGIN` env var. Handles preflight `OPTIONS` requests. Allowed methods: `GET, POST, PATCH, OPTIONS`. No credentials.
**Verification:** new test asserts preflight returns the configured origin; existing 38 BFF tests stay green.
**Commit:** `feat(bff): allowlist-based CORS module driven by BFF_CORS_ALLOWED_ORIGIN env`

### Phase 2 — Deploy workflow-svc to Railway *(if Q1=B or C)*

**Files:** none (deploy-only); env vars enumerated in [docs/env.md](../../docs/env.md) edit (see Phase 4)
**What:**
- `railway link --service hydrax-workflow-svc`
- `railway up --path-as-root . --detach` from `services/workflow-svc/`
- Wait for build, healthcheck `/healthz`
- Run migrations: `psql "$DATABASE_URL" < db/postgres/migrations/*.sql` (or workflow-svc's migration runner if one exists; check before commit)
**Verification:** `curl https://hydrax-workflow-svc-production.up.railway.app/healthz` returns `{"service":"workflow-svc","status":"ok"}`; `psql -c "SELECT count(*) FROM products"` returns 0 (empty fresh schema, not error).
**Commit:** `chore(deploy): wire workflow-svc env vars and migrations note`

### Phase 3 — Deploy BFF to Railway

**Files:** none (deploy-only)
**What:**
- `railway link --service hydrax-bff`
- Set env: `WORKFLOW_SVC_URL=https://hydrax-workflow-svc-production.up.railway.app` + (`APPROVAL_SVC_URL`, `AUDIT_SVC_URL`, `HYDRAX_ADAPTER_URL` if Q1=C; left unset if Q1=B), plus `BFF_CORS_ALLOWED_ORIGIN=https://hydrax-portals-production.up.railway.app`, `PORT=7103`.
- `railway up --path-as-root . --detach` from `services/bff/`
**Verification:** `curl https://hydrax-bff-production.up.railway.app/healthz/composite | jq` returns the `bff` envelope with each upstream's status. workflow-svc tile shows `ok`; the unconfigured upstreams show `unreachable` (expected per Q1=B); the structured composite envelope is correct.
**Commit:** `chore(deploy): bff service env wiring`

### Phase 4 — Document env vars

**Files:** [docs/env.md](../../docs/env.md) — add the new BFF + workflow-svc Railway URLs to the existing tables.
**LOC:** ~15
**What:** Append the 3-4 production URLs to the existing `bff upstream URLs` table. Add a new section "Production Railway env (added 2026-04-27)" with the per-service env-var checklist.
**Verification:** docs/env.md still lists every env var that exists. Grep against the codebase.
**Commit:** `docs(env): record production Railway URLs for BFF + workflow-svc`

### Phase 5 — Rebuild + redeploy portals with real BFF URL

**Files:** [web/portal-deploy/](../../web/portal-deploy/) artifacts + the bundle hashes change
**LOC:** ~22 build artifacts (same shape as commits `134b21f` and `76deb80`)
**What:**
- Build per portal: `VITE_BFF_URL=https://hydrax-bff-production.up.railway.app VITE_BASE_PATH=/<portal>/ pnpm --filter @hydrax/<portal> build`. **Do NOT** set `VITE_DEMO_MODE` — letting it default to false flips api-client back to `realBaseQuery`.
- `rsync -a --delete web/apps/<portal>/dist/ web/portal-deploy/<portal>/` for all 5.
- `cd web/portal-deploy && railway link --service hydrax-portals && railway up --path-as-root . --detach`.
**Verification:**
- New asset hashes per portal (different from `index-DPSRJDkv` etc. — the demo-mode hashes).
- Browser visit to `/issuer/products` shows the workflow-svc fixture (or real seeded data if Phase 2 inserted any) loaded over the network. Network tab shows fetches to `hydrax-bff-production.up.railway.app`, not `localhost:8080`.
- `/investor/health` shows the bff tile + workflow-svc tile in green; other-upstream tiles in red/amber per Q1 depth.
- Item A's CTA contrast verification re-runs on the empty state when products list is empty (workflow-svc returns 0 rows initially).
**Commit:** `build(portals): rebuild 5 bundles against deployed BFF`

### Phase 6 — Smoke + verification

**Files:** none, just probing
**What:** Re-run [/tmp/qa-portals.js](/tmp/qa-portals.js) (the same script used for the 2026-04-26 demo verification) against the new deploy. Expect:
- Health route shows mixed tile statuses per Q1 depth.
- `/issuer/products` empty-state CTA reachable (workflow-svc has 0 rows on fresh schema, so the empty state IS triggered) — finally end-to-end visual verification of Item A's CTA fix on the empty path.
- Subscribe button on `/investor/products/<id>` — same canonical pairing as Phase 5 of the demo deploy already verified.
**Commit:** none. Findings recorded in STATE.yaml `verification_log`.

## Verification gate (cumulative, before declaring done)

Per [CLAUDE.md Verification Gates](../../CLAUDE.md):
- Go: `go vet ./... && go test ./...` per touched service (workflow-svc, optionally approval/audit/hydrax).
- TS: `pnpm --filter @hydrax/bff typecheck && pnpm --filter @hydrax/bff test -- --run` (38 tests today, +CORS tests from Phase 1).
- DB: migrations dry-run on empty + seeded fixture (workflow-svc has these per `2026-04-25-backend-services-scaffold.md`).
- Live probes:
  - `curl -sS https://hydrax-bff-production.up.railway.app/healthz/composite | jq .upstreams` lists workflow-svc.
  - `curl -sS -H "Origin: https://hydrax-portals-production.up.railway.app" -X OPTIONS https://hydrax-bff-production.up.railway.app/v1/products` returns 204 with the matching `Access-Control-Allow-Origin`.
  - Browser fetch to `/v1/products` from the portals origin succeeds (no CORS console error).

## Past-mistakes to avoid

- **2026-04-26 — `railway up` from a subdirectory uploads the project root.** All `railway up` calls in this plan use `--path-as-root .` from the service-specific subdirectory.
- **2026-04-26 — Verification by HTTP 200 alone is meaningless on `serve -s`.** All deploy verifications below probe the actual `Access-Control-Allow-Origin` header value or a known JSON envelope, not just the status code.
- **2026-04-26 — Working tree mutates between Bash calls in multi-agent sessions.** Each phase's commit uses `git add <specific paths>` and `git diff --cached --name-only` reconciliation before commit.
- **2026-04-25 — Don't use `npx` / curl-piped installers without explicit per-domain authorization.** Postgres provenance is a Railway addon (Q2=A); no toolchain installs needed.
- **2026-04-26 — Concurrent CLAUDE.md edits.** Phase 4 docs/env.md edit must check `git diff docs/env.md` before staging; if a parallel session has additions, surface and commit transparently.

## Estimated effort

| Phase | Files | Time |
|---|---|---|
| 0 (user setup) | 0 | 15 min (dashboard clicks) |
| 1 (CORS) | ~3 | 60 min (code + tests) |
| 2 (workflow-svc deploy) | 0 | 45 min (build, migrations, healthcheck) |
| 3 (BFF deploy) | 0 | 30 min |
| 4 (docs/env.md) | 1 | 10 min |
| 5 (portal rebuild) | ~22 | 30 min |
| 6 (smoke) | 0 | 20 min |
| **Total (Q1=B)** | **~26** | **~3.5 h** |
| Total (Q1=C, +3 more services in Phase 2) | ~26 | ~6 h |

## Rollback

- Phase 5 is reversible by setting `VITE_DEMO_MODE=true` and rebuilding. The `76deb80` demo-mode deploy commit can be cherry-picked to roll the portals back to fixture mode without rolling back BFF.
- Phase 3 is reversible by un-linking the portals' `VITE_BFF_URL` (rebuild without it → falls back to `http://localhost:8080`, same as pre-demo state) and removing the bff service in the dashboard.
- Phase 2 + Postgres are NOT reversible from the data side — once workflow-svc has accepted writes from the portals, those rows exist. Treat workflow-svc deploy as the point of no easy undo.

## Pre-execution checklist

- [ ] Q1 answered (default B)
- [ ] Q2 answered (default A — Railway Postgres addon)
- [ ] Q3 answered (default A — per-service)
- [ ] Q4 answered (default A — strict origin allowlist)
- [ ] User has created the 2-5 Railway services + Postgres addon (Phase 0)
- [ ] User confirms `proceed with bff-deploy plan` (or scopes to a phase subset)
- [ ] Working tree clean before Phase 1

## Companion plans

- [2026-04-25-backend-services-scaffold.md](2026-04-25-backend-services-scaffold.md) — the original Go-services scaffold; Dockerfiles + tests already exist
- [2026-04-26-portal-grey-theme-consistency.md](2026-04-26-portal-grey-theme-consistency.md) — the previous portal rebuild that established the `web/portal-deploy/` workflow
- [2026-04-26-deck-brand-alignment.md](2026-04-26-deck-brand-alignment.md) — the audit follow-up plan structure this plan mirrors
