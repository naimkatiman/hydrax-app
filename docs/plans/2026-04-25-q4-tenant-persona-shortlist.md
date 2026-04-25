# Q4 Persona Shortlist — First Tenant Design Partner

> **Status:** DRAFT persona shortlist written autonomously under auto mode. **No specific firm names** — naming targets is the user's outreach call. This doc gives the qualifying criteria, three persona archetypes, and an outreach checklist so the user can compress sourcing time.
>
> **Not a build plan.** This is a Q4 unblock artifact. Tenant decision changes workflow-template specificity (PRD-v2 §14 Q4) but does not gate prototype slices or service scaffolding.

- **Date:** 2026-04-25
- **Resolves:** PRD-v2 §14 Q4 — first tenant design partner (named issuer + named distributor committed to v1 as pilot)
- **Depends on:** Q3 default proposal (`docs/plans/2026-04-25-q3-default-short-duration-credit.md`) — short-duration credit narrows the persona universe
- **Skill lineage:** `/proceed-with-claude-recommendation unblock the blockers`

---

## 1. Qualifying criteria for "design partner" (must hit all five)

A tenant qualifies as a v1 design partner only if they meet ALL of:

1. **Already issuing or actively piloting** a tokenised short-duration credit product (or directly comparable instrument). Not "interested in tokenisation" — actually shipping or in pilot.
2. **Has at least one institutional placement agent or distribution partner** they currently subscribe through. We need both sides of the marketplace at v1, not just the issuer.
3. **Willing to commit one named operational person** (not "the team") for weekly working sessions for 8–12 weeks. No design partner without an embedded counterpart.
4. **Pre-agreed to give us evidence** — actual subscription docs (redacted), KYB checklists, current ops runbooks. We design against their reality, not generic best-practice.
5. **Pricing-discussion ready** — willing to discuss Q7 pricing structure before v1 GA, not after. Prevents v1 launching without a commercial story.

If a candidate fails any one, they're a sales prospect, not a design partner. Different stakeholder, different conversation.

## 2. Anti-pattern personas (do NOT design for first)

| Anti-persona | Why not for v1 | Re-engage at |
|---|---|---|
| Crypto-native trading desk wanting "tokenised yield" | Workflow assumptions diverge — they don't have institutional onboarding pain | v2 if we add retail-rails surface |
| Multi-product fund admin running 30+ funds | Workflow variance forces per-tenant customisation in v1 (PRD-v2 §13 risk #5) | v2 once workflow templates are versioned |
| Greenfield issuer with no existing token product | We learn nothing from their status quo; v1 becomes speculative | v1.5 once we have one production tenant |
| Distributor-only with no issuer in their pipeline | Can't close the loop without an issuer counterpart | When they bring one |
| Regulator-adjacent body wanting "transparency" platform | Off-thesis (PRD-v2 §1: this is operator workflow, not regulator reporting) | Never (different product) |

## 3. The three archetypes ranked by v1 fit

### A. Issuer-led pilot (RECOMMENDED for v1)

**Profile.** A regulated issuer who already runs one or two short-duration credit notes manually (email + spreadsheets + portal-of-the-week) and has at least one repeat distributor. Issuance volume small but cadence regular (≥1 issuance per quarter). 5–25 person ops team.

**Why best fit.** Their pain is unambiguous (manual ops bleeds margin every cycle), their workflow is observable (we shadow one full lifecycle), their distributor counterpart is already in place. They control the v1 product spec.

**What they need from us.** End-to-end issuance → subscription → servicing workflow with audit trail. Tenant-themed portals their distributor and investors recognise as "their" platform.

**What we need from them.** Real subscription doc set (redacted), KYB checklist they currently use, named ops lead, willingness to run v1 against one new note (not bet-the-business).

**Decision-maker.** Head of Operations or COO. NOT the head of capital markets (too far upstream) or the CTO (too engineering-flavoured for a workflow conversation).

**Outreach hook.** "We're shipping a workflow control plane above HydraX rails. Looking for one issuer running short-duration credit who'd give us 8 weeks of weekly time in exchange for the platform built around their actual ops runbook. No fee for design-partner phase."

### B. Distributor-led pilot (acceptable but riskier)

**Profile.** A private bank, wealth platform, or family-office group that subscribes its clients into multiple issuers' tokenised products and is feeling the onboarding friction across all of them.

**Why second choice.** Distributor pain is real but issuer-side is the bigger workflow surface. If we design for the distributor first, we'll discover issuer requirements late.

**What they need from us.** Unified investor onboarding + entitlement view across multiple issuers, one portal per investor regardless of which issuer they hold.

**What we need from them.** At least two issuers they actively subscribe through, willing to be looped in. Without that, we're building distributor-only software (off-thesis per PRD-v2 §6).

**Risk.** If their two issuers won't engage, this collapses to single-side software and v1 scope shrinks.

**Decision-maker.** Head of Wealth Operations or Head of Distribution.

### C. Fund-admin-led pilot (worst fit for v1, document why)

**Profile.** A transfer-agent or fund administrator servicing multiple tokenised funds for issuer clients.

**Why worst.** They sit between issuer and distributor and want to bill HydraX as a vendor delivering them efficiency. v1 stops being a control plane and becomes back-office automation. Different product (PRD-v2 §10 anti-pattern).

**Re-engage.** v1.5+ once we have one issuer-led tenant in production and want to scale via fund-admin distribution.

## 4. Sourcing checklist — what the user does next

The user (Naim) does sourcing; this doc reduces sourcing-question count.

- [ ] Pick archetype: A (recommended), B, or C. Default A.
- [ ] List 5–10 candidate firms matching the archetype's profile (private to the user — no need to commit names to repo).
- [ ] For each, run the §1 five-criteria filter. Keep candidates that pass all five.
- [ ] For top 2–3 survivors, draft personalised intro using the §3.A "Outreach hook" pattern.
- [ ] Score replies on: (a) named ops lead committed, (b) ≥1 weekly session for 8 weeks, (c) willingness to share redacted runbooks, (d) Q7 pricing-discussion-ready.
- [ ] Pick one. Pick a backup. Tell us so we narrow workflow templates.
- [ ] Update CLAUDE.md "Decisions (Recent)" with the selected tenant archetype (not necessarily the firm name, if confidentiality matters).

## 5. What changes in the codebase once Q4 is resolved

Concrete deltas that unlock once a tenant archetype is locked:

- **Workflow templates** in `services/workflow-svc/internal/workflow/` get tenant-specific definitions (subscription chain, allocation rules, servicing events) keyed off the tenant's actual runbook.
- **Approval chains** in `services/approval-svc/internal/approvals/` get the right rung count + escalation rules for the tenant's compliance posture.
- **`services/integration-svc`** gets the tenant's actual KYB + SSO providers (vendor selection happens here, see PRD-v2 §14 Q6).
- **Tenant theming** in (future) `web/packages/tenant-theme/` gets the brand tokens.
- **PRD-v2 §14 Q5 (deployment model)** narrows — if the tenant insists on dedicated instance, single-tenant Railway topology; if they're OK shared, multi-tenant.

## 6. What this note does NOT decide

- Q1 (HydraX rails) — see `docs/plans/2026-04-25-q1-hydrax-engagement-note.md`.
- Q3 (product template) — see `docs/plans/2026-04-25-q3-default-short-duration-credit.md`.
- Q7 (pricing) — see `docs/plans/2026-04-25-q7-pricing-model-options.md`.
- Specific tenant firm names — that's the user's sales call.

## 7. User actions to actually unblock Q4

1. Read this doc end-to-end. Override the archetype recommendation if you have a different read.
2. Run the §4 sourcing checklist offline. We don't need names in this repo — just the archetype + commit signal.
3. Once a design partner says yes, append a `## 8. Selected design partner` section here with archetype, named ops counterpart, weekly cadence start date, and any redacted runbook excerpts that should ground v1 workflow templates.
4. Q4 is unblocked when one design partner has formally agreed (in writing — even a Slack screenshot — to the §1 five-criteria commitment).
