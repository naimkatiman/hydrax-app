package handlers

import (
	"net/http"
	"time"

	"github.com/naimkatiman/hydrax-app/services/hydrax-adapter/internal/hydraxrails"
)

type NAVResponseBody struct {
	ProductID string    `json:"product_id"`
	NAV       string    `json:"nav"`
	AsOf      time.Time `json:"as_of"`
}

func NAV(rails hydraxrails.Rails) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondError(w, http.StatusMethodNotAllowed, "method_not_allowed", "GET only")
			return
		}
		productID := r.PathValue("product_id")
		if productID == "" {
			respondError(w, http.StatusBadRequest, "bad_product_id", "product_id required")
			return
		}
		result, err := rails.NAV(r.Context(), productID)
		if err != nil {
			respondError(w, http.StatusBadRequest, "nav_rejected", err.Error())
			return
		}
		respondJSON(w, http.StatusOK, NAVResponseBody{
			ProductID: result.ProductID,
			NAV:       result.NAV,
			AsOf:      result.AsOf,
		})
	}
}
