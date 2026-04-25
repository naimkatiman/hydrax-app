# market-data-svc

Go service. Owns market-data feeds (prices, candles, FX rates) sourced from
two upstreams:

- **Binance public REST** — crypto (BTC/ETH/SOL on USD)
- **market-data-hub** — FX (18 pairs) + commodities (XAU/XAG)

This is the **data display + analytics feed**. It is **not** the HydraX rails
adapter (custody/tokenisation/trading) — that's `services/hydrax-adapter`.

## Phase 1 status (2026-04-25)

Skeleton only. `/healthz` live on :7006. Symbol registry + normalization
adapters in place. Upstream clients land in Phase 2 (hub) and Phase 3
(Binance) per [`docs/plans/2026-04-25-market-data-adapter.md`](../../docs/plans/2026-04-25-market-data-adapter.md).

## Run locally

    MARKET_DATA_HUB_URL=https://affectionate-consideration-production-f0be.up.railway.app go run ./cmd/server

Listens on `:7006` (override with `PORT`).

## Health

    curl -s http://localhost:7006/healthz
    # {"service":"market-data-svc","status":"ok"}

## Test

    go test ./...

## Env vars

| Var | Required | Default | Notes |
|---|---|---|---|
| `MARKET_DATA_HUB_URL` | yes | — | The hub Railway URL |
| `MARKET_DATA_HUB_TIMEOUT` | no | `5s` | HTTP timeout for hub requests |
| `BINANCE_API_BASE` | no | `https://api.binance.com` | Override for testnet/proxy |
| `BINANCE_API_KEY` | no | — | Optional; raises rate limits only |
| `PORT` | no | `7006` | HTTP listen port |

## Divergences from the plan

Documented in commit message. Summary:
- Stdlib `net/http` instead of `chi` — adds zero deps until Phase 4 actually needs router groups
- Port `7006` instead of `8080` — fits workspace 7001-7005 (Go) + 7101-7103 (TS) convention
- `/healthz` returns JSON `{"service":"market-data-svc","status":"ok"}` matching the other 5 Go services in the workspace, instead of the plan's text "200 ok"
- Plan §"Open questions" all accept their stated defaults: BTC/ETH/SOL crypto allowlist, in-process LRU (Phase 4), hub-auth deferred, 30s freshness target
