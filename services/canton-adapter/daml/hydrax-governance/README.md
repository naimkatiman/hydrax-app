# hydrax-governance — Daml spike

Status: throwaway spike. Not production. Not deployed to Canton.

Exists to de-risk three design questions before PRD §22 Q1/Q2/Q7 close:

1. Can a single Daml template carry the propose → approve → execute governance lifecycle with role-based controllers and party-level visibility?
2. Does the Daml interface mechanism give us a seam for upgrading the template without breaking observers?
3. Where exactly does multi-synchronizer reassignment attach, and what does deferring it cost?

## What this is

One Daml package — `hydrax-governance` — with:

- `GovernanceProposal` template: party model (proposer, approvers, observers), lifecycle status, validation on required approvals
- `Approve`, `Reject`, `Execute` choices with signatory + controller-based authorization
- `Proposal` interface over the template to demonstrate an upgrade pathway
- Daml Script test suite: one happy-path + three failure-paths + one interface-view test

## What this is NOT

- Not running on Canton. Verified with `--ide-ledger` (in-process deterministic ledger) only.
- Not integrated with HydraX APIs. No `services/hydrax-adapter/` work.
- Not multi-synchronizer. Runs on a single in-memory ledger.
- Not production upgrade machinery. The interface demonstrates a mechanism; a real upgrade requires package-versioning discipline across operational instances.

## Reassignment seam — deferred, intentionally

Canton reassignment moves a contract between synchronizers (trust boundaries) while preserving signatories and observers. In this spike, nothing reassigns — the ledger is single-domain.

A future multi-synchronizer version would:

1. Keep the template shape unchanged. Reassignment is a deployment concern, not a modeling concern.
2. Require every approver and observer to be hosted on the target synchronizer at the moment of reassignment — this is the operational constraint that bites first.
3. Optionally add a `RequestReassignment` choice controlled by a designated operator party if the workflow wants reassignment visible as a first-class lifecycle event (vs. a purely operational action invisible to the contract).
4. Gate `Approve` / `Execute` on a synchronizer-specific policy only if a regulatory boundary requires it. Default: do not gate. Canton already gives you synchronizer-level trust isolation.

That work is not in this spike because:

- PRD §15 fixes single-synchronizer until multi-domain is justified.
- Reassignment is a deployment concern, not a modeling concern — the template does not change.
- Canton Enterprise is required to actually test multi-synchronizer behavior and is not installed.

## How to run

Prerequisites:

- Daml SDK 2.9.5 (see [docs/env.md](../../../../docs/env.md))
- JRE 17 (Daml Script needs a JVM). Any Temurin/OpenJDK 17 build works.

From repo root:

    export PATH="$HOME/.java/jdk-17.0.19+10-jre/bin:$HOME/.daml/bin:$PATH"
    cd services/canton-adapter/daml/hydrax-governance
    daml build

Run any single script:

    daml script --dar .daml/dist/hydrax-governance-0.0.1.dar \
      --script-name Test.GovernanceScript:testHappyPath \
      --ide-ledger

Or run the full suite:

    for t in testHappyPath testUnauthorizedApprover testDoubleApproval \
             testRejectBlocksExecute testInterfaceView; do
      daml script --dar .daml/dist/hydrax-governance-0.0.1.dar \
        --script-name "Test.GovernanceScript:$t" --ide-ledger || exit 1
    done

## Decisions this spike does NOT lock in

- Whether `GovernanceProposal` is the right shape for the first production workflow object (PRD §22 Q2).
- Whether Daml is the right tool for the workflow layer vs. off-ledger state + HydraX rails commands.
- Whether multi-synchronizer is needed for the first tenant (PRD §22 Q7).
- Daml SDK version policy (pinned to 2.9.5 here; re-decision deferred to production-adoption time).

## What to do with this

Read the Daml. Run the scripts. Decide whether to:

- **Promote:** extract the template shape into a production package with real party structure from PRD §5.
- **Rewrite:** the interface-based upgrade model doesn't fit; pick a different package-versioning strategy.
- **Discard:** off-ledger workflow is sufficient for MVP; revisit Daml when §6.1 escalation demands it.

All three are valid outcomes. The plan doc at [docs/plans/2026-04-25-daml-governance-spike.md](../../../../docs/plans/2026-04-25-daml-governance-spike.md) is the authoritative record of what was built and why.
