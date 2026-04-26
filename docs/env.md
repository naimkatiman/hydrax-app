# Environment Variables and Toolchains

Every environment variable and toolchain dependency used anywhere in the repo is documented here.

## Toolchains

### Daml SDK

- Version: 2.9.5 (pinned, LTS)
- Install: `curl -sSL https://get.daml.com/ | sh -s 2.9.5`
- Verify: `daml version` shows `SDK version: 2.9.5`
- Used by: `services/canton-adapter/daml/*`
- Why pinned to 2.9: Daml 3.x is pre-GA as of 2026-04-25. Upgrade re-decision is out of scope for the governance spike.

## Environment variables

## Service env vars (v1 scaffolding — added 2026-04-25)

Each service binary listens on `PORT` (defaulted per service below). All services expose `/healthz` returning `{"service":"<name>","status":"ok"}` with HTTP 200.

| Service | Default port | Notes |
|---|---|---|
| workflow-svc | 7001 | Go. Owns workflow orchestration + state machines. |
| approval-svc | 7002 | Go. Owns approval chains. |
| audit-svc | 7003 | Go. Owns the immutable action log. |
| hydrax-adapter | 7004 | Go. v1 ships `MockRails` per Decision 2026-04-25. |
| canton-adapter | 7005 | Go. Bridge to Canton/Daml participant. Daml spike at `services/canton-adapter/daml/`. |
| notify-svc | 7101 | Node/TS. Owns email + in-app + webhook notifications. |
| integration-svc | 7102 | Node/TS. Owns KYC/KYB, SSO, CRM. |
| bff | 7103 | Node/TS. Aggregates the above for React portals. |
| market-data-svc | 7006 | Go. Crypto via Binance public REST + FX/commodities via market-data-hub. /healthz + /v1/candles + /v1/quotes + /v1/fx. |

### market-data-svc env vars (added 2026-04-25)

| Env var | Required | Default | Notes |
|---|---|---|---|
| `MARKET_DATA_HUB_URL` | yes | — | The market-data-hub Railway URL (e.g. `https://affectionate-consideration-production-f0be.up.railway.app`). Service refuses to start without it. |
| `MARKET_DATA_HUB_TIMEOUT` | no | `5s` | HTTP timeout for hub requests. Parsed as `time.Duration`. |
| `BINANCE_API_BASE` | no | `https://api.binance.com` | Override for testnet/proxy. |
| `BINANCE_API_KEY` | no | — | Optional; raises rate limits only. **Public market endpoints work without it.** |

### bff upstream URLs (set at deploy time)

| Env var | Default | Points at |
|---|---|---|
| `WORKFLOW_SVC_URL` | `http://localhost:7001` | workflow-svc |
| `APPROVAL_SVC_URL` | `http://localhost:7002` | approval-svc — consumed by bff `/v1/approvals` proxy (`services/bff/src/approvals/proxy.ts`); approval-svc is in-memory in v1 (persistence deferred) |
| `AUDIT_SVC_URL` | `http://localhost:7003` | audit-svc — consumed by bff `/v1/audit/events` proxy (`services/bff/src/audit/proxy.ts`) **and** by workflow-svc to emit `product.transitioned` events on successful lifecycle transitions (`services/workflow-svc/internal/auditclient`). When unset on workflow-svc, emission is a no-op (best-effort, never blocks the 200). |
| `HYDRAX_ADAPTER_URL` | `http://localhost:7004` | hydrax-adapter |
| `NOTIFY_SVC_URL` | `http://localhost:7101` | notify-svc |
| `INTEGRATION_SVC_URL` | `http://localhost:7102` | integration-svc |

### `DATABASE_URL` (workflow-svc)

Postgres DSN. Required for product routes (`POST /v1/products`,
`GET /v1/products/{id}`). If unset, the binary still serves `/healthz`
but logs `DATABASE_URL unset — product routes disabled`. workflow-svc
runs a 3-second startup `PingContext` against the DSN — a bad URL fails
fast at boot rather than at first query.

- **Local:** `postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable`
  (start the stack with `docker compose -f db/postgres/docker-compose.test.yml up -d`)
- **Railway:** the Postgres addon injects `DATABASE_URL` automatically once provisioned.
  See "Railway provisioning runbook" in `docs/plans/2026-04-25-persistence-foundation.md`.

### Auth Foundation (Slice 1)

| Var | Service | Default | Purpose |
|---|---|---|---|
| `INTEGRATION_SVC_DATABASE_URL` | integration-svc | falls back to `DATABASE_URL` | Postgres DSN for the auth Sessions repo |
| `AUTH_DEV_LOGIN` | integration-svc | unset (off) | Set to `1` to enable `POST /v1/auth/dev/login`. Returns 404 when unset. **Never set in prod.** |
| `SESSION_TTL_SECONDS` | integration-svc | `43200` (12h) | TTL for sessions issued via dev/login |
| `INTEGRATION_SVC_URL` | bff | `http://localhost:7102` | Upstream URL for auth proxy + composite healthz (already listed in bff upstream URLs table above) |

### Auth Slice 2a — WebAuthn (Passkeys, server substrate)

| Var | Service | Default | Purpose |
|---|---|---|---|
| `WEBAUTHN_RP_ID` | integration-svc | `localhost` | RP ID for WebAuthn ceremonies. **Production: must match the eTLD+1 of the portal origin.** Single-valued — RP-ID-across-multiple-portal-subdomains is a deferred deployment decision (see slice 2d plan). |
| `WEBAUTHN_RP_NAME` | integration-svc | `Hydrax` | Display name shown in the OS/browser passkey prompt |
| `WEBAUTHN_ORIGIN` | integration-svc | `http://localhost:5173` | Expected origin of the calling browser. Production: must be HTTPS (browsers reject WebAuthn over plain HTTP except for `localhost`). |
| `WEBAUTHN_CHALLENGE_TTL_SECONDS` | integration-svc | `60` | Challenge LRU TTL. Range 30–300. Validated at startup; bad value crashes the process. |

**Slice 2a is server-side substrate only.** New users have no first-credential bootstrap path until slice 2b (magic-link enrollment) ships. Slice 2a's prototype path uses `AUTH_DEV_LOGIN=1` to bootstrap, which is fail-closed in production.

Slice 2c (email transport) and slice 2d (portal UI) will add: SMTP / SES / Resend creds, browser asset paths, etc.

If OIDC is later chosen as a complementary auth path: `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` will be added then.

### Auth Slice 2b — Magic-Link Enrollment (server substrate + console transport)

| Var | Service | Default | Purpose |
|---|---|---|---|
| `MAGIC_LINK_TTL_SECONDS` | integration-svc | `900` (15 min) | TTL for magic-link tokens. Range 60-3600. |
| `MAGIC_LINK_RATE_LIMIT_PER_WINDOW` | integration-svc | `3` | Max magic-link requests per (tenant_slug, email) per window. Range 1-10. |
| `MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS` | integration-svc | `900` (15 min) | Rate-limit window. Range 60-3600. |
| `MAGIC_LINK_BASE_URL` | integration-svc | `http://localhost:5173/auth/magic-link` | URL the email points at. The `?token=...` query param is appended. Production: must match the slice 2d portal route. |
| `EMAIL_TRANSPORT` | notify-svc | `console` | Email transport. Slice 2b ships `console` (logs to stdout) and `noop` (silently drops). Slice 2c will add `smtp` / `ses` / `resend`. |
| `NOTIFY_SVC_URL` | integration-svc | `http://localhost:7101` | Where integration-svc POSTs `/v1/notifications/email`. |

**Slice 2b is server-side substrate + console-transport only.** Magic-link URLs are printed to `notify-svc` stdout when `EMAIL_TRANSPORT=console`; nothing reaches a real inbox. Production-ready bootstrap requires slice 2c (real email transport via SMTP / SES / Resend) before `AUTH_DEV_LOGIN=1` can come down (slice 2e).

**Email enumeration safety:** `POST /v1/auth/magic-link/request` always returns 202 regardless of whether the user exists. Send failures are swallowed and logged via `console.error` — they never surface to the requester. Rate-limit responses (HTTP 429) are the only non-202 success-path response.

### Deferred

`MONGODB_URI`, KYC/SSO/CRM provider credentials, HydraX rails credentials — all deferred until the corresponding domain logic lands. Document each here at the same commit that introduces the dependency.

## Web app env vars (web monorepo scaffold — added 2026-04-25)

### `VITE_BFF_URL`

- Used by: `web/packages/api-client` (read via `import.meta.env` in browser bundles; falls back to `process.env.VITE_BFF_URL` in Node tests).
- Default: `http://localhost:8080` when unset.
- Where set: each `web/apps/*/.env.local` for development, Railway service env for staging/prod. The bff service (port 7103) is the canonical target in v1.
- Why: api-client's `fetchBaseQuery` baseUrl. Apps consume RTK Query hooks; no other surface reads this var.
- Precedence: `import.meta.env` is replaced at Vite build time and works in deployed bundles. `process.env` is the fallback for `vitest`/Node-only test environments. Order matters — see Past Mistakes 2026-04-25 in [CLAUDE.md](../CLAUDE.md).
