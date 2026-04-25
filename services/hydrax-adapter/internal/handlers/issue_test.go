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

func TestIssue_HappyPath(t *testing.T) {
	rails := hydraxrails.NewMockRails()
	h := Issue(rails)

	body := `{"tenant_id":"t1","product_code":"MMF-USD"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/issue", bytes.NewBufferString(body))
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
	if got["product_id"] == "" {
		t.Fatalf("product_id empty")
	}
	if !strings.HasPrefix(got["product_id"], "mock-MMF-USD-") {
		t.Errorf("product_id %q does not match mock-<code>-<n>", got["product_id"])
	}
}

func TestIssue_RejectsEmptyTenant(t *testing.T) {
	rails := hydraxrails.NewMockRails()
	h := Issue(rails)

	body := `{"tenant_id":"","product_code":"X"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/issue", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
}

func TestIssue_RejectsBadJSON(t *testing.T) {
	rails := hydraxrails.NewMockRails()
	h := Issue(rails)

	req := httptest.NewRequest(http.MethodPost, "/v1/issue", bytes.NewBufferString(`not-json`))
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
}

func TestIssue_RejectsNonPOST(t *testing.T) {
	rails := hydraxrails.NewMockRails()
	h := Issue(rails)

	req := httptest.NewRequest(http.MethodGet, "/v1/issue", nil)
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status: got %d, want 405", rec.Code)
	}
}
