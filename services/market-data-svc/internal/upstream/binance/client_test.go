package binance

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestTicker_HappyPath_NoAPIKey(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v3/ticker/price" {
			t.Errorf("path: got %q", r.URL.Path)
		}
		if r.URL.Query().Get("symbol") != "BTCUSDT" {
			t.Errorf("symbol: got %q, want BTCUSDT", r.URL.Query().Get("symbol"))
		}
		if r.Header.Get("X-MBX-APIKEY") != "" {
			t.Errorf("X-MBX-APIKEY: got %q, want empty (no key configured)", r.Header.Get("X-MBX-APIKEY"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"symbol":"BTCUSDT","price":"42345.12000000"}`))
	}))
	defer srv.Close()

	c := New(srv.URL, "", 2*time.Second)
	got, err := c.Ticker(context.Background(), "BTC/USD")
	if err != nil {
		t.Fatalf("Ticker: %v", err)
	}
	if got.Symbol != "BTCUSDT" || got.Price != "42345.12000000" {
		t.Errorf("ticker: %#v", got)
	}
}

func TestTicker_WithAPIKey_SetsHeader(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("X-MBX-APIKEY"); got != "test-key" {
			t.Errorf("X-MBX-APIKEY: got %q, want %q", got, "test-key")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"symbol":"BTCUSDT","price":"1.0"}`))
	}))
	defer srv.Close()

	c := New(srv.URL, "test-key", 2*time.Second)
	if _, err := c.Ticker(context.Background(), "BTC/USD"); err != nil {
		t.Fatalf("Ticker: %v", err)
	}
}

func TestTicker_RateLimited_429(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer srv.Close()

	c := New(srv.URL, "", 2*time.Second)
	_, err := c.Ticker(context.Background(), "BTC/USD")
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("expected ErrRateLimited, got %v", err)
	}
}

func TestTicker_RateLimited_418_IPBan(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(418)
	}))
	defer srv.Close()

	c := New(srv.URL, "", 2*time.Second)
	_, err := c.Ticker(context.Background(), "BTC/USD")
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("expected ErrRateLimited (418 IP ban), got %v", err)
	}
}

func TestTicker_RejectsFXSymbol(t *testing.T) {
	c := New("http://does-not-matter", "", 1*time.Second)
	_, err := c.Ticker(context.Background(), "EUR/USD")
	if err == nil {
		t.Fatal("expected error for FX symbol on Binance client")
	}
}

func TestKlines_HappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v3/klines" {
			t.Errorf("path: got %q", r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("symbol") != "BTCUSDT" {
			t.Errorf("symbol: got %q", q.Get("symbol"))
		}
		if q.Get("interval") != "5m" {
			t.Errorf("interval: got %q, want 5m", q.Get("interval"))
		}
		if q.Get("limit") != "2" {
			t.Errorf("limit: got %q", q.Get("limit"))
		}
		w.Header().Set("Content-Type", "application/json")
		// Two rows of Binance kline payload (12 cols, the full shape).
		_, _ = w.Write([]byte(`[
			[1714000000000,"42000.00","42100.00","41950.00","42050.00","12.345",1714000299999,"518000.00",1234,"6.0","259000.00","0"],
			[1714000300000,"42050.00","42120.00","42010.00","42100.00","8.910",1714000599999,"375000.00",980,"4.5","189000.00","0"]
		]`))
	}))
	defer srv.Close()

	c := New(srv.URL, "", 2*time.Second)
	got, err := c.Klines(context.Background(), "BTC/USD", "5min", 2)
	if err != nil {
		t.Fatalf("Klines: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("len: got %d, want 2", len(got))
	}
	if got[0].OpenTime != 1714000000000 || got[0].Open != "42000.00" || got[0].Close != "42050.00" {
		t.Errorf("row 0: %#v", got[0])
	}
	if got[1].CloseTime != 1714000599999 {
		t.Errorf("row 1 closeTime: %d", got[1].CloseTime)
	}
}

func TestKlines_UnsupportedInterval(t *testing.T) {
	c := New("http://does-not-matter", "", 1*time.Second)
	_, err := c.Klines(context.Background(), "BTC/USD", "7sec", 1)
	if err == nil || !strings.Contains(err.Error(), "unsupported interval") {
		t.Fatalf("expected unsupported-interval error, got %v", err)
	}
}

func TestKlines_500_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer srv.Close()

	c := New(srv.URL, "", 2*time.Second)
	_, err := c.Klines(context.Background(), "BTC/USD", "5min", 1)
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("expected ErrUpstream, got %v", err)
	}
}
