package handlers

import (
	"encoding/json"
	"net/http"
)

func Health(service string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"service": service,
			"status":  "ok",
		})
	}
}
