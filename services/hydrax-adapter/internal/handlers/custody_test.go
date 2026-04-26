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

func TestCustody_HappyPath(t *testing.T) {
	h := Custody(hydraxrails.NewMockRails())
	body := `{"tenant_id":"t1","from":"a","to":"b","asset_ref":"USDC","units":50}`
	req := httptest.NewRequest(http.MethodPost, "/v1/custody/transfer", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var got map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !strings.HasPrefix(got["transfer_id"], "xfer-mock-") {
		t.Errorf("transfer_id %q does not match xfer-mock-<n>", got["transfer_id"])
	}
}

func TestCustody_RejectsEmptyTenant(t *testing.T) {
	h := Custody(hydraxrails.NewMockRails())
	req := httptest.NewRequest(http.MethodPost, "/v1/custody/transfer",
		bytes.NewBufferString(`{"from":"a","to":"b"}`))
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
}

func TestCustody_RejectsBadJSON(t *testing.T) {
	h := Custody(hydraxrails.NewMockRails())
	req := httptest.NewRequest(http.MethodPost, "/v1/custody/transfer", bytes.NewBufferString(`not-json`))
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
}

func TestCustody_RejectsNonPOST(t *testing.T) {
	h := Custody(hydraxrails.NewMockRails())
	req := httptest.NewRequest(http.MethodGet, "/v1/custody/transfer", nil)
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status: got %d, want 405", rec.Code)
	}
}
