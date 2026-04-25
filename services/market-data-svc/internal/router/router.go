// Package router decides which upstream serves a given symbol.
// Crypto routes to Binance; FX and commodities route to the hub.
package router

import (
	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/symbols"
)

// Upstream identifies which upstream to call.
type Upstream string

const (
	UpstreamBinance Upstream = "binance"
	UpstreamHub     Upstream = "hub"
)

// For returns the Upstream that serves the given symbol, plus its asset class
// (crypto/fx/commodity) for caller logging. Returns false if the symbol is
// not in the registry.
func For(symbol string) (Upstream, symbols.AssetClass, bool) {
	class, ok := symbols.AssetClassOf(symbol)
	if !ok {
		return "", "", false
	}
	switch class {
	case symbols.AssetClassCrypto:
		return UpstreamBinance, class, true
	case symbols.AssetClassFX, symbols.AssetClassCommodity:
		return UpstreamHub, class, true
	default:
		return "", "", false
	}
}
