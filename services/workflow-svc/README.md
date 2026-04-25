# workflow-svc

Go service. Owns workflow orchestration, state machines, SLA tracking.

## Run locally

    HYDRAX_ADAPTER_URL=http://localhost:7004 go run ./cmd/server

Listens on `:7001` (override with `PORT`).

## Health

    curl -s http://localhost:7001/healthz
    # {"service":"workflow-svc","status":"ok"}

## Test

    go test ./...

## Env vars

| Var | Default | Notes |
|---|---|---|
| `PORT` | `7001` | HTTP listen port |
| `HYDRAX_ADAPTER_URL` | `http://localhost:7004` | Where to reach hydrax-adapter for rails calls. Cross-service HTTP — workflow-svc never imports `hydraxrails` directly. |

## Cross-service rails

`internal/railsclient` is the HTTP client for `hydrax-adapter`'s `POST /v1/issue`.
v1 server-side is MockRails per Decision 2026-04-25; the same client shape works
once the real HydraX surface lands (PRD-v2 §14 Q1).

## Deploy

Railway service `workflow-svc`. Build via Dockerfile.
