package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/naimkatiman/hydrax-app/services/canton-adapter/internal/ledger"
)

func TestListEvents_DefaultAfterZero(t *testing.T) {
	l := ledger.New()
	for i := 0; i < 3; i++ {
		if _, _, err := l.SubmitCreate("T", []byte("{}")); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	h := ListEvents(l)

	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, "/v1/events", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", rec.Code)
	}
	var got struct {
		Events     []ledger.Event `json:"events"`
		NextOffset uint64         `json:"next_offset"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got.Events) != 3 {
		t.Fatalf("len = %d, want 3", len(got.Events))
	}
	if got.NextOffset != 3 {
		t.Fatalf("next_offset = %d, want 3", got.NextOffset)
	}
}

func TestListEvents_AfterFilters(t *testing.T) {
	l := ledger.New()
	for i := 0; i < 3; i++ {
		if _, _, err := l.SubmitCreate("T", []byte("{}")); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	h := ListEvents(l)

	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, "/v1/events?after=1", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", rec.Code)
	}
	var got struct {
		Events     []ledger.Event `json:"events"`
		NextOffset uint64         `json:"next_offset"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got.Events) != 2 {
		t.Fatalf("len = %d, want 2", len(got.Events))
	}
	if got.Events[0].Offset != 2 || got.Events[1].Offset != 3 {
		t.Fatalf("offsets = %d,%d, want 2,3", got.Events[0].Offset, got.Events[1].Offset)
	}
	if got.NextOffset != 3 {
		t.Fatalf("next_offset = %d, want 3", got.NextOffset)
	}
}

func TestListEvents_EmptyReturnsArrayNotNull(t *testing.T) {
	l := ledger.New()
	h := ListEvents(l)

	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, "/v1/events", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", rec.Code)
	}
	var got struct {
		Events     []ledger.Event `json:"events"`
		NextOffset uint64         `json:"next_offset"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Events == nil {
		t.Fatalf("events is nil; want []")
	}
	if len(got.Events) != 0 {
		t.Fatalf("len = %d, want 0", len(got.Events))
	}
}

func TestListEvents_RejectsNegativeAfter(t *testing.T) {
	l := ledger.New()
	h := ListEvents(l)

	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, "/v1/events?after=-1", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
	var got map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got["error"] != "bad_after" {
		t.Fatalf("error = %q, want bad_after", got["error"])
	}
}

func TestListEvents_RejectsNonIntegerAfter(t *testing.T) {
	l := ledger.New()
	h := ListEvents(l)

	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, "/v1/events?after=abc", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
	var got map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got["error"] != "bad_after" {
		t.Fatalf("error = %q, want bad_after", got["error"])
	}
}

func TestListEvents_PartyFilter(t *testing.T) {
	l := ledger.New()
	if _, _, err := l.SubmitCreate("T", []byte(`{"signatory":"alice"}`)); err != nil {
		t.Fatalf("seed alice: %v", err)
	}
	if _, _, err := l.SubmitCreate("T", []byte(`{"signatory":"bob"}`)); err != nil {
		t.Fatalf("seed bob: %v", err)
	}
	h := ListEvents(l)

	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, "/v1/events?party=alice", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var got struct {
		Events     []ledger.Event `json:"events"`
		NextOffset uint64         `json:"next_offset"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got.Events) != 1 {
		t.Fatalf("len = %d, want 1 (mock loose match on alice only)", len(got.Events))
	}
}
