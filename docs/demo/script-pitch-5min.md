# HydraX — 5-Minute Business Pitch + Build Proof

**Speaker:** Naim Katiman
**Audience:** HydraX founders / interview panel
**Runtime:** 5:00 at ~130 wpm
**Recording mode:** Talking-head only — record yourself, then layer Hyperframes-generated visuals in post.
**Companion materials:** [canton-interview.html](canton-interview.html) (deep deck), [script-canton-9slides-5min.md](script-canton-9slides-5min.md) (deck-anchored cut), [script-5min.md](script-5min.md) (operator-console walkthrough cut).

**Tone discipline:**
- Confident on what I built (verifiable, in the repo).
- Humble on what I assumed (named explicitly, invited to be wrong).
- Strong close that invites attack rather than asking for politeness.

---

## Segment 1 — The Hook (00:00 → 00:30)

**Visual cue (Hyperframes):** title card — name, role-applying, "HydraX × Canton — adoption layer thesis"

> Hi, I'm Naim. I'm going to do something ambitious for the next five minutes. I'll tell you what I think your adoption bottleneck on Canton is, propose a wedge to break it, and show you the working code I built around that thesis. I might be talking past you on a few things — please grill me at the end. I'd rather find out tonight than next month.

---

## Segment 2 — The Bet (00:30 → 01:00)

**Visual cue:** simple two-box diagram — Canton (rails) | HydraX (workflow layer above)

> Here's the bet. Canton wins regulated multi-party tokenization — privacy by design, atomic interop, the model that fits how institutions actually work. HydraX wins because you're the regulated rails for Southeast Asia. But rails alone don't drive adoption. The bottleneck between "we have the rails" and "an issuer ships a product on them" is the workflow layer above. That's where you can grow fastest, and that's the layer I built.

---

## Segment 3 — Three Assumptions, Any of Them Could Be Wrong (01:00 → 01:30)

**Visual cue:** three bullet cards labelled `assumption 1`, `assumption 2`, `assumption 3`

> Three assumptions I'm making, named up front so you can break them. One — institutions want a tenant surface you provide, not their own build. Two — your roadmap wants a white-label workflow plane, not bespoke per-deal engineering. Three — Canton's selective disclosure is what makes that plane defensible against a generic SaaS competitor. Tell me which breaks, and the rest of this presentation reshapes around your answer.

---

## Segment 4 — Proof: I Built It (01:30 → 03:00)

**Visual cue:** architecture diagram (services + portals row), then a single 10-second screen-recorded clip of `hydraxrail.com` landing → portal grid

> Instead of just pitching, I built the thing. The repo is `hydrax-app`, live across three Railway services right now — portals, the Canton homework site, and the original prototype. Nine backend services — six Go for performance-critical workflow, approval, audit, market data, plus the HydraX and Canton adapters. Three Node services for notifications, integrations, and a BFF. Five role-aware portals — issuer, distributor, investor, ops, admin — running on baked demo-mode data so you can click around without a backend. Five Daml scripts modeling the multi-party governance contracts. Auth complete — passkeys, magic-link over real SMTP, the developer-only login removed before public exposure. One workflow end-to-end. An investor submits a subscription. Workflow service validates. Approval service opens the ceremony with an SLA timer. Notification service fans out. The approver clicks accept. The mocked HydraX adapter posts the issuance. The Canton adapter commits the Daml command on an in-memory synchronizer. Audit logs every state change. Every transition provable, attributable, replayable. And the Canton-specific questions — tokenization stance, DeFi composability under privacy, infrastructure setup, cross-domain data sync — each get a dedicated deck panel and a matching portal read-model. The HydraX-rails mock is a deliberate bet: when your real API surface drops, it slots in behind the same interface, no rewrite of the workflow stack.

---

## Segment 5 — The New Business Idea (03:00 → 04:00)

**Visual cue:** wedge slide — `Workflow layer · Tenant-led · Credit-first` plus the three personas as chips

> So here's the idea. Position HydraX not just as the regulated rails, but as the workflow layer above them for institutional tokenization in Southeast Asia. White-label per tenant — three personas, issuer, distributor, market operator. First wedge: short-duration credit, thirty to one-eighty day tenor, institutional. That's where the volume lives, regulators are friendly to the instrument, and the cycle is short enough to prove the platform inside one quarter. Pricing: hybrid setup-plus-platform-plus-volume. Setup pays for the integration work, platform pays for the operating surface, volume pays for the rails. Why this beats letting institutions build their own: they don't want to maintain workflow code, regulators want one auditable surface to look at, and you land adoption per tenant rather than per developer. The unit of growth becomes a desk, not an integration ticket.

---

## Segment 6 — Open Questions + Roadmap (04:00 → 04:30)

**Visual cue:** Q1 / Q3 / Q4 / Q7 grid with status pills

> Four open questions from your PRD. Decision memo for each in the repo. Q1, your rails API surface — I built the mock, ready for the drop. Q3, first product type — short-duration credit, FSM wired in workflow service today. Q4, first tenant — issuer-led for fastest land. Q7, pricing — hybrid setup-plus-platform-plus-volume. None block shipping the stack.

---

## Segment 7 — Close: Grill Me (04:30 → 05:00)

**Visual cue:** simple full-bleed text card — "Validate the wedge · Reality-check Q1–Q7 · Tell me where I'm wrong"

> Three things I want out of this conversation. One — validate or reject the wedge: short-duration credit, tenant-led, white-label workflow above your rails. Two — reality-check my Q1 through Q7 calls. Three — tell me where my map of HydraX's actual roadmap diverges from yours, because that gap is where I'm flying blind. The rails are yours. The workflow layer is moving. Grill me.

---

## Verification

- **Spoken-word count:** 674 words across the seven blockquoted segments (`grep '^> ' script-pitch-5min.md | sed 's/^> //' | wc -w` = 674 on 2026-04-27 PM refresh). Pacing target: ~135 wpm averaged — interview-confident, slightly faster than narration-stiff 130 wpm and well under the 150 wpm fast-speech threshold. Lands at 4:59 at 135 wpm or 4:49 at 140 wpm. If you naturally come in at 130 wpm (5:11), trim one sentence from any of Segments 1, 2, 3 to recover the overage.
- **Per-segment word counts:** S1=68, S2=70, S3=68, S4=213, S5=133, S6=58, S7=64. S4 carries the build proof and runs at ~142 wpm in its 90-second slot — that's confident-fast, intentional. Segments 6 and 7 land under their slots, leaving 8 seconds of dwell for the closing card.
- **Timestamp ladder:** monotonic 00:00 → 00:30 → 01:00 → 01:30 → 03:00 → 04:00 → 04:30 → 05:00. Segment 4 (build proof) gets the largest 90-second slot — it's the load-bearing credibility segment.
- **Codebase claims (verified against current repo, 2026-04-27 PM refresh):** 9 backend services (6 Go + 3 Node — `find services -maxdepth 2 -name 'cmd' -o -name 'package.json'` confirms 6 Go cmd dirs + 3 Node package.jsons), 5 React portals running on baked `VITE_DEMO_MODE=true` synthetic data (commit `1938166`), 5 Daml scripts in `services/canton-adapter/daml/hydrax-governance/daml/Test/GovernanceScript.daml` — `testHappyPath`, `testUnauthorizedApprover`, `testDoubleApproval`, `testRejectBlocksExecute`, `testInterfaceView`, auth complete through slice 2e (passkeys + magic-link over SMTP + AUTH_DEV_LOGIN removed), HydraX-rails mock covers issue/subscribe/transfer-custody/settle/NAV, Canton adapter ships in-memory Daml ledger, Q3 credit FSM wired in workflow-svc, Q7 hybrid pricing decision memo in repo, 18-slide canton-homework-deck.html (slides 0-17) covering the 4 Canton deep-dive topics referenced in Segment 4. All grounded against project CLAUDE.md "Decisions (Recent)" entries dated 2026-04-25 through 2026-04-27.
- **Public URL claims:** "live across three Railway services" refers to all three production deployments, all verified live 2026-04-27 PM:
  - [hydraxrail.com](https://hydraxrail.com/) — institutional landing + 5 portals + /pricing + /docs + /quickstart (also reachable at the legacy `hydraxrail.up.railway.app` during the cutover window)
  - [hydrax-layer.up.railway.app](https://hydrax-layer.up.railway.app/) — Canton homework cover + /deck (18 slides) + /script (this file's mirror at `docs/demo/site/script.html`) + /interview
  - [hydrax-prototype-production.up.railway.app](https://hydrax-prototype-production.up.railway.app/) — bare original operator-console prototype, source matches `index.html`
- **Tone audit:** confidence markers — owns the diagnosis ("what I think your adoption bottleneck is"), names verifiable build artifacts, closes with "grill me." Humility markers — "any of them could be wrong," "tell me which breaks," "I'd rather find out tonight than next month," "that gap is where I'm flying blind." Build-proof markers — every claim in Segment 4 is grep-verifiable in the repo.

---

## Recording playbook (talking-head + Hyperframes pipeline)

### Phase 1 — record yourself

- Camera at eye level, lens roughly an arm's length away. 1080p minimum, 4K preferred for room to crop in post.
- 30 fps. Don't shoot 24 — it pairs badly with the screen-recorded portal clip in Segment 4.
- External mic mandatory. USB cardioid (Yeti, AT2020USB) on a boom, or a lav (Rode SmartLav, DJI Mic). Laptop mic is a tell of low effort — interviewers register it without consciously knowing why.
- Soft front light from the camera-side. Even-luminance background. No window directly behind you.
- Read from a teleprompter app or your script taped just above the lens. ~70% eye contact with the lens, ~30% glance at the script. Don't memorize — sound rehearsed-not-read, not memorized-and-stiff.
- Record the full 5:00 in **one continuous take**. Then redo two more times. Pick the take with the strongest Segments 1 and 7 — those bookend the impression. Splicing across takes loses energy continuity; only do it if a take has a fatal flaw mid-segment.
- Leave a half-second of silence at the very start and end of every take so the editor has clean cut points.

### Phase 2 — generate visuals with Hyperframes

For each segment's `Visual cue`, generate one or two frames:

| Segment | Hyperframes prompt seed |
|---|---|
| 1 | dark editorial title card, single line "HydraX × Canton — adoption layer thesis", monospace caption |
| 2 | side-by-side: left "Canton — rails", right "HydraX — workflow layer", subtle horizontal flow arrow between |
| 3 | three vertical cards, labels "assumption 1", "assumption 2", "assumption 3", each with one-line content from the segment |
| 4a | architecture diagram — 6 Go service boxes + 3 Node service boxes in a row, 5 portal boxes above, Postgres + Mongo + Daml below |
| 4b | three-URL banner — institutional portals, Canton homework site, prototype — each with a small status pill |
| 4c | (insert here) 10-second screen recording of `hydraxrail.com` landing → click into one portal → click a workflow lane (cursor-magnified) |
| 4d | four-quadrant Canton-deep-dive panel — Tokenization · DeFi composability under privacy · Infra & ops setup · Cross-domain data sync — synced to spoken delivery of those four bullets |
| 5 | wedge slide — large "Short-duration credit · Tenant-led · White-label" with three persona chips |
| 6 | 2×2 grid Q1 / Q3 / Q4 / Q7 with one-word status pills |
| 7 | full-bleed text card — three asks, listed |

Render each frame as a 1920×1080 PNG. Hand them to the editor as a labelled folder.

### Phase 3 — edit

- Editor: DaVinci Resolve (free, professional-grade) or CapCut Pro (faster, less control). Avoid iMovie — it can't keyframe picture-in-picture cleanly.
- Layout: full-frame talking head for Segments 1, 2, 7. Picture-in-picture (face in bottom-right corner, ~25% width) over the Hyperframes visuals for Segments 3, 4, 5, 6.
- Cut to the screen-recorded portal clip exactly once, mid-Segment 4 ("Five role-aware portals on top"). Hold for 8–10 seconds. Cut back to architecture frame for the workflow narration.
- Audio: ducked music bed at -25 dB under voice, lifted to -22 dB during silent visuals (none in this script). Stick to one track for the full five minutes — track changes draw attention.
- Captions: burn-in subtitles, timed to the spoken-word ladder above. Even if interviewers won't watch with audio off, captions improve comprehension on dense segments (Segment 4 especially).
- Final export: 1080p H.264, ~12 Mbps. MP4. Single file. No outro logo card — it dilutes Segment 7's close.

---

## Companion-script policy

This file is the **first cut** to record. The other two scripts in this folder serve different purposes:

- [script-canton-9slides-5min.md](script-canton-9slides-5min.md) — use if the panel asks you to "walk us through the deck" — it's anchored to the existing nine-slide canton-interview.html and reads slide-by-slide.
- [script-5min.md](script-5min.md) — use if the panel asks for a hands-on demo — it walks the operator-console prototype end-to-end with cursor actions.

Pick one for the recorded video; have the other two queued for the live conversation if the panel pushes a different direction.
