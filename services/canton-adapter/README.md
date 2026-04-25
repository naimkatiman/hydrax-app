# canton-adapter

Go service. Bridges the workflow stack and the Canton/Daml participant node.

The Daml spike at `daml/hydrax-governance/` defines the on-ledger contracts and is built independently with `daml build`. This Go bridge is what `workflow-svc` and `approval-svc` call to submit commands and consume events.

## Run locally

    go run ./cmd/server

Listens on `:7005` (override with `PORT`).

## Health

    curl -s http://localhost:7005/healthz
    # {"service":"canton-adapter","status":"ok"}

## Test

    go test ./...

## Deploy

Railway service `canton-adapter`. Build via Dockerfile (Daml tree is excluded from the Go build context).
