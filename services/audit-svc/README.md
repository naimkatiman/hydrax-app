# audit-svc

Go service. Owns the immutable action log and evidence trail.

## Run locally

    go run ./cmd/server

Listens on `:7003` (override with `PORT`).

## Health

    curl -s http://localhost:7003/healthz
    # {"service":"audit-svc","status":"ok"}

## Test

    go test ./...

## Deploy

Railway service `audit-svc`. Build via Dockerfile.
