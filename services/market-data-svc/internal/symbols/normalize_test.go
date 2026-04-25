package symbols

import (
	"errors"
	"testing"
)

func TestNormalizeForBinance(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"BTC/USD", "BTCUSDT"},
		{"ETH/USD", "ETHUSDT"},
		{"SOL/USD", "SOLUSDT"},
	}
	for _, c := range cases {
		got, err := NormalizeForBinance(c.in)
		if err != nil {
			t.Fatalf("NormalizeForBinance(%q): unexpected err %v", c.in, err)
		}
		if got != c.want {
			t.Errorf("NormalizeForBinance(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestNormalizeForBinance_FXRejected(t *testing.T) {
	_, err := NormalizeForBinance("EUR/USD")
	if err == nil {
		t.Fatal("expected NormalizeForBinance(EUR/USD) to return error (FX is not on Binance)")
	}
	if !errors.Is(err, ErrUnknownSymbol) {
		t.Errorf("expected ErrUnknownSymbol, got %v", err)
	}
}

func TestNormalizeForHub(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"EUR/USD", "EUR%2FUSD"},
		{"XAU/USD", "XAU%2FUSD"},
		{"GBP/JPY", "GBP%2FJPY"},
	}
	for _, c := range cases {
		got, err := NormalizeForHub(c.in)
		if err != nil {
			t.Fatalf("NormalizeForHub(%q): unexpected err %v", c.in, err)
		}
		if got != c.want {
			t.Errorf("NormalizeForHub(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestNormalizeForHub_CryptoRejected(t *testing.T) {
	_, err := NormalizeForHub("BTC/USD")
	if err == nil {
		t.Fatal("expected NormalizeForHub(BTC/USD) to return error (crypto is not on hub)")
	}
	if !errors.Is(err, ErrUnknownSymbol) {
		t.Errorf("expected ErrUnknownSymbol, got %v", err)
	}
}

func TestNormalize_UnknownSymbol(t *testing.T) {
	_, err := NormalizeForBinance("DOGE/USD")
	if !errors.Is(err, ErrUnknownSymbol) {
		t.Errorf("DOGE/USD: expected ErrUnknownSymbol, got %v", err)
	}
}
