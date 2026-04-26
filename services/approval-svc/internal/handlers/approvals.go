package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/naimkatiman/hydrax-app/services/approval-svc/internal/approvals"
)

type appendBody struct {
	TenantID     string `json:"tenant_id"`
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`
}

type decideBody struct {
	Status          string `json:"status"`
	DecidedByUserID string `json:"decided_by_user_id"`
}

type approvalResponse struct {
	ID              string  `json:"id"`
	TenantID        string  `json:"tenant_id"`
	ResourceType    string  `json:"resource_type"`
	ResourceID      string  `json:"resource_id"`
	Status          string  `json:"status"`
	DecidedByUserID *string `json:"decided_by_user_id,omitempty"`
	DecidedAt       *string `json:"decided_at,omitempty"`
	CreatedAt       string  `json:"created_at"`
}

func toResponse(a *approvals.Approval) approvalResponse {
	r := approvalResponse{
		ID:              a.ID,
		TenantID:        a.TenantID,
		ResourceType:    a.ResourceType,
		ResourceID:      a.ResourceID,
		Status:          a.Status,
		DecidedByUserID: a.DecidedByUserID,
		CreatedAt:       a.CreatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
	}
	if a.DecidedAt != nil {
		s := a.DecidedAt.UTC().Format("2006-01-02T15:04:05.000000Z")
		r.DecidedAt = &s
	}
	return r
}

func errorJSON(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code, "message": msg})
}

// Append POST /v1/approvals
func Append(repo approvals.Repo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		var body appendBody
		r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			errorJSON(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		if body.TenantID == "" || body.ResourceType == "" || body.ResourceID == "" {
			errorJSON(w, http.StatusBadRequest, "missing_fields",
				"tenant_id, resource_type, and resource_id are required")
			return
		}
		got, err := repo.Insert(r.Context(), approvals.ApprovalInput{
			TenantID:     body.TenantID,
			ResourceType: body.ResourceType,
			ResourceID:   body.ResourceID,
		})
		if err != nil {
			log.Printf("approval-svc: Insert: %v", err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(toResponse(got))
	}
}

// Get GET /v1/approvals/{id}. id pre-extracted by router.
func Get(repo approvals.Repo, id string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "GET only")
			return
		}
		got, err := repo.GetByID(r.Context(), id)
		if err != nil {
			if approvals.IsNotFound(err) {
				errorJSON(w, http.StatusNotFound, "not_found", "approval not found")
				return
			}
			log.Printf("approval-svc: GetByID(%s): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(toResponse(got))
	}
}

// ListPending GET /v1/approvals (status=pending currently the only filter).
func ListPending(repo approvals.Repo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "GET only")
			return
		}
		got, err := repo.ListPending(r.Context())
		if err != nil {
			log.Printf("approval-svc: ListPending: %v", err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		out := make([]approvalResponse, 0, len(got))
		for i := range got {
			out = append(out, toResponse(&got[i]))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(out)
	}
}

// Decide POST /v1/approvals/{id}/decide. id pre-extracted by router.
func Decide(repo approvals.Repo, id string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		var body decideBody
		r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			errorJSON(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		if body.Status != "approved" && body.Status != "rejected" {
			errorJSON(w, http.StatusBadRequest, "bad_status", `status must be "approved" or "rejected"`)
			return
		}
		if body.DecidedByUserID == "" {
			errorJSON(w, http.StatusBadRequest, "missing_fields", "decided_by_user_id is required")
			return
		}
		got, err := repo.Decide(r.Context(), id, approvals.DecideInput{
			Status: body.Status, DecidedByID: body.DecidedByUserID,
		})
		if err != nil {
			if approvals.IsNotFound(err) {
				errorJSON(w, http.StatusNotFound, "not_found", "approval not found")
				return
			}
			if approvals.IsAlreadyDecided(err) {
				errorJSON(w, http.StatusConflict, "already_decided",
					"approval already decided — first decide wins")
				return
			}
			log.Printf("approval-svc: Decide(%s): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(toResponse(got))
	}
}
