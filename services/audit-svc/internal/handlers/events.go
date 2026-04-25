package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/naimkatiman/hydrax-app/services/audit-svc/internal/audit"
)

type appendBody struct {
	TenantID     string          `json:"tenant_id"`
	ActorUserID  *string         `json:"actor_user_id,omitempty"`
	Action       string          `json:"action"`
	ResourceType string          `json:"resource_type"`
	ResourceID   string          `json:"resource_id"`
	Payload      json.RawMessage `json:"payload,omitempty"`
}

type eventResponse struct {
	ID           string          `json:"id"`
	TenantID     string          `json:"tenant_id"`
	ActorUserID  *string         `json:"actor_user_id,omitempty"`
	Action       string          `json:"action"`
	ResourceType string          `json:"resource_type"`
	ResourceID   string          `json:"resource_id"`
	Payload      json.RawMessage `json:"payload"`
	CreatedAt    string          `json:"created_at"`
}

func toResponse(e *audit.Event) eventResponse {
	return eventResponse{
		ID:           e.ID,
		TenantID:     e.TenantID,
		ActorUserID:  e.ActorUserID,
		Action:       e.Action,
		ResourceType: e.ResourceType,
		ResourceID:   e.ResourceID,
		Payload:      e.Payload,
		CreatedAt:    e.CreatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
	}
}

func errorJSON(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code, "message": msg})
}

// Append handles POST /v1/audit/events. Body cap 64 KB. Required
// fields: tenant_id, action, resource_type, resource_id. Returns 201
// with the persisted row, 400 on bad input, 405 on non-POST, 500
// otherwise (with internal detail logged, generic message returned).
func Append(repo *audit.Events) http.HandlerFunc {
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
		if body.TenantID == "" || body.Action == "" || body.ResourceType == "" || body.ResourceID == "" {
			errorJSON(w, http.StatusBadRequest, "missing_fields",
				"tenant_id, action, resource_type, and resource_id are required")
			return
		}
		got, err := repo.Append(r.Context(), audit.EventInput{
			TenantID:     body.TenantID,
			ActorUserID:  body.ActorUserID,
			Action:       body.Action,
			ResourceType: body.ResourceType,
			ResourceID:   body.ResourceID,
			Payload:      body.Payload,
		})
		if err != nil {
			log.Printf("audit-svc: events.Append: %v", err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(toResponse(got))
	}
}

// List handles GET /v1/audit/events?tenant_id=&resource_type=&resource_id=
// Returns 200 with newest-first array, 400 if any of the three query
// params are missing, 405 on non-GET, 500 otherwise.
func List(repo *audit.Events) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "GET only")
			return
		}
		q := r.URL.Query()
		tenantID := q.Get("tenant_id")
		resourceType := q.Get("resource_type")
		resourceID := q.Get("resource_id")
		if tenantID == "" || resourceType == "" || resourceID == "" {
			errorJSON(w, http.StatusBadRequest, "missing_query_params",
				"tenant_id, resource_type, and resource_id query params are required")
			return
		}
		got, err := repo.ListByResource(r.Context(), tenantID, resourceType, resourceID)
		if err != nil {
			log.Printf("audit-svc: events.List(%s/%s/%s): %v", tenantID, resourceType, resourceID, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		out := make([]eventResponse, 0, len(got))
		for i := range got {
			out = append(out, toResponse(&got[i]))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(out)
	}
}
