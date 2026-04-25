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

## Prototype — How to Work on It Today

Until `services/` and `web/apps/` exist, the three-file prototype is the only runnable surface. Treat it as the verification target.

**Preview:**
```bash
python3 -m http.server 8000   # then open http://localhost:8000
# or just open index.html directly in a browser
```

**Verification (run after every edit — these are the smallest correctness proofs):**
- `node --check app.js` — syntax check, must pass.
- `getElementById` ↔ HTML `id=` audit — every `document.getElementById("x")` in [app.js](app.js) must have a matching `id="x"` in [index.html](index.html). Zero misses.
- CSS class audit — every class referenced in [index.html](index.html) or added via [app.js](app.js) must be declared in [styles.css](styles.css).
- `wc -l index.html app.js styles.css` — record counts in [STATE.yaml](STATE.yaml) `verification_log`.
- `git diff --stat` — confirm only the expected files changed (prototype work touches exactly those three + STATE.yaml).

**Gotchas:**
- LocalStorage keys are versioned: `hydrax.workspace.v1` ([app.js:248](app.js#L248)) and `hydrax.activity.v1` ([app.js:490](app.js#L490)). If you change the persisted shape, **bump the `.v1` suffix** — do not silently break users with stale state.
- All three prototype files change together for any interactive slice (HTML ids + JS handlers + CSS classes). A commit that touches one or two without the other is almost always incomplete.
- Go/TS verification gates below apply once those services exist. For prototype work, the five checks above are the gate.

**STATE.yaml `verification_log` entry format** (match what's already there):
`YYYY-MM-DD — <slice>: node --check app.js passes; <id audit result>; <css audit result>; wc -l index.html=N app.js=N styles.css=N; git diff --stat confirms N code files changed`

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

## Workflow Companions (use when triggered)

Installed at user-level from `naimkatiman/continuous-improvement`. Optional — invoke only when the trigger fires, not on every task.

- `/proceed-with-claude-recommendation` — walk a recommendation list top-to-bottom under the 7 Laws. Triggers: `/proceed-with-claude-recommendation`, "proceed with your recommendation", "do all of it", "all of them", "yes do it". Stops on `needs-approval` items (deploy, force-push, DB drop, secret change) even if other items are `safe`. Honors scope cues like "just the first one".
- `/workspace-surface-audit` — pre-flight environment scan. Run first-time or when a recommendation list references tools/plugins/MCP servers not obviously present in the repo.
- `/planning-with-files` — persistent `docs/plans/` workflow (task_plan + findings + progress). Complements `/superpowers:writing-plans`.
- `/continuous-improvement` — on-demand reflection + instinct analysis. Run after significant work; not every session.
- `/dashboard` — visual instinct health + observation stats.
- `/discipline` — quick-reference card for the 7 Laws.
- `/ralph` — autonomous multi-iteration loop for PRD-sized work. Requires explicit authorization; incompatible with small reversible slices.
- `/superpowers` — framework companion. Prefer the namespaced `superpowers:*` plugin skills (writing-plans, brainstorming, verification) for specific workflow stages.

## Decisions (Recent)

- **2026-04-25 — Market data source for prototype + v1.** Binance public REST/WS for crypto, and the existing `market-data-hub` Railway service (Twelve Data via Redis) for forex + commodities. Mirrors the dual-source pattern already proven in TradeClaw `web`. Plan: [docs/plans/2026-04-25-market-data-adapter.md](docs/plans/2026-04-25-market-data-adapter.md). Hydrax-app consumes the hub via `MARKET_DATA_HUB_URL`; Binance public market endpoints require no key (optional `BINANCE_API_KEY` only for higher rate limits).
- **2026-04-25 — PRD-v2 §14 Q1 (HydraX rails) deferred-not-resolved for v1.** Real workflow-layer integration with HydraX tokenisation, custody, and trading rails waits on HydraX engagement providing the API surface. v1 stands up `services/hydrax-adapter` (Go) as a mock behind a stable interface so the workflow stack ships without blocking on Q1. Q1 is scoped around, not closed.
- **2026-04-25 — Q3 default proposal: short-duration credit (institutional, 30–180d tenor).** Autonomous proposal under auto mode, pending user confirmation. Plan: [docs/plans/2026-04-25-q3-default-short-duration-credit.md](docs/plans/2026-04-25-q3-default-short-duration-credit.md). Override with `Q3: <other>` (MMF, treasury-equivalent, equity-linked, etc.).
- **2026-04-25 — Backend services scaffold landed (Item C).** Eight services under `services/` (5 Go, 3 Node/TS) on stable ports 7001-7005 + 7101-7103, each with `/healthz` + 1 test + Dockerfile. `go.work` ties Go modules; `pnpm-workspace.yaml` ties Node services. Smoke script at `scripts/` validates 8-port runtime. Plan: [docs/plans/2026-04-25-backend-services-scaffold.md](docs/plans/2026-04-25-backend-services-scaffold.md). Web monorepo plan ready at [docs/plans/2026-04-25-web-monorepo-scaffold.md](docs/plans/2026-04-25-web-monorepo-scaffold.md), execution still gated.

## Open Questions — Resolve Before Design (PRD-v2 §14)

1. HydraX API surface available for workflow-layer integration? *(v1: deferred-not-resolved — see Decisions (Recent); `services/hydrax-adapter` mocked behind interface.)*
2. Which workflow objects live as Daml contracts vs off-ledger read models?
3. First target product type: fund, structured product, private credit, treasury, or equity-linked?
4. First tenant persona: issuer, distributor, or market operator?
5. Deployment model: managed platform, dedicated tenant instances, or hybrid?
6. Institutional identity / entitlement standards to support first?
7. When does multi-domain Canton become necessary?

## Web Monorepo — Invariants

Locked by [docs/plans/2026-04-25-web-monorepo-scaffold.md](docs/plans/2026-04-25-web-monorepo-scaffold.md). Do not relitigate without a new plan doc.

- pnpm 9 workspace at the repo root. Workspaces: `services/{notify-svc,integration-svc,bff}` (Node), `web/packages/*` (3 packages), `web/apps/*` (5 apps). Lockfile is `pnpm-lock.yaml`. `package-lock.json` is dead history kept for now; do not add npm-managed deps to it.
- Two TypeScript bases. **Do not merge them.**
  - `tsconfig.base.json` — Node-shaped (`module: NodeNext`, `types: ["node"]`, `lib: ["ES2022"]`). Used by `services/{notify-svc,integration-svc,bff}/tsconfig.json`.
  - `tsconfig.web.json` — Browser-shaped (`module: ESNext`, `moduleResolution: Bundler`, `jsx: react-jsx`, `lib: ["ES2022","DOM","DOM.Iterable"]`, `types: []`). Used by everything under `web/`.
- Apps: Vite 5 + React 18 + RTK + react-router-dom 6 + vitest. No Tailwind, no Next, no Turbo. App `tsconfig.json` adds `"types": ["vite/client"]` for `import.meta.env` typing.
- `@hydrax/ui` ships UI primitives. Icons are `lucide-react` only, wrapped in `<Icon icon=… label=… />` (a11y `aria-label` is mandatory). **No emoji in JSX.** Lucide `MonitorCog` does NOT exist in v0.378.0 — ops-console uses `Settings` (gear).
- Tenant theming is CSS variables on `:root` written by `<ThemeProvider>` from `@hydrax/tenant-theme`. New tokens land in `TenantThemeTokens` first, then `applyTheme`'s map, then consumers.
- `@hydrax/api-client` is the only place that reads BFF URLs. Env var: `VITE_BFF_URL` (see [docs/env.md](docs/env.md)). Default `http://localhost:8080`. `api-client/tsconfig.json` carries `"types": ["node"]` to allow `process.env` fallback for tests.
- Apps depend on packages via `workspace:*`. Apps never import another app.
- vitest with `globals: false` requires explicit `afterEach(cleanup)` in `src/test-setup.ts` for any web workspace that uses `@testing-library/react`. The 7-line setup file shape is consistent across `tenant-theme`, `ui`, and the 5 apps.
- Per-app dev ports are reserved: issuer-portal 5173, distributor-portal 5174, investor-portal 5175, ops-console 5176, admin 5177.
- Verification gates (mandatory before commit on any web workspace): `pnpm -r --if-present typecheck`, `pnpm -r --if-present test -- --run`, `pnpm -r --if-present build`. Three green or no commit. Note the `--` separator before `--run` (pnpm intercepts a bare `--run`).
- Visual polish is out of scope for the scaffold. Real layouts, real colors, hero imagery land under separate plans invoked through `frontend-design` + `taste-skill` + `design-system` + `nano-banana`.
- Token surface (added 2026-04-25 visual-polish): `TenantThemeTokens` carries 41 tokens covering color (12), typography (display/h1/h2/body/bodySm/mono = 14), spacing (xs/sm/md/lg/xl/2xl + spaceUnit = 7), shadow (sm/md), motion (fast/medium/easeOut), plus 3 semantic colors (text-strong, bg-raised, focus-ring). New tokens land in `TenantThemeTokens` first, then `TOKEN_TO_CSS_VAR` in `applyTheme`, then consumers — never read `--hydrax-*` vars from a CSS file that did not extend the type registry.
- `@hydrax/ui` primitives extended (visual-polish, 2026-04-25): `Stack`, `Heading`, `Text`, `Skeleton`, `EmptyState`, `NavItem`, `Avatar` in addition to the original `Icon`, `Button`, `Card`, `AppShell`. Apps consume these directly; no app re-implements layout or typography primitives. Skeleton's shimmer `@keyframes hydrax-skeleton-shimmer` is mounted globally inside `<AppShell>`'s `<style>` tag — components that use `Skeleton` outside an AppShell must inject the keyframes themselves.
- `<AppShell>` slots (visual-polish, 2026-04-25): `brand` (sidebar header, 56px aligned to topbar), `topbar` (`<header role="banner">`), `sidebar` (`<nav>` body), `sidebarFooter` (optional bottom-pinned slot), `children` (`<main>`). `appName` and `children` mandatory, the rest optional. Sidebar renders if EITHER `brand` OR `sidebar` is provided.
- Hero / empty-state imagery comes from `web/packages/ui/src/assets/` and must be generated via `nano-banana` with provenance recorded in `assets-meta.json`. No stock images, no decorative gradients-as-substitute, no inline SVG placeholders for spaces that warrant real imagery. Note: nano-banana returns JPEG by default for photographic/illustrative content; that is fine — accept whatever format Gemini emits and adjust import paths accordingly. Apps reach the asset via a relative path (`../../../../packages/ui/src/assets/<file>`) because `@hydrax/ui`'s `package.json` `exports` only declares `./dist/index.js`; do not change the package's exports map just to support an asset path.
- Hero asset inventory (visual-polish + portal-polish, 2026-04-25): `issuer-empty-state.jpg`, `distributor-empty-state.jpg`, `ops-console-empty-state.jpg`, `admin-empty-state.jpg`. Each has a metadata entry in `assets-meta.json` with prompt + tool + dimensions; `assets.test.ts` asserts every shipped hero is registered with the correct `consumed_by` portal pointer. The polished baseline is now uniform across four of five portals — issuer-portal, distributor-portal, ops-console, and admin each ship a `<Brand>Sidebar` (NavItem-driven, 6–7 NAV items), `<Brand>TopBar` (search placeholder + notifications button + Avatar-with-name), and `routes/HomeRoute.tsx` (`Heading` + intro + 3 stat tiles + EmptyState backed by their hero JPEG). Investor-portal's Home is the upstream-health grid (`/healthz/composite` against bff) and intentionally does not follow the stat-tiles + EmptyState shape. Test count when this baseline landed: ui 40, distributor 8, admin 8, ops 8, issuer 15, investor 5 (total 84 web tests).
- AppShell `<header>` collision (visual-polish, 2026-04-25): `<AppShell>` renders the topbar slot as `<header role="banner">`. `<Card title=…>` also renders an internal `<header>` for the title — this gets the implicit `banner` role too because it is not nested inside an `<aside>` / `<main>` / `<nav>` / `<section>` / `<article>` element when the Card sits at the route root. Tests must use `getAllByRole("banner")` not `getByRole("banner")` when a route renders both an `AppShell` topbar and a `Card title`. The single-match form throws `Found multiple elements with the role "banner"`.

## Past Mistakes

- **2026-04-24 — Commit-message mismatch from stale auto-context.** Commit `78888d3` was titled `feat(ui): persist activity log across sessions with Clear Log action` but the actual file diff shipped sortable-table-columns work. Root cause: assistant read STATE.yaml from session-start auto-context describing the prior slice, then wrote a commit message off that stale summary without running `git diff --stat` against the actual working tree first. **Prevention:** before drafting any commit message, run `git diff --stat` and skim each file's diff. Do not trust STATE.yaml's `summary` field as authoritative for what the current working tree contains.
- **2026-04-25 — Permission system blocks toolchain installs by default.** Curl-piped installers from any domain not on the trusted-bootstrap list require explicit per-domain user approval phrased as `install <pkg> <version> from <domain> — approved` (verbatim). Generic "continue" / urgency cues are NOT authorization. `sudo apt-get` is treated as scope escalation; prefer user-local installs (`~/.daml/`, `~/.java/`, `~/.local/`) which avoid the system-wide approval gate. Daml + Java JRE both went in user-local this way; see [docs/env.md](docs/env.md).
- **2026-04-25 — Working tree mutates between Bash calls in multi-agent sessions.** Parallel agents/sessions can modify files while the main session works. Pattern: never `git add -A` or `git commit -a`; always `git add <specific files>` to stage only your own work. If `M` flags appear on files outside your scope, run `git update-index --refresh` to clear stat-cache phantoms; if real, leave them alone. STATE.yaml is especially prone to concurrent edits — append `verification_log` lines instead of overwriting `current_focus`.
- **2026-04-25 — Go 1.26 + go.work workspace pattern: `go test ./...` from repo root fails.** With `go.work` referencing `./services/<svc>` paths and no Go module at the repo root, Go 1.26 errors with `directory prefix . does not contain modules listed in go.work`. Workaround: per-service invocation, e.g. `for s in workflow-svc approval-svc audit-svc hydrax-adapter canton-adapter; do (cd services/$s && go vet ./... && go test ./...); done`. Smoke script at [scripts/](scripts/) handles the multi-port runtime check. Verification gate above ("Go services: `go vet ./...` + `go test ./...`") therefore means *per-service*, not workspace-wide.
- **2026-04-25 — Re-invoking `/proceed-with-claude-recommendation` does not pass authorization.** When a `needs-approval` item halts the loop (e.g., toolchain install denied), re-invoking the same command re-runs the skill from Phase 1 and hits the same halt. The skill's own Red Flags list this explicitly: "user pressing the button five times" is the `urgency-as-authorization` antipattern. Unblock with the specific authorization phrase named in the halt message, not by re-invoking.
- **2026-04-25 — Web scaffold Phases 5-8 shipped 8 commits where the plan called for 4.** A subagent-driven implementer scaffolded distributor-portal, investor-portal, ops-console, and admin from the issuer-portal template, then noticed each `App.test.tsx` had a stale `data-app-name='issuer-portal'` string in the test description (the assertion itself was correct, so tests passed on first run). The implementer made one extra cosmetic commit per app to fix the description string. Root cause: the substitution table in the dispatch prompt did not call out the test description string explicitly — only the assertion. **Prevention:** when dispatching a template-substitution implementer, enumerate every textual occurrence to substitute, including descriptions, JSDoc, comments, and any `it("name", …)` / `describe("name", …)` strings — not just code lines. The work was correct, but the rule "ONE commit per app" was violated.
- **2026-04-25 — `import.meta.env` precedence over `process.env` for Vite-bundled web packages.** `@hydrax/api-client` originally read `process.env.VITE_BFF_URL` first. In Vite browser bundles, `process` is undefined, so the guard always short-circuited and BFF_URL fell back to `http://localhost:8080` — meaning the Railway env var was never read in deployed apps. Found in final code review. Fix at commit `74b206b`: read `import.meta.env.VITE_BFF_URL` first (Vite replaces it at build time), then `process.env.VITE_BFF_URL` for Node tests, then localhost. **Rule:** in any web/ package that reads runtime config, prefer `import.meta.env` over `process.env`. Reverse order is a silent prod bug.
- **2026-04-25 — Path-scoped `git add` doesn't unstage unrelated index entries.** Admin-portal subagent ran `git add web/apps/admin/` then `git commit -m …` and the resulting commit `78da9a4` bundled four issuer-portal files (`App.tsx`, `IssuerSidebar.tsx`, `ProductDetailRoute.tsx`, `ProductDetailRoute.test.tsx`) from a parallel session that had staged them between the implementer's preceding `git status` check and the commit. Path-scoped `git add` only adds; it does not clear pre-existing index entries. **Prevention:** before every commit, run `git diff --cached --name-only` and reconcile against the task scope; if any unrelated paths show up, `git restore --staged <path>` to unstage them. The "always specific files" rule from the prior past-mistake is necessary but not sufficient — concurrent staging by another session is the new failure mode.
