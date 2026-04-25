package observability

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/prometheus/client_golang/prometheus/testutil"
)

func TestMetricsMiddleware_CountsRequestsAndSkipsMetrics(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.Handle("/metrics", promhttp.Handler())

	wrapped := MetricsMiddleware(mux)
	srv := httptest.NewServer(wrapped)
	defer srv.Close()

	// Reset to known starting count for the labels we care about.
	httpRequestsTotal.Reset()
	httpRequestDuration.Reset()

	for i := 0; i < 3; i++ {
		resp, err := http.Get(srv.URL + "/healthz")
		if err != nil {
			t.Fatalf("get healthz: %v", err)
		}
		resp.Body.Close()
	}

	got := testutil.ToFloat64(httpRequestsTotal.WithLabelValues("/healthz", "GET", "200"))
	if got != 3 {
		t.Errorf("http_requests_total{/healthz,GET,200} = %v, want 3", got)
	}

	// /metrics must NOT be counted.
	resp, err := http.Get(srv.URL + "/metrics")
	if err != nil {
		t.Fatalf("get metrics: %v", err)
	}
	resp.Body.Close()
	gotMetricsCount := testutil.ToFloat64(httpRequestsTotal.WithLabelValues("/metrics", "GET", "200"))
	if gotMetricsCount != 0 {
		t.Errorf("expected /metrics to be skipped, got count=%v", gotMetricsCount)
	}
}

func TestMetricsMiddleware_DefaultsToOK(t *testing.T) {
	httpRequestsTotal.Reset()
	httpRequestDuration.Reset()

	mux := http.NewServeMux()
	// Handler that writes body without calling WriteHeader explicitly —
	// the recorder must default the status to 200.
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("hi"))
	})
	wrapped := MetricsMiddleware(mux)
	srv := httptest.NewServer(wrapped)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/healthz")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	resp.Body.Close()

	got := testutil.ToFloat64(httpRequestsTotal.WithLabelValues("/healthz", "GET", "200"))
	if got != 1 {
		t.Errorf("default status: count=%v want 1", got)
	}
}

func TestRecordCacheHitMiss(t *testing.T) {
	cacheHitsTotal.Reset()
	cacheMissesTotal.Reset()

	RecordCacheHit("candles")
	RecordCacheHit("candles")
	RecordCacheMiss("candles")

	if got := testutil.ToFloat64(cacheHitsTotal.WithLabelValues("candles")); got != 2 {
		t.Errorf("cache_hits_total{candles} = %v, want 2", got)
	}
	if got := testutil.ToFloat64(cacheMissesTotal.WithLabelValues("candles")); got != 1 {
		t.Errorf("cache_misses_total{candles} = %v, want 1", got)
	}
}

func TestRecordUpstream_ObservesDuration(t *testing.T) {
	upstreamRequestDuration.Reset()
	RecordUpstream("binance", "klines", 25*time.Millisecond)
	RecordUpstream("binance", "klines", 30*time.Millisecond)

	count := testutil.CollectAndCount(upstreamRequestDuration)
	if count == 0 {
		t.Fatal("expected at least one upstream histogram series")
	}
}

func TestNormalizePath(t *testing.T) {
	cases := []struct{ in, out string }{
		{"/healthz", "/healthz"},
		{"/metrics", "/metrics"},
		{"/v1/candles/BTC%2FUSD", "/v1/candles/:symbol"},
		{"/v1/quotes/ETH%2FUSD", "/v1/quotes/:symbol"},
		{"/v1/fx/EUR/USD", "/v1/fx/:base/:quote"},
		{"/something/else", "/other"},
	}
	for _, c := range cases {
		if got := normalizePath(c.in); got != c.out {
			t.Errorf("normalizePath(%q) = %q, want %q", c.in, got, c.out)
		}
	}
}

func TestPromhttpExposesRegisteredMetrics(t *testing.T) {
	httpRequestsTotal.Reset()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	mux.Handle("/metrics", promhttp.Handler())
	wrapped := MetricsMiddleware(mux)
	srv := httptest.NewServer(wrapped)
	defer srv.Close()

	// Drive at least one metric value.
	resp, _ := http.Get(srv.URL + "/healthz")
	if resp != nil {
		resp.Body.Close()
	}

	resp2, err := http.Get(srv.URL + "/metrics")
	if err != nil {
		t.Fatalf("scrape /metrics: %v", err)
	}
	defer resp2.Body.Close()
	raw, err := io.ReadAll(resp2.Body)
	if err != nil {
		t.Fatalf("read /metrics: %v", err)
	}
	body := string(raw)

	for _, want := range []string{
		"http_requests_total",
		"http_request_duration_seconds",
		"cache_hits_total",
		"cache_misses_total",
		"upstream_request_duration_seconds",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("/metrics body missing %q", want)
		}
	}
}
