// Package sublifecycle codifies the subscription lifecycle state machine.
// State constants mirror the subscriptions.status CHECK constraint in
// db/postgres/migrations/0001_initial.sql. Pure functions only —
// persistence and HTTP wiring live elsewhere.
//
// Kept distinct from internal/lifecycle (product FSM) because the two
// domains share state names but not edges. Coupling them into one
// package would conflate orthogonal concerns and make future per-FSM
// changes harder to reason about.
package sublifecycle

import (
	"errors"
	"fmt"
)

// State is the subscription lifecycle state. The string values must
// match the schema CHECK exactly:
// 'pending','approved','allocated','settled','cancelled'.
type State string

const (
	StatePending   State = "pending"
	StateApproved  State = "approved"
	StateAllocated State = "allocated"
	StateSettled   State = "settled"
	StateCancelled State = "cancelled"
)

// ErrInvalidTransition is returned when Transition is called with a
// (from, to) pair that is not in the table. Callers can branch via
// errors.Is(err, ErrInvalidTransition).
var ErrInvalidTransition = errors.New("sublifecycle: invalid transition")

// allowed maps each from-state to the set of valid to-states. Terminal
// states (settled, cancelled) have no outgoing edges. Cancellation is
// permitted only before allocation — once units are allocated, reversal
// is a separate compensating workflow (refund/buyback), not a status
// flip. See docs/plans/2026-04-26-subscription-lifecycle-fsm.md.
var allowed = map[State]map[State]bool{
	StatePending: {
		StateApproved:  true,
		StateCancelled: true,
	},
	StateApproved: {
		StateAllocated: true,
		StateCancelled: true,
	},
	StateAllocated: {
		StateSettled: true,
	},
	StateSettled:   {},
	StateCancelled: {},
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
