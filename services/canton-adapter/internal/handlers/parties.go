package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/naimkatiman/hydrax-app/services/canton-adapter/internal/ledger"
)

// AllocatePartyRequestBody is the JSON shape POST /v1/parties accepts.
type AllocatePartyRequestBody struct {
	Hint string `json:"hint"`
}

// AllocatePartyResponseBody is the JSON shape POST /v1/parties returns.
type AllocatePartyResponseBody struct {
	Party string `json:"party"`
}

// ListPartiesResponseBody is the JSON shape GET /v1/parties returns.
type ListPartiesResponseBody struct {
	Parties []string `json:"parties"`
}

// AllocateParty exposes Ledger.AllocateParty over HTTP.
// Returns 400 bad_hint when the hint field is empty.
func AllocateParty(l *ledger.Ledger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body AllocatePartyRequestBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondError(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		if body.Hint == "" {
			respondError(w, http.StatusBadRequest, "bad_hint", "hint is required")
			return
		}
		party, err := l.AllocateParty(body.Hint)
		if err != nil {
			respondError(w, http.StatusBadRequest, "bad_hint", err.Error())
			return
		}
		respondJSON(w, http.StatusOK, AllocatePartyResponseBody{Party: party})
	}
}

// ListParties returns all currently-allocated parties.
func ListParties(l *ledger.Ledger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		parties := l.Parties()
		if parties == nil {
			parties = []string{}
		}
		respondJSON(w, http.StatusOK, ListPartiesResponseBody{Parties: parties})
	}
}

// respondJSON writes a JSON response with the given status code.
// Shared by all handlers in this package; mirrors the helper in
// services/hydrax-adapter/internal/handlers/issue.go so the two
// adapters stay shape-consistent.
func respondJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// respondError writes a {"error":code,"message":msg} body with the
// given status code.
func respondError(w http.ResponseWriter, status int, code, msg string) {
	respondJSON(w, status, map[string]string{"error": code, "message": msg})
}
