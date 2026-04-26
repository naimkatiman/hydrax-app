package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/naimkatiman/hydrax-app/services/hydrax-adapter/internal/hydraxrails"
)

type SubscribeRequestBody struct {
	TenantID    string `json:"tenant_id"`
	ProductID   string `json:"product_id"`
	InvestorRef string `json:"investor_ref"`
	Units       uint64 `json:"units"`
}

type SubscribeResponseBody struct {
	SubscriptionID string `json:"subscription_id"`
}

func Subscribe(rails hydraxrails.Rails) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondError(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		var body SubscribeRequestBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondError(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		result, err := rails.Subscribe(r.Context(), hydraxrails.SubscribeRequest{
			TenantID:    body.TenantID,
			ProductID:   body.ProductID,
			InvestorRef: body.InvestorRef,
			Units:       body.Units,
		})
		if err != nil {
			respondError(w, http.StatusBadRequest, "subscribe_rejected", err.Error())
			return
		}
		respondJSON(w, http.StatusOK, SubscribeResponseBody{SubscriptionID: result.SubscriptionID})
	}
}
