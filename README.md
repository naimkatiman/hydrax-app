# HydraX App

> White-label institutional workflow platform above HydraX's tokenisation, custody, and trading rails.

This is the **layer above** Canton + HydraX. The rails handle shared business truth, multi-party state, and atomic settlement. This app handles the operator UX, tenant onboarding, off-ledger approval ceremonies, and integration glue that the rails by design do not.

For the load-bearing operating rules see [CLAUDE.md](CLAUDE.md). For the product spec see [docs/prd-v2.md](docs/prd-v2.md).

## Live preview

Landing page deployed at [hydrax-portals-production.up.railway.app](https://hydrax-portals-production.up.railway.app/) — institutional-grade entry surface that routes operators into the five role-scoped portals below.

![HydraX landing page](docs/demo/captures/landing.png)

The five role-scoped React portals are served from the same static deploy under per-persona base paths. Each GIF below cycles between the home route and the portal's primary work surface.

| Portal | Routes shown | Live |
|---|---|---|
| Issuer | `/issuer/` &rarr; `/issuer/products` | ![issuer-portal](docs/demo/captures/issuer.gif) |
| Distributor | `/distributor/` &rarr; `/distributor/approvals` | ![distributor-portal](docs/demo/captures/distributor.gif) |
| Investor | `/investor/` &rarr; `/investor/products` | ![investor-portal](docs/demo/captures/investor.gif) |
| Ops | `/ops/` &rarr; `/ops/audit` | ![ops-console](docs/demo/captures/ops.gif) |
| Admin | `/admin/` &rarr; `/admin/tenants` | ![admin-portal](docs/demo/captures/admin.gif) |

Captures were taken via headless chromium against the live URLs (`--window-size=1280,800 --virtual-time-budget=4000`) and assembled into 2-frame GIFs with PIL. To regenerate after a deploy, see [docs/demo/captures/](docs/demo/captures/).

## Canton owns

- Shared multi-party truth (Daml contracts on a synchronizer)
- Sub-transaction privacy via signatories, controllers, and disclosure
- Atomic composition of state transitions across institutions
- Controlled cross-domain interoperability via the Global Synchronizer

## hydrax-app owns

- Tenant onboarding, KYC, IdP and SSO glue (off-ledger by definition)
- Workflow state machines, SLA timers, retries, escalations
- Approval ceremonies that *gate* on-chain commands
- Notifications (email, in-app, webhook)
- Tenant-themed role-scoped portals (issuer, distributor, investor, ops, admin)
- Audit trail of the human approval steps that don't fit on a ledger
- Integration with HydraX rails through one bordered adapter — no rails credentials live elsewhere

## Why this split

Canton models *what was authorized*. The path that *gets* something authorized — collecting documents, walking signatories through their queue, escalating when an approver times out, notifying the CRM — is web2 work. Putting that on-chain is expensive and a privacy leak. Putting it nowhere is what most "blockchain-first" institutional projects do; that's why they fail to ship.

This repo holds the off-ledger half so the on-ledger half can stay small.

## Repo layout

```
hydrax-app/
  index.html, app.js, styles.css     prototype operator console (Railway-deployed)
  services/                          9 backend services (5 Go, 4 Node/TS)
    workflow-svc/                    state machines, SLA, lifecycle (Postgres)
    approval-svc/                    sign-off chains
    audit-svc/                       append-only evidence (Postgres)
    notify-svc/                      fan-out (email / in-app / webhook)
    integration-svc/                 KYC, SSO, CRM glue
    bff/                             HTTP aggregator for portals
    market-data-svc/                 Binance + market-data-hub fan-out
    hydrax-adapter/                  rails translation (MockRails in v1)
    canton-adapter/                  Daml command/event bridge
      daml/hydrax-governance/        running Daml spike (5 Scripts green)
  web/
    apps/                            5 role-scoped React portals
      issuer-portal, distributor-portal, investor-portal, ops-console, admin
    packages/                        shared UI, tenant-theme, api-client
  db/
    postgres/migrations/             schema for v1
  docs/
    prd.md, prd-v2.md                product spec (load-bearing)
    architecture.md                  3-plane architecture, per-service justification
    example-subscription-flow.md     one workflow traced end-to-end with file paths
    plans/                           dated plan docs (one per slice)
    env.md                           every env var documented
  STATE.yaml                         current focus, verification log
```

## Where to start reading

1. [docs/architecture.md](docs/architecture.md) — what each plane owns and why each service exists
2. [docs/example-subscription-flow.md](docs/example-subscription-flow.md) — one workflow, end-to-end, with real file paths
3. [docs/prd-v2.md](docs/prd-v2.md) — the spec
4. [services/canton-adapter/daml/hydrax-governance/](services/canton-adapter/daml/hydrax-governance/) — running Daml spike (the on-ledger half)
5. [index.html](index.html) — the operator UX prototype (live: `hydrax-prototype-production.up.railway.app`, last verified 2026-04-24)

## Status

| Surface | State |
|---|---|
| Operator console prototype | Live on Railway, static HTML/JS, reference for UX patterns |
| Backend services | 9 services, each with `/healthz`; composite health at `bff /healthz/composite` |
| Cross-service wires | bff ↔ workflow-svc (products, subscriptions), bff ↔ audit-svc, bff ↔ approval-svc, bff ↔ market-data-svc, workflow-svc ↔ hydrax-adapter (issue) |
| Portals | 5 with polished baselines (sidebar + topbar + stat tiles + EmptyState + hero JPEG) |
| Postgres-backed | workflow-svc products, audit-svc events |
| Daml spike | `hydrax-governance` package — `daml build` green, 5 Scripts green on `--ide-ledger` |
| HydraX rails | mocked behind `MockRails` in `hydrax-adapter` per [PRD-v2 §14 Q1](docs/prd-v2.md) deferral |
| Canton synchronizer | Daml runs on `--ide-ledger` only; real synchronizer deferred |
| Live deployments | prototype + market-data-svc on Railway |

## Stack

Backend: Go 1.22 (stdlib `net/http`, no framework) + Node 20 / TypeScript (fetch-based proxies, no framework). Frontend: React 18 + Redux Toolkit + RTK Query + Vite + lucide-react. Storage: Postgres (live), MongoDB (planned per [PRD-v2](docs/prd-v2.md) §10). Deploy: Railway (one service per binary, one static site per portal).

Workspace: pnpm 9 monorepo at the repo root; Go workspace via `go.work`; two TypeScript bases (`tsconfig.base.json` for Node, `tsconfig.web.json` for browser).

## Operating rules

See [CLAUDE.md](CLAUDE.md) for the full set. Highlights:

- One concern per commit; hard cap 15 files
- Plan docs at `docs/plans/YYYY-MM-DD-<slug>.md` for any work over 3 files or 150 LOC
- No emoji in UI, code, commits, or logs (lucide icons only in UI)
- Verification gates non-negotiable before commit: `pnpm -r --if-present typecheck`, per-service `go vet ./... && go test ./...`, `pnpm -r --if-present test -- --run`, `pnpm -r --if-present build`

## Local development

```bash
# Prototype (the only single-command runnable surface today)
python3 -m http.server 8000   # then open http://localhost:8000

# Backend services
cd services/<svc> && go run .         # Go services (ports 7001-7006)
pnpm -F @hydrax/<svc> dev             # Node services (ports 7101-7103)

# Portals
pnpm -F @hydrax/<portal> dev          # Vite (ports 5173-5177)

# Workspace verification
pnpm -r --if-present typecheck && pnpm -r --if-present test -- --run && pnpm -r --if-present build
```

For env vars see [docs/env.md](docs/env.md).

## Deploy

Railway, one service per deployable.

```bash
railway up --detach   # from the linked service root
```

Auto-deploy on `git push` is not wired by default. The prototype redeploys on push because `railway.json` is at the repo root; backend services require explicit `railway up` until GitHub source is connected per service in the Railway dashboard.

## Status of the open spec questions

Tracked in [PRD-v2 §14](docs/prd-v2.md). Each blocker has a draft response in `docs/plans/`:

- Q1 — HydraX rails surface — deferred-not-resolved; mocked behind `hydrax-adapter` interface
- Q3 — first product type — default proposal: short-duration credit (30–180d institutional)
- Q4 — first tenant persona — shortlist drafted (issuer-led)
- Q7 — pricing model — 4 candidates, hybrid recommended

All four require external action to actually unblock.

## Canton decks

Two slide decks live in this repo. Both are single-file HTML, keyboard-navigable (←/→/space/PgUp/PgDn/Home/End, mouse-wheel paging, IntersectionObserver reveal, `prefers-reduced-motion` respected). Hero imagery is generated via `/nano-banana`; provenance is in [docs/demo/assets/assets-meta.json](docs/demo/assets/assets-meta.json).

### Primary — homework-aligned deck (14 slides)

[docs/demo/canton-homework-deck.html](docs/demo/canton-homework-deck.html) — structured directly around the homework's three required sections. Deployed at [hydrax-context-production.up.railway.app/deck](https://hydrax-context-production.up.railway.app/deck). Pairs with the long-form article [docs/demo/canton-homework.md](docs/demo/canton-homework.md).

| # | Section | Title | Hero |
|---|---|---|---|
| 0 | Cover | Canton Network — Homework Submission | ![slide-0](docs/demo/assets/slide-0-stack.jpg) |
| 1 | §1 Conceptual Overview | Canton in one frame | ![slide-1](docs/demo/assets/slide-1-thesis-split.jpg) |
| 2 | §1 | Participants, synchronisers, Daml contracts | ![slide-2](docs/demo/assets/slide-2-three-primitives.jpg) |
| 3 | §1 | Four layers, one direction of authority | ![slide-3](docs/demo/assets/slide-3-canton-wiring.jpg) |
| 4 | §1 | Canton vs public L1 vs traditional permissioned DLT | ![slide-4](docs/demo/assets/slide-4-where-canton-stops.jpg) |
| 5 | §2 Building on Canton | Developer toolchain that actually feels like dev | ![slide-5](docs/demo/assets/slide-3-canton-wiring.jpg) |
| 6 | §2 | Local → testnet → mainnet | ![slide-6](docs/demo/assets/slide-1-thesis-split.jpg) |
| 7 | §2 | Where Canton stops, where Web2 takes over | ![slide-7](docs/demo/assets/slide-4-where-canton-stops.jpg) |
| 8 | §2 | Practical assumptions if I were starting today | ![slide-8](docs/demo/assets/slide-6-one-workflow.jpg) |
| 9 | §3 Technical Deep Dive | Privacy & security model | ![slide-9](docs/demo/assets/slide-4-where-canton-stops.jpg) |
| 10 | §3 | Single sync vs Global Synchronizer | ![slide-10](docs/demo/assets/slide-3-canton-wiring.jpg) |
| 11 | §3 | Daml choices as state transitions | ![slide-11](docs/demo/assets/slide-2-three-primitives.jpg) |
| 12 | §3 | What I built above Canton | ![slide-12](docs/demo/assets/slide-6-one-workflow.jpg) |
| 13 | Close | Trade-offs now, roadmap next | ![slide-13](docs/demo/assets/slide-8-tradeoffs-roadmap.jpg) |

### Alternate — architecture-positioning deck (9 slides)

[docs/demo/canton-interview.html](docs/demo/canton-interview.html) — the earlier framing, organised around the "Canton owns the rails, we build above" thesis rather than the homework's three-section structure. Kept for reference.

| # | Title | Hero |
|---|---|---|
| 0 | Canton Network + the layer above it | ![alt-slide-0](docs/demo/assets/slide-0-stack.jpg) |
| 1 | Canton owns the rails. We own the layer above. | ![alt-slide-1](docs/demo/assets/slide-1-thesis-split.jpg) |
| 2 | Canton in three primitives | ![alt-slide-2](docs/demo/assets/slide-2-three-primitives.jpg) |
| 3 | How Canton is wired | ![alt-slide-3](docs/demo/assets/slide-3-canton-wiring.jpg) |
| 4 | Where Canton stops vs what the app must do | ![alt-slide-4](docs/demo/assets/slide-4-where-canton-stops.jpg) |
| 5 | Three planes above the rails | ![alt-slide-5](docs/demo/assets/slide-5-three-planes.jpg) |
| 6 | One workflow across three planes | ![alt-slide-6](docs/demo/assets/slide-6-one-workflow.jpg) |
| 7 | Status, grounded in commits | ![alt-slide-7](docs/demo/assets/slide-7-status.jpg) |
| 8 | Trade-offs now, roadmap next | ![alt-slide-8](docs/demo/assets/slide-8-tradeoffs-roadmap.jpg) |
