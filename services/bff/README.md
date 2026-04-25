# bff

Node/TS service. Backend-for-frontend that aggregates Go and Node services for the React portals.

## Run locally

    pnpm -F @hydrax/bff dev

Listens on `:7103` (override with `PORT`).

## Health

    curl -s http://localhost:7103/healthz
    # {"service":"bff","status":"ok"}

## Test

    pnpm -F @hydrax/bff test

## Build

    pnpm -F @hydrax/bff build

## Upstream URLs

| Env var | Default | Service |
|---|---|---|
| `WORKFLOW_SVC_URL` | http://localhost:7001 | workflow-svc |
| `APPROVAL_SVC_URL` | http://localhost:7002 | approval-svc |
| `AUDIT_SVC_URL` | http://localhost:7003 | audit-svc |
| `HYDRAX_ADAPTER_URL` | http://localhost:7004 | hydrax-adapter |
| `NOTIFY_SVC_URL` | http://localhost:7101 | notify-svc |
| `INTEGRATION_SVC_URL` | http://localhost:7102 | integration-svc |

## Deploy

Railway service `bff`. Build with repo root as Docker context: `docker build -f services/bff/Dockerfile .`
