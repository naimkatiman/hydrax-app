package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/naimkatiman/hydrax-app/services/hydrax-adapter/internal/hydraxrails"
)

func TestSettle_HappyPath(t *testing.T) {
	h := Settle(hydraxrails.NewMockRails())
	body := `{"tenant_id":"t1","subscription_id":"sub-1"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/settle", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var got map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !strings.HasPrefix(got["settlement_id"], "set-mock-") {
		t.Errorf("settlement_id %q does not match set-mock-<n>", got["settlement_id"])
	}
	if got["status"] != "settled" {
		t.Errorf("status = %q, want settled", got["status"])
	}
}

func TestSettle_RejectsEmptyTenant(t *testing.T) {
	h := Settle(hydraxrails.NewMockRails())
	req := httptest.NewRequest(http.MethodPost, "/v1/settle",
		bytes.NewBufferString(`{"subscription_id":"sub-1"}`))
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
}

func TestSettle_RejectsBadJSON(t *testing.T) {
	h := Settle(hydraxrails.NewMockRails())
	req := httptest.NewRequest(http.MethodPost, "/v1/settle", bytes.NewBufferString(`not-json`))
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
}

func TestSettle_RejectsNonPOST(t *testing.T) {
	h := Settle(hydraxrails.NewMockRails())
	req := httptest.NewRequest(http.MethodGet, "/v1/settle", nil)
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status: got %d, want 405", rec.Code)
	}
}
