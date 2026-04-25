package hub

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/symbols"
)

func TestCandles_HappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/candles/") {
			t.Errorf("unexpected path %q", r.URL.Path)
		}
		if r.URL.Query().Get("interval") != "5min" {
			t.Errorf("interval: got %q, want %q", r.URL.Query().Get("interval"), "5min")
		}
		if r.URL.Query().Get("limit") != "2" {
			t.Errorf("limit: got %q, want %q", r.URL.Query().Get("limit"), "2")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"symbol":"EUR/USD","interval":"5min","count":2,"values":[
				{"datetime":"2026-04-25 07:45:00","open":1.17215,"high":1.17215,"low":1.17202,"close":1.17208,"volume":0},
				{"datetime":"2026-04-25 07:50:00","open":1.17208,"high":1.17252,"low":1.17202,"close":1.17236,"volume":0}
			]}`))
	}))
	defer srv.Close()

	c := New(srv.URL, 2*time.Second)
	got, err := c.Candles(context.Background(), "EUR/USD", "5min", 2)
	if err != nil {
		t.Fatalf("Candles: %v", err)
	}
	if got.Count != 2 || len(got.Values) != 2 {
		t.Fatalf("count=%d values=%d", got.Count, len(got.Values))
	}
	if got.Values[0].Open != 1.17215 {
		t.Errorf("Open: got %v, want 1.17215", got.Values[0].Open)
	}
}

func TestCandles_404(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer srv.Close()

	c := New(srv.URL, 2*time.Second)
	_, err := c.Candles(context.Background(), "EUR/USD", "5min", 1)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestCandles_500(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("upstream timeout"))
	}))
	defer srv.Close()

	c := New(srv.URL, 2*time.Second)
	_, err := c.Candles(context.Background(), "EUR/USD", "5min", 1)
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("expected ErrUpstream, got %v", err)
	}
}

func TestCandles_RejectsCryptoSymbol(t *testing.T) {
	c := New("http://does-not-matter", 1*time.Second)
	_, err := c.Candles(context.Background(), "BTC/USD", "5min", 1)
	if !errors.Is(err, symbols.ErrUnknownSymbol) {
		t.Fatalf("expected ErrUnknownSymbol (BTC/USD is crypto, not on hub), got %v", err)
	}
}

func TestCandles_Timeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(500 * time.Millisecond):
		case <-r.Context().Done():
		}
	}))
	defer srv.Close()

	c := New(srv.URL, 50*time.Millisecond)
	_, err := c.Candles(context.Background(), "EUR/USD", "5min", 1)
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("expected ErrUpstream from timeout, got %v", err)
	}
}

func TestExchangeRates_HappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/exchange-rates" {
			t.Errorf("unexpected path %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[
			{"from_currency":"EUR","to_currency":"GBP","rate":0.86974,"timestamp":1776331320,"fetched_at":"2026-04-16T09:24:03.188Z"},
			{"from_currency":"USD","to_currency":"JPY","rate":159.03639,"timestamp":1776331320,"fetched_at":"2026-04-16T09:24:01.412Z"}
		]}`))
	}))
	defer srv.Close()

	c := New(srv.URL, 2*time.Second)
	got, err := c.ExchangeRates(context.Background())
	if err != nil {
		t.Fatalf("ExchangeRates: %v", err)
	}
	if len(got.Data) != 2 {
		t.Fatalf("len: got %d, want 2", len(got.Data))
	}
	if got.Data[0].FromCurrency != "EUR" || got.Data[0].ToCurrency != "GBP" || got.Data[0].Rate != 0.86974 {
		t.Errorf("first row mismatch: %#v", got.Data[0])
	}
}

func TestExchangeRates_500(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := New(srv.URL, 2*time.Second)
	_, err := c.ExchangeRates(context.Background())
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("expected ErrUpstream, got %v", err)
	}
}
