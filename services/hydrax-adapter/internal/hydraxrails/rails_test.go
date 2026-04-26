package hydraxrails

import (
	"context"
	"strings"
	"testing"
)

func TestMockRails_IssueProduct_ReturnsDeterministicID(t *testing.T) {
	r := NewMockRails()
	ctx := context.Background()

	got, err := r.IssueProduct(ctx, IssueRequest{TenantID: "t1", ProductCode: "MMF-USD"})
	if err != nil {
		t.Fatalf("IssueProduct: %v", err)
	}
	if got.ProductID == "" {
		t.Fatalf("ProductID empty")
	}

	again, err := r.IssueProduct(ctx, IssueRequest{TenantID: "t1", ProductCode: "MMF-USD"})
	if err != nil {
		t.Fatalf("IssueProduct(again): %v", err)
	}
	if got.ProductID == again.ProductID {
		t.Fatalf("expected new ID per call, got %q twice", got.ProductID)
	}
}

func TestMockRails_IssueProduct_RejectsEmptyTenant(t *testing.T) {
	r := NewMockRails()
	_, err := r.IssueProduct(context.Background(), IssueRequest{ProductCode: "X"})
	if err == nil {
		t.Fatal("expected error on empty TenantID")
	}
}

func TestMockRails_Subscribe(t *testing.T) {
	r := NewMockRails()
	ctx := context.Background()

	got, err := r.Subscribe(ctx, SubscribeRequest{TenantID: "t1", ProductID: "p1", InvestorRef: "i1", Units: 100})
	if err != nil {
		t.Fatalf("Subscribe: %v", err)
	}
	if !strings.HasPrefix(got.SubscriptionID, "sub-mock-") {
		t.Errorf("SubscriptionID %q does not match sub-mock-<n>", got.SubscriptionID)
	}

	again, _ := r.Subscribe(ctx, SubscribeRequest{TenantID: "t1", ProductID: "p1", InvestorRef: "i1", Units: 100})
	if got.SubscriptionID == again.SubscriptionID {
		t.Fatalf("expected new SubscriptionID per call, got %q twice", got.SubscriptionID)
	}
}

func TestMockRails_Subscribe_Validation(t *testing.T) {
	r := NewMockRails()
	cases := []struct {
		name string
		req  SubscribeRequest
	}{
		{"empty tenant", SubscribeRequest{ProductID: "p1"}},
		{"empty product", SubscribeRequest{TenantID: "t1"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := r.Subscribe(context.Background(), c.req); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}

func TestMockRails_TransferCustody(t *testing.T) {
	r := NewMockRails()
	got, err := r.TransferCustody(context.Background(), CustodyRequest{
		TenantID: "t1", From: "a", To: "b", AssetRef: "USDC", Units: 50,
	})
	if err != nil {
		t.Fatalf("TransferCustody: %v", err)
	}
	if !strings.HasPrefix(got.TransferID, "xfer-mock-") {
		t.Errorf("TransferID %q does not match xfer-mock-<n>", got.TransferID)
	}
}

func TestMockRails_TransferCustody_Validation(t *testing.T) {
	r := NewMockRails()
	cases := []struct {
		name string
		req  CustodyRequest
	}{
		{"empty tenant", CustodyRequest{From: "a", To: "b"}},
		{"empty from", CustodyRequest{TenantID: "t1", To: "b"}},
		{"empty to", CustodyRequest{TenantID: "t1", From: "a"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := r.TransferCustody(context.Background(), c.req); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}

func TestMockRails_Settle(t *testing.T) {
	r := NewMockRails()
	got, err := r.Settle(context.Background(), SettleRequest{TenantID: "t1", SubscriptionID: "sub-1"})
	if err != nil {
		t.Fatalf("Settle: %v", err)
	}
	if !strings.HasPrefix(got.SettlementID, "set-mock-") {
		t.Errorf("SettlementID %q does not match set-mock-<n>", got.SettlementID)
	}
	if got.Status != "settled" {
		t.Errorf("Status = %q, want settled", got.Status)
	}
}

func TestMockRails_Settle_Validation(t *testing.T) {
	r := NewMockRails()
	cases := []struct {
		name string
		req  SettleRequest
	}{
		{"empty tenant", SettleRequest{SubscriptionID: "sub-1"}},
		{"empty subscription", SettleRequest{TenantID: "t1"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := r.Settle(context.Background(), c.req); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}

func TestMockRails_NAV_Deterministic(t *testing.T) {
	r := NewMockRails()
	ctx := context.Background()

	a, err := r.NAV(ctx, "product-xyz")
	if err != nil {
		t.Fatalf("NAV: %v", err)
	}
	b, err := r.NAV(ctx, "product-xyz")
	if err != nil {
		t.Fatalf("NAV(again): %v", err)
	}
	if a.NAV != b.NAV {
		t.Fatalf("NAV not deterministic: %q vs %q", a.NAV, b.NAV)
	}
	if !strings.HasPrefix(a.NAV, "1.") || len(a.NAV) != 6 {
		t.Errorf("NAV format unexpected: %q (want 1.NNNN)", a.NAV)
	}

	c, _ := r.NAV(ctx, "product-other")
	if a.NAV == c.NAV {
		t.Logf("note: hash collision possible but unlikely; got identical NAVs %q for distinct products", a.NAV)
	}
}

func TestMockRails_NAV_RejectsEmpty(t *testing.T) {
	r := NewMockRails()
	if _, err := r.NAV(context.Background(), ""); err == nil {
		t.Fatal("expected error on empty productID")
	}
}
