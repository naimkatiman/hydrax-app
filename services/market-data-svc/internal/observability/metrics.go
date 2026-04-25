// Package observability holds Prometheus metrics and structured-logging
// middleware for market-data-svc. Collectors register against the default
// Prometheus registry exactly once at package init via promauto, so importers
// can wire `/metrics` with `promhttp.Handler()` without worrying about
// duplicate-registration panics across tests.
package observability

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// metricsPath is excluded from request counters to avoid Prometheus scrape
// feedback loops (each scrape would otherwise increment its own counter).
const metricsPath = "/metrics"

// httpRequestsTotal counts inbound HTTP requests by path/method/status.
var httpRequestsTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Count of inbound HTTP requests by path, method and status.",
	},
	[]string{"path", "method", "status"},
)

// httpRequestDuration observes inbound HTTP request latency by path/method.
// Default buckets are appropriate for sub-second handlers; if the upstream
// hub starts pushing P99 above 10s we should revisit.
var httpRequestDuration = promauto.NewHistogramVec(
	prometheus.HistogramOpts{
		Name: "http_request_duration_seconds",
		Help: "Latency of inbound HTTP requests in seconds.",
	},
	[]string{"path", "method"},
)

// cacheHitsTotal counts cache hits keyed by cache name (candles, quote, fx).
var cacheHitsTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "cache_hits_total",
		Help: "Count of in-process cache hits by cache name.",
	},
	[]string{"cache"},
)

// cacheMissesTotal counts cache misses keyed by cache name.
var cacheMissesTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "cache_misses_total",
		Help: "Count of in-process cache misses by cache name.",
	},
	[]string{"cache"},
)

// upstreamRequestDuration observes upstream client latency by upstream name
// (binance, hub) and endpoint (ticker, klines, candles, exchange-rates).
var upstreamRequestDuration = promauto.NewHistogramVec(
	prometheus.HistogramOpts{
		Name: "upstream_request_duration_seconds",
		Help: "Latency of upstream HTTP calls in seconds.",
	},
	[]string{"upstream", "endpoint"},
)

// RecordCacheHit increments the hit counter for a named cache.
func RecordCacheHit(cache string) {
	cacheHitsTotal.WithLabelValues(cache).Inc()
}

// RecordCacheMiss increments the miss counter for a named cache.
func RecordCacheMiss(cache string) {
	cacheMissesTotal.WithLabelValues(cache).Inc()
}

// RecordUpstream observes the latency of one upstream call.
func RecordUpstream(upstream, endpoint string, d time.Duration) {
	upstreamRequestDuration.WithLabelValues(upstream, endpoint).Observe(d.Seconds())
}

// statusRecorder wraps http.ResponseWriter to capture the status code that
// the inner handler writes (or 200 by default if the handler streams body
// without ever calling WriteHeader).
type statusRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (s *statusRecorder) WriteHeader(code int) {
	if s.wroteHeader {
		return
	}
	s.status = code
	s.wroteHeader = true
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Write(b []byte) (int, error) {
	if !s.wroteHeader {
		s.status = http.StatusOK
		s.wroteHeader = true
	}
	return s.ResponseWriter.Write(b)
}

// MetricsMiddleware records request count and duration around the inner
// handler. It skips the /metrics path itself to avoid scrape feedback.
func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == metricsPath {
			next.ServeHTTP(w, r)
			return
		}
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()
		next.ServeHTTP(rec, r)
		elapsed := time.Since(start).Seconds()
		path := normalizePath(r.URL.Path)
		method := r.Method
		httpRequestsTotal.WithLabelValues(path, method, strconv.Itoa(rec.status)).Inc()
		httpRequestDuration.WithLabelValues(path, method).Observe(elapsed)
	})
}

// normalizePath maps request URLs to a low-cardinality label. Path params
// (symbols, intervals, FX bases/quotes) are stripped to avoid metrics
// cardinality blow-up. The first two segments under /v1/ are enough to
// identify the route; everything beyond is collapsed.
func normalizePath(p string) string {
	switch {
	case p == "/healthz", p == metricsPath, p == "/":
		return p
	case len(p) > 4 && p[:4] == "/v1/":
		// Keep the literal route group, drop concrete params.
		// /v1/candles/BTC%2FUSD     -> /v1/candles/:symbol
		// /v1/quotes/BTC%2FUSD      -> /v1/quotes/:symbol
		// /v1/fx/EUR/USD            -> /v1/fx/:base/:quote
		return collapseV1(p)
	default:
		return "/other"
	}
}

func collapseV1(p string) string {
	// Split on "/" -> ["", "v1", "<group>", "<a>", "<b>"...]
	// Group is index 2; everything past that is param.
	const prefix = "/v1/"
	rest := p[len(prefix):]
	// First segment after /v1/.
	for i := 0; i < len(rest); i++ {
		if rest[i] == '/' {
			group := rest[:i]
			tail := rest[i+1:]
			// Two-segment tail (fx/base/quote) keeps both as :base/:quote.
			if group == "fx" && containsSlash(tail) {
				return "/v1/fx/:base/:quote"
			}
			return "/v1/" + group + "/:symbol"
		}
	}
	// No further slashes — group route only (unlikely).
	return "/v1/" + rest
}

func containsSlash(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] == '/' {
			return true
		}
	}
	return false
}
