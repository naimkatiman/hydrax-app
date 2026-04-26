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

func TestSubscribe_HappyPath(t *testing.T) {
	h := Subscribe(hydraxrails.NewMockRails())
	body := `{"tenant_id":"t1","product_id":"p1","investor_ref":"i1","units":1000}`
	req := httptest.NewRequest(http.MethodPost, "/v1/subscribe", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var got map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !strings.HasPrefix(got["subscription_id"], "sub-mock-") {
		t.Errorf("subscription_id %q does not match sub-mock-<n>", got["subscription_id"])
	}
}

func TestSubscribe_RejectsEmptyTenant(t *testing.T) {
	h := Subscribe(hydraxrails.NewMockRails())
	req := httptest.NewRequest(http.MethodPost, "/v1/subscribe", bytes.NewBufferString(`{"product_id":"p1"}`))
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
}

func TestSubscribe_RejectsBadJSON(t *testing.T) {
	h := Subscribe(hydraxrails.NewMockRails())
	req := httptest.NewRequest(http.MethodPost, "/v1/subscribe", bytes.NewBufferString(`not-json`))
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
}

func TestSubscribe_RejectsNonPOST(t *testing.T) {
	h := Subscribe(hydraxrails.NewMockRails())
	req := httptest.NewRequest(http.MethodGet, "/v1/subscribe", nil)
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status: got %d, want 405", rec.Code)
	}
}
