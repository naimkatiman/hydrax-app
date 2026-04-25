# Q7 Pricing Options — First Tenant Commercial Model

> **Status:** DRAFT options study written autonomously under auto mode. **No specific dollar amounts** — illustrative bands only, marked clearly. The user (or HydraX commercial owner) sets actual prices.
>
> **Not a build plan.** This is a Q7 unblock artifact. Recommends Option D (hybrid) for first-tenant default but the call belongs to whoever owns HydraX commercial — present this to that person, get a pick, log the pick.

- **Date:** 2026-04-25
- **Resolves:** PRD-v2 §14 Q7 — pricing commitment for first tenant contract
- **Anchored on:** PRD-v2 §10 monetization lines (setup, platform, volume, servicing, integration)
- **Depends on:** Q4 archetype (Option D assumes issuer-led tenant). If distributor-led, re-pick.
- **Skill lineage:** `/proceed-with-claude-recommendation unblock the blockers`

---

## 1. The five §10 monetization lines, reframed for v1 pricing

| Line | What it bills for | First-tenant fit |
|---|---|---|
| Setup / implementation fee | One-time onboarding effort | High — first tenant is design-partner-heavy |
| Tenant platform fee | Recurring subscription, per-tenant | High — predictable revenue, anchors the relationship |
| Workflow volume fee | Per subscription / redemption / servicing event | Medium — scales with tenant success but slow at low volume |
| Servicing fee | Percentage or flat on servicing events HydraX processes for the issuer | Low — servicing automation isn't load-bearing in v1 |
| Integration fee | Custom KYC/SSO/CRM connector beyond supported set | Low for v1 — bundle into setup unless connector is genuinely bespoke |

## 2. Four candidate pricing models for the first tenant

Each model picks a primary line, supports it with one or two secondary lines, and explicitly drops the others for v1.

### Option A — Setup-Heavy / Platform-Light (Proof-of-Concept Pricing)

- **Primary:** large one-off setup fee
- **Secondary:** small monthly platform fee
- **Drop in v1:** volume fee, servicing fee, integration fee
- **Best for:** design-partner phase; we want their commitment more than their cash
- **Risk:** tenant treats us as project work, not a platform; renewal conversation is hard

### Option B — Setup-Light / Platform-Ramped (Sales-Friendly)

- **Primary:** ramped platform fee (low Y1, full price Y2+)
- **Secondary:** small or waived setup
- **Drop in v1:** volume fee, servicing fee, integration fee
- **Best for:** distributor-led tenants where the buyer is procurement
- **Risk:** revenue lags significantly behind cost; HydraX ROI weak in Y1

### Option C — Volume-Only (Pure Usage)

- **Primary:** workflow volume fee per subscription / redemption / servicing event
- **Secondary:** none
- **Drop in v1:** setup, platform, servicing, integration
- **Best for:** mature tenants doing high cadence, OR when HydraX wants the cleanest "rails-as-a-service" story
- **Risk:** zero revenue if tenant fails to issue; we carry all volume risk; commercially indefensible internally if Y1 volume is low

### Option D — Hybrid (RECOMMENDED for first tenant)

- **Primary:** medium platform fee
- **Secondary:** medium setup fee + volume fee that activates above a tier (e.g., free up to N events/month, then per-event above)
- **Drop in v1:** servicing fee, integration fee
- **Best for:** issuer-led tenant per Q4 Option A — predictable revenue + upside if tenant scales
- **Risk:** more line items to negotiate; harder to summarise to a procurement team

## 3. Decision matrix at three illustrative tenant sizes

> **Illustrative band labels only.** Actual numbers belong to the HydraX commercial owner. Bands here are S/M/L for shape comparison, not dollar guidance.

| Tenant size | A (Setup-heavy) | B (Platform-ramp) | C (Volume-only) | D (Hybrid) |
|---|---|---|---|---|
| Small (≤25 issuances/yr) | Strong cash up front, weak Y2 | Weak Y1, modest Y2 | Near-zero Y1 | Modest Y1, modest Y2 |
| Medium (25–200 issuances/yr) | Same as small | Modest Y1, strong Y2 | Modest Y1, strong Y2 | Strong Y1, strong Y2 |
| Large (200+ issuances/yr) | Same as small | Strong Y1, strong Y2 | Very strong Y1+ | Very strong Y1+ |

Reading: at first-tenant scale (likely Small to lower-Medium), Option D dominates A and B and beats C unless we have unusually high confidence in tenant volume.

## 4. What "first-tenant pricing" means commercially

- The first tenant pricing is BOTH a revenue lever AND a market signal. Whatever we charge becomes the public anchor for tenant #2's negotiation.
- Underpricing #1 to win the design partner is fine if explicitly time-boxed (e.g., "design partner pricing for 12 months, list price after"). Bake the renewal step into the contract from day one.
- Overpricing #1 risks losing the partner. We are not yet in a position to extract pricing power.
- Volume fee should be cleanly metered and visible to the tenant from week one — opaque billing kills the renewal conversation.

## 5. Open sub-questions Option D exposes

If the user (or HydraX commercial owner) picks D, these need answers before contract drafting:

1. **Setup fee:** lump sum or milestone-based? Recommend milestone-based (kick-off, sandbox-live, production-cutover) for design-partner credibility.
2. **Platform fee:** monthly or annual prepay? Recommend annual prepay with 30-day out for first 90 days; protects revenue while keeping partner trust.
3. **Volume tier threshold:** flat per-event above N, or stepped tiers? Recommend stepped (e.g., free → low-rate → standard-rate) so the tenant feels rewarded for scaling.
4. **Volume fee target events:** subscriptions only, or also redemptions and servicing events? Recommend all three but at different rates (subscription > redemption > servicing).
5. **Servicing-event fee:** included in volume or separate line? Recommend included in v1; split out at v1.5 once servicing automation lands.
6. **Integration fee carve-out:** pre-bundle the tenant's KYB/SSO connectors into setup, or quote separately? Recommend pre-bundle for first tenant (bundled into setup as design-partner courtesy), separate-line from tenant #2.

## 6. What "unblocked" looks like for Q7

Q7 is unblocked when ALL of these are true:

- One of A/B/C/D is selected (recommend D).
- Sub-questions in §5 are answered if D is picked.
- An actual price band is committed in writing (Notion, contract draft, internal pricing doc — anywhere durable).
- The price commitment is signed off by whoever owns HydraX commercial decisions, not just the engineering side.
- The first tenant (Q4) has either accepted, counter-offered with specific deltas, or rejected on commercial grounds (in which case we re-pick).

## 7. Open coupling with other Qs

- **Couples to Q4** — issuer-led tenant suits Option D; distributor-led tenant might prefer Option B; fund-admin-led tenant pushes us to Option C (which we should refuse on §3 risk grounds).
- **Couples to Q1** — if HydraX rails SLA is weak, we cannot defensibly bill on volume; we'd be pushed back to Option A or B until SLA is firm.
- **Independent of Q3** — pricing model is largely product-agnostic. Short-duration credit doesn't change the pricing math much.

## 8. What this note does NOT decide

- Q1 (HydraX rails) — see `docs/plans/2026-04-25-q1-hydrax-engagement-note.md`.
- Q3 (product template) — see `docs/plans/2026-04-25-q3-default-short-duration-credit.md`.
- Q4 (first tenant) — see `docs/plans/2026-04-25-q4-tenant-persona-shortlist.md`.
- Actual dollar amounts — HydraX commercial owner's call.

## 9. User actions to actually unblock Q7

1. Read this doc end-to-end. Override the Option D recommendation if you have a different read.
2. Walk this through with whoever owns HydraX commercial (founder, CFO, head of revenue — whichever role applies).
3. Get a pick (A/B/C/D) and answers to §5 sub-questions if D.
4. Commit the pick to a durable doc (this file is fine — append a `## 10. Selected pricing model` section).
5. Update CLAUDE.md "Decisions (Recent)" with the selected option. No need to log dollar amounts here unless useful.
6. Q7 is unblocked when the §6 conditions are met.
