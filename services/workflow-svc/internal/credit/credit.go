// Package credit codifies the short-duration credit product FSM.
// Mirrors internal/lifecycle and internal/sublifecycle in shape; kept
// separate because credit edges (defaulted, accruing, matured) do not
// match the generic product or subscription FSM.
//
// This package is pure logic. No schema, no HTTP wiring. Once Q3
// (product type) is accepted by the user — see
// docs/plans/2026-04-25-q3-default-short-duration-credit.md — a
// separate plan adds persistence + handlers using this FSM.
package credit

import (
	"errors"
	"fmt"
)

// State is the short-duration credit lifecycle state.
type State string

const (
	StateDraft            State = "draft"
	StateKYCPending       State = "kyc_pending"
	StateTermsLocked      State = "terms_locked"
	StateSubscriptionOpen State = "subscription_open"
	StateFunded           State = "funded"
	StateAccruing         State = "accruing"
	StateMatured          State = "matured"
	StateSettled          State = "settled"
	StateCancelled        State = "cancelled"
	StateDefaulted        State = "defaulted"
)

// ErrInvalidTransition is returned when Transition is called with a
// (from, to) pair that is not in the table. Callers can branch via
// errors.Is(err, ErrInvalidTransition).
var ErrInvalidTransition = errors.New("credit: invalid transition")

// allowed maps each from-state to the set of valid to-states. Terminal
// states (settled, cancelled, defaulted) have no outgoing edges.
// Cancellation is permitted only before funding; once the deal is
// funded, exit paths are accruing -> matured -> settled or default.
var allowed = map[State]map[State]bool{
	StateDraft: {
		StateKYCPending: true,
	},
	StateKYCPending: {
		StateTermsLocked: true,
		StateCancelled:   true,
	},
	StateTermsLocked: {
		StateSubscriptionOpen: true,
		StateCancelled:        true,
	},
	StateSubscriptionOpen: {
		StateFunded:    true,
		StateCancelled: true,
	},
	StateFunded: {
		StateAccruing:  true,
		StateDefaulted: true,
	},
	StateAccruing: {
		StateMatured:   true,
		StateDefaulted: true,
	},
	StateMatured: {
		StateSettled: true,
	},
	StateSettled:   {},
	StateCancelled: {},
	StateDefaulted: {},
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
