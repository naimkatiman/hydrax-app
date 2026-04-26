# Q7 Pricing — One-Page Decision Memo

> **Read time:** 5 minutes. **Decision required:** pick one of A/B/C/D below; if D, answer six sub-questions.
>
> **Full options analysis:** [docs/plans/2026-04-25-q7-pricing-model-options.md](2026-04-25-q7-pricing-model-options.md). This memo is the takeaway page for a commercial-owner conversation.
>
> **Resolves:** Tier-1 recommendation Item 12 — Walk Q7 pricing through commercial owner.

## What we're picking

A pricing model for the **first tenant**. Whatever we charge tenant #1 becomes the public anchor for tenant #2's negotiation, so the call has signal value beyond the cash.

## The four candidate models

| | A — Setup-Heavy | B — Platform-Ramp | C — Volume-Only | D — Hybrid |
|---|---|---|---|---|
| Primary line | Large one-off setup | Ramped monthly platform fee (low Y1, full Y2+) | Per-event volume fee | Medium platform fee |
| Secondary line | Small monthly platform | Small/waived setup | None | Medium setup + tiered volume above threshold |
| Best fit | Design-partner phase, capture commitment | Distributor-led tenant (procurement buyer) | Mature, high-cadence tenants | **Issuer-led tenant per Q4 Option A** |
| Y1 cash | Strong | Weak | Near-zero | Strong |
| Y2 cash | Weak | Strong | Strong if tenant scales | Strong with upside |
| Main risk | Tenant treats us as project work | HydraX ROI weak in Y1 | Zero revenue if tenant doesn't issue | More line items to negotiate |

## Recommendation — Option D (Hybrid)

Reasoning in three sentences:

1. First tenant is likely Small to lower-Medium volume (≤25–200 issuances/yr per the size matrix in the full doc). At that volume, A leaves Y2 weak, B leaves Y1 weak, C leaves both Y1 and Y2 weak.
2. D is the only option that delivers Y1 cash AND keeps upside if tenant scales — same pattern that institutional SaaS contracts converge on.
3. The "more line items to negotiate" risk is real but bounded: list the three lines (setup, platform, volume) on one page of the contract. Procurement teams handle this shape every week.

## If D is picked, six sub-questions to answer in the same conversation

1. **Setup fee structure** — lump sum, or milestone-based (kick-off / sandbox-live / production-cutover)? Recommend milestone-based for design-partner credibility.
2. **Platform fee cadence** — monthly or annual prepay? Recommend annual prepay with a 30-day out for the first 90 days.
3. **Volume tier shape** — flat per-event above N, or stepped (free → low-rate → standard-rate)? Recommend stepped so tenant feels rewarded for scaling.
4. **Volume target events** — subscriptions only, or also redemptions and servicing events? Recommend all three at different rates (subscription > redemption > servicing).
5. **Servicing-event fee** — included in volume line, or separate? Recommend included in v1; split out at v1.5 once servicing automation lands.
6. **Integration fee carve-out** — pre-bundle the tenant's KYB/SSO connectors into setup, or quote separately? Recommend pre-bundle for tenant #1 (design-partner courtesy), separate-line from tenant #2.

**Note:** No specific dollar amounts in this memo. Bands and ratios belong to the commercial owner's pricing instinct, not to engineering.

## Coupling with other Qs (read before locking in)

- **Q4** — issuer-led tenant suits D; distributor-led tenant might prefer B; fund-admin-led tenant pushes us to C (refuse on risk grounds).
- **Q1** — if HydraX rails SLA is weak, we cannot defensibly bill on volume; we'd be pushed back to A or B until SLA is firm. Q1 still deferred-not-resolved per CLAUDE.md.
- **Q3** — pricing is largely product-agnostic. Short-duration credit doesn't change the math.

## Sign-off block — fill in during the conversation

```
Pricing model selected:           [ A | B | C | D | other (specify) ]

Time-boxing on the design-partner pricing:
                                  [ 6 mo | 9 mo | 12 mo | none | other ]

If D:
  Setup structure:                [ lump | milestone-based | other ]
  Platform cadence:               [ monthly | annual prepay | other ]
  Volume shape:                   [ flat | stepped | other ]
  Volume targets:                 [ subs only | subs+redemptions | all three ]
  Servicing fee:                  [ in volume | separate ]
  Integration carve-out:          [ pre-bundle for #1 | separate line | other ]

Approved by:                      ___________________________  (commercial owner role)
Date:                             ____________________________
Logged in CLAUDE.md Decisions:    [ ]   STATE.yaml updated:    [ ]
```

## What "Q7 unblocked" means

Q7 is unblocked when ALL of these are true:

- One of A/B/C/D is selected (D recommended).
- Sub-questions §1–§6 above answered if D is picked.
- An actual price band is committed in writing — anywhere durable (Notion, contract draft, internal pricing doc, or this file).
- The price commitment is signed off by whoever owns HydraX commercial decisions, not just the engineering side.
- The first tenant (Q4) has either accepted, counter-offered with specific deltas, or rejected on commercial grounds.

When the conversation lands, append the filled-in sign-off block above to this file and update CLAUDE.md "Decisions (Recent)" with one line. Q7 then leaves the recommendation list.
