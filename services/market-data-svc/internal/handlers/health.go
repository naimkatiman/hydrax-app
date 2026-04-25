package handlers

import (
	"encoding/json"
	"net/http"
)

// Health returns a handler that reports the service as healthy.
// Matches the /healthz contract used by the other 5 Go services in this
// workspace: HTTP 200 with {"service":"<name>","status":"ok"}.
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
