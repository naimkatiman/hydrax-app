package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/naimkatiman/hydrax-app/services/hydrax-adapter/internal/hydraxrails"
)

type CustodyRequestBody struct {
	TenantID string `json:"tenant_id"`
	From     string `json:"from"`
	To       string `json:"to"`
	AssetRef string `json:"asset_ref"`
	Units    uint64 `json:"units"`
}

type CustodyResponseBody struct {
	TransferID string `json:"transfer_id"`
}

func Custody(rails hydraxrails.Rails) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondError(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		var body CustodyRequestBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondError(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		result, err := rails.TransferCustody(r.Context(), hydraxrails.CustodyRequest{
			TenantID: body.TenantID,
			From:     body.From,
			To:       body.To,
			AssetRef: body.AssetRef,
			Units:    body.Units,
		})
		if err != nil {
			respondError(w, http.StatusBadRequest, "custody_rejected", err.Error())
			return
		}
		respondJSON(w, http.StatusOK, CustodyResponseBody{TransferID: result.TransferID})
	}
}
