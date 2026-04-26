package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sort"

	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/sublifecycle"
	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/subscriptions"
)

type createSubscriptionBody struct {
	ProductID      string `json:"product_id"`
	InvestorUserID string `json:"investor_user_id"`
	AmountMinor    int64  `json:"amount_minor"`
	Currency       string `json:"currency"`
}

type subscriptionResponse struct {
	ID             string   `json:"id"`
	ProductID      string   `json:"product_id"`
	InvestorUserID string   `json:"investor_user_id"`
	AmountMinor    int64    `json:"amount_minor"`
	Currency       string   `json:"currency"`
	Status         string   `json:"status"`
	AllowedNext    []string `json:"allowed_next"`
	CreatedAt      string   `json:"created_at"`
	UpdatedAt      string   `json:"updated_at"`
}

func toSubscriptionResponse(s *subscriptions.Subscription) subscriptionResponse {
	next := sublifecycle.AllowedNext(sublifecycle.State(s.Status))
	out := make([]string, 0, len(next))
	for _, st := range next {
		out = append(out, string(st))
	}
	sort.Strings(out)
	return subscriptionResponse{
		ID:             s.ID,
		ProductID:      s.ProductID,
		InvestorUserID: s.InvestorUserID,
		AmountMinor:    s.AmountMinor,
		Currency:       s.Currency,
		Status:         s.Status,
		AllowedNext:    out,
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

type transitionSubscriptionBody struct {
	To string `json:"to"`
}

// TransitionSubscription handles POST /v1/subscriptions/{id}/transition.
//
// This endpoint is for system-driven and ops-console operator transitions
// of subscription state. Production user-facing approval UX would route
// through approval-svc; calling this endpoint directly bypasses the
// approval audit trail.
//
// No audit emission and no rails-adapter call. Subscription audit is a
// follow-up slice; subscription allocations have no rails surface today
// (deferred-not-resolved per CLAUDE.md Decisions). When those land, the
// shape mirrors handlers.Transition for products.
//
// Returns:
//
//	200 with updated subscription on success
//	400 on bad JSON / missing fields
//	404 when the subscription id does not exist
//	409 when status drifted between GetByID and UpdateStatus (race) or id is unknown by the time UpdateStatus runs
//	422 when (current_status, body.to) is not a legal sublifecycle edge
//	500 on other errors
func TransitionSubscription(repo *subscriptions.Subscriptions) http.HandlerFunc {
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
		var body transitionSubscriptionBody
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
			if subscriptions.IsNotFound(err) {
				errorJSON(w, http.StatusNotFound, "not_found", "no subscription with that id")
				return
			}
			log.Printf("workflow-svc: subscriptions.Transition GetByID(%q): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}

		from := sublifecycle.State(current.Status)
		to := sublifecycle.State(body.To)
		if err := sublifecycle.Transition(from, to); err != nil {
			errorJSON(w, http.StatusUnprocessableEntity, "invalid_transition", err.Error())
			return
		}

		updated, err := repo.UpdateStatus(r.Context(), id, current.Status, body.To)
		if err != nil {
			if subscriptions.IsStaleStatus(err) {
				errorJSON(w, http.StatusConflict, "stale_status",
					"subscription status changed under us — refetch and retry")
				return
			}
			log.Printf("workflow-svc: subscriptions.Transition UpdateStatus(%q): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(toSubscriptionResponse(updated))
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
