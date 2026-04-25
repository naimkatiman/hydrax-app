package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/subscriptions"
)

type createSubscriptionBody struct {
	ProductID      string `json:"product_id"`
	InvestorUserID string `json:"investor_user_id"`
	AmountMinor    int64  `json:"amount_minor"`
	Currency       string `json:"currency"`
}

type subscriptionResponse struct {
	ID             string `json:"id"`
	ProductID      string `json:"product_id"`
	InvestorUserID string `json:"investor_user_id"`
	AmountMinor    int64  `json:"amount_minor"`
	Currency       string `json:"currency"`
	Status         string `json:"status"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

func toSubscriptionResponse(s *subscriptions.Subscription) subscriptionResponse {
	return subscriptionResponse{
		ID:             s.ID,
		ProductID:      s.ProductID,
		InvestorUserID: s.InvestorUserID,
		AmountMinor:    s.AmountMinor,
		Currency:       s.Currency,
		Status:         s.Status,
		CreatedAt:      s.CreatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
		UpdatedAt:      s.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
	}
}

// CreateSubscription handles POST /v1/subscriptions. Requires product_id,
// investor_user_id, currency, and amount_minor >= 0. Returns 201 with the
// inserted row, 400 on bad input or missing fields, 405 on non-POST, 500
// on other errors.
func CreateSubscription(repo *subscriptions.Subscriptions) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		var body createSubscriptionBody
		r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			errorJSON(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		if body.ProductID == "" || body.InvestorUserID == "" || body.Currency == "" || body.AmountMinor < 0 {
			errorJSON(w, http.StatusBadRequest, "missing_fields",
				"product_id, investor_user_id, currency required and amount_minor >= 0")
			return
		}
		got, err := repo.Insert(r.Context(), subscriptions.SubscriptionInput{
			ProductID:      body.ProductID,
			InvestorUserID: body.InvestorUserID,
			AmountMinor:    body.AmountMinor,
			Currency:       body.Currency,
		})
		if err != nil {
			log.Printf("workflow-svc: subscriptions.Create: %v", err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(toSubscriptionResponse(got))
	}
}

// GetSubscription handles GET /v1/subscriptions/{id}. Returns 200 with the
// row, 404 if not found, 405 on non-GET, 500 otherwise.
func GetSubscription(repo *subscriptions.Subscriptions) http.HandlerFunc {
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
			if subscriptions.IsNotFound(err) {
				errorJSON(w, http.StatusNotFound, "not_found", "no subscription with that id")
				return
			}
			log.Printf("workflow-svc: subscriptions.Get(%q): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(toSubscriptionResponse(got))
	}
}
