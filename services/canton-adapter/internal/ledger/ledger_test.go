package ledger

import (
	"strings"
	"sync"
	"testing"
)

func TestAllocateParty(t *testing.T) {
	l := New()
	p, err := l.AllocateParty("issuer-acme")
	if err != nil {
		t.Fatalf("allocate: %v", err)
	}
	if !strings.HasPrefix(p, "issuer-acme::") {
		t.Fatalf("party hint not honoured: %q", p)
	}
	parties := l.Parties()
	if len(parties) != 1 || parties[0] != p {
		t.Fatalf("Parties() = %v, want [%q]", parties, p)
	}
}

func TestAllocatePartyEmptyHint(t *testing.T) {
	l := New()
	if _, err := l.AllocateParty(""); err == nil {
		t.Fatal("expected error for empty hint")
	}
}

func TestAllocatePartyMultiple(t *testing.T) {
	l := New()
	a, err := l.AllocateParty("issuer-acme")
	if err != nil {
		t.Fatalf("allocate a: %v", err)
	}
	b, err := l.AllocateParty("issuer-acme")
	if err != nil {
		t.Fatalf("allocate b: %v", err)
	}
	if a == b {
		t.Fatalf("expected unique parties from same hint, got %q twice", a)
	}
	if len(l.Parties()) != 2 {
		t.Fatalf("Parties() len = %d, want 2", len(l.Parties()))
	}
}

func TestSubmitCreateAssignsOffset(t *testing.T) {
	l := New()
	cid, off, err := l.SubmitCreate("Daml.Hydrax:ProductCommitment", []byte(`{"sponsor":"x"}`))
	if err != nil {
		t.Fatalf("submit: %v", err)
	}
	if cid == "" {
		t.Fatal("contract id empty")
	}
	if !strings.HasPrefix(cid, "cid-") {
		t.Fatalf("contract id %q does not have cid- prefix", cid)
	}
	if off != 1 {
		t.Fatalf("first offset = %d, want 1", off)
	}
}

func TestSubmitCreateRejectsEmptyTemplateID(t *testing.T) {
	l := New()
	if _, _, err := l.SubmitCreate("", []byte("{}")); err == nil {
		t.Fatal("expected error for empty template_id")
	}
}

func TestSubmitExerciseHappy(t *testing.T) {
	l := New()
	cid, _, err := l.SubmitCreate("T", []byte("{}"))
	if err != nil {
		t.Fatalf("seed create: %v", err)
	}
	off, err := l.SubmitExercise("T", cid, "Approve", []byte("{}"))
	if err != nil {
		t.Fatalf("submit exercise: %v", err)
	}
	if off != 2 {
		t.Fatalf("exercise offset = %d, want 2", off)
	}
}

func TestSubmitExerciseValidatesArgs(t *testing.T) {
	l := New()
	cases := []struct {
		name       string
		template   string
		contractID string
		choice     string
	}{
		{"empty template", "", "cid-1", "Approve"},
		{"empty contract", "T", "", "Approve"},
		{"empty choice", "T", "cid-1", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := l.SubmitExercise(tc.template, tc.contractID, tc.choice, []byte("{}")); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}

func TestEventsAfterOffset(t *testing.T) {
	l := New()
	for i := 0; i < 3; i++ {
		if _, _, err := l.SubmitCreate("T", []byte("{}")); err != nil {
			t.Fatalf("submit %d: %v", i, err)
		}
	}
	evs, next := l.EventsAfter(1)
	if len(evs) != 2 {
		t.Fatalf("EventsAfter(1) returned %d events, want 2", len(evs))
	}
	if next != 3 {
		t.Fatalf("next offset = %d, want 3", next)
	}
	if evs[0].Offset != 2 || evs[1].Offset != 3 {
		t.Fatalf("offsets = %d,%d, want 2,3", evs[0].Offset, evs[1].Offset)
	}
	for _, e := range evs {
		if e.Kind != "create" {
			t.Errorf("kind = %q, want create", e.Kind)
		}
	}
}

func TestEventsAfterEmpty(t *testing.T) {
	l := New()
	evs, next := l.EventsAfter(0)
	if len(evs) != 0 {
		t.Fatalf("len = %d, want 0", len(evs))
	}
	if next != 0 {
		t.Fatalf("next = %d, want 0", next)
	}
}

func TestEventsAfterPastTail(t *testing.T) {
	l := New()
	if _, _, err := l.SubmitCreate("T", []byte("{}")); err != nil {
		t.Fatalf("seed: %v", err)
	}
	evs, next := l.EventsAfter(99)
	if len(evs) != 0 {
		t.Fatalf("len = %d, want 0", len(evs))
	}
	if next != 99 {
		t.Fatalf("next = %d, want 99 (echo of after when nothing matches)", next)
	}
}

func TestConcurrentSubmitCreate(t *testing.T) {
	l := New()
	var wg sync.WaitGroup
	const n = 50
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, _, err := l.SubmitCreate("T", []byte("{}")); err != nil {
				t.Errorf("submit: %v", err)
			}
		}()
	}
	wg.Wait()
	evs, _ := l.EventsAfter(0)
	if len(evs) != n {
		t.Fatalf("len events = %d, want %d", len(evs), n)
	}
	seen := map[uint64]bool{}
	for _, e := range evs {
		if seen[e.Offset] {
			t.Fatalf("duplicate offset %d", e.Offset)
		}
		seen[e.Offset] = true
	}
}
