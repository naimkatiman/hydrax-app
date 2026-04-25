package products

import (
	"context"
	"database/sql"
	"os"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// openTestDB connects to the compose-stack DB. Each test wraps its work
// in a Tx that t.Cleanup rolls back, so no fixture reset is needed.
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Fatal("DATABASE_URL not set; run docker compose -f db/postgres/docker-compose.test.yml up -d")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

// withTx wraps a test in a Tx that always rolls back. Returns the context,
// a *Products bound to that Tx, and the raw *sql.Tx for direct seed queries.
func withTx(t *testing.T) (context.Context, *Products, *sql.Tx) {
	t.Helper()
	db := openTestDB(t)
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("BeginTx: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback() })
	return context.Background(), New(tx), tx
}

// seedTenant inserts a throwaway tenant inside the given Tx and returns
// its id. Rolls back with the test. Takes the *sql.Tx directly so this
// helper does not couple to the unexported Products.tx field.
func seedTenant(t *testing.T, ctx context.Context, tx *sql.Tx) string {
	t.Helper()
	var id string
	err := tx.QueryRowContext(ctx,
		`INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
		"acme-test", "Acme Test Issuer",
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedTenant: %v", err)
	}
	return id
}

func TestInsertReturnsRowWithDefaults(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)

	got, err := repo.Insert(ctx, ProductInput{
		TenantID:    tenantID,
		Code:        "SDC-2026-Q2-A",
		Name:        "Short Duration Credit 2026 Q2 A",
		ProductType: "short_duration_credit",
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}
	if got.ID == "" {
		t.Error("expected generated ID, got empty string")
	}
	if got.Status != "pending" {
		t.Errorf("expected default status=pending, got %q", got.Status)
	}
	if got.CreatedAt.IsZero() {
		t.Error("expected CreatedAt populated")
	}
}

func TestGetByIDReturnsInsertedRow(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)

	created, err := repo.Insert(ctx, ProductInput{
		TenantID:    tenantID,
		Code:        "SDC-2026-Q2-B",
		Name:        "SDC B",
		ProductType: "short_duration_credit",
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}

	got, err := repo.GetByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID mismatch: got %q want %q", got.ID, created.ID)
	}
	if got.Code != "SDC-2026-Q2-B" {
		t.Errorf("Code mismatch: got %q", got.Code)
	}
}

func TestGetByIDReturnsErrNotFoundForUnknown(t *testing.T) {
	ctx, repo, _ := withTx(t)
	_, err := repo.GetByID(ctx, "00000000-0000-0000-0000-000000000000")
	if err == nil {
		t.Fatal("expected error for unknown ID, got nil")
	}
	if !IsNotFound(err) {
		t.Errorf("expected IsNotFound==true, got %v", err)
	}
}

func TestUpdateStatusHappyPath(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)

	created, err := repo.Insert(ctx, ProductInput{
		TenantID:    tenantID,
		Code:        "T1-HAPPY",
		Name:        "Update happy path",
		ProductType: "short_duration_credit",
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}
	if created.Status != "pending" {
		t.Fatalf("expected status=pending, got %q", created.Status)
	}

	got, err := repo.UpdateStatus(ctx, created.ID, "pending", "approved")
	if err != nil {
		t.Fatalf("UpdateStatus pending->approved: %v", err)
	}
	if got.Status != "approved" {
		t.Errorf("status = %q, want approved", got.Status)
	}
	if !got.UpdatedAt.After(created.UpdatedAt) && !got.UpdatedAt.Equal(created.UpdatedAt) {
		t.Errorf("UpdatedAt did not advance or hold steady: created=%v got=%v", created.UpdatedAt, got.UpdatedAt)
	}
}

func TestUpdateStatusStaleStatusReturnsSentinel(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	created, err := repo.Insert(ctx, ProductInput{
		TenantID:    tenantID,
		Code:        "T1-STALE",
		Name:        "Stale test",
		ProductType: "short_duration_credit",
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}
	// Caller claims fromStatus=approved but the row is actually pending.
	_, err = repo.UpdateStatus(ctx, created.ID, "approved", "active")
	if err == nil {
		t.Fatal("UpdateStatus with mismatched fromStatus should fail, got nil")
	}
	if !IsStaleStatus(err) {
		t.Errorf("expected IsStaleStatus(err)==true, got %v", err)
	}
}

func TestUpdateStatusUnknownIDReturnsStale(t *testing.T) {
	ctx, repo, _ := withTx(t)
	_, err := repo.UpdateStatus(ctx, "00000000-0000-0000-0000-000000000000", "pending", "approved")
	if err == nil {
		t.Fatal("UpdateStatus on missing id should fail, got nil")
	}
	if !IsStaleStatus(err) {
		t.Errorf("expected IsStaleStatus(err)==true (missing id is indistinguishable from drift), got %v", err)
	}
}

func TestSetRailsProductIDStampsValue(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	created, err := repo.Insert(ctx, ProductInput{
		TenantID:    tenantID,
		Code:        "T1-RAILS",
		Name:        "Rails id stamp",
		ProductType: "short_duration_credit",
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}
	if created.RailsProductID != nil {
		t.Fatalf("freshly inserted product must not have rails_product_id set; got %v", *created.RailsProductID)
	}

	got, err := repo.SetRailsProductID(ctx, created.ID, "rails-prod-abc")
	if err != nil {
		t.Fatalf("SetRailsProductID: %v", err)
	}
	if got.RailsProductID == nil || *got.RailsProductID != "rails-prod-abc" {
		t.Errorf("rails_product_id mismatch: got %v want rails-prod-abc", got.RailsProductID)
	}
}

func TestSetRailsProductIDUnknownIDReturnsNotFound(t *testing.T) {
	ctx, repo, _ := withTx(t)
	_, err := repo.SetRailsProductID(ctx, "00000000-0000-0000-0000-000000000000", "rails-prod-xyz")
	if err == nil {
		t.Fatal("SetRailsProductID on missing id should fail, got nil")
	}
	if !IsNotFound(err) {
		t.Errorf("expected IsNotFound(err)==true, got %v", err)
	}
}

func TestInsertRejectsDuplicateTenantCode(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	input := ProductInput{
		TenantID:    tenantID,
		Code:        "DUPE-001",
		Name:        "Dupe",
		ProductType: "short_duration_credit",
	}
	if _, err := repo.Insert(ctx, input); err != nil {
		t.Fatalf("first Insert: %v", err)
	}
	if _, err := repo.Insert(ctx, input); err == nil {
		t.Fatal("expected duplicate (tenant_id,code) to error, got nil")
	}
}
