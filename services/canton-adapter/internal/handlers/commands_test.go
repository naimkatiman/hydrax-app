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

func TestSubmitCommand_CreateHappyPath(t *testing.T) {
	l := ledger.New()
	h := SubmitCommand(l)

	body := `{"kind":"create","template_id":"Daml.Hydrax:ProductCommitment","payload_json":{"sponsor":"x"}}`
	req := httptest.NewRequest(http.MethodPost, "/v1/commands", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var got struct {
		ContractID string `json:"contract_id"`
		Offset     uint64 `json:"offset"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !strings.HasPrefix(got.ContractID, "cid-") {
		t.Fatalf("contract_id %q lacks cid- prefix", got.ContractID)
	}
	if got.Offset != 1 {
		t.Fatalf("offset = %d, want 1", got.Offset)
	}
}

func TestSubmitCommand_ExerciseHappyPath(t *testing.T) {
	l := ledger.New()
	h := SubmitCommand(l)

	// First create.
	createBody := `{"kind":"create","template_id":"T","payload_json":{}}`
	rec1 := httptest.NewRecorder()
	h(rec1, httptest.NewRequest(http.MethodPost, "/v1/commands", bytes.NewBufferString(createBody)))
	if rec1.Code != http.StatusOK {
		t.Fatalf("seed create status %d", rec1.Code)
	}
	var seed struct {
		ContractID string `json:"contract_id"`
	}
	if err := json.NewDecoder(rec1.Body).Decode(&seed); err != nil {
		t.Fatalf("decode seed: %v", err)
	}

	exerciseBody := `{"kind":"exercise","template_id":"T","contract_id":"` + seed.ContractID + `","choice":"Approve","payload_json":{}}`
	rec2 := httptest.NewRecorder()
	h(rec2, httptest.NewRequest(http.MethodPost, "/v1/commands", bytes.NewBufferString(exerciseBody)))

	if rec2.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200; body=%s", rec2.Code, rec2.Body.String())
	}
	var got struct {
		ContractID string `json:"contract_id"`
		Offset     uint64 `json:"offset"`
	}
	if err := json.NewDecoder(rec2.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.ContractID != seed.ContractID {
		t.Fatalf("exercise should echo contract id; got %q want %q", got.ContractID, seed.ContractID)
	}
	if got.Offset != 2 {
		t.Fatalf("offset = %d, want 2", got.Offset)
	}
}

func TestSubmitCommand_PayloadJSONShapes(t *testing.T) {
	l := ledger.New()
	h := SubmitCommand(l)

	cases := []struct {
		name string
		body string
	}{
		{"object payload", `{"kind":"create","template_id":"T","payload_json":{"a":1}}`},
		{"array payload", `{"kind":"create","template_id":"T","payload_json":[1,2,3]}`},
		{"string payload", `{"kind":"create","template_id":"T","payload_json":"raw"}`},
		{"null payload", `{"kind":"create","template_id":"T","payload_json":null}`},
		{"omitted payload", `{"kind":"create","template_id":"T"}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h(rec, httptest.NewRequest(http.MethodPost, "/v1/commands", bytes.NewBufferString(tc.body)))
			if rec.Code != http.StatusOK {
				t.Fatalf("status: got %d, want 200; body=%s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestSubmitCommand_RejectsBadKind(t *testing.T) {
	l := ledger.New()
	h := SubmitCommand(l)

	body := `{"kind":"oops","template_id":"T","payload_json":{}}`
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodPost, "/v1/commands", bytes.NewBufferString(body)))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
	var got map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got["error"] != "bad_kind" {
		t.Fatalf("error = %q, want bad_kind", got["error"])
	}
}

func TestSubmitCommand_RejectsBadCommandShape(t *testing.T) {
	l := ledger.New()
	h := SubmitCommand(l)

	cases := []struct {
		name string
		body string
	}{
		{"exercise empty contract", `{"kind":"exercise","template_id":"T","contract_id":"","choice":"X"}`},
		{"exercise empty choice", `{"kind":"exercise","template_id":"T","contract_id":"cid-1","choice":""}`},
		{"create empty template", `{"kind":"create","template_id":""}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h(rec, httptest.NewRequest(http.MethodPost, "/v1/commands", bytes.NewBufferString(tc.body)))
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status: got %d, want 400; body=%s", rec.Code, rec.Body.String())
			}
			var got map[string]string
			if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if got["error"] != "bad_command" {
				t.Fatalf("error = %q, want bad_command", got["error"])
			}
		})
	}
}

func TestSubmitCommand_RejectsBadJSON(t *testing.T) {
	l := ledger.New()
	h := SubmitCommand(l)

	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodPost, "/v1/commands", bytes.NewBufferString(`not-json`)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
}
