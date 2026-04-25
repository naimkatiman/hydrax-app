package symbols

// IntervalForBinance maps internal interval strings to Binance's notation.
// Internal vocabulary mirrors what most market-data UIs use; Binance shortens
// "min" → "m" and "day" → "d".
var IntervalForBinance = map[string]string{
	"1min":  "1m",
	"5min":  "5m",
	"15min": "15m",
	"30min": "30m",
	"1h":    "1h",
	"4h":    "4h",
	"1day":  "1d",
	"1week": "1w",
}

// IsValidInterval reports whether interval is in our supported set.
func IsValidInterval(interval string) bool {
	_, ok := IntervalForBinance[interval]
	return ok
}
