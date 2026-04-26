# Canton Network — Homework Submission

**Naim Katiman · April 2026**

> Canton owns the rails. The interesting work is the layer above.

**Live:** https://hydrax-context-production.up.railway.app — single-URL presentation: cover article + 14-slide homework deck + 5-minute script + live multi-portal demo + public source.

This is a single-page index for the homework. The substantive material lives in three artifacts and a working prototype:

| Artifact | What it is |
|---|---|
| [docs/demo/canton-homework-deck.html](docs/demo/canton-homework-deck.html) | **Primary deck** — 14 slides structured to answer the homework's three sections (§1 Conceptual Overview, §2 Building on Canton, §3 Technical Deep Dive). Deployed at `hydrax-context/deck`. |
| [docs/demo/canton-interview.html](docs/demo/canton-interview.html) | Alternate deck — 9-slide architecture-positioning narrative (slide-0 cover → slide-8 trade-offs). The earlier framing, kept for reference. |
| [docs/demo/script-5min.md](docs/demo/script-5min.md) | 5-minute walkthrough script + [shot-list.md](docs/demo/shot-list.md) |
| [docs/prd.md](docs/prd.md) | 24-section PRD for the platform built above the rails |
| [hydrax-app/](hydrax-app/) repo | 8 backend services + 5 white-label portals; the "build above Canton" answer expressed as code, not prose |

The rest of this document is original argument — the deck shows the model, this explains *why* I chose that model.

---

## 1. Conceptual Overview

Canton is best understood not as a blockchain, but as **a privacy-preserving synchronisation protocol for multi-party workflows in regulated markets**. Public chains optimise for shared visibility and permissionless composition; traditional permissioned DLT optimises for control but fragments interoperability. Canton sits in the gap: independent participants run their own nodes, hold only the contracts they are entitled to see, and coordinate state changes through synchronisers that order transactions without seeing their contents.

Three primitives are load-bearing — see [slide-2](docs/demo/canton-interview.html) ("Canton in three primitives"):

1. **Participant nodes** — one per organisation, holding only that org's view of contracts.
2. **Synchronisers** — order and finalise multi-party transactions without seeing contract payload. Trust is contractual, not custodial.
3. **Daml contracts** — declare which parties are stakeholders on which contract, so privacy is a first-class property of the data model, not a network policy.

The four-layer wiring is laid out in [slide-3](docs/demo/canton-interview.html) ("How Canton is wired"): apps → participant nodes → synchronisers → ledger. The point that earns the architecture is **selective disclosure with global coordination** — you get a shared truth without forcing every participant into a globally readable state.

**Differences worth naming:**
- vs. **Ethereum / public L1s:** no shared mempool, no global state read, no token-incentivised consensus. Composability is by signed Daml choices across consenting parties, not by anyone-can-call.
- vs. **traditional permissioned DLT (Fabric, Corda, Quorum):** Canton's privacy model isn't "channel-based isolation" or "need-to-know broadcasts". Privacy is a property of each contract's stakeholder set, which means the same workflow can span domains with different privacy boundaries without re-architecting.

## 2. Building on Canton — How I Approached It

The brief's strongest signal: *don't write fluff about "secure APIs and best practices" — describe what you would actually build*. So I built it.

The premise (see [slide-1](docs/demo/canton-interview.html) "the thesis"): institutions don't need another ledger primitive — they need the **workflow, identity, approval, audit, notification, and integration layer** that turns a Daml contract into something an issuer, distributor, custodian, ops team, and investor can actually operate. That's the wedge. HydraX has the rails (tokenisation, custody, trading, regulatory licences in MY/SG); the unmet need is the operational platform above them.

[Slide-5](docs/demo/canton-interview.html) splits this into **three planes**:

- **Experience plane** — five role-aware white-label React portals (issuer, distributor, investor, ops, admin). Tenant theming via CSS variables. Lives in [web/apps/](web/apps/) + [web/packages/](web/packages/).
- **Orchestration plane** — Go services for workflow, approvals, audit; Node services for notify, integrate, BFF aggregation. Lives in [services/](services/) (8 services, stable ports 7001–7005 + 7101–7103, each with `/healthz` + tests + Dockerfile).
- **Rails plane** — `hydrax-adapter` and `canton-adapter` Go services as the only path the browser ever takes to the ledger. Today the HydraX adapter is mocked behind a stable interface (a deliberate deferral — see §3 below).

[Slide-6](docs/demo/canton-interview.html) traces a single subscription workflow end-to-end: investor portal submits intent → orchestration plane runs the approval chain → adapter commits a Daml choice → audit + notify fire → portals re-render off the read model. This is the demo path; the [5-min script](docs/demo/script-5min.md) walks it on screen.

**Practical assumptions baked into the design** (these are what I'd defend in interview):
- **Single-synchroniser to start** ([PRD §15](docs/prd.md)). Multi-domain Canton is real complexity for a real benefit; we don't pay it until a tenant needs cross-domain composition.
- **Web2 owns identity, UI, documents, notifications, reporting**. Web3 owns shared truth and controlled state transitions. The boundary is non-negotiable — see [slide-4](docs/demo/canton-interview.html) "Where Canton stops vs what the app must do".
- **Browser never touches Daml directly.** All ledger I/O goes through Go adapters with audit on the way in and event-stream projections on the way out.
- **Tenant isolation and role-based disclosure from day one**, not retrofitted. The portal shells are role-aware shells, not the same SPA with feature flags.
- **First wedge is narrow on purpose** ([PRD §23](docs/prd.md)): institutional onboarding + product issuance + subscription servicing. Not secondary market, not portfolio analytics, not a generalised workflow engine.

## 3. Technical Deep Dive — Three Areas I Care About

### A. Privacy ↔ composability trade-off

[Slide-4](docs/demo/canton-interview.html) is the core tension. Public chains get composability *because* state is globally readable; that exact property is what disqualifies them for regulated workflows. Canton's contract-level privacy means a custodian doesn't see a competing custodian's positions even on the same domain — but it also means **you cannot compose blindly**. Cross-contract logic requires every relevant party to be a stakeholder on every relevant contract, or it doesn't see them. That's a feature for compliance and a constraint for builders. The implication for application design: **composability moves from the ledger to the orchestration plane**. The workflow service knows which parties to bring onto a contract at issuance time so the right downstream choices are even possible. Get this wrong at modelling time and no amount of UI work fixes it.

### B. Workflow plane as a first-class system, not a wrapper

The default mistake is treating "the app" as a thin wrapper around Daml choices. The reality is that 80% of institutional value lives in **what surrounds the choice**: who approved it, what evidence was attached, which SLA clock is running, what notification fired, what audit row was written. This is why the orchestration plane in [services/](services/) has more services than the rails plane (workflow-svc, approval-svc, audit-svc, notify-svc, integration-svc, bff) and why I refused to fold them into one. Single-purpose services with their own state machines and `/healthz` make the operational story (debugging, scaling, tenant isolation) tractable. A monolith would have been faster to ship and impossible to operate at multi-tenant scale.

### C. Smart contract lifecycle in regulated environments

Daml upgrade paths are real, but the operational question is harder than the technical one. When entitlements change — a distributor loses a licence, a regulator's reporting party rotates — *what happens to in-flight contracts*? The honest answer is: Daml gives you the upgrade primitive (interfaces, package versioning), but you still need (a) a deterministic projection of "what's in flight at cutover", (b) a migration plan per contract template, (c) a fallback for participants who haven't accepted the new package, (d) an audit trail that proves no economic state changed during the swap. [PRD §10–§15](docs/prd.md) is where this becomes concrete; [slide-8](docs/demo/canton-interview.html) frames the deferrals honestly. We don't claim to have solved this — we've architected so that the lifecycle decisions are isolated in the rails-plane adapters, where they belong.

---

## 4. What's Deliberately Not Here

Honesty section. Mirrors [slide-8](docs/demo/canton-interview.html) ("deliberate deferrals") and [PRD §14](docs/prd.md):

- **Real HydraX rails integration** — `hydrax-adapter` is mocked behind a stable interface, waiting on HydraX engagement to share the API surface. The workflow layer is not blocked by this.
- **Multi-domain Canton** — single-synchroniser default; multi-domain when a tenant pays for the complexity.
- **Generalised workflow DSL** — concrete templates for the first wedge (onboarding, issuance, subscription) before any DSL.
- **Secondary market UX, portfolio analytics, advanced token econ tooling** — explicitly out of MVP ([PRD §18](docs/prd.md)).
- **Open product-type questions** — fund vs. structured product vs. private credit vs. treasury still parked in [PRD §14](docs/prd.md). My current default proposal is short-duration credit (30–180d institutional tenor); see [docs/plans/2026-04-25-q3-default-short-duration-credit.md](docs/plans/2026-04-25-q3-default-short-duration-credit.md).

## 5. How I Built This Knowledge

Approach mattered to the brief. My loop:

1. Built the mental model from first principles (rails vs. layer above) before reading docs, so I had questions to *test* against the docs rather than just absorb.
2. Confirmed against Canton + Daml official documentation; used Context7 MCP for current SDK references.
3. Mapped each Canton primitive to a real institutional workflow (subscription, approval chain, audit) before touching code.
4. Built the prototype to expose where the model gets uncomfortable — the deferrals in §4 are exactly the friction points I hit.
5. Wrote the deck last. Drawing the system forced me to defend each box.

If you want the visual + spoken version, [docs/demo/canton-interview.html](docs/demo/canton-interview.html) is 9 slides; the [5-min script](docs/demo/script-5min.md) is what I'd narrate over them.
