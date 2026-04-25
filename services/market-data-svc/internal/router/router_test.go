package router

import (
	"testing"

	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/symbols"
)

func TestFor(t *testing.T) {
	cases := []struct {
		symbol   string
		want     Upstream
		wantCls  symbols.AssetClass
		wantOK   bool
	}{
		{"BTC/USD", UpstreamBinance, symbols.AssetClassCrypto, true},
		{"ETH/USD", UpstreamBinance, symbols.AssetClassCrypto, true},
		{"SOL/USD", UpstreamBinance, symbols.AssetClassCrypto, true},
		{"EUR/USD", UpstreamHub, symbols.AssetClassFX, true},
		{"USD/JPY", UpstreamHub, symbols.AssetClassFX, true},
		{"XAU/USD", UpstreamHub, symbols.AssetClassCommodity, true},
		{"XAG/USD", UpstreamHub, symbols.AssetClassCommodity, true},
		{"DOGE/USD", "", "", false},
		{"GARBAGE", "", "", false},
		{"", "", "", false},
	}
	for _, c := range cases {
		got, cls, ok := For(c.symbol)
		if got != c.want || cls != c.wantCls || ok != c.wantOK {
			t.Errorf("For(%q) = (%q, %q, %v), want (%q, %q, %v)",
				c.symbol, got, cls, ok, c.want, c.wantCls, c.wantOK)
		}
	}
}
