package observability

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// readLogLines parses the buffer as one slog JSON record per line.
func readLogLines(t *testing.T, buf *bytes.Buffer) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, line := range strings.Split(strings.TrimRight(buf.String(), "\n"), "\n") {
		if line == "" {
			continue
		}
		var m map[string]any
		if err := json.Unmarshal([]byte(line), &m); err != nil {
			t.Fatalf("parse log line %q: %v", line, err)
		}
		out = append(out, m)
	}
	return out
}

func TestLoggingMiddleware_EmitsOneLineWithExpectedFields(t *testing.T) {
	buf := &bytes.Buffer{}
	logger := NewLogger(buf)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	wrapped := LoggingMiddleware(logger)(mux)
	srv := httptest.NewServer(wrapped)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/healthz")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	resp.Body.Close()

	lines := readLogLines(t, buf)
	if len(lines) != 1 {
		t.Fatalf("got %d log lines, want 1; body=%q", len(lines), buf.String())
	}
	rec := lines[0]
	if rec["msg"] != "http_request" {
		t.Errorf("msg = %v, want http_request", rec["msg"])
	}
	if rec["method"] != "GET" {
		t.Errorf("method = %v", rec["method"])
	}
	if rec["path"] != "/healthz" {
		t.Errorf("path = %v", rec["path"])
	}
	if rec["status"].(float64) != 200 {
		t.Errorf("status = %v", rec["status"])
	}
	if _, ok := rec["duration_ms"]; !ok {
		t.Error("missing duration_ms")
	}
	if id, ok := rec["request_id"].(string); !ok || len(id) == 0 {
		t.Errorf("request_id = %v (type %T)", rec["request_id"], rec["request_id"])
	}
	if rec["level"] != "INFO" {
		t.Errorf("level = %v, want INFO", rec["level"])
	}
}

func TestLoggingMiddleware_WarnFor4xx_ErrorFor5xx(t *testing.T) {
	buf := &bytes.Buffer{}
	logger := NewLogger(buf)

	mux := http.NewServeMux()
	mux.HandleFunc("/four", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	})
	mux.HandleFunc("/five", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	wrapped := LoggingMiddleware(logger)(mux)
	srv := httptest.NewServer(wrapped)
	defer srv.Close()

	for _, p := range []string{"/four", "/five"} {
		resp, err := http.Get(srv.URL + p)
		if err != nil {
			t.Fatalf("get %s: %v", p, err)
		}
		resp.Body.Close()
	}

	lines := readLogLines(t, buf)
	if len(lines) != 2 {
		t.Fatalf("got %d lines, want 2", len(lines))
	}
	if lines[0]["level"] != "WARN" {
		t.Errorf("4xx level = %v, want WARN", lines[0]["level"])
	}
	if lines[1]["level"] != "ERROR" {
		t.Errorf("5xx level = %v, want ERROR", lines[1]["level"])
	}
}

func TestLoggingMiddleware_SkipsMetricsPath(t *testing.T) {
	buf := &bytes.Buffer{}
	logger := NewLogger(buf)

	mux := http.NewServeMux()
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	})
	wrapped := LoggingMiddleware(logger)(mux)
	srv := httptest.NewServer(wrapped)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/metrics")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	resp.Body.Close()

	if buf.Len() != 0 {
		t.Errorf("expected no log lines for /metrics, got: %q", buf.String())
	}
}
