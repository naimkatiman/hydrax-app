# Product Lifecycle State Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure-Go state-machine package `services/workflow-svc/internal/lifecycle` that codifies the 5-state product lifecycle (`pending → approved → active → matured | cancelled`) defined in the `products.status` CHECK constraint. This is the FIRST half of Tier 1 item 4 (workflow lifecycle). The HTTP endpoint + DB transition handler is a follow-up slice that can land once the parallel-session subscriptions work settles in `cmd/server/main.go` and `internal/products/repo.go`.

**Architecture:** Pure functions, no IO. Transition table as a Go-native `map[State]map[State]bool`. `Transition(from, to)` returns `nil` if allowed or `ErrInvalidTransition` otherwise. `AllowedNext(from)` returns the slice of valid successor states (useful for UI affordances). `IsTerminal(state)` reports whether the state is a sink (no outgoing transitions). No DB, no HTTP, no logging — just the rules.

**Tech Stack:** Go 1.22, stdlib only. No new dependencies.

---

## Scope Boundary (read before starting)

1. **Pure package only.** No `cmd/server/main.go` change. No HTTP route. No `internal/products/repo.go` change. No new DB migration. The endpoint is a future slice.
2. **Why pivoted:** parallel session committed to `services/workflow-svc/cmd/server/main.go` and `services/workflow-svc/internal/products/` 2 minutes before this slice started. Touching either is a merge-conflict trap. The lifecycle package is brand-new files in a new subdirectory — zero collision risk.
3. **State constants must match the schema CHECK.** `db/postgres/migrations/0001_initial.sql:35-36` defines `('pending','approved','active','matured','cancelled')`. Drift is forbidden.
4. **The transition table IS the spec.** No "configurable" lifecycle, no plugin hook, no runtime override. YAGNI.
5. **Anti-scope (refuse):** entry/exit actions, transition guards beyond identity, async transitions, concurrent state, persistence, audit emission, RBAC, multi-tenant variations, tenant-overridable graphs.

## File Structure

```
services/workflow-svc/internal/lifecycle/
  lifecycle.go           # NEW — State type, transition table, Transition + AllowedNext + IsTerminal
  lifecycle_test.go      # NEW — table-driven tests covering valid + invalid + terminal cases
docs/plans/
  2026-04-25-product-lifecycle-state-machine.md   # THIS FILE
```

## The Transition Table (locked decision)

Standard short-duration credit lifecycle (PRD §14 Q3 default):

| From      | Valid → To             | Rationale                                       |
| --------- | ---------------------- | ----------------------------------------------- |
| pending   | approved, cancelled    | Issuer/ops approves term sheet OR pulls early   |
| approved  | active, cancelled      | Subscription window opens OR issuer pulls late  |
| active    | matured, cancelled     | Term completes normally OR early termination    |
| matured   | (none — terminal)      | Principal returned, lifecycle done              |
| cancelled | (none — terminal)      | Withdrawn at any point, no resurrection         |

Self-transitions (`approved → approved`) are NOT allowed — a redundant call signals a caller bug, not a no-op.

---

## Task 1: State Type + Transition Table

**Files:**
- Create: `services/workflow-svc/internal/lifecycle/lifecycle.go`
- Create: `services/workflow-svc/internal/lifecycle/lifecycle_test.go`

- [ ] **Step 1: Write the failing tests first**

Create `services/workflow-svc/internal/lifecycle/lifecycle_test.go`:

```go
package lifecycle

import (
	"errors"
	"sort"
	"testing"
)

func TestStateConstantsMatchSchema(t *testing.T) {
	// Schema CHECK is ('pending','approved','active','matured','cancelled').
	// Drift here = drift from DB. Do not loosen this assertion.
	want := []string{"pending", "approved", "active", "matured", "cancelled"}
	got := []string{
		string(StatePending),
		string(StateApproved),
		string(StateActive),
		string(StateMatured),
		string(StateCancelled),
	}
	if len(got) != len(want) {
		t.Fatalf("constant count mismatch: got %d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("constant order mismatch at %d: got %q, want %q", i, got[i], want[i])
		}
	}
}

func TestTransitionAllowsValidEdges(t *testing.T) {
	cases := []struct {
		from, to State
	}{
		{StatePending, StateApproved},
		{StatePending, StateCancelled},
		{StateApproved, StateActive},
		{StateApproved, StateCancelled},
		{StateActive, StateMatured},
		{StateActive, StateCancelled},
	}
	for _, c := range cases {
		if err := Transition(c.from, c.to); err != nil {
			t.Errorf("Transition(%s, %s) unexpected error: %v", c.from, c.to, err)
		}
	}
}

func TestTransitionRejectsInvalidEdges(t *testing.T) {
	cases := []struct {
		from, to State
		reason   string
	}{
		{StatePending, StateActive, "must approve before activating"},
		{StatePending, StateMatured, "must run lifecycle"},
		{StateApproved, StatePending, "no rewind"},
		{StateApproved, StateMatured, "must activate first"},
		{StateActive, StatePending, "no rewind"},
		{StateActive, StateApproved, "no rewind"},
		{StateMatured, StatePending, "terminal"},
		{StateMatured, StateApproved, "terminal"},
		{StateMatured, StateActive, "terminal"},
		{StateMatured, StateCancelled, "terminal"},
		{StateCancelled, StatePending, "terminal"},
		{StateCancelled, StateApproved, "terminal"},
		{StateCancelled, StateActive, "terminal"},
		{StateCancelled, StateMatured, "terminal"},
	}
	for _, c := range cases {
		err := Transition(c.from, c.to)
		if err == nil {
			t.Errorf("Transition(%s, %s) expected error (%s), got nil", c.from, c.to, c.reason)
			continue
		}
		if !errors.Is(err, ErrInvalidTransition) {
			t.Errorf("Transition(%s, %s) expected ErrInvalidTransition, got %v", c.from, c.to, err)
		}
	}
}

func TestTransitionRejectsSelfLoops(t *testing.T) {
	for _, s := range []State{StatePending, StateApproved, StateActive, StateMatured, StateCancelled} {
		if err := Transition(s, s); err == nil {
			t.Errorf("Transition(%s, %s) self-loop should fail, got nil", s, s)
		}
	}
}

func TestTransitionRejectsUnknownStates(t *testing.T) {
	if err := Transition(State("garbage"), StateApproved); err == nil {
		t.Error("Transition from unknown state should fail")
	}
	if err := Transition(StatePending, State("garbage")); err == nil {
		t.Error("Transition to unknown state should fail")
	}
}

func TestAllowedNextReturnsSortedSlice(t *testing.T) {
	cases := []struct {
		from State
		want []State
	}{
		{StatePending, []State{StateApproved, StateCancelled}},
		{StateApproved, []State{StateActive, StateCancelled}},
		{StateActive, []State{StateCancelled, StateMatured}},
		{StateMatured, []State{}},
		{StateCancelled, []State{}},
	}
	for _, c := range cases {
		got := AllowedNext(c.from)
		// Sort both sides — table order is canonical (alphabetical by state name).
		sortStates(got)
		sortStates(c.want)
		if !equalStates(got, c.want) {
			t.Errorf("AllowedNext(%s) = %v, want %v", c.from, got, c.want)
		}
	}
}

func TestIsTerminalIdentifiesSinks(t *testing.T) {
	terminal := []State{StateMatured, StateCancelled}
	nonterminal := []State{StatePending, StateApproved, StateActive}
	for _, s := range terminal {
		if !IsTerminal(s) {
			t.Errorf("IsTerminal(%s) = false, want true", s)
		}
	}
	for _, s := range nonterminal {
		if IsTerminal(s) {
			t.Errorf("IsTerminal(%s) = true, want false", s)
		}
	}
}

func sortStates(ss []State) {
	sort.Slice(ss, func(i, j int) bool { return ss[i] < ss[j] })
}

func equalStates(a, b []State) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd services/workflow-svc && go test ./internal/lifecycle/... 2>&1 | head -10
```

Expected: build failure — `State`, constants, `Transition`, `AllowedNext`, `IsTerminal`, `ErrInvalidTransition` all undefined.

- [ ] **Step 3: Write the implementation**

Create `services/workflow-svc/internal/lifecycle/lifecycle.go`:

```go
// Package lifecycle codifies the product lifecycle state machine.
// State constants mirror the products.status CHECK constraint in
// db/postgres/migrations/0001_initial.sql. Pure functions only —
// persistence and HTTP wiring live elsewhere.
package lifecycle

import (
	"errors"
	"fmt"
)

// State is the product lifecycle state. The string values must match
// the schema CHECK exactly: 'pending','approved','active','matured','cancelled'.
type State string

const (
	StatePending   State = "pending"
	StateApproved  State = "approved"
	StateActive    State = "active"
	StateMatured   State = "matured"
	StateCancelled State = "cancelled"
)

// ErrInvalidTransition is returned when Transition is called with a
// (from, to) pair that is not in the table. Callers can branch via
// errors.Is(err, ErrInvalidTransition).
var ErrInvalidTransition = errors.New("lifecycle: invalid transition")

// allowed maps each from-state to the set of valid to-states. Terminal
// states (matured, cancelled) have no outgoing edges.
var allowed = map[State]map[State]bool{
	StatePending: {
		StateApproved:  true,
		StateCancelled: true,
	},
	StateApproved: {
		StateActive:    true,
		StateCancelled: true,
	},
	StateActive: {
		StateMatured:   true,
		StateCancelled: true,
	},
	StateMatured:   {}, // terminal
	StateCancelled: {}, // terminal
}

// Transition validates a state change. Returns nil if (from, to) is in
// the table; ErrInvalidTransition otherwise. Self-loops (from == to)
// are rejected — a redundant transition signals a caller bug, not a
// no-op.
func Transition(from, to State) error {
	successors, ok := allowed[from]
	if !ok {
		return fmt.Errorf("%w: unknown from state %q", ErrInvalidTransition, from)
	}
	if from == to {
		return fmt.Errorf("%w: self-loop %s -> %s rejected", ErrInvalidTransition, from, to)
	}
	if !successors[to] {
		// to-state may also be unknown; surface it generically as part
		// of the invalid-transition message.
		return fmt.Errorf("%w: %s -> %s not allowed", ErrInvalidTransition, from, to)
	}
	return nil
}

// AllowedNext returns the slice of valid successor states for from,
// or an empty slice if from is terminal or unknown. Slice order is
// not guaranteed — sort at call site if you need deterministic output.
func AllowedNext(from State) []State {
	successors, ok := allowed[from]
	if !ok {
		return []State{}
	}
	out := make([]State, 0, len(successors))
	for s := range successors {
		out = append(out, s)
	}
	return out
}

// IsTerminal reports whether the state has no outgoing transitions.
// Unknown states return false (do not assume).
func IsTerminal(s State) bool {
	successors, ok := allowed[s]
	if !ok {
		return false
	}
	return len(successors) == 0
}
```

- [ ] **Step 4: Run tests, verify all green**

```bash
cd services/workflow-svc && go test ./internal/lifecycle/... -v
```

Expected: 6 tests PASS — `TestStateConstantsMatchSchema`, `TestTransitionAllowsValidEdges`, `TestTransitionRejectsInvalidEdges`, `TestTransitionRejectsSelfLoops`, `TestTransitionRejectsUnknownStates`, `TestAllowedNextReturnsSortedSlice`, `TestIsTerminalIdentifiesSinks`.

- [ ] **Step 5: Verify go vet clean across the whole service**

```bash
cd services/workflow-svc && go vet ./...
```

Expected: silent.

- [ ] **Step 6: Verify regression — existing tests still green**

```bash
cd services/workflow-svc && DATABASE_URL='postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable' go test ./...
```

Expected: all packages green. The lifecycle package adds tests; nothing else changed.

- [ ] **Step 7: Commit**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git add services/workflow-svc/internal/lifecycle/ docs/plans/2026-04-25-product-lifecycle-state-machine.md
git commit -m "$(cat <<'EOF'
feat(workflow-svc): add product lifecycle state machine

Pure-functional package codifying the 5-state product lifecycle
(pending → approved → active → matured | cancelled) defined in
the products.status CHECK constraint. Provides Transition,
AllowedNext, IsTerminal. Self-loops + unknown states + invalid
edges all rejected via ErrInvalidTransition.

Scope intentionally excludes the HTTP transition endpoint and DB
update — those land in a follow-up once the parallel-session
subscriptions work in cmd/server/main.go settles. This package
is brand-new files in a new subdirectory; zero merge-conflict
risk with concurrent work.

Plan: docs/plans/2026-04-25-product-lifecycle-state-machine.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Slice Closure Checklist

- [ ] `git status` clean
- [ ] `git log --oneline -2` shows 1 commit (lifecycle + plan in same commit since plan + 2 source files = 3 files total — under the 15-file cap)
- [ ] `(cd services/workflow-svc && go vet ./...)` silent
- [ ] `(cd services/workflow-svc && DATABASE_URL=... go test ./...)` all green including lifecycle
- [ ] No changes to `cmd/server/main.go`
- [ ] No changes to `internal/products/`
- [ ] No new DB migration

## Follow-up (next session)

When the parallel session's subscriptions work has settled (no commits to `services/workflow-svc/cmd/server/main.go` for ≥30 minutes), the wire-up slice can land:

1. `internal/products/repo.go` adds `UpdateStatus(ctx, id, newStatus) error` that calls `lifecycle.Transition(currentStatus, newStatus)` first.
2. `internal/handlers/products.go` adds `Transition(repo)` returning POST `/v1/products/{id}/transition` with body `{"to": "approved"}`. Returns 200 + updated row, 409 on invalid transition (using `errors.Is(err, lifecycle.ErrInvalidTransition)`), 404 on unknown product.
3. `cmd/server/main.go` mounts the route alongside the existing product routes.
4. Optional: emit an audit event via the audit-svc HTTP API on each successful transition (cross-service wire — separate concern).
