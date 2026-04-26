package credit

import (
	"errors"
	"sort"
	"testing"
)

func TestTransitionAllowed(t *testing.T) {
	cases := []struct {
		from, to State
	}{
		{StateDraft, StateKYCPending},
		{StateKYCPending, StateTermsLocked},
		{StateKYCPending, StateCancelled},
		{StateTermsLocked, StateSubscriptionOpen},
		{StateTermsLocked, StateCancelled},
		{StateSubscriptionOpen, StateFunded},
		{StateSubscriptionOpen, StateCancelled},
		{StateFunded, StateAccruing},
		{StateFunded, StateDefaulted},
		{StateAccruing, StateMatured},
		{StateAccruing, StateDefaulted},
		{StateMatured, StateSettled},
	}
	for _, c := range cases {
		if err := Transition(c.from, c.to); err != nil {
			t.Errorf("Transition(%s,%s) = %v, want nil", c.from, c.to, err)
		}
	}
}

func TestTransitionRejected(t *testing.T) {
	cases := []struct {
		from, to State
	}{
		{StateDraft, StateFunded},      // skipping
		{StateSettled, StateAccruing},  // terminal -> non-terminal
		{StateCancelled, StateDraft},   // terminal -> anything
		{StateDefaulted, StateSettled}, // defaulted is terminal in this FSM
		{StateDraft, StateDraft},       // self-loop
		{State("ghost"), StateDraft},   // unknown from
	}
	for _, c := range cases {
		err := Transition(c.from, c.to)
		if !errors.Is(err, ErrInvalidTransition) {
			t.Errorf("Transition(%s,%s) = %v, want ErrInvalidTransition", c.from, c.to, err)
		}
	}
}

func TestAllowedNext(t *testing.T) {
	got := AllowedNext(StateFunded)
	sort.Slice(got, func(i, j int) bool { return got[i] < got[j] })
	want := []State{StateAccruing, StateDefaulted}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("AllowedNext(funded) = %v, want %v", got, want)
	}
	if got := AllowedNext(StateSettled); len(got) != 0 {
		t.Errorf("AllowedNext(settled) = %v, want empty", got)
	}
	if got := AllowedNext(State("ghost")); len(got) != 0 {
		t.Errorf("AllowedNext(unknown) = %v, want empty", got)
	}
}

func TestIsTerminal(t *testing.T) {
	for _, s := range []State{StateSettled, StateCancelled, StateDefaulted} {
		if !IsTerminal(s) {
			t.Errorf("IsTerminal(%s) = false, want true", s)
		}
	}
	for _, s := range []State{StateDraft, StateFunded, StateAccruing} {
		if IsTerminal(s) {
			t.Errorf("IsTerminal(%s) = true, want false", s)
		}
	}
	if IsTerminal(State("ghost")) {
		t.Error("IsTerminal(unknown) = true, want false")
	}
}
