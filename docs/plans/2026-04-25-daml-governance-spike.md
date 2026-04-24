# Daml Governance + Upgradeability Spike — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Date:** 2026-04-25
- **Status:** drafted, HALTED pending user approval for Daml SDK install
- **Parent docs:** [docs/prd.md](../prd.md) §10, §13, §15, §22 · [STATE.yaml](../../STATE.yaml)
- **Skill lineage:** `/proceed-with-claude-recommendation` → `superpowers:writing-plans` (Phase 2). Phase 3 execution blocked on `needs-approval` flag.

---

**Goal:** Prove that a `GovernanceProposal` Daml template can express propose → approve → execute under role-based controllers and expose an interface that supports future upgrades, on a single Canton synchronizer, while documenting the exact seams where multi-synchronizer reassignment would attach later.

**Architecture:** One Daml package (`hydrax-governance`) under `services/canton-adapter/daml/`. No Canton deployment, no HydraX integration, no Go or TS bridge. Verification via `daml build` and `daml script --ide-ledger` only. This is a throwaway spike — any decision to promote it to production goes through a separate plan after PRD §22 Q1/Q2/Q7 are answered.

**Tech Stack:** Daml SDK 2.9.5 (LTS pin). Daml Script for tests. No Canton runtime, no multi-synchronizer topology, no Digital Asset hosted services.

**Gated by:** User approval to install Daml SDK (new toolchain — CLAUDE.md: *"No new dependencies… without explicit approval."*). This plan documents the install command and does not trigger it.

---

## 1. Why this spike, why now

The user described three concepts in one sentence: *governance, upgradeability, Canton reassignment*. They are not interchangeable:

| Concept | What it is | Where it is proven |
|---|---|---|
| Governance | Propose → approve → execute, role-based | Daml template + choices (in code) |
| Upgradeability | Evolve the template shape without breaking observers | Daml interface + view (in code) |
| Reassignment | Move a contract between synchronizers / trust domains | Deferred — documented seam only |

All three are worth understanding. Only the first two are **code-provable inside a single-synchronizer spike**. Reassignment requires Canton Enterprise + multi-synchronizer topology that is not installed and not on the 2026 roadmap per PRD §15.

The spike's job is to:

1. Prove the party model and lifecycle fit under Daml's signatory / observer discipline.
2. Prove the interface-based upgrade mechanism is usable for the institutional workflow shape.
3. Write down — in code-adjacent prose — where reassignment attaches later and what it costs to defer now.

Promotion decision comes later. This spike is **deletable** via `git rm -r services/canton-adapter/daml/hydrax-governance/` without breaking anything else in the repo.

---

## 2. Scope

### 2.1 In scope

- Daml project scaffold in `services/canton-adapter/daml/hydrax-governance/`
- `GovernanceProposal` template with parties, lifecycle, validation
- `Approve`, `Reject`, `Execute` choices
- `Proposal` interface demonstrating upgrade seam
- Daml Script tests — happy path + three failure paths + interface-view test
- README explaining mental model + reassignment deferral
- `docs/env.md` created with Daml SDK pin + install command
- STATE.yaml `verification_log` entry

### 2.2 Out of scope

- Deploying to Canton (single-synchronizer or multi-)
- HydraX API adapter — nothing in `services/hydrax-adapter/` is touched or planned here
- Go / TS service bridge — no codegen, no service binary, no ledger subscription
- Actual reassignment logic (requires multi-synchronizer; PRD §15 defers this)
- Production-grade upgrade tooling (interface demonstrates the mechanism; versioning strategy is a separate decision)
- Any frontend integration
- Any STATE.yaml changes to `current_focus` / `next_actions` beyond recording the verification

### 2.3 Non-goals that will be tempting

- "While we're here, let's scaffold the Go adapter" — no. One concern per commit. Defer.
- "Also wire the contract into the prototype UI" — no. Spike is ledger-only; UI stays prototype.
- "Pin to Daml 3.x since it's newer" — no. 3.x is pre-GA; spike targets 2.9 LTS. Version re-decision is not in this plan.

### 2.4 Verification gate

- `daml build` exits 0
- `daml script --ide-ledger` runs all five test scripts and each exits 0
- `wc -l` recorded in STATE.yaml
- `git diff --stat` shows exactly 7 files changed (6 created + 1 modified STATE.yaml) — no drive-bys

---

## 3. File Structure

| Path | Role | Status |
|---|---|---|
| `services/canton-adapter/daml/hydrax-governance/daml.yaml` | Package manifest: SDK version, name, dependencies | Create |
| `services/canton-adapter/daml/hydrax-governance/daml/Governance.daml` | `ProposalType`, `ProposalStatus`, `GovernanceProposal` template, `Proposal` interface | Create |
| `services/canton-adapter/daml/hydrax-governance/daml/Test/GovernanceScript.daml` | Daml Script tests (happy + failure + interface) | Create |
| `services/canton-adapter/daml/hydrax-governance/README.md` | Mental model, run commands, reassignment-seam doc | Create |
| `services/canton-adapter/daml/hydrax-governance/.gitignore` | `.daml/`, `dar/` build outputs | Create |
| `docs/env.md` | Daml SDK install + version pin — **create, does not exist today** | Create |
| `STATE.yaml` | `verification_log` entry for the spike | Modify |

Seven files. Under the 15-file commit cap. One concern per commit → seven commits, one per task.

Confirmed absent before planning: `docs/env.md` (does not exist), `services/` (does not exist). No collisions.

---

## 4. Tasks

### Task 1: Install gate + Daml project scaffold

**Files:**
- Create: `services/canton-adapter/daml/hydrax-governance/daml.yaml`
- Create: `services/canton-adapter/daml/hydrax-governance/daml/Governance.daml`
- Create: `services/canton-adapter/daml/hydrax-governance/.gitignore`
- Create: `docs/env.md`

- [ ] **Step 1: Wait for explicit user approval to install Daml SDK**

Do NOT run any install command before user explicitly greenlights:

```
curl -sSL https://get.daml.com/ | sh -s 2.9.5
```

If user declines: stop. Do not create any files. Close the plan as "scope withdrawn, no work done."

- [ ] **Step 2: Verify install**

Run:
```
daml version
```
Expected output: a block that includes `SDK version: 2.9.5`. Fail fast if the command is not found — that means step 1 silently failed and must be re-run or user must install manually.

- [ ] **Step 3: Create package manifest**

Create `services/canton-adapter/daml/hydrax-governance/daml.yaml`:
```yaml
sdk-version: 2.9.5
name: hydrax-governance
source: daml
version: 0.0.1
dependencies:
  - daml-prim
  - daml-stdlib
  - daml-script
```

- [ ] **Step 4: Create empty Governance module**

Create `services/canton-adapter/daml/hydrax-governance/daml/Governance.daml`:
```daml
module Governance where

-- HydraX institutional governance spike.
-- See README.md for mental model and non-goals.
-- This is throwaway code. Do not import from other packages.
```

- [ ] **Step 5: Create .gitignore**

Create `services/canton-adapter/daml/hydrax-governance/.gitignore`:
```
.daml/
*.dar
```

- [ ] **Step 6: Verify empty module builds**

Run:
```
cd services/canton-adapter/daml/hydrax-governance && daml build
```
Expected tail: `Created .daml/dist/hydrax-governance-0.0.1.dar`. Exit 0.

- [ ] **Step 7: Create docs/env.md**

Create `docs/env.md`:
```markdown
# Environment Variables and Toolchains

Every environment variable and toolchain dependency used anywhere in the repo is documented here.

## Toolchains

### Daml SDK

- Version: 2.9.5 (pinned, LTS)
- Install: `curl -sSL https://get.daml.com/ | sh -s 2.9.5`
- Verify: `daml version` shows `SDK version: 2.9.5`
- Used by: `services/canton-adapter/daml/*`
- Why pinned to 2.9: Daml 3.x is pre-GA as of 2026-04-25. Upgrade re-decision is out of scope for the governance spike.

## Environment variables

(None yet — this document starts empty because no service binaries exist.)
```

- [ ] **Step 8: Commit**

```
git add services/canton-adapter/daml/hydrax-governance/daml.yaml \
         services/canton-adapter/daml/hydrax-governance/daml/Governance.daml \
         services/canton-adapter/daml/hydrax-governance/.gitignore \
         docs/env.md
git commit -m "feat(canton): scaffold hydrax-governance Daml package"
```

---

### Task 2: GovernanceProposal — data types, party model, invariants

**Files:**
- Modify: `services/canton-adapter/daml/hydrax-governance/daml/Governance.daml`

- [ ] **Step 1: Replace file contents with data types + template shell**

Replace all of `daml/Governance.daml`:
```daml
module Governance where

import DA.List (unique)

data ProposalType
  = ProductLaunch
  | SubscriptionApproval
  | PolicyChange
  deriving (Eq, Show)

data ProposalStatus
  = Pending
  | Approved
  | Executed
  | Rejected
  deriving (Eq, Show)

template GovernanceProposal
  with
    proposer: Party
    approvers: [Party]
    observers: [Party]
    proposalType: ProposalType
    payload: Text
    requiredApprovals: Int
    approvals: [Party]
    status: ProposalStatus
  where
    signatory proposer
    observer observers, approvers

    ensure requiredApprovals > 0
        && requiredApprovals <= length approvers
        && unique approvers
```

- [ ] **Step 2: Verify build still passes**

Run:
```
cd services/canton-adapter/daml/hydrax-governance && daml build
```
Expected: exit 0, no warnings about unused imports. If `unique` import path differs in the installed SDK, adjust to the correct module (e.g. `DA.Set` or `DA.List.Total`) and keep the invariant intact.

- [ ] **Step 3: Commit**

```
git add services/canton-adapter/daml/hydrax-governance/daml/Governance.daml
git commit -m "feat(canton): add GovernanceProposal template with party model and invariants"
```

---

### Task 3: Happy-path choices + Daml Script test

**Files:**
- Modify: `services/canton-adapter/daml/hydrax-governance/daml/Governance.daml`
- Create: `services/canton-adapter/daml/hydrax-governance/daml/Test/GovernanceScript.daml`

- [ ] **Step 1: Add Approve choice to GovernanceProposal**

Append inside the `where` block of the template:
```daml
    choice Approve : ContractId GovernanceProposal
      with
        approver: Party
      controller approver
      do
        assertMsg "approver not authorized" $ approver `elem` approvers
        assertMsg "duplicate approval" $ approver `notElem` approvals
        assertMsg "not pending"           $ status == Pending
        let newApprovals = approver :: approvals
        let newStatus =
              if length newApprovals >= requiredApprovals
                then Approved
                else Pending
        create this with
          approvals = newApprovals
          status    = newStatus
```

- [ ] **Step 2: Add Execute choice**

Append to the same `where` block:
```daml
    choice Execute : ContractId GovernanceProposal
      controller proposer
      do
        assertMsg "not approved" $ status == Approved
        create this with status = Executed
```

- [ ] **Step 3: Write happy-path Daml Script**

Create `daml/Test/GovernanceScript.daml`:
```daml
module Test.GovernanceScript where

import Daml.Script
import Governance

testHappyPath : Script ()
testHappyPath = script do
  issuer    <- allocateParty "Issuer"
  ops1      <- allocateParty "Ops1"
  ops2      <- allocateParty "Ops2"
  custodian <- allocateParty "Custodian"

  cid0 <- submit issuer $ createCmd GovernanceProposal with
    proposer          = issuer
    approvers         = [ops1, ops2]
    observers         = [custodian]
    proposalType      = ProductLaunch
    payload           = "Launch MMF v1"
    requiredApprovals = 2
    approvals         = []
    status            = Pending

  cid1 <- submit ops1 $ exerciseCmd cid0 Approve with approver = ops1
  cid2 <- submit ops2 $ exerciseCmd cid1 Approve with approver = ops2
  cid3 <- submit issuer $ exerciseCmd cid2 Execute

  Some final <- queryContractId issuer cid3
  assertMsg "status must be Executed" $ final.status == Executed
  pure ()
```

- [ ] **Step 4: Run happy-path script**

Run:
```
cd services/canton-adapter/daml/hydrax-governance && daml build && \
  daml script --dar .daml/dist/hydrax-governance-0.0.1.dar \
              --script-name Test.GovernanceScript:testHappyPath \
              --ide-ledger
```
Expected: exit 0. Ledger output ends without assertion failure.

- [ ] **Step 5: Commit**

```
git add services/canton-adapter/daml/hydrax-governance/daml/Governance.daml \
         services/canton-adapter/daml/hydrax-governance/daml/Test/GovernanceScript.daml
git commit -m "feat(canton): add Approve+Execute choices with happy-path Daml Script"
```

---

### Task 4: Failure paths — Reject choice + three negative tests

**Files:**
- Modify: `services/canton-adapter/daml/hydrax-governance/daml/Governance.daml`
- Modify: `services/canton-adapter/daml/hydrax-governance/daml/Test/GovernanceScript.daml`

- [ ] **Step 1: Add Reject choice**

Append to the template `where` block:
```daml
    choice Reject : ContractId GovernanceProposal
      with
        approver: Party
        reason: Text
      controller approver
      do
        assertMsg "approver not authorized" $ approver `elem` approvers
        assertMsg "not pending"             $ status == Pending
        create this with status = Rejected
```

- [ ] **Step 2: Append failure-path tests**

Append to `daml/Test/GovernanceScript.daml`:
```daml
testUnauthorizedApprover : Script ()
testUnauthorizedApprover = script do
  issuer   <- allocateParty "Issuer"
  ops1     <- allocateParty "Ops1"
  intruder <- allocateParty "Intruder"

  cid <- submit issuer $ createCmd GovernanceProposal with
    proposer          = issuer
    approvers         = [ops1]
    observers         = []
    proposalType      = PolicyChange
    payload           = "test"
    requiredApprovals = 1
    approvals         = []
    status            = Pending

  submitMustFail intruder $ exerciseCmd cid Approve with approver = intruder

testDoubleApproval : Script ()
testDoubleApproval = script do
  issuer <- allocateParty "Issuer"
  ops1   <- allocateParty "Ops1"
  ops2   <- allocateParty "Ops2"

  cid0 <- submit issuer $ createCmd GovernanceProposal with
    proposer          = issuer
    approvers         = [ops1, ops2]
    observers         = []
    proposalType      = SubscriptionApproval
    payload           = "test"
    requiredApprovals = 2
    approvals         = []
    status            = Pending

  cid1 <- submit ops1 $ exerciseCmd cid0 Approve with approver = ops1
  submitMustFail ops1 $ exerciseCmd cid1 Approve with approver = ops1

testRejectBlocksExecute : Script ()
testRejectBlocksExecute = script do
  issuer <- allocateParty "Issuer"
  ops1   <- allocateParty "Ops1"

  cid <- submit issuer $ createCmd GovernanceProposal with
    proposer          = issuer
    approvers         = [ops1]
    observers         = []
    proposalType      = ProductLaunch
    payload           = "test"
    requiredApprovals = 1
    approvals         = []
    status            = Pending

  rejectedCid <- submit ops1 $ exerciseCmd cid Reject with
    approver = ops1
    reason   = "insufficient diligence"

  submitMustFail issuer $ exerciseCmd rejectedCid Execute
```

- [ ] **Step 3: Run all four scripts**

Run:
```
cd services/canton-adapter/daml/hydrax-governance && daml build && \
for t in testHappyPath testUnauthorizedApprover testDoubleApproval testRejectBlocksExecute; do
  daml script --dar .daml/dist/hydrax-governance-0.0.1.dar \
              --script-name "Test.GovernanceScript:$t" \
              --ide-ledger || { echo "FAILED: $t"; exit 1; }
done
```
Expected: all four exit 0. No `FAILED:` line printed.

- [ ] **Step 4: Commit**

```
git add services/canton-adapter/daml/hydrax-governance/daml/Governance.daml \
         services/canton-adapter/daml/hydrax-governance/daml/Test/GovernanceScript.daml
git commit -m "feat(canton): add Reject choice and failure-path Daml Scripts"
```

---

### Task 5: Proposal interface — upgrade seam

**Files:**
- Modify: `services/canton-adapter/daml/hydrax-governance/daml/Governance.daml`
- Modify: `services/canton-adapter/daml/hydrax-governance/daml/Test/GovernanceScript.daml`

- [ ] **Step 1: Add view type + interface declaration**

In `daml/Governance.daml`, insert **after** the `data ProposalStatus` declaration and **before** the `template GovernanceProposal` declaration:
```daml
data ProposalView = ProposalView
  with
    proposer: Party
    status: ProposalStatus
    proposalType: ProposalType
  deriving (Eq, Show)

interface Proposal where
  viewtype ProposalView
```

- [ ] **Step 2: Implement interface on the template**

Append inside the `GovernanceProposal` `where` block:
```daml
    interface instance Proposal for GovernanceProposal where
      view = ProposalView with
        proposer
        status
        proposalType
```

- [ ] **Step 3: Add interface-view test**

Append to `daml/Test/GovernanceScript.daml`:
```daml
testInterfaceView : Script ()
testInterfaceView = script do
  issuer <- allocateParty "Issuer"
  ops1   <- allocateParty "Ops1"

  cid <- submit issuer $ createCmd GovernanceProposal with
    proposer          = issuer
    approvers         = [ops1]
    observers         = []
    proposalType      = ProductLaunch
    payload           = "interface view"
    requiredApprovals = 1
    approvals         = []
    status            = Pending

  let ifaceCid = toInterfaceContractId @Proposal cid
  Some view <- queryInterfaceContractId @Proposal issuer ifaceCid
  assertMsg "view.proposer must match"     $ view.proposer == issuer
  assertMsg "view.status must be Pending"  $ view.status   == Pending
  assertMsg "view.proposalType must match" $ view.proposalType == ProductLaunch
  pure ()
```

If the installed SDK exposes interface-view querying via a different helper (e.g. `queryInterfaceContractId` vs `fetchFromInterface`), adjust to that SDK's shape. The intent — *observing the contract through the interface lens* — is the invariant.

- [ ] **Step 4: Run full suite**

Run:
```
cd services/canton-adapter/daml/hydrax-governance && daml build && \
for t in testHappyPath testUnauthorizedApprover testDoubleApproval \
         testRejectBlocksExecute testInterfaceView; do
  daml script --dar .daml/dist/hydrax-governance-0.0.1.dar \
              --script-name "Test.GovernanceScript:$t" \
              --ide-ledger || { echo "FAILED: $t"; exit 1; }
done
```
Expected: all five exit 0.

- [ ] **Step 5: Commit**

```
git add services/canton-adapter/daml/hydrax-governance/daml/Governance.daml \
         services/canton-adapter/daml/hydrax-governance/daml/Test/GovernanceScript.daml
git commit -m "feat(canton): add Proposal interface and view for upgrade path"
```

---

### Task 6: README — mental model, run commands, reassignment-seam deferral

**Files:**
- Create: `services/canton-adapter/daml/hydrax-governance/README.md`

- [ ] **Step 1: Write README**

Create `services/canton-adapter/daml/hydrax-governance/README.md`:
```markdown
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

From repo root:

    cd services/canton-adapter/daml/hydrax-governance
    daml build

Then run any single script:

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

All three are valid outcomes. The plan doc at `docs/plans/2026-04-25-daml-governance-spike.md` is the authoritative record of what was built and why.
```

- [ ] **Step 2: Sanity-check word count**

Run:
```
wc -l services/canton-adapter/daml/hydrax-governance/README.md
```
Expected: 80–130 lines.

- [ ] **Step 3: Commit**

```
git add services/canton-adapter/daml/hydrax-governance/README.md
git commit -m "docs(canton): add mental model and reassignment-deferral note for hydrax-governance spike"
```

---

### Task 7: STATE.yaml verification-log entry

**Files:**
- Modify: `STATE.yaml`

- [ ] **Step 1: Append verification entry**

Under `verification_log:` in `STATE.yaml`, append a new dated line (immediately after the most recent entry):
```yaml
  - 2026-04-25 — hydrax-governance Daml spike: daml build exits 0; five Daml Scripts (testHappyPath, testUnauthorizedApprover, testDoubleApproval, testRejectBlocksExecute, testInterfaceView) all exit 0 on --ide-ledger; wc -l recorded per README "How to run" conventions; git diff --stat confirms 7 files changed across 6 commits (scaffold, template, happy-path, failure-paths, interface, README, state)
```

Record actual line counts from the run — do not copy the placeholder "wc -l recorded" phrasing literally, replace with real numbers.

Do **not** modify `current_focus:` or `next_actions:` in this task — the prototype roadmap is unrelated and this spike does not change prototype slice planning. If the user wants the spike reflected in `current_focus`, add it in a separate commit (not this one).

- [ ] **Step 2: Commit**

```
git add STATE.yaml
git commit -m "chore(state): record hydrax-governance Daml spike verification"
```

---

## 5. Self-Review

**1. Spec coverage**

| User's ask | Addressed in |
|---|---|
| Governance | Task 2 (template) + Task 3 (approve/execute) + Task 4 (reject) |
| Upgradeability | Task 5 (interface + view) |
| Canton reassignment | Task 6 (documented deferral only — no code) |
| Synchronization / consistent multi-party view | Task 2 signatory/observer discipline (implicit — Daml handles this) |

Three of four in code; one (reassignment) in prose with rationale. Acceptable for a spike because reassignment cannot be tested without Canton Enterprise + multi-synchronizer topology. Documenting the seam is the responsible move.

**2. Placeholder scan**

- No "TBD", "later", "appropriate", "handle edge cases" hits.
- Every step has either code, a command, or an explicit prose action.
- One soft spot: Task 5 Step 3 says "adjust to that SDK's shape" for interface-query helper variance. Acceptable — the invariant is documented and the executor can make the call with local feedback from `daml build`.

**3. Type consistency**

- `ProposalStatus` enum used identically across template, all choices, all scripts.
- `Approve` / `Reject` / `Execute` choice signatures match across all invocations.
- `Proposal` interface name + `@Proposal` type application consistent between Task 5 Step 1 and Step 3.
- `ProposalView` record fields match between `interface instance` (Task 5 Step 2) and the view assertions (Task 5 Step 3).

**4. Commit hygiene**

- Seven tasks → seven commits. One concern per commit.
- All commits stay inside `services/canton-adapter/daml/hydrax-governance/` or modify a single root-level file (STATE.yaml, docs/env.md). No cross-cutting commits.
- Messages lead with outcome (`feat(canton): add Approve+Execute choices with happy-path Daml Script`) not mechanism.

---

## 6. Execution Handoff — HALTED pending approval

This plan does not auto-execute. `/proceed-with-claude-recommendation` flagged `/superpowers:execute-plan` as `needs-approval` because:

1. Task 1 Step 1 installs Daml SDK (~800 MB). Project CLAUDE.md: *"No new dependencies… without explicit approval."*
2. PRD §22 Q1/Q2/Q7 are unresolved. A "discard" outcome from this spike is legitimate — approve only if the spike's learning value is worth the install.
3. The user has not yet greenlit the new `services/canton-adapter/` directory as a repo-wide concern (it establishes a precedent for how Daml work is organized).

### To proceed, reply with one of:

- **`execute inline`** — run all seven tasks in this session via `superpowers:executing-plans` with a checkpoint after each task
- **`execute subagent`** — dispatch fresh subagents per task via `superpowers:subagent-driven-development` for cleaner context
- **`install only, pause after Task 1`** — install Daml SDK + scaffold empty package, then re-decide on Tasks 2–7
- **`halt`** — keep the plan on disk, install nothing, revisit after PRD §22 questions close
- **scope edits** — e.g. "drop Task 5, skip upgradeability", "also add a Go consumer stub", "target Daml 3.x instead"

Current state: nothing changed on disk except this plan document.
