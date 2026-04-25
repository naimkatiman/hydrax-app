# Q3 Default Proposal — Short-Duration Credit as the First Tokenized Product

> **Status:** DEFAULT PROPOSAL written autonomously under auto mode. Easily overridable — reply with any of `MMF`, `treasury-equivalent`, `equity-linked`, `private-credit-3yr+`, or a different product entirely, and I'll replace this doc.
>
> **Not a build plan.** This is a Q3 resolution proposal that downstream plans (BFF, portals, workflow services, hydrax-adapter mock) will key off. No code is implied.

- **Date:** 2026-04-25
- **Resolves:** PRD-v2 §14 Q3 — first product template
- **Gated:** does NOT bypass Item C. Item C scaffolding still needs explicit user approval.
- **Parent docs:** [docs/prd.md](../prd.md) §5/§7/§18, [docs/prd-v2.md](../prd-v2.md) §11/§14
- **Skill lineage:** `/proceed-with-claude-recommendation` autonomous Q3 default

---

## 1. The proposal in one sentence

The first tokenized product hydrax-app templates against is a **short-duration secured credit note** (target tenor 30–180 days, single-issuer originated, distributed through one or more institutional placement agents to qualified investors).

## 2. Why this default

Five reasons, ranked:

1. **Lowest tokenization complexity per dollar of business value.** Cash flows are linear (principal + interest at maturity). No daily NAV, no constituents to rebalance, no derivative legs. The token contract is "claim on a fixed-payment instrument." Daml `GovernanceProposal` extends naturally to a `CreditNote` template carrying issuer/coupon/maturity.
2. **Strongest institutional pull right now.** Treasuries, family offices, and corporate cash desks are the loudest buyers of tokenized short-duration credit (Ondo, Maple, Ostium, Centrifuge all target this segment). Distributor partners (private banks, wealth platforms) already have allocation mandates in this space.
3. **Compliance surface is tractable.** Reg D 506(c) / Reg S structures are well-understood. Eligibility = qualified institutional buyer (QIB) or accredited entity, easy to encode as boolean flags on the investor entity model.
4. **Operational lifecycle fits the prototype's UX patterns.** Subscription → allocation → settlement → coupon (if any) → maturity redemption maps cleanly onto the Orders/Positions/Risk drill-downs the prototype already implements.
5. **Defensive against PRD-v2 §15 deferral.** Single-synchronizer Canton handles single-issuer/single-distributor flows without reassignment. MMFs and equity-linked products would push us toward multi-domain faster.

## 3. What "short-duration credit" looks like, concretely

| Attribute | Default value |
|---|---|
| Issuer type | Single corporate or financial institution per note |
| Tenor | 30 / 60 / 90 / 180 days (issuer chooses at launch) |
| Coupon | Discount-to-par (zero coupon) for 30–90d; fixed coupon at maturity for 180d |
| Minimum subscription | USD 100,000 (institutional / QIB threshold) |
| Settlement | T+1 against on-chain stablecoin or bank wire confirmation |
| Redemption | At maturity only — no early redemption in v1 |
| Investor universe | Institutional + accredited entities, KYB-verified |
| Distribution | One or more placement agents per note (issuer can pre-allocate or open-book) |
| Servicing events | (a) subscription confirmed (b) allocation finalized (c) maturity payment |

## 4. Workflow lifecycle (operator-perspective)

```
[Issuer Workbench]
   ├─ create note (terms, parties, eligibility rules)
   ├─ route to internal approval (compliance + treasury sign-off)
   └─ launch → status: open

[Distributor Portal]
   ├─ see eligible notes per their entitlement
   ├─ onboard / refresh investor KYB
   └─ submit subscription requests

[Investor Portal]
   ├─ view eligible notes
   ├─ submit subscription
   └─ view holdings + servicing notices

[Operations Console]
   ├─ approve subscriptions (KYB + sanctions check passed?)
   ├─ allocate per pre-agreed rules or manual override
   ├─ confirm settlement (HydraX rails event ingest, currently mocked)
   └─ trigger maturity redemption when matured

[Audit]
   └─ every transition recorded with party, timestamp, evidence link
```

Each lifecycle state is a `ProposalStatus`-style enum on the `CreditNote` Daml template (extending the spike at [services/canton-adapter/daml/hydrax-governance/](../../services/canton-adapter/daml/hydrax-governance/)).

## 5. Party model (extends PRD §5 with concrete labels)

| PRD persona | Concrete v1 role | Daml party? |
|---|---|---|
| Issuer | Corporate treasury or finance-arm of a regulated bank | yes — signatory on note creation |
| Distributor | Placement agent (private bank, broker-dealer) | yes — observer + subscription submitter |
| Investor (entity) | QIB / accredited institutional buyer | yes — observer of own positions |
| Custodian | HydraX or bank custodian | mocked via `services/hydrax-adapter`; no Daml party in v1 |
| Operations | hydrax-app tenant ops team | yes — controller on approval/exception choices |
| Compliance | Tenant compliance reviewer | controller on KYB+sanctions approvals |

Investor authorized users (individuals acting on behalf of an investor entity) live in Postgres `users` keyed by entity, NOT as Daml parties. PRD §13 stance: "Web2 owns authN/SSO."

## 6. Data model split (Postgres vs Mongo vs ledger)

| Lives where | What |
|---|---|
| **Daml ledger** | `CreditNote` template, lifecycle status, signatories/observers, approval state. Source of truth for "did this note exist, who approved, what's the current state." |
| **Postgres** | Tenants, users, roles, entity profiles, KYB documents metadata, audit log indexes, reporting read models. Source of truth for everything Web2 owns. |
| **Mongo** | Note configuration payloads (terms, eligibility rules, distribution allowlists), notification envelopes, evidence document blobs. Source of truth for flexible/tenant-configurable data. |

Postgres-Mongo line: structured + queryable + relational → Postgres; tenant-configurable + variable shape → Mongo.

## 7. HydraX rails dependencies (deferred per CLAUDE.md Decisions)

The CreditNote workflow needs HydraX for:
- Token issuance (mint at launch, burn at maturity)
- Custody confirmation (settlement events)
- Optional secondary-market lifecycle (out of v1 scope)

**v1 plan:** mock all of these behind `services/hydrax-adapter` per CLAUDE.md Decisions (Recent). The mock returns deterministic stub responses; real wiring waits on HydraX engagement.

## 8. Out of scope for "first tokenized product"

- Multi-issuer or pooled-issuer notes (think portfolio of small-business loans)
- Variable-rate / floating-coupon instruments
- Secondary market trading (initial-issuance + maturity only in v1)
- Multi-currency notes (USD only in v1)
- Investor self-service KYB (must be tenant-mediated for v1)
- Auto-rollover at maturity (manual rollover only)

## 9. Open questions surfaced by this default

These do NOT block writing this proposal but DO need answers before downstream plans (BFF, portals, workflow-svc) can scaffold:

- **A.** Does the first tenant want to issue, distribute, or both? (Q4 dependency.)
- **B.** Stablecoin settlement vs bank-wire-only for v1? Bank-wire is simpler for compliance; stablecoin is more on-brand for tokenization.
- **C.** Do we need to model coupon-paying notes in v1, or is zero-coupon discount-to-par sufficient as a starting product? Zero-coupon is materially simpler.
- **D.** What's the minimum-viable KYB doc set per investor entity? Prototype assumes "one PDF + one pass/fail flag"; real KYB is multi-document.

## 10. How to override this default

Reply with any of:

- `Q3: MMF` — first product is a money-market fund instead. Different lifecycle (daily NAV, redemption windows, basket rebalancing). I rewrite this doc.
- `Q3: treasury-equivalent` — short-term Treasury-bill-equivalent, different regulatory treatment.
- `Q3: equity-linked` — structured product with underlying equity exposure. More complex Daml model.
- `Q3: private-credit-3yr+` — long-tenor private credit. Adds early-redemption windows, NAV, rolling reporting.
- `Q3: <free text>` — describe the product in one paragraph and I rewrite.

Or accept this default by replying `Q3: confirmed` (or proceeding without objection on the next /proceed pass).

---

## 11. What this unblocks

If accepted as-is, this default lets the following plans get drafted (still gated on Item C for execution):

- `services/hydrax-adapter/` mock interface — the CreditNote-shaped methods are the surface area
- `services/workflow-svc/` lifecycle state machine — the 6 lifecycle states above are the FSM
- `services/audit-svc/` evidence trail — the transition events from §4 are what gets logged
- BFF + issuer-portal scaffolding — the issuer workbench surface from §4 is the UI contract
- Postgres migrations — the data-model split in §6 is the schema starting point

Q4 (first tenant persona) and Q7 (pricing) still need separate defaults to be proposed or chosen. Tell me to draft those next, or override Q3 first.
