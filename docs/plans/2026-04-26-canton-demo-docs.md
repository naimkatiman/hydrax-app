# 2026-04-26 — Canton demo docs

## Goal

Three documents that frame this repo as the **workflow layer above Canton + HydraX rails**. They serve two purposes:

1. Supporting evidence for the Canton homework submission ("How I would build on Canton").
2. A 10–15 minute sit-down demo for the interviewer that walks architecture → trace → live prototype → Daml spike.

## Why now

The standard candidate response is a Canton primer essay. The differentiator is delivering a Canton primer that ends with *"...and here's the layer above it that I built."* This repo already has the substance — 9 services, 5 portals, running Daml spike, polished prototype on Railway. What it lacks is the framing artifacts that make the architectural intent obvious in a five-minute walk-through.

## Scope (what this slice produces)

Three new files:

1. `docs/architecture.md` — three-plane architecture (rails / orchestration / UX). ASCII diagram. Per-service one-line justification ("Canton can't do X, so this exists"). Status snapshot grounded in real commits.
2. `docs/example-subscription-flow.md` — one workflow traced end-to-end. Real file paths. Honest "wired vs mocked" call-outs at every step.
3. `README.md` (repo root, currently absent) — one-page entry point opening with "Canton owns X, hydrax-app owns Y", repo tree, where to start reading.

## Will NOT

- Write the homework document itself (user owns the homework artifact at `docs/homework.md` and existing draft at `docs/genericresponse.md`).
- Modify any service code, schema, route, or portal.
- Touch `docs/genericresponse.md` or `docs/homework.md` (user-owned drafts).
- Add new dependencies, deploy anything, push to remote, or commit.
- Generate new images via nano-banana (no UI work in this slice).
- Rewrite the existing prototype.

## Files touched

- `docs/plans/2026-04-26-canton-demo-docs.md` (this file)
- `docs/architecture.md` (new)
- `docs/example-subscription-flow.md` (new)
- `README.md` (new, repo root)
- `STATE.yaml` (append `verification_log` entry only)

5 files. Pure markdown. Zero code, zero schema, zero infra.

## Verification per file

- Each new doc — `wc -l` recorded; every cited file path tested with `test -e`; no broken refs; no emoji in body.
- README cross-links — at minimum links to `docs/architecture.md`, `docs/example-subscription-flow.md`, `docs/prd-v2.md`, and the running Daml spike.
- STATE.yaml — `python3 -c 'import yaml; yaml.safe_load(open("STATE.yaml"))'` parses; new line appended, nothing overwritten.

## Out-of-scope (explicit deferrals)

- ASCII-to-Mermaid conversion if a renderable diagram is wanted (separate slice).
- A dedicated `docs/canton-mental-model.md` rewriting `genericresponse.md` in the candidate's voice (separate slice; user already owns that draft).
- Updating any portal landing page to link to the new docs.
- Hero asset for the homework PDF / interview deck (would require nano-banana — separate slice).

## Risks

- Stale prototype URL — verified live earlier this week, but if it goes down before the interview, the README claim is wrong. Mitigation: caveat the URL with a "last-verified" date and a `railway up --detach` instruction.
- Cited file paths drift if the user keeps building. Mitigation: paths reference stable scaffold locations (`services/<svc>/internal/<pkg>/`, `web/apps/<portal>/src/routes/`), not internal symbols that move.
- Length creep on `architecture.md` — easy to balloon into a Canton primer. Mitigation: hard 200-line target; defer Canton internals to PRD-v2 §1–§24 by reference.

## After this slice

User can:

- Cite concrete file paths in the homework instead of speaking in generalities.
- Walk the interviewer through `README.md → architecture.md → example-subscription-flow.md → live prototype → Daml spike` in 10–15 minutes.
- Use the per-service "Canton can't do X, so this exists" lines verbatim as the "Building on Canton" answer.

## Reference: source repo facts (verified 2026-04-26)

- 9 services exist under `services/`: workflow-svc, approval-svc, audit-svc, hydrax-adapter, canton-adapter, market-data-svc (Go); notify-svc, integration-svc, bff (Node/TS).
- 5 portals exist under `web/apps/`: issuer-portal, distributor-portal, investor-portal, ops-console, admin.
- 3 packages under `web/packages/`: ui, tenant-theme, api-client.
- Daml spike at `services/canton-adapter/daml/hydrax-governance/` — `daml build` green; 5 Scripts pass on `--ide-ledger`.
- Postgres-backed: workflow-svc products, audit-svc events.
- Cross-service wired: bff → workflow-svc (POST/GET /v1/products), bff → audit-svc, bff → approval-svc, bff → market-data-svc, workflow-svc → hydrax-adapter (POST /v1/issue).
- Live prototype: `hydrax-prototype-production.up.railway.app` (last verified 2026-04-24).
- Live market-data-svc: `market-data-svc-production.up.railway.app` (last verified 2026-04-25).
