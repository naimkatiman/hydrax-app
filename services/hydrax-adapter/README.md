# hydrax-adapter

Go service. Workflow-layer adapter for HydraX tokenisation, custody, and trading rails.

**Status:** v1 ships `MockRails` behind the `Rails` interface per CLAUDE.md decision 2026-04-25. Real HydraX integration unblocks once the API surface is delivered (PRD-v2 §14 Q1).

## Run locally

    go run ./cmd/server

Listens on `:7004` (override with `PORT`).

## Health

    curl -s http://localhost:7004/healthz
    # {"service":"hydrax-adapter","status":"ok"}

## Mock Rails Surface

All endpoints below are mock-only. Same HTTP shape stays once a real `Rails` impl swaps in.

### POST /v1/issue

    curl -sX POST http://localhost:7004/v1/issue \
      -d '{"tenant_id":"t1","product_code":"MMF-USD"}'
    # {"product_id":"mock-MMF-USD-1"}

### POST /v1/subscribe

    curl -sX POST http://localhost:7004/v1/subscribe \
      -d '{"tenant_id":"t1","product_id":"p1","investor_ref":"i1","units":1000}'
    # {"subscription_id":"sub-mock-1"}

### POST /v1/custody/transfer

    curl -sX POST http://localhost:7004/v1/custody/transfer \
      -d '{"tenant_id":"t1","from":"a","to":"b","asset_ref":"USDC","units":50}'
    # {"transfer_id":"xfer-mock-1"}

### POST /v1/settle

    curl -sX POST http://localhost:7004/v1/settle \
      -d '{"tenant_id":"t1","subscription_id":"sub-mock-1"}'
    # {"settlement_id":"set-mock-1","status":"settled"}

### GET /v1/nav/{product_id}

NAV is **deterministic** — same `product_id` returns the same NAV (FNV-1a hash mod 5000, formatted `1.NNNN`). `as_of` is truncated to UTC date so demo screenshots stay stable within a 24h window.

    curl -s http://localhost:7004/v1/nav/p1
    # {"product_id":"p1","nav":"1.XXXX","as_of":"2026-04-26T00:00:00Z"}

## Errors

All 4xx responses are JSON: `{"error":"<code>","message":"<detail>"}`. Common codes: `bad_json`, `method_not_allowed`, `subscribe_rejected`, `custody_rejected`, `settle_rejected`, `nav_rejected`, `bad_product_id`.

## Test

    go test ./...

## Deploy

Railway service `hydrax-adapter`. Build via Dockerfile.
