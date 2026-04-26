package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/naimkatiman/hydrax-app/services/hydrax-adapter/internal/hydraxrails"
)

// helper: invoke the NAV handler with a path-value populated request
// (mimicking what the mux's GET /v1/nav/{product_id} pattern provides).
func navRequest(productID string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/v1/nav/"+productID, nil)
	if productID != "" {
		req.SetPathValue("product_id", productID)
	}
	return req
}

func TestNAV_HappyPath(t *testing.T) {
	h := NAV(hydraxrails.NewMockRails())
	rec := httptest.NewRecorder()
	h(rec, navRequest("product-xyz"))

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var got struct {
		ProductID string `json:"product_id"`
		NAV       string `json:"nav"`
		AsOf      string `json:"as_of"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.ProductID != "product-xyz" {
		t.Errorf("product_id = %q, want product-xyz", got.ProductID)
	}
	if !strings.HasPrefix(got.NAV, "1.") || len(got.NAV) != 6 {
		t.Errorf("nav format = %q, want 1.NNNN", got.NAV)
	}
	if got.AsOf == "" {
		t.Error("as_of empty")
	}
}

func TestNAV_Deterministic(t *testing.T) {
	h := NAV(hydraxrails.NewMockRails())
	get := func() string {
		rec := httptest.NewRecorder()
		h(rec, navRequest("product-xyz"))
		var got struct{ NAV string `json:"nav"` }
		_ = json.NewDecoder(rec.Body).Decode(&got)
		return got.NAV
	}
	if a, b := get(), get(); a != b {
		t.Fatalf("NAV not deterministic across requests: %q vs %q", a, b)
	}
}

func TestNAV_RejectsEmpty(t *testing.T) {
	h := NAV(hydraxrails.NewMockRails())
	rec := httptest.NewRecorder()
	h(rec, navRequest(""))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", rec.Code)
	}
}

func TestNAV_RejectsNonGET(t *testing.T) {
	h := NAV(hydraxrails.NewMockRails())
	req := httptest.NewRequest(http.MethodPost, "/v1/nav/p1", nil)
	req.SetPathValue("product_id", "p1")
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status: got %d, want 405", rec.Code)
	}
}
