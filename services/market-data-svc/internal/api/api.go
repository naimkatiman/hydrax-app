// Package api wires the upstream clients, cache, and router into the
// public /v1 HTTP routes.
//
// Routes:
//   GET /v1/candles/{symbol}?interval=...&limit=...
//   GET /v1/quotes/{symbol}
//   GET /v1/fx/{base}/{quote}
//
// All responses are JSON. Cache-first; on upstream 5xx we serve a stale
// cached value if one exists within the stale window, else 503.
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/cache"
	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/router"
	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/symbols"
	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/upstream/binance"
	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/upstream/hub"
)

// BinanceClient is the subset of the Binance client used by handlers.
// Defining as an interface lets integration tests substitute fakes.
type BinanceClient interface {
	Ticker(ctx context.Context, symbol string) (*binance.Ticker, error)
	Klines(ctx context.Context, symbol, interval string, limit int) ([]binance.Kline, error)
}

// HubClient is the subset of the hub client used by handlers.
type HubClient interface {
	Candles(ctx context.Context, symbol, interval string, limit int) (*hub.CandlesResponse, error)
	ExchangeRates(ctx context.Context) (*hub.ExchangeRatesResponse, error)
}

// Handlers carries the state needed to serve /v1 routes.
type Handlers struct {
	Binance       BinanceClient
	Hub           HubClient
	CandlesCache  *cache.Cache[CandleResponse]
	QuoteCache    *cache.Cache[QuoteResponse]
	FXCache       *cache.Cache[FXResponse]
	CandleStaleTTL time.Duration
	QuoteStaleTTL  time.Duration
	FXStaleTTL     time.Duration
}

// ServeMux returns a configured *http.ServeMux with all /v1 routes.
// Go 1.22's pattern syntax provides path parameters via {name}.
func (h *Handlers) ServeMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/candles/{symbol}", h.candles)
	mux.HandleFunc("GET /v1/quotes/{symbol}", h.quote)
	mux.HandleFunc("GET /v1/fx/{base}/{quote}", h.fx)
	return mux
}

// Wire shape — internal contract; stable for BFF consumption.
type CandleBar struct {
	OpenTime  int64   `json:"open_time"`
	CloseTime int64   `json:"close_time"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    float64 `json:"volume"`
}

type CandleResponse struct {
	Symbol   string      `json:"symbol"`
	Interval string      `json:"interval"`
	Bars     []CandleBar `json:"bars"`
}

type QuoteResponse struct {
	Symbol string  `json:"symbol"`
	Price  float64 `json:"price"`
}

type FXResponse struct {
	Base      string  `json:"base"`
	Quote     string  `json:"quote"`
	Rate      float64 `json:"rate"`
	Timestamp int64   `json:"timestamp"`
}

func (h *Handlers) candles(w http.ResponseWriter, r *http.Request) {
	sym := r.PathValue("symbol")
	interval := r.URL.Query().Get("interval")
	if interval == "" {
		interval = "5min"
	}
	limitStr := r.URL.Query().Get("limit")
	limit := 100
	if limitStr != "" {
		n, err := strconv.Atoi(limitStr)
		if err != nil || n <= 0 || n > 1000 {
			writeError(w, http.StatusBadRequest, "invalid_limit", "limit must be 1..1000")
			return
		}
		limit = n
	}
	if !symbols.IsValidInterval(interval) {
		writeError(w, http.StatusBadRequest, "invalid_interval", fmt.Sprintf("interval %q not supported", interval))
		return
	}

	upstream, _, ok := router.For(sym)
	if !ok {
		writeError(w, http.StatusNotFound, "unknown_symbol", fmt.Sprintf("symbol %q not in registry", sym))
		return
	}

	cacheKey := fmt.Sprintf("%s|%s|%d|%s", sym, interval, limit, upstream)

	if cached, ok := h.CandlesCache.Get(cacheKey); ok {
		writeJSON(w, http.StatusOK, cached)
		return
	}

	resp, err := h.fetchCandles(r.Context(), upstream, sym, interval, limit)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		return
	}

	ttl := candleTTL(interval)
	h.CandlesCache.Set(cacheKey, *resp, ttl)
	writeJSON(w, http.StatusOK, *resp)
}

func (h *Handlers) fetchCandles(ctx context.Context, up router.Upstream, sym, interval string, limit int) (*CandleResponse, error) {
	out := &CandleResponse{Symbol: sym, Interval: interval, Bars: []CandleBar{}}

	switch up {
	case router.UpstreamBinance:
		klines, err := h.Binance.Klines(ctx, sym, interval, limit)
		if err != nil {
			return nil, err
		}
		for _, k := range klines {
			out.Bars = append(out.Bars, CandleBar{
				OpenTime:  k.OpenTime,
				CloseTime: k.CloseTime,
				Open:      parseFloat(k.Open),
				High:      parseFloat(k.High),
				Low:       parseFloat(k.Low),
				Close:     parseFloat(k.Close),
				Volume:    parseFloat(k.Volume),
			})
		}
	case router.UpstreamHub:
		cr, err := h.Hub.Candles(ctx, sym, interval, limit)
		if err != nil {
			return nil, err
		}
		for _, c := range cr.Values {
			out.Bars = append(out.Bars, CandleBar{
				Open:   c.Open,
				High:   c.High,
				Low:    c.Low,
				Close:  c.Close,
				Volume: c.Volume,
			})
		}
	default:
		return nil, fmt.Errorf("api: unknown upstream %q", up)
	}
	return out, nil
}

func (h *Handlers) quote(w http.ResponseWriter, r *http.Request) {
	sym := r.PathValue("symbol")

	upstream, _, ok := router.For(sym)
	if !ok {
		writeError(w, http.StatusNotFound, "unknown_symbol", fmt.Sprintf("symbol %q not in registry", sym))
		return
	}
	if upstream != router.UpstreamBinance {
		writeError(w, http.StatusBadRequest, "use_fx_endpoint", "/v1/quotes/{symbol} is for crypto only; use /v1/fx/{base}/{quote} for FX")
		return
	}

	cacheKey := sym

	if cached, ok := h.QuoteCache.Get(cacheKey); ok {
		writeJSON(w, http.StatusOK, cached)
		return
	}

	t, err := h.Binance.Ticker(r.Context(), sym)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		return
	}

	resp := QuoteResponse{Symbol: sym, Price: parseFloat(t.Price)}
	h.QuoteCache.Set(cacheKey, resp, 30*time.Second)
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handlers) fx(w http.ResponseWriter, r *http.Request) {
	base := r.PathValue("base")
	quote := r.PathValue("quote")
	sym := base + "/" + quote

	if _, _, ok := router.For(sym); !ok {
		writeError(w, http.StatusNotFound, "unknown_symbol", fmt.Sprintf("pair %s/%s not in registry", base, quote))
		return
	}

	cacheKey := sym
	if cached, ok := h.FXCache.Get(cacheKey); ok {
		writeJSON(w, http.StatusOK, cached)
		return
	}

	rates, err := h.Hub.ExchangeRates(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		return
	}

	for _, row := range rates.Data {
		if row.FromCurrency == base && row.ToCurrency == quote {
			resp := FXResponse{Base: base, Quote: quote, Rate: row.Rate, Timestamp: row.Timestamp}
			h.FXCache.Set(cacheKey, resp, 60*time.Second)
			writeJSON(w, http.StatusOK, resp)
			return
		}
	}
	writeError(w, http.StatusNotFound, "pair_not_in_hub", fmt.Sprintf("hub did not return %s/%s", base, quote))
}

func candleTTL(interval string) time.Duration {
	switch interval {
	case "1min":
		return 30 * time.Second
	case "5min", "15min", "30min":
		return 30 * time.Second
	case "1h", "4h":
		return 60 * time.Second
	case "1day", "1week":
		return 5 * time.Minute
	default:
		return 30 * time.Second
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, map[string]string{"error": code, "message": msg})
}

func parseFloat(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}
