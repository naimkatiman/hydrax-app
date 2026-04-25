// Package config loads market-data-svc env-var configuration with explicit
// zero-tolerance for missing required vars.
package config

import (
	"errors"
	"fmt"
	"os"
	"time"
)

// Config is the runtime configuration for market-data-svc.
type Config struct {
	Port             string
	HubURL           string
	HubTimeout       time.Duration
	BinanceAPIBase   string
	BinanceAPIKey    string // optional, raises rate limits only
}

// Load reads env vars and returns a populated Config or an error.
// Required: MARKET_DATA_HUB_URL.
// Defaults: PORT=7006, MARKET_DATA_HUB_TIMEOUT=5s,
// BINANCE_API_BASE=https://api.binance.com.
func Load() (*Config, error) {
	cfg := &Config{
		Port:           getenv("PORT", "7006"),
		HubURL:         os.Getenv("MARKET_DATA_HUB_URL"),
		BinanceAPIBase: getenv("BINANCE_API_BASE", "https://api.binance.com"),
		BinanceAPIKey:  os.Getenv("BINANCE_API_KEY"),
	}

	if cfg.HubURL == "" {
		return nil, errors.New("config: MARKET_DATA_HUB_URL is required")
	}

	timeout := getenv("MARKET_DATA_HUB_TIMEOUT", "5s")
	d, err := time.ParseDuration(timeout)
	if err != nil {
		return nil, fmt.Errorf("config: MARKET_DATA_HUB_TIMEOUT %q: %w", timeout, err)
	}
	cfg.HubTimeout = d

	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
