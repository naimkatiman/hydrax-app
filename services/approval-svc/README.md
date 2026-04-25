# approval-svc

Go service. Owns approval chains and escalations.

## Run locally

    go run ./cmd/server

Listens on `:7002` (override with `PORT`).

## Health

    curl -s http://localhost:7002/healthz
    # {"service":"approval-svc","status":"ok"}

## Test

    go test ./...

## Deploy

Railway service `approval-svc`. Build via Dockerfile.
