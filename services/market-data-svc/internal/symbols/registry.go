// Package symbols holds the supported-symbols registry and the normalization
// adapters from the internal {BASE}/{QUOTE} representation to each upstream's
// expected format (Binance: BASEQUOTE no-slash, hub: BASE%2FQUOTE url-encoded).
//
// v1 default allowlists per docs/plans/2026-04-25-market-data-adapter.md
// "Open questions" §1 (BTC/ETH/SOL crypto) and the hub README (18 FX pairs +
// XAU/USD + XAG/USD).
package symbols

// AssetClass describes which upstream a symbol routes to.
type AssetClass string

const (
	AssetClassCrypto      AssetClass = "crypto"
	AssetClassFX          AssetClass = "fx"
	AssetClassCommodity   AssetClass = "commodity"
)

// CryptoAllowlist — v1 default per plan §"Open questions" Q1.
var CryptoAllowlist = []string{
	"BTC/USD",
	"ETH/USD",
	"SOL/USD",
}

// FXAllowlist — the 18 pairs market-data-hub serves per its README.
var FXAllowlist = []string{
	"EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
	"USD/CAD", "AUD/USD", "NZD/USD",
	"EUR/GBP", "EUR/JPY", "EUR/CHF",
	"GBP/JPY", "GBP/CHF", "AUD/JPY",
	"USD/MYR", "USD/SGD", "USD/HKD", "USD/CNH", "USD/INR",
}

// CommodityAllowlist — XAU/XAG via the hub.
var CommodityAllowlist = []string{
	"XAU/USD",
	"XAG/USD",
}

// AssetClassOf returns the asset class for a known symbol, or false.
func AssetClassOf(symbol string) (AssetClass, bool) {
	for _, s := range CryptoAllowlist {
		if s == symbol {
			return AssetClassCrypto, true
		}
	}
	for _, s := range FXAllowlist {
		if s == symbol {
			return AssetClassFX, true
		}
	}
	for _, s := range CommodityAllowlist {
		if s == symbol {
			return AssetClassCommodity, true
		}
	}
	return "", false
}
