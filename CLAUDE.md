# CLAUDE.md — HydraX Institutional Workflow Platform

## Project Identity

- **Name:** hydrax-app
- **Authoritative spec:** [docs/prd.md](docs/prd.md) — read §1–§24 before scoping any module. Everything below is a compressed operating layer on top of it.
- **Positioning (PRD §1, §6):** White-label institutional workflow platform above HydraX's regulated tokenisation, trading, and custody rails. Canton-aligned, privacy-preserving, multi-party.
- **NOT building:** competing exchange, custody system, tokenisation protocol, retail trading app, DeFi frontend.
- **First wedge (PRD §23):** institutional onboarding + issuance + subscription servicing workspace for tokenized products.

## Current Repo State

- [index.html](index.html), [app.js](app.js), [styles.css](styles.css) — static HTML/JS prototype of the operator console. Reference for UX patterns (orders drill-down, venues panel, workspace persistence). **Not production code.**
- [STATE.yaml](STATE.yaml) — current working slice, verification log. Update on every progress step.
- [docs/](docs/) — PRD, plan, problems, workflow, homework, ideas.
- No backend, no database, no build pipeline yet.

## Target Tech Stack

### Backend (polyglot microservices)

- **Go:** performance-critical core — workflow orchestration, approval chains, audit, HydraX rails adapters, Canton/Daml command + event bridge.
- **Node.js + TypeScript:** notification service, integration adapters (KYC/KYB, SSO, email, CRM), BFF for React portals.

### Frontend

- **React + TypeScript + Redux Toolkit** (RTK + RTK Query for server state).
- **Vite** for build.
- Separate role-aware shells: `issuer-portal`, `distributor-portal`, `investor-portal`, `ops-console`, `admin`.
- White-label theming via CSS variables + tenant config injected at runtime.
- **Icons: lucide-react only. No emoji in UI.**

### Data

- **PostgreSQL:** tenants, users, roles, workflow definitions, approval state, audit log, relational lookups, reporting read models.
- **MongoDB:** flexible tenant-configurable payloads, workflow state projections, document metadata, notification envelopes.

### Deploy

- **Railway:** one service per Go/Node binary, React apps as static sites, Postgres + Mongo as addons. Env per stage (dev/staging/prod).

## Target Repo Layout

```
hydrax-app/
  services/
    workflow-svc/         # Go — orchestration, state machines, SLA tracking
    approval-svc/         # Go — approval chains, escalations
    audit-svc/            # Go — action log, evidence trail
    hydrax-adapter/       # Go — HydraX rails integration
    canton-adapter/       # Go — Daml command/event bridge
    notify-svc/           # Node/TS — email, in-app, webhook
    integration-svc/      # Node/TS — KYC, SSO, CRM
    bff/                  # Node/TS — aggregates services for React
  web/
    apps/
      issuer-portal/
      distributor-portal/
      investor-portal/
      ops-console/
      admin/
    packages/
      ui/                 # shared components, lucide icons
      tenant-theme/       # white-label theming primitives
      api-client/         # RTK Query generated from BFF OpenAPI
  db/
    postgres/migrations/
    mongo/schemas/
  docs/
    prd.md                # authoritative
    plans/YYYY-MM-DD-*.md
    env.md                # every env var documented
```

## Architecture Principles (PRD §10, §13)

- Not a generic blockchain app. Privacy-preserving multi-party workflow platform.
- **HydraX = rails.** This app = workflow + experience + orchestration layer.
- Ledger access only through backend adapters. Browser never calls Daml/HydraX directly.
- Web2 owns: authN/SSO, UI, documents, notifications, reporting, CRM integrations.
- Web3/shared ledger owns: shared business truth, controlled state transitions, multi-party lifecycle coordination.
- Role-based disclosure and tenant isolation from day one. Least-privilege default.
- Single-synchronizer Canton design until multi-domain is justified (PRD §15).

## MVP Scope (PRD §18)

**In:** tenant framework, issuer workbench, distributor portal, investor portal, ops console, onboarding, product setup + launch tracking, subscription workflow, approvals + exceptions, notifications + audit, HydraX integration.

**Out:** secondary market UX, portfolio analytics, full RM dashboard, advanced token econ tooling, generalized multi-domain workflow engine, public API marketplace.

## Commit Discipline

- Conventional commits: `feat(scope): <observable outcome>` — lead with outcome, not mechanism.
- One concern per commit. Infra/tooling never ride with product.
- Hard cap: 15 files per commit unless purely generated (migrations, lockfiles, OpenAPI specs).
- Phased features ship one commit per layer: migration → schema → service → route → client → UI → copy.
- No drive-by fixes. Log them as follow-ups in STATE.yaml.

## Verification Gates (non-negotiable before commit)

- Go services: `go vet ./...` + `go test ./...` green on touched packages.
- TS services / frontend: `pnpm typecheck` + `pnpm test` + `pnpm build` green.
- DB migrations: reversible, dry-run on empty + seeded fixture.
- After every change run the smallest check that proves correctness. No "should work" claims.

## Railway Rules

- One Railway service per deployable (each Go binary, each Node service, each React app as static site).
- Postgres + Mongo via Railway addons; `DATABASE_URL` + `MONGODB_URI` injected per service env.
- `.env` never committed. Every var documented in [docs/env.md](docs/env.md).
- Deploy with `railway up --detach` from the linked service root. Record build id + commit sha in STATE.yaml `verification_log`.

## Operating Rules

- Read [docs/prd.md](docs/prd.md) before scoping any new module. The PRD is load-bearing.
- Any work >3 files or >150 LOC requires a plan doc at `docs/plans/YYYY-MM-DD-<slug>.md` before coding. Cite it in the commit.
- Update [STATE.yaml](STATE.yaml) on every progress step: `current_focus`, `recently_verified`, `next_actions`, `verification_log`.
- No emoji in code, UI, commits, or logs. Lucide icons only in UI.
- No new dependencies, refactors, or destructive actions without explicit approval.
- Never push a broken build. Never deploy without local build + typecheck passing.

## Agents (workspace-inherited)

planner, architect, tdd-guide, code-reviewer, typescript-reviewer, security-reviewer, database-reviewer, build-error-resolver, e2e-runner, refactor-cleaner, doc-updater, feature-dev.

## Required Skills (always invoke)

Non-negotiable. Invoke before the corresponding work starts:

- `/superpowers:writing-plans` — before any non-trivial work (>3 files or >150 LOC, or any new slice). Produces the `docs/plans/YYYY-MM-DD-<slug>.md` required by Operating Rules.
- `/frontend-design` — for every UI/frontend slice. Enforces production-grade output and overrides default generic patterns. Use for new components, layout changes, and visual passes on the prototype or v1 portals.
- `/taste-skill` — pair with `/frontend-design` on UI work. Senior UI/UX engineer framing; overrides default LLM aesthetic biases and enforces component rigor.
- `/design-system` — for work that touches shared primitives, tenant theming, or cross-portal consistency. Use to generate or audit the design system before shipping reusable components.
- `/nano-banana` — for all background image generation (hero backgrounds, empty-state art, tenant theming imagery). Do not use stock images, gradients-as-substitute, or inline SVG placeholders when a generated asset is needed.

## Open Questions — Resolve Before Design (PRD §22)

1. HydraX API surface available for workflow-layer integration?
2. Which workflow objects live as Daml contracts vs off-ledger read models?
3. First target product type: fund, structured product, private credit, treasury, or equity-linked?
4. First tenant persona: issuer, distributor, or market operator?
5. Deployment model: managed platform, dedicated tenant instances, or hybrid?
6. Institutional identity / entitlement standards to support first?
7. When does multi-domain Canton become necessary?

## Past Mistakes

(empty — log dated entries with verification step when they happen)
