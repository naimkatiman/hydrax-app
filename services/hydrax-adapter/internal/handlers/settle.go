package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/naimkatiman/hydrax-app/services/hydrax-adapter/internal/hydraxrails"
)

type SettleRequestBody struct {
	TenantID       string `json:"tenant_id"`
	SubscriptionID string `json:"subscription_id"`
}

type SettleResponseBody struct {
	SettlementID string `json:"settlement_id"`
	Status       string `json:"status"`
}

func Settle(rails hydraxrails.Rails) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondError(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		var body SettleRequestBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondError(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		result, err := rails.Settle(r.Context(), hydraxrails.SettleRequest{
			TenantID:       body.TenantID,
			SubscriptionID: body.SubscriptionID,
		})
		if err != nil {
			respondError(w, http.StatusBadRequest, "settle_rejected", err.Error())
			return
		}
		respondJSON(w, http.StatusOK, SettleResponseBody{
			SettlementID: result.SettlementID,
			Status:       result.Status,
		})
	}
}
