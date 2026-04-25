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
| `APPROVAL_SVC_URL` | `http://localhost:7002` | approval-svc |
| `AUDIT_SVC_URL` | `http://localhost:7003` | audit-svc |
| `HYDRAX_ADAPTER_URL` | `http://localhost:7004` | hydrax-adapter |
| `NOTIFY_SVC_URL` | `http://localhost:7101` | notify-svc |
| `INTEGRATION_SVC_URL` | `http://localhost:7102` | integration-svc |

### Deferred

`DATABASE_URL`, `MONGODB_URI`, KYC/SSO/CRM provider credentials, HydraX rails credentials — all deferred until the corresponding domain logic lands. Document each here at the same commit that introduces the dependency.

## Web app env vars (web monorepo scaffold — added 2026-04-25)

### `VITE_BFF_URL`

- Used by: `web/packages/api-client` (read via `import.meta.env` in browser bundles; falls back to `process.env.VITE_BFF_URL` in Node tests).
- Default: `http://localhost:8080` when unset.
- Where set: each `web/apps/*/.env.local` for development, Railway service env for staging/prod. The bff service (port 7103) is the canonical target in v1.
- Why: api-client's `fetchBaseQuery` baseUrl. Apps consume RTK Query hooks; no other surface reads this var.
- Precedence: `import.meta.env` is replaced at Vite build time and works in deployed bundles. `process.env` is the fallback for `vitest`/Node-only test environments. Order matters — see Past Mistakes 2026-04-25 in [CLAUDE.md](../CLAUDE.md).
