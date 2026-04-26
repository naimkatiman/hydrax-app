package sublifecycle

import (
	"errors"
	"sort"
	"testing"
)

func TestStateConstantsMatchSchema(t *testing.T) {
	want := []string{"pending", "approved", "allocated", "settled", "cancelled"}
	got := []string{
		string(StatePending),
		string(StateApproved),
		string(StateAllocated),
		string(StateSettled),
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
		{StateApproved, StateAllocated},
		{StateApproved, StateCancelled},
		{StateAllocated, StateSettled},
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
		{StatePending, StateAllocated, "must approve before allocating"},
		{StatePending, StateSettled, "must run lifecycle"},
		{StateApproved, StatePending, "no rewind"},
		{StateApproved, StateSettled, "must allocate first"},
		{StateAllocated, StatePending, "no rewind"},
		{StateAllocated, StateApproved, "no rewind"},
		{StateAllocated, StateCancelled, "post-allocation cancel forbidden — needs reversal slice"},
		{StateSettled, StatePending, "terminal"},
		{StateSettled, StateApproved, "terminal"},
		{StateSettled, StateAllocated, "terminal"},
		{StateSettled, StateCancelled, "terminal"},
		{StateCancelled, StatePending, "terminal"},
		{StateCancelled, StateApproved, "terminal"},
		{StateCancelled, StateAllocated, "terminal"},
		{StateCancelled, StateSettled, "terminal"},
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
	for _, s := range []State{StatePending, StateApproved, StateAllocated, StateSettled, StateCancelled} {
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

func TestAllowedNextReturnsValidSuccessors(t *testing.T) {
	cases := []struct {
		from State
		want []State
	}{
		{StatePending, []State{StateApproved, StateCancelled}},
		{StateApproved, []State{StateAllocated, StateCancelled}},
		{StateAllocated, []State{StateSettled}},
		{StateSettled, []State{}},
		{StateCancelled, []State{}},
	}
	for _, c := range cases {
		got := AllowedNext(c.from)
		sortStates(got)
		sortStates(c.want)
		if !equalStates(got, c.want) {
			t.Errorf("AllowedNext(%s) = %v, want %v", c.from, got, c.want)
		}
	}
}

func TestIsTerminalIdentifiesSinks(t *testing.T) {
	terminal := []State{StateSettled, StateCancelled}
	nonterminal := []State{StatePending, StateApproved, StateAllocated}
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
