// Package ledger is the in-memory mock testnet synchronizer.
// Replaces a real Canton participant for v1 demo. Same HTTP shape
// the eventual real adapter will expose — just RAM-backed and
// resets on restart. Swap-to-real path: keep the public method
// signatures stable and replace the in-memory state with calls
// to a real participant client (PRD-v2 §14 Q1).
package ledger

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
)

// Event is one ledger event in the mock synchronizer log.
type Event struct {
	Offset      uint64 `json:"offset"`
	Kind        string `json:"kind"` // "create" or "exercise"
	TemplateID  string `json:"template_id"`
	ContractID  string `json:"contract_id"`
	PayloadJSON []byte `json:"payload_json,omitempty"`
}

// Ledger is the synchronizer + participant state in one struct.
// Goroutine-safe; all mutating methods take the mutex.
type Ledger struct {
	mu      sync.Mutex
	parties map[string]struct{}
	events  []Event
	offset  uint64
}

// New returns an empty in-memory ledger.
func New() *Ledger {
	return &Ledger{parties: map[string]struct{}{}}
}

// AllocateParty registers a new party derived from the supplied hint.
// The hint is honoured as a prefix; a random suffix keeps allocations unique.
func (l *Ledger) AllocateParty(hint string) (string, error) {
	if hint == "" {
		return "", errors.New("ledger: party hint required")
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	suffix := randHex(4)
	party := fmt.Sprintf("%s::mock-%s", hint, suffix)
	l.parties[party] = struct{}{}
	return party, nil
}

// Parties returns a snapshot of the currently allocated parties.
func (l *Ledger) Parties() []string {
	l.mu.Lock()
	defer l.mu.Unlock()
	out := make([]string, 0, len(l.parties))
	for p := range l.parties {
		out = append(out, p)
	}
	return out
}

// SubmitCreate records a create event and returns the new contract id and offset.
func (l *Ledger) SubmitCreate(templateID string, payloadJSON []byte) (string, uint64, error) {
	if templateID == "" {
		return "", 0, errors.New("ledger: template_id required")
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	cid := "cid-" + randHex(8)
	l.offset++
	l.events = append(l.events, Event{
		Offset:      l.offset,
		Kind:        "create",
		TemplateID:  templateID,
		ContractID:  cid,
		PayloadJSON: payloadJSON,
	})
	return cid, l.offset, nil
}

// SubmitExercise records an exercise event and returns the new offset.
func (l *Ledger) SubmitExercise(templateID, contractID, choice string, payloadJSON []byte) (uint64, error) {
	if templateID == "" || contractID == "" || choice == "" {
		return 0, errors.New("ledger: template_id, contract_id, choice required")
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.offset++
	l.events = append(l.events, Event{
		Offset:      l.offset,
		Kind:        "exercise",
		TemplateID:  templateID,
		ContractID:  contractID,
		PayloadJSON: payloadJSON,
	})
	return l.offset, nil
}

// EventsAfter returns events with Offset > after, plus the highest offset
// in the returned slice. If no new events match, returns ([], after).
func (l *Ledger) EventsAfter(after uint64) ([]Event, uint64) {
	l.mu.Lock()
	defer l.mu.Unlock()
	out := []Event{}
	next := after
	for _, e := range l.events {
		if e.Offset > after {
			out = append(out, e)
			if e.Offset > next {
				next = e.Offset
			}
		}
	}
	return out, next
}

func randHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
