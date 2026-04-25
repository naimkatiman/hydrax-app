package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/naimkatiman/hydrax-app/services/hydrax-adapter/internal/hydraxrails"
)

// IssueRequestBody is the JSON shape POST /v1/issue accepts.
type IssueRequestBody struct {
	TenantID    string `json:"tenant_id"`
	ProductCode string `json:"product_code"`
}

// IssueResponseBody is the JSON shape POST /v1/issue returns on 200.
type IssueResponseBody struct {
	ProductID string `json:"product_id"`
}

// Issue exposes hydraxrails.Rails.IssueProduct over HTTP. v1 ships this
// against MockRails per Decision 2026-04-25; the same handler binds to a
// real Rails impl once the HydraX surface is delivered (PRD-v2 §14 Q1).
func Issue(rails hydraxrails.Rails) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondError(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}

		var body IssueRequestBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondError(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}

		result, err := rails.IssueProduct(r.Context(), hydraxrails.IssueRequest{
			TenantID:    body.TenantID,
			ProductCode: body.ProductCode,
		})
		if err != nil {
			respondError(w, http.StatusBadRequest, "issue_rejected", err.Error())
			return
		}

		respondJSON(w, http.StatusOK, IssueResponseBody{ProductID: result.ProductID})
	}
}

func respondJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func respondError(w http.ResponseWriter, status int, code, msg string) {
	respondJSON(w, status, map[string]string{"error": code, "message": msg})
}
