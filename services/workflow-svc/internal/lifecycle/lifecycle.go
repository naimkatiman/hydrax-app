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
	StateMatured:   {},
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
