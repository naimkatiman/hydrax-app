package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sort"

	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/lifecycle"
	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/products"
)

type createBody struct {
	TenantID    string `json:"tenant_id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	ProductType string `json:"product_type"`
}

type productResponse struct {
	ID             string   `json:"id"`
	TenantID       string   `json:"tenant_id"`
	Code           string   `json:"code"`
	Name           string   `json:"name"`
	ProductType    string   `json:"product_type"`
	Status         string   `json:"status"`
	RailsProductID *string  `json:"rails_product_id,omitempty"`
	AllowedNext    []string `json:"allowed_next"`
	CreatedAt      string   `json:"created_at"`
	UpdatedAt      string   `json:"updated_at"`
}

func toResponse(p *products.Product) productResponse {
	next := lifecycle.AllowedNext(lifecycle.State(p.Status))
	out := make([]string, 0, len(next))
	for _, s := range next {
		out = append(out, string(s))
	}
	sort.Strings(out) // deterministic JSON for tests + clients
	return productResponse{
		ID:             p.ID,
		TenantID:       p.TenantID,
		Code:           p.Code,
		Name:           p.Name,
		ProductType:    p.ProductType,
		Status:         p.Status,
		RailsProductID: p.RailsProductID,
		AllowedNext:    out,
		CreatedAt:      p.CreatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
		UpdatedAt:      p.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
	}
}

func errorJSON(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code, "message": msg})
}

// Create handles POST /v1/products. Requires tenant_id, code, name,
// product_type. Returns 201 with the inserted row, 400 on bad input or
// missing fields, 409 on duplicate (tenant_id, code), 500 on other
// errors.
func Create(repo *products.Products) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		var body createBody
		r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			errorJSON(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		if body.TenantID == "" || body.Code == "" || body.Name == "" || body.ProductType == "" {
			errorJSON(w, http.StatusBadRequest, "missing_fields",
				"tenant_id, code, name, and product_type are required")
			return
		}

		got, err := repo.Insert(r.Context(), products.ProductInput{
			TenantID:    body.TenantID,
			Code:        body.Code,
			Name:        body.Name,
			ProductType: body.ProductType,
		})
		if err != nil {
			// Surface DB unique-constraint as 409 by string sniff — pgx
			// errors expose code "23505" but importing pgconn just for
			// this is more weight than it's worth in MVP.
			if isUniqueViolation(err) {
				errorJSON(w, http.StatusConflict, "duplicate_code",
					"a product with this code already exists for this tenant")
				return
			}
			log.Printf("workflow-svc: products.Create: %v", err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(toResponse(got))
	}
}

// isUniqueViolation matches Postgres SQLSTATE 23505 by string. Cheap
// and correct for our use; swap to pgconn.PgError if we ever need
// finer-grained handling.
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	var dup interface{ SQLState() string }
	if errors.As(err, &dup) && dup.SQLState() == "23505" {
		return true
	}
	return false
}

// Get handles GET /v1/products/{id}. Returns 200 with the row, 404 if
// not found, 405 on non-GET, 500 otherwise.
func Get(repo *products.Products) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "GET only")
			return
		}
		id := r.PathValue("id")
		if id == "" {
			errorJSON(w, http.StatusBadRequest, "missing_id", "id path param required")
			return
		}
		got, err := repo.GetByID(r.Context(), id)
		if err != nil {
			if products.IsNotFound(err) {
				errorJSON(w, http.StatusNotFound, "not_found", "no product with that id")
				return
			}
			log.Printf("workflow-svc: products.Get(%q): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(toResponse(got))
	}
}

type transitionBody struct {
	To string `json:"to"`
}

// Transition handles POST /v1/products/{id}/transition.
//
// This endpoint is for system-driven transitions (e.g. scheduler-driven
// active->matured) and ops-console operator overrides. Production
// user-facing approval UX in distributor-portal routes through
// approval-svc, NOT this endpoint — even though pending->approved is
// reachable here, the approval-svc audit trail and multi-approver
// chain are bypassed if you call this directly.
//
// Returns:
//
//	200 with updated product on success
//	400 on bad JSON / missing fields
//	404 when the product id does not exist
//	409 when status drifted between GetByID and UpdateStatus (race) or id is unknown by the time UpdateStatus runs
//	422 when (current_status, body.to) is not a legal lifecycle edge
//	500 on other errors
func Transition(repo *products.Products) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		id := r.PathValue("id")
		if id == "" {
			errorJSON(w, http.StatusBadRequest, "missing_id", "id path param required")
			return
		}
		var body transitionBody
		r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			errorJSON(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		if body.To == "" {
			errorJSON(w, http.StatusBadRequest, "missing_to", "to field required")
			return
		}

		current, err := repo.GetByID(r.Context(), id)
		if err != nil {
			if products.IsNotFound(err) {
				errorJSON(w, http.StatusNotFound, "not_found", "no product with that id")
				return
			}
			log.Printf("workflow-svc: products.Transition GetByID(%q): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}

		from := lifecycle.State(current.Status)
		to := lifecycle.State(body.To)
		if err := lifecycle.Transition(from, to); err != nil {
			errorJSON(w, http.StatusUnprocessableEntity, "invalid_transition", err.Error())
			return
		}

		updated, err := repo.UpdateStatus(r.Context(), id, current.Status, body.To)
		if err != nil {
			if products.IsStaleStatus(err) {
				errorJSON(w, http.StatusConflict, "stale_status",
					"product status changed under us — refetch and retry")
				return
			}
			log.Printf("workflow-svc: products.Transition UpdateStatus(%q): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(toResponse(updated))
	}
}
