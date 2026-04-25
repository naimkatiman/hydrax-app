# workflow-svc

Go service. Owns workflow orchestration, state machines, SLA tracking.

## Run locally

    go run ./cmd/server

Listens on `:7001` (override with `PORT`).

## Health

    curl -s http://localhost:7001/healthz
    # {"service":"workflow-svc","status":"ok"}

## Test

    go test ./...

## Deploy

Railway service `workflow-svc`. Build via Dockerfile.
