// Package binance is the upstream client for Binance public REST endpoints.
// Only public market endpoints are called — no trading, no account, no
// private data. BINANCE_API_KEY is optional; it raises rate limits but is
// not required for any of these calls.
package binance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/symbols"
)

// Client speaks to Binance public REST.
type Client struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

// New constructs a Client. apiKey may be empty (public market endpoints
// work without it).
func New(baseURL, apiKey string, timeout time.Duration) *Client {
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		http:    &http.Client{Timeout: timeout},
	}
}

// Ticker is the response from /api/v3/ticker/price.
// Binance returns price as a string; we keep it as string here and let
// callers parse if they need a float (preserves precision).
type Ticker struct {
	Symbol string `json:"symbol"`
	Price  string `json:"price"`
}

// Kline is one OHLCV bar from /api/v3/klines, unmarshalled from Binance's
// array-of-arrays response into a named struct.
type Kline struct {
	OpenTime  int64
	Open      string
	High      string
	Low       string
	Close     string
	Volume    string
	CloseTime int64
}

// Errors callers branch on via errors.Is.
var (
	ErrUpstream     = errors.New("binance: upstream error")
	ErrRateLimited  = errors.New("binance: rate limited")
	ErrNotFound     = errors.New("binance: not found")
)

// Ticker calls GET /api/v3/ticker/price?symbol=BTCUSDT.
// Caller passes internal "BASE/QUOTE"; client normalizes via symbols pkg.
func (c *Client) Ticker(ctx context.Context, symbol string) (*Ticker, error) {
	bs, err := symbols.NormalizeForBinance(symbol)
	if err != nil {
		return nil, err
	}
	u := fmt.Sprintf("%s/api/v3/ticker/price?symbol=%s", c.baseURL, bs)
	resp, err := c.do(ctx, u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := classifyStatus(resp); err != nil {
		return nil, err
	}

	var out Ticker
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("binance: decode ticker: %w", err)
	}
	return &out, nil
}

// Klines calls GET /api/v3/klines?symbol=...&interval=...&limit=...
// Binance interval is short form (5m, 1h, 1d). We map from internal vocabulary
// (5min, 1h, 1day) via symbols.IntervalForBinance.
func (c *Client) Klines(ctx context.Context, symbol, interval string, limit int) ([]Kline, error) {
	bs, err := symbols.NormalizeForBinance(symbol)
	if err != nil {
		return nil, err
	}
	bi, ok := symbols.IntervalForBinance[interval]
	if !ok {
		return nil, fmt.Errorf("binance: unsupported interval %q", interval)
	}

	u := fmt.Sprintf("%s/api/v3/klines?symbol=%s&interval=%s&limit=%d",
		c.baseURL, bs, bi, limit)
	resp, err := c.do(ctx, u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := classifyStatus(resp); err != nil {
		return nil, err
	}

	// Binance kline payload is an array of arrays. Each row is positional:
	// [openTime, open, high, low, close, volume, closeTime, ...trailing fields].
	var raw [][]any
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("binance: decode klines: %w", err)
	}

	out := make([]Kline, 0, len(raw))
	for i, row := range raw {
		if len(row) < 7 {
			return nil, fmt.Errorf("binance: klines[%d]: short row (%d cols)", i, len(row))
		}
		openTime, ok1 := toInt64(row[0])
		closeTime, ok2 := toInt64(row[6])
		if !ok1 || !ok2 {
			return nil, fmt.Errorf("binance: klines[%d]: bad timestamps", i)
		}
		out = append(out, Kline{
			OpenTime:  openTime,
			Open:      asString(row[1]),
			High:      asString(row[2]),
			Low:       asString(row[3]),
			Close:     asString(row[4]),
			Volume:    asString(row[5]),
			CloseTime: closeTime,
		})
	}
	return out, nil
}

func (c *Client) do(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("binance: build request: %w", err)
	}
	if c.apiKey != "" {
		req.Header.Set("X-MBX-APIKEY", c.apiKey)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	return resp, nil
}

func classifyStatus(resp *http.Response) error {
	switch {
	case resp.StatusCode == http.StatusOK:
		return nil
	case resp.StatusCode == http.StatusNotFound:
		return ErrNotFound
	case resp.StatusCode == http.StatusTooManyRequests, resp.StatusCode == 418:
		// Binance returns 429 for rate-limit warning, 418 for IP ban.
		return ErrRateLimited
	case resp.StatusCode >= 500:
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
		return fmt.Errorf("%w: status %s body=%q", ErrUpstream, strconv.Itoa(resp.StatusCode), body)
	default:
		return fmt.Errorf("%w: unexpected status %d", ErrUpstream, resp.StatusCode)
	}
}

func toInt64(v any) (int64, bool) {
	switch x := v.(type) {
	case float64:
		return int64(x), true
	case int64:
		return x, true
	default:
		return 0, false
	}
}

func asString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}
