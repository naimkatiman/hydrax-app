package hydraxrails

import (
	"context"
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
