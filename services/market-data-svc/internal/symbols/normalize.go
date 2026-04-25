package symbols

import (
	"errors"
	"net/url"
	"strings"
)

// ErrUnknownSymbol is returned when a symbol is not in the registry, or when
// it is in the registry but does not belong to the asset class the caller
// asked to normalize for (e.g. asking the Binance adapter for EUR/USD).
var ErrUnknownSymbol = errors.New("symbols: unknown symbol")

// NormalizeForBinance converts internal "BASE/QUOTE" → Binance "BASEQUOTE".
// USD quotes map to USDT on Binance (BTC/USD → BTCUSDT) since Binance's USD
// pairs are quoted in USDT for spot.
func NormalizeForBinance(symbol string) (string, error) {
	class, ok := AssetClassOf(symbol)
	if !ok || class != AssetClassCrypto {
		return "", ErrUnknownSymbol
	}
	base, quote, ok := splitPair(symbol)
	if !ok {
		return "", ErrUnknownSymbol
	}
	if quote == "USD" {
		quote = "USDT"
	}
	return base + quote, nil
}

// NormalizeForHub converts internal "BASE/QUOTE" → hub url-encoded
// "BASE%2FQUOTE". Only FX and commodity symbols route to the hub.
func NormalizeForHub(symbol string) (string, error) {
	class, ok := AssetClassOf(symbol)
	if !ok || (class != AssetClassFX && class != AssetClassCommodity) {
		return "", ErrUnknownSymbol
	}
	return url.PathEscape(symbol), nil
}

func splitPair(symbol string) (base, quote string, ok bool) {
	i := strings.IndexByte(symbol, '/')
	if i <= 0 || i == len(symbol)-1 {
		return "", "", false
	}
	return symbol[:i], symbol[i+1:], true
}
