package observability

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"log/slog"
	"net/http"
	"os"
	"time"
)

// requestIDKey identifies the request id in the log record.
const requestIDKey = "request_id"

// NewLogger returns a JSON-handler slog.Logger writing to the given writer.
// Pass nil for stdout. Used by main.go and overridable in tests.
func NewLogger(w io.Writer) *slog.Logger {
	if w == nil {
		w = os.Stdout
	}
	return slog.New(slog.NewJSONHandler(w, &slog.HandlerOptions{Level: slog.LevelInfo}))
}

// LoggingMiddleware emits one structured log line per request after the
// inner handler returns. Level is INFO for 2xx/3xx, WARN for 4xx, ERROR
// for 5xx. Requests to /metrics are not logged to avoid scrape spam.
//
// The middleware also generates a short hex request id and stamps it on
// the log record. Future work can propagate this via context for
// downstream correlation; for now it scopes to the single log line.
func LoggingMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = NewLogger(nil)
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == metricsPath {
				next.ServeHTTP(w, r)
				return
			}
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			start := time.Now()
			reqID := newRequestID()

			next.ServeHTTP(rec, r)

			durationMS := float64(time.Since(start).Microseconds()) / 1000.0
			level := levelForStatus(rec.status)
			logger.LogAttrs(r.Context(), level, "http_request",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", rec.status),
				slog.Float64("duration_ms", durationMS),
				slog.String(requestIDKey, reqID),
			)
		})
	}
}

func levelForStatus(status int) slog.Level {
	switch {
	case status >= 500:
		return slog.LevelError
	case status >= 400:
		return slog.LevelWarn
	default:
		return slog.LevelInfo
	}
}

// newRequestID returns a 16-hex-char random id (8 random bytes). Falls back
// to the unix-nano timestamp when crypto/rand fails, which is good enough
// for log correlation.
func newRequestID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return time.Now().UTC().Format("20060102T150405.000000000")
	}
	return hex.EncodeToString(b[:])
}
