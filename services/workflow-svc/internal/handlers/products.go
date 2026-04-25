package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/products"
)

type createBody struct {
	TenantID    string `json:"tenant_id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	ProductType string `json:"product_type"`
}

type productResponse struct {
	ID             string  `json:"id"`
	TenantID       string  `json:"tenant_id"`
	Code           string  `json:"code"`
	Name           string  `json:"name"`
	ProductType    string  `json:"product_type"`
	Status         string  `json:"status"`
	RailsProductID *string `json:"rails_product_id,omitempty"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

func toResponse(p *products.Product) productResponse {
	return productResponse{
		ID:             p.ID,
		TenantID:       p.TenantID,
		Code:           p.Code,
		Name:           p.Name,
		ProductType:    p.ProductType,
		Status:         p.Status,
		RailsProductID: p.RailsProductID,
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
			errorJSON(w, http.StatusInternalServerError, "internal", err.Error())
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
