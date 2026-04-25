package subscriptions

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"

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
// a *Subscriptions bound to that Tx, and the raw *sql.Tx for direct seed
// queries.
func withTx(t *testing.T) (context.Context, *Subscriptions, *sql.Tx) {
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
// helper does not couple to the unexported Subscriptions.tx field.
func seedTenant(t *testing.T, ctx context.Context, tx *sql.Tx) string {
	t.Helper()
	var id string
	err := tx.QueryRowContext(ctx,
		`INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
		"acme-sub-test", "Acme Subscriptions Test",
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedTenant: %v", err)
	}
	return id
}

// seedUser inserts a throwaway user under the given tenant inside the
// given Tx and returns its id. Email is uniquified per call so multiple
// users can be seeded under the same tenant within one test.
func seedUser(t *testing.T, ctx context.Context, tx *sql.Tx, tenantID string) string {
	t.Helper()
	email := fmt.Sprintf("investor-%d@example.com", time.Now().UnixNano())
	var id string
	err := tx.QueryRowContext(ctx,
		`INSERT INTO users (tenant_id, email, role) VALUES ($1, $2, 'viewer') RETURNING id`,
		tenantID, email,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedUser: %v", err)
	}
	return id
}

// seedProduct inserts a throwaway product under the given tenant inside
// the given Tx and returns its id. Uses product_type='short_duration_credit'
// to satisfy any check constraints; code is uniquified per call.
func seedProduct(t *testing.T, ctx context.Context, tx *sql.Tx, tenantID string) string {
	t.Helper()
	code := fmt.Sprintf("SDC-TEST-%d", time.Now().UnixNano())
	var id string
	err := tx.QueryRowContext(ctx,
		`INSERT INTO products (tenant_id, code, name, product_type)
		 VALUES ($1, $2, $3, 'short_duration_credit') RETURNING id`,
		tenantID, code, "Subscriptions Test Product",
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedProduct: %v", err)
	}
	return id
}

func TestInsertReturnsRowWithDefaults(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	userID := seedUser(t, ctx, tx, tenantID)
	productID := seedProduct(t, ctx, tx, tenantID)

	got, err := repo.Insert(ctx, SubscriptionInput{
		ProductID:      productID,
		InvestorUserID: userID,
		AmountMinor:    100_000_00,
		Currency:       "USD",
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
	userID := seedUser(t, ctx, tx, tenantID)
	productID := seedProduct(t, ctx, tx, tenantID)

	created, err := repo.Insert(ctx, SubscriptionInput{
		ProductID:      productID,
		InvestorUserID: userID,
		AmountMinor:    250_000_00,
		Currency:       "USD",
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
	if got.ProductID != productID {
		t.Errorf("ProductID mismatch: got %q want %q", got.ProductID, productID)
	}
	if got.InvestorUserID != userID {
		t.Errorf("InvestorUserID mismatch: got %q want %q", got.InvestorUserID, userID)
	}
	if got.AmountMinor != 250_000_00 {
		t.Errorf("AmountMinor mismatch: got %d want %d", got.AmountMinor, 250_000_00)
	}
	if got.Currency != "USD" {
		t.Errorf("Currency mismatch: got %q", got.Currency)
	}
}
