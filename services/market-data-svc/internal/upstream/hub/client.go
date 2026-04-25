// Package hub is the upstream client for the market-data-hub Railway
// service (https://affectionate-consideration-production-f0be.up.railway.app).
// Hub serves FX (18 pairs) and commodities (XAU/XAG) — never crypto.
//
// Response shapes captured 2026-04-25 from the live hub.
package hub

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/symbols"
)

// Client speaks to the hub over HTTPS.
type Client struct {
	baseURL string
	http    *http.Client
}

// New constructs a Client. timeout applies to each request.
func New(baseURL string, timeout time.Duration) *Client {
	return &Client{
		baseURL: baseURL,
		http:    &http.Client{Timeout: timeout},
	}
}

// Candle is one OHLCV bar as returned by the hub.
type Candle struct {
	Datetime string  `json:"datetime"`
	Open     float64 `json:"open"`
	High     float64 `json:"high"`
	Low      float64 `json:"low"`
	Close    float64 `json:"close"`
	Volume   float64 `json:"volume"`
}

// CandlesResponse is the hub's /api/candles/:symbol envelope.
type CandlesResponse struct {
	Symbol   string   `json:"symbol"`
	Interval string   `json:"interval"`
	Count    int      `json:"count"`
	Values   []Candle `json:"values"`
}

// ExchangeRate is one row in the /api/exchange-rates response.
type ExchangeRate struct {
	FromCurrency string  `json:"from_currency"`
	ToCurrency   string  `json:"to_currency"`
	Rate         float64 `json:"rate"`
	Timestamp    int64   `json:"timestamp"`
	FetchedAt    string  `json:"fetched_at"`
}

// ExchangeRatesResponse is the hub envelope for /api/exchange-rates.
type ExchangeRatesResponse struct {
	Data []ExchangeRate `json:"data"`
}

// Errors surfaced by the client. Callers branch on these via errors.Is.
var (
	ErrUpstream         = errors.New("hub: upstream error")
	ErrNotFound         = errors.New("hub: not found")
	ErrUpstreamRateLimit = errors.New("hub: rate limited")
)

// Candles calls GET /api/candles/{url-encoded symbol}?interval=...&limit=...
// Symbol is the internal "BASE/QUOTE" form; this method url-encodes it.
func (c *Client) Candles(ctx context.Context, symbol, interval string, limit int) (*CandlesResponse, error) {
	encoded, err := symbols.NormalizeForHub(symbol)
	if err != nil {
		return nil, err
	}

	u := fmt.Sprintf("%s/api/candles/%s?interval=%s&limit=%d",
		c.baseURL, encoded, url.QueryEscape(interval), limit)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, fmt.Errorf("hub: build request: %w", err)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer resp.Body.Close()

	if err := classifyStatus(resp); err != nil {
		return nil, err
	}

	var out CandlesResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("hub: decode: %w", err)
	}
	return &out, nil
}

// ExchangeRates calls GET /api/exchange-rates and returns all rows.
func (c *Client) ExchangeRates(ctx context.Context) (*ExchangeRatesResponse, error) {
	u := c.baseURL + "/api/exchange-rates"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, fmt.Errorf("hub: build request: %w", err)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer resp.Body.Close()

	if err := classifyStatus(resp); err != nil {
		return nil, err
	}

	var out ExchangeRatesResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("hub: decode: %w", err)
	}
	return &out, nil
}

func classifyStatus(resp *http.Response) error {
	switch {
	case resp.StatusCode == http.StatusOK:
		return nil
	case resp.StatusCode == http.StatusNotFound:
		return ErrNotFound
	case resp.StatusCode == http.StatusTooManyRequests:
		return ErrUpstreamRateLimit
	case resp.StatusCode >= 500:
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
		return fmt.Errorf("%w: status %s body=%q", ErrUpstream, strconv.Itoa(resp.StatusCode), body)
	default:
		return fmt.Errorf("%w: unexpected status %d", ErrUpstream, resp.StatusCode)
	}
}
