package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/cache"
	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/upstream/binance"
	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/upstream/hub"
)

// startUpstreams returns a Handlers wired against two httptest servers that
// stand in for Binance and the hub. Caller closes both via t.Cleanup.
func startUpstreams(t *testing.T, binHandler, hubHandler http.HandlerFunc) (*Handlers, *httptest.Server, *httptest.Server) {
	t.Helper()
	binSrv := httptest.NewServer(binHandler)
	hubSrv := httptest.NewServer(hubHandler)
	t.Cleanup(func() { binSrv.Close(); hubSrv.Close() })

	h := &Handlers{
		Binance:      binance.New(binSrv.URL, "", 2*time.Second),
		Hub:          hub.New(hubSrv.URL, 2*time.Second),
		CandlesCache: cache.New[CandleResponse](16, nil),
		QuoteCache:   cache.New[QuoteResponse](16, nil),
		FXCache:      cache.New[FXResponse](16, nil),
	}
	return h, binSrv, hubSrv
}

func TestRoutes_Candles_Crypto_RoutesToBinance(t *testing.T) {
	binCalled := 0
	hubCalled := 0
	h, _, _ := startUpstreams(t,
		func(w http.ResponseWriter, r *http.Request) {
			binCalled++
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`[[1714000000000,"42000.00","42100.00","41950.00","42050.00","12.345",1714000299999,"x",0,"x","x","x"]]`))
		},
		func(w http.ResponseWriter, r *http.Request) {
			hubCalled++
			http.Error(w, "should not be called", 500)
		},
	)

	srv := httptest.NewServer(h.ServeMux())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/v1/candles/BTC%2FUSD?interval=5min&limit=1")
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d", resp.StatusCode)
	}
	var body CandleResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Symbol != "BTC/USD" || len(body.Bars) != 1 || body.Bars[0].Open != 42000 {
		t.Fatalf("body: %#v", body)
	}
	if binCalled != 1 {
		t.Errorf("expected binance called once, got %d", binCalled)
	}
	if hubCalled != 0 {
		t.Errorf("expected hub NOT called, got %d", hubCalled)
	}
}

func TestRoutes_Candles_FX_RoutesToHub(t *testing.T) {
	binCalled := 0
	hubCalled := 0
	h, _, _ := startUpstreams(t,
		func(w http.ResponseWriter, r *http.Request) {
			binCalled++
			http.Error(w, "should not be called", 500)
		},
		func(w http.ResponseWriter, r *http.Request) {
			hubCalled++
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"symbol":"EUR/USD","interval":"5min","count":1,"values":[
				{"datetime":"2026-04-25 07:45:00","open":1.17215,"high":1.17215,"low":1.17202,"close":1.17208,"volume":0}
			]}`))
		},
	)

	srv := httptest.NewServer(h.ServeMux())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/v1/candles/EUR%2FUSD?interval=5min&limit=1")
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d", resp.StatusCode)
	}
	if hubCalled != 1 || binCalled != 0 {
		t.Errorf("routing: hub=%d bin=%d (want hub=1 bin=0)", hubCalled, binCalled)
	}
}

func TestRoutes_Candles_CachesSecondCall(t *testing.T) {
	binCalled := 0
	h, _, _ := startUpstreams(t,
		func(w http.ResponseWriter, r *http.Request) {
			binCalled++
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`[[1714000000000,"1.0","1.0","1.0","1.0","0",1714000299999,"x",0,"x","x","x"]]`))
		},
		func(w http.ResponseWriter, r *http.Request) {},
	)
	srv := httptest.NewServer(h.ServeMux())
	defer srv.Close()

	for i := 0; i < 3; i++ {
		resp, err := http.Get(srv.URL + "/v1/candles/BTC%2FUSD?interval=5min&limit=1")
		if err != nil {
			t.Fatalf("request %d: %v", i, err)
		}
		resp.Body.Close()
	}
	if binCalled != 1 {
		t.Errorf("expected binance called once across 3 requests (cache hit), got %d", binCalled)
	}
}

func TestRoutes_Quote_Crypto(t *testing.T) {
	h, _, _ := startUpstreams(t,
		func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"symbol":"BTCUSDT","price":"42345.12000000"}`))
		},
		func(w http.ResponseWriter, r *http.Request) {},
	)
	srv := httptest.NewServer(h.ServeMux())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/v1/quotes/BTC%2FUSD")
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d", resp.StatusCode)
	}
	var body QuoteResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Symbol != "BTC/USD" || body.Price != 42345.12 {
		t.Errorf("quote: %#v", body)
	}
}

func TestRoutes_Quote_FX_Rejected(t *testing.T) {
	h, _, _ := startUpstreams(t, func(http.ResponseWriter, *http.Request) {}, func(http.ResponseWriter, *http.Request) {})
	srv := httptest.NewServer(h.ServeMux())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/v1/quotes/EUR%2FUSD")
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400 (use_fx_endpoint)", resp.StatusCode)
	}
}

func TestRoutes_FX_HappyPath(t *testing.T) {
	h, _, _ := startUpstreams(t,
		func(http.ResponseWriter, *http.Request) {},
		func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"data":[
				{"from_currency":"EUR","to_currency":"USD","rate":1.1721,"timestamp":1776331320,"fetched_at":"2026-04-16T09:24:03.188Z"}
			]}`))
		},
	)
	srv := httptest.NewServer(h.ServeMux())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/v1/fx/EUR/USD")
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: got %d", resp.StatusCode)
	}
	var body FXResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Base != "EUR" || body.Quote != "USD" || body.Rate != 1.1721 {
		t.Errorf("fx: %#v", body)
	}
}

func TestRoutes_UnknownSymbol_404(t *testing.T) {
	h, _, _ := startUpstreams(t, func(http.ResponseWriter, *http.Request) {}, func(http.ResponseWriter, *http.Request) {})
	srv := httptest.NewServer(h.ServeMux())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/v1/candles/DOGE%2FUSD?interval=5min&limit=1")
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status: got %d, want 404", resp.StatusCode)
	}
}

func TestRoutes_InvalidInterval_400(t *testing.T) {
	h, _, _ := startUpstreams(t, func(http.ResponseWriter, *http.Request) {}, func(http.ResponseWriter, *http.Request) {})
	srv := httptest.NewServer(h.ServeMux())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/v1/candles/BTC%2FUSD?interval=7sec&limit=1")
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", resp.StatusCode)
	}
}
