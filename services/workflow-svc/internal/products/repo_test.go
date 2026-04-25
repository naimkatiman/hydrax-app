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

// withTx wraps a test in a Tx that always rolls back. Returns a *Products
// bound to that Tx so all writes vanish on cleanup.
func withTx(t *testing.T) (context.Context, *Products) {
	t.Helper()
	db := openTestDB(t)
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("BeginTx: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback() })
	return context.Background(), New(tx)
}

// seedTenant inserts a throwaway tenant inside the same Tx and returns
// its id. Rolls back with the test.
func seedTenant(t *testing.T, ctx context.Context, repo *Products) string {
	t.Helper()
	var id string
	err := repo.tx.QueryRowContext(ctx,
		`INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
		"acme-test", "Acme Test Issuer",
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedTenant: %v", err)
	}
	return id
}

func TestInsertReturnsRowWithDefaults(t *testing.T) {
	ctx, repo := withTx(t)
	tenantID := seedTenant(t, ctx, repo)

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
	ctx, repo := withTx(t)
	tenantID := seedTenant(t, ctx, repo)

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
	ctx, repo := withTx(t)
	_, err := repo.GetByID(ctx, "00000000-0000-0000-0000-000000000000")
	if err == nil {
		t.Fatal("expected error for unknown ID, got nil")
	}
	if !IsNotFound(err) {
		t.Errorf("expected IsNotFound==true, got %v", err)
	}
}

func TestInsertRejectsDuplicateTenantCode(t *testing.T) {
	ctx, repo := withTx(t)
	tenantID := seedTenant(t, ctx, repo)
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
