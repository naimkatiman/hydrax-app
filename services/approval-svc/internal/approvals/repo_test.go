package approvals

import (
	"context"
	"testing"
)

func TestMemRepo_Insert_AssignsIDAndCreatedAt(t *testing.T) {
	r := NewMemRepo()
	got, err := r.Insert(context.Background(), ApprovalInput{
		TenantID: "t1", ResourceType: "product", ResourceID: "p1",
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}
	if got.ID == "" {
		t.Fatal("Insert: empty ID")
	}
	if got.Status != "pending" {
		t.Fatalf("Insert status = %q, want pending", got.Status)
	}
	if got.CreatedAt.IsZero() {
		t.Fatal("Insert: zero CreatedAt")
	}
}

func TestMemRepo_GetByID_ReturnsInsertedRow(t *testing.T) {
	r := NewMemRepo()
	in, _ := r.Insert(context.Background(), ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	got, err := r.GetByID(context.Background(), in.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.ID != in.ID {
		t.Fatalf("GetByID ID = %q, want %q", got.ID, in.ID)
	}
}

func TestMemRepo_GetByID_ErrNotFoundOnUnknown(t *testing.T) {
	r := NewMemRepo()
	_, err := r.GetByID(context.Background(), "nope")
	if !IsNotFound(err) {
		t.Fatalf("GetByID(unknown): err = %v, want IsNotFound", err)
	}
}

func TestMemRepo_ListPending_ReturnsOnlyPending(t *testing.T) {
	r := NewMemRepo()
	a, _ := r.Insert(context.Background(), ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	b, _ := r.Insert(context.Background(), ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p2"})
	if _, err := r.Decide(context.Background(), b.ID, DecideInput{Status: "approved", DecidedByID: "u1"}); err != nil {
		t.Fatalf("Decide: %v", err)
	}
	got, err := r.ListPending(context.Background())
	if err != nil {
		t.Fatalf("ListPending: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("ListPending len = %d, want 1", len(got))
	}
	if got[0].ID != a.ID {
		t.Fatalf("ListPending[0].ID = %q, want %q", got[0].ID, a.ID)
	}
}

func TestMemRepo_Decide_SetsDecidedFields(t *testing.T) {
	r := NewMemRepo()
	in, _ := r.Insert(context.Background(), ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	got, err := r.Decide(context.Background(), in.ID, DecideInput{Status: "approved", DecidedByID: "u1"})
	if err != nil {
		t.Fatalf("Decide: %v", err)
	}
	if got.Status != "approved" {
		t.Fatalf("Decide status = %q, want approved", got.Status)
	}
	if got.DecidedByUserID == nil || *got.DecidedByUserID != "u1" {
		t.Fatal("Decide: DecidedByUserID not set")
	}
	if got.DecidedAt == nil {
		t.Fatal("Decide: DecidedAt nil")
	}
}

func TestMemRepo_Decide_ErrNotFoundOnUnknown(t *testing.T) {
	r := NewMemRepo()
	_, err := r.Decide(context.Background(), "nope", DecideInput{Status: "approved", DecidedByID: "u1"})
	if !IsNotFound(err) {
		t.Fatalf("Decide(unknown): err = %v, want IsNotFound", err)
	}
}

func TestMemRepo_Decide_RejectsInvalidStatus(t *testing.T) {
	r := NewMemRepo()
	in, _ := r.Insert(context.Background(), ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	_, err := r.Decide(context.Background(), in.ID, DecideInput{Status: "maybe", DecidedByID: "u1"})
	if err == nil {
		t.Fatal("Decide(maybe): want error, got nil")
	}
}
