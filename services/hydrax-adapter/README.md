# hydrax-adapter

Go service. Workflow-layer adapter for HydraX tokenisation, custody, and trading rails.

**Status:** v1 ships `MockRails` behind the `Rails` interface per CLAUDE.md decision 2026-04-25. Real HydraX integration unblocks once the API surface is delivered (PRD-v2 §14 Q1).

## Run locally

    go run ./cmd/server

Listens on `:7004` (override with `PORT`).

## Health

    curl -s http://localhost:7004/healthz
    # {"service":"hydrax-adapter","status":"ok"}

## Test

    go test ./...

## Deploy

Railway service `hydrax-adapter`. Build via Dockerfile.
