package handlers

import (
	"encoding/json"
	"net/http"
)

// Health returns a handler that reports the service as healthy.
// Service name is captured at construction time so the response body
// identifies which binary answered.
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
