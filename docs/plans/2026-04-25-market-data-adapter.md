# Market Data Adapter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **This plan is gated on Item C (v1 backend scaffolding) approval — do not start implementation until the user authorizes scaffolding.**

**Goal:** Stand up a single Go service `services/market-data-svc` that exposes a stable internal HTTP contract for prices, candles, and FX rates to the BFF and downstream workflow services, sourcing data from two free/owned upstreams (Binance public + the existing `market-data-hub` Railway service). This is the data display + analytics feed only — it is **not** the HydraX rails adapter and does not carry workflow state.

**Context (read first):**
- This plan is the deliverable for Item D from the 2026-04-25 `/proceed-with-claude-recommendation` pass. See [CLAUDE.md](../../CLAUDE.md) → "Decisions (Recent)" for the source-of-record decision.
- This is **separate** from PRD-v2 §14 Q1 (HydraX workflow rails). Q1 stays open; v1 will mock `services/hydrax-adapter` behind a stable interface. This service handles a different layer.
- The dual-source pattern is already proven in TradeClaw `web` (per workspace [CLAUDE.md](../../../CLAUDE.md)): web fetches crypto directly from Binance; the hub serves 18 forex pairs + XAU/USD + XAG/USD via Twelve Data. Hydrax-app reuses that split, no new architecture.
- Public URL of the hub: `https://affectionate-consideration-production-f0be.up.railway.app` (verified HTTP 200 on 2026-04-25). README at [`market-data-hub/README.md`](../../../market-data-hub/README.md).

**Architecture:**

```
                     hydrax-app/services/market-data-svc (Go, this service)
                                    │
            ┌──── /v1/candles/{symbol} ────┐
            │     /v1/quotes/{symbol}      │
            │     /v1/fx/{base}/{quote}    │
            ▼                               ▼
   route by asset class                  cache + dedup
            │                               │
   ┌────────┴───────┐                       │
   │                │                       │
   ▼                ▼                       │
Binance public   market-data-hub            │
REST/WS          REST                       │
(crypto)         (forex + XAU/XAG)          │
   │                │                       │
   └────────────────┴───────────────────────┘
                    │
              upstream cache TTLs respected;
              circuit-breaker on upstream 5xx
```

The service is the only place inside hydrax-app that knows about Binance or Twelve Data exists. Everything upstack (BFF, React portals, workflow services) talks the internal `market-data-svc` contract.

**Tech Stack:**
- Go 1.22+ (matches workspace target; aligned with other Go services per [CLAUDE.md target tech stack](../../CLAUDE.md))
- HTTP server: `net/http` + `chi` for routing (boring choice, no framework lock-in)
- Upstream HTTP client: `net/http` with `context.Context` deadlines
- Cache: in-process LRU first; Redis only if multiple replicas materially help (defer until measured)
- No persistence — all data is derived from upstreams

**Scope:**

| In | Out |
|---|---|
| `services/market-data-svc` Go binary with `/v1/candles`, `/v1/quotes`, `/v1/fx` routes | Trading-side endpoints (orders, account, positions) — not in scope; HydraX rails handle that |
| Asset-class routing (crypto → Binance, FX/commodities → hub) | Direct Twelve Data API calls (we proxy through the existing hub, never bypass it) |
| In-process LRU cache with per-asset TTL | Pushing market data into Postgres / Mongo (this service is read-only, in-memory) |
| Circuit-breaker + fallback responses (last-known-good) on upstream 5xx | Ledger-backed price publication (out of v1) |
| Symbol registry: documented list of supported `BTC/USD`, `EUR/USD`, `XAU/USD` etc. | Per-tenant symbol entitlement (deferred to tenant-framework slice) |
| OpenAPI spec generated from routes for the BFF client | Custom indicators/derived analytics (those live in their own service later) |
| Structured JSON logs + Prometheus `/metrics` | gRPC interface (HTTP-only for v1; revisit if BFF needs streaming) |

**Risk log:**
- **Binance rate limits**: public market endpoints are weight-based (1200/min default). Cache aggressively (30s for ticker, candle TTL = bar interval). Adding `BINANCE_API_KEY` raises the limit but is **not required for any market data endpoint** — only used if measurements show we're hitting the cap.
- **Hub coupling**: market-data-hub is a separate Railway project the user owns; if it goes down, all FX/commodities go dark. Mitigation: in-process LRU keeps last-known-good for `cache.fxStaleTTL = 1h`, after which we 503 with a clear `upstream_unavailable` body. Alarm via Prometheus.
- **Symbol format drift**: hub uses `BTC/USD` (slash, url-encoded as `BTC%2FUSD`); Binance uses `BTCUSDT` (no slash, USDT not USD). Adapter normalizes at the boundary — internal contract is `{base}/{quote}` always. Single normalization map in one file (`internal/symbols/normalize.go`).
- **Pair availability mismatch**: hub serves 18 specific FX pairs + XAU/USD + XAG/USD as of 2026-04-15. If a future portal needs a pair not in that set, we have to either add it to the hub (Redis hash write per hub README) or proxy directly to Twelve Data. Plan: keep the supported-symbols list hard-coded in `internal/symbols/registry.go` and 404 unknown symbols loudly.

---

### Phase 1: Service skeleton + symbol registry

**Files (created):**
- `services/market-data-svc/cmd/server/main.go` — entrypoint, reads env, starts HTTP server
- `services/market-data-svc/internal/config/config.go` — env-var loading with explicit zero-tolerance for missing required vars
- `services/market-data-svc/internal/symbols/registry.go` — supported-symbols list (matches hub README + Binance public ticker support)
- `services/market-data-svc/internal/symbols/normalize.go` — internal `BASE/QUOTE` ↔ Binance `BASEQUOTE` ↔ hub url-encoded slash
- `services/market-data-svc/go.mod` + `go.sum`

**Tasks:**
- [ ] **Step 1.1:** Scaffold `cmd/server/main.go` that reads config, registers a single `/healthz` route, listens on `:$PORT` (default `8080`). Verify with `go build ./...` and `curl :8080/healthz` returning `200 ok`.
- [ ] **Step 1.2:** Hard-code the supported-symbols list per the hub README: 18 FX pairs + XAU/USD + XAG/USD + (TBD) crypto list. Crypto list to confirm: BTC/USD, ETH/USD, SOL/USD as a starting set.
- [ ] **Step 1.3:** Add `internal/symbols/normalize_test.go` covering: `BTC/USD` → `BTCUSDT` (Binance), `BTC/USD` → `BTC%2FUSD` (hub), unknown symbol → `ErrUnknownSymbol`. `go test ./...` green.

**Verification:** `go build ./services/market-data-svc/...` exits 0; `go test ./services/market-data-svc/...` exits 0; `curl :8080/healthz` returns `200`.

**Commit:** `feat(market-data): scaffold service skeleton with symbol registry` — one concern, one commit.

---

### Phase 2: Hub adapter (FX + commodities)

**Files (created):**
- `services/market-data-svc/internal/upstream/hub/client.go` — HTTP client for `MARKET_DATA_HUB_URL`
- `services/market-data-svc/internal/upstream/hub/client_test.go` — uses `httptest.Server` for fake hub, no live network in CI

**Tasks:**
- [ ] **Step 2.1:** Implement `Client.Candles(ctx, symbol, interval, limit)` calling `GET {HUB_URL}/api/candles/{url-encoded symbol}?interval=...&limit=...`.
- [ ] **Step 2.2:** Implement `Client.ExchangeRates(ctx)` calling `GET {HUB_URL}/api/exchange-rates`. Return decoded slice.
- [ ] **Step 2.3:** Add unit test against `httptest.Server` returning the documented hub response shapes (per hub README + a captured live response). Cover 200, 404, 500, and timeout paths.

**Verification:** `go test ./services/market-data-svc/internal/upstream/hub/...` green. One smoke `curl` against the live hub URL outside CI to confirm response shape matches what the test fakes are returning.

**Commit:** `feat(market-data): add market-data-hub upstream client`

---

### Phase 3: Binance adapter (crypto)

**Files (created):**
- `services/market-data-svc/internal/upstream/binance/client.go`
- `services/market-data-svc/internal/upstream/binance/client_test.go`

**Tasks:**
- [ ] **Step 3.1:** Implement `Client.Ticker(ctx, symbol)` against `GET https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT`. Symbol normalization happens at the boundary — caller passes internal `BTC/USD`.
- [ ] **Step 3.2:** Implement `Client.Klines(ctx, symbol, interval, limit)` against `GET /api/v3/klines`. Map intervals: internal `5min` → Binance `5m`, `1h` → `1h`, `1day` → `1d`, etc. (table in `internal/symbols/intervals.go`).
- [ ] **Step 3.3:** Optional `BINANCE_API_KEY` injected as `X-MBX-APIKEY` header; unit-test both with and without the header.
- [ ] **Step 3.4:** Add `httptest`-backed tests for happy path + 429 (rate limit) handling that surfaces a typed `ErrRateLimited`.

**Verification:** `go test ./services/market-data-svc/internal/upstream/binance/...` green.

**Commit:** `feat(market-data): add Binance public REST upstream client`

---

### Phase 4: Routing layer + cache + public HTTP routes

**Files (created):**
- `services/market-data-svc/internal/router/router.go` — given symbol + asset class, returns the right upstream
- `services/market-data-svc/internal/cache/lru.go` — typed in-process LRU
- `services/market-data-svc/internal/api/handlers.go` — `/v1/candles`, `/v1/quotes`, `/v1/fx` HTTP handlers
- `services/market-data-svc/internal/api/openapi.yaml` — generated/maintained OpenAPI spec for BFF consumption

**Tasks:**
- [ ] **Step 4.1:** Implement `router.For(symbol)` → returns `crypto` (Binance) or `fx_or_commodity` (hub). Lookup table seeded from registry.
- [ ] **Step 4.2:** Implement LRU with per-key TTL: candles cached for `min(interval, 30s)` for live bars; FX rates cached 60s; tickers cached 30s.
- [ ] **Step 4.3:** Wire HTTP handlers: each handler calls `router.For()`, picks the upstream client, hits cache first, falls back to upstream. On upstream 5xx, serve last-known-good if `< stale-ttl`, else `503 upstream_unavailable`.
- [ ] **Step 4.4:** Generate OpenAPI YAML and check it in. BFF will consume this directly via codegen.
- [ ] **Step 4.5:** Integration test in `internal/api/handlers_integration_test.go` using two fake `httptest.Server` instances (one as Binance, one as hub) and asserting routing per symbol.

**Verification:** `go test ./services/market-data-svc/...` green; `curl :8080/v1/candles/BTC%2FUSD?interval=5m&limit=10` returns 200 with the expected JSON shape; same for `/v1/fx/EUR/USD`.

**Commit:** `feat(market-data): add routing, cache, and v1 HTTP API`

---

### Phase 5: Observability + Railway service config

**Files (created):**
- `services/market-data-svc/internal/middleware/logging.go` — structured JSON request log with correlation ID
- `services/market-data-svc/internal/middleware/metrics.go` — Prometheus counters/histograms per route + per upstream
- `services/market-data-svc/Dockerfile` — multi-stage build, distroless final image
- `services/market-data-svc/railway.json` — Railway service config (build via Dockerfile, env-var contract documented)
- Update [`docs/env.md`](../env.md) — add `MARKET_DATA_HUB_URL`, `MARKET_DATA_HUB_TIMEOUT`, optional `BINANCE_API_KEY`, and Binance base URL override `BINANCE_API_BASE`

**Tasks:**
- [ ] **Step 5.1:** Wrap HTTP server with logging + metrics middleware. Expose `/metrics` for Prometheus scrape.
- [ ] **Step 5.2:** Add Dockerfile and verify `docker build` exits 0 locally; `docker run -e MARKET_DATA_HUB_URL=... -p 8080:8080 ...` serves `/healthz` with 200.
- [ ] **Step 5.3:** Update [`docs/env.md`](../env.md) with the new env vars, **names only**, never values.
- [ ] **Step 5.4:** `railway up --detach` from `services/market-data-svc/` once a Railway service is provisioned for it (gated on Item C). Capture build id + commit sha into [STATE.yaml](../../STATE.yaml) `verification_log`.

**Verification:** local Docker run reaches both upstreams (one curl per route); Prometheus `/metrics` exposes `market_data_upstream_request_total{upstream="binance"}` and `..."hub"` after one request to each.

**Commit:** `feat(market-data): add observability, Dockerfile, and Railway service config`

---

### Phase 6: BFF integration spike (separate plan doc)

Out of scope for this plan. When the BFF is scaffolded (also gated on Item C), it consumes `services/market-data-svc` via the OpenAPI spec from Phase 4. That integration belongs in the BFF's own plan doc, not here.

---

## Environment variables (names only — values live on Railway)

| Var | Required | Lives on | Used by |
|---|---|---|---|
| `MARKET_DATA_HUB_URL` | yes | Railway `market-data-svc` env | Hub upstream client. Set to `https://affectionate-consideration-production-f0be.up.railway.app`. |
| `MARKET_DATA_HUB_TIMEOUT` | no (default 5s) | Railway `market-data-svc` env | HTTP timeout for hub requests. |
| `BINANCE_API_BASE` | no (default `https://api.binance.com`) | Railway `market-data-svc` env | Override for testnet or proxy. |
| `BINANCE_API_KEY` | no | Railway `market-data-svc` env | Optional; only raises rate limits. **Public market endpoints work without it.** |
| `PORT` | no (default 8080) | Railway-injected | HTTP listen port. |

**Never committed.** Documented in [`docs/env.md`](../env.md). Match the workspace `.env`-never-committed rule per [CLAUDE.md](../../CLAUDE.md) Railway Rules.

---

## Out of scope (explicit non-goals)

- HydraX rails integration (custody, tokenisation, trading lifecycle) — that is `services/hydrax-adapter` per [CLAUDE.md](../../CLAUDE.md) Decisions (Recent), tracked separately under PRD-v2 §14 Q1 deferral
- Any persistence (Postgres/Mongo writes) — this service is read-only, in-memory, and derives all data from upstreams
- Per-tenant entitlement / symbol whitelisting — comes with the tenant framework slice
- WebSocket streaming to the BFF — HTTP-only for v1; revisit if measurements justify
- Custom indicators or analytics — separate service later
- A trading API — Binance trading endpoints are explicitly excluded; we only call public market endpoints

---

## Open questions (must resolve before Phase 1 starts)

1. **Crypto symbol allowlist for v1.** Hub README confirms hub has zero crypto coverage. What are the crypto pairs the first portal slice needs? Default proposal: BTC/USD, ETH/USD, SOL/USD. Confirm with the first design partner (PRD-v2 §14 Q4).
2. **Cache shape.** In-process LRU is fine for a single replica. If we ship multi-replica from day one for any reason, we want Redis. Default: single replica + in-process LRU; promote later only on measurement.
3. **Hub auth.** The hub is currently public/unauthenticated (per its README). If we add auth on the hub side, we need `MARKET_DATA_HUB_TOKEN` here. Track via the hub repo, not this plan.
4. **Live-data vs delayed.** Do any v1 workflows need sub-second freshness? If yes, Phase 2/3 caches drop to 5s, and we revisit WebSocket streaming. Default assumption: 30s freshness is fine for v1 (institutional workflow context, not retail trading).

---

## References

- [CLAUDE.md → Decisions (Recent)](../../CLAUDE.md) — source-of-record for the data source choice
- [STATE.yaml](../../STATE.yaml) — current focus and verification log
- [market-data-hub README](../../../market-data-hub/README.md) — upstream service contract
- [PRD-v2 §11](../prd-v2.md) (and PRD §11.3, §11.5) — architectural context
- [docs/env.md](../env.md) — env-var registry (will gain new entries in Phase 5)
- TradeClaw `web` consumer (workspace [CLAUDE.md](../../../CLAUDE.md) "TradeClaw — Signal Generation Architecture") — proven dual-source pattern this plan mirrors
