package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/naimkatiman/hydrax-app/services/canton-adapter/internal/ledger"
)

func TestAllocateParty_HappyPath(t *testing.T) {
	l := ledger.New()
	h := AllocateParty(l)

	req := httptest.NewRequest(http.MethodPost, "/v1/parties", bytes.NewBufferString(`{"hint":"issuer-acme"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var got map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !strings.HasPrefix(got["party"], "issuer-acme::mock-") {
		t.Fatalf("party %q does not match issuer-acme::mock-XXXX", got["party"])
	}
}

func TestAllocateParty_RejectsEmptyHint(t *testing.T) {
	l := ledger.New()
	h := AllocateParty(l)

	req := httptest.NewRequest(http.MethodPost, "/v1/parties", bytes.NewBufferString(`{"hint":""}`))
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
	var got map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got["error"] != "bad_hint" {
		t.Fatalf("error code = %q, want bad_hint", got["error"])
	}
}

func TestAllocateParty_RejectsBadJSON(t *testing.T) {
	l := ledger.New()
	h := AllocateParty(l)

	req := httptest.NewRequest(http.MethodPost, "/v1/parties", bytes.NewBufferString(`not-json`))
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
}

func TestListParties_EmptyAndPopulated(t *testing.T) {
	l := ledger.New()
	h := ListParties(l)

	// Empty.
	req := httptest.NewRequest(http.MethodGet, "/v1/parties", nil)
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", rec.Code)
	}
	var empty struct {
		Parties []string `json:"parties"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&empty); err != nil {
		t.Fatalf("decode empty: %v", err)
	}
	if empty.Parties == nil {
		t.Fatalf("expected empty array, got nil")
	}
	if len(empty.Parties) != 0 {
		t.Fatalf("expected 0 parties, got %d", len(empty.Parties))
	}

	// Populate two parties.
	if _, err := l.AllocateParty("issuer-acme"); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if _, err := l.AllocateParty("distributor-beta"); err != nil {
		t.Fatalf("seed: %v", err)
	}

	rec2 := httptest.NewRecorder()
	h(rec2, httptest.NewRequest(http.MethodGet, "/v1/parties", nil))
	if rec2.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", rec2.Code)
	}
	var got struct {
		Parties []string `json:"parties"`
	}
	if err := json.NewDecoder(rec2.Body).Decode(&got); err != nil {
		t.Fatalf("decode populated: %v", err)
	}
	if len(got.Parties) != 2 {
		t.Fatalf("len = %d, want 2", len(got.Parties))
	}
}
