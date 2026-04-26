package approvals

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
// a *PgRepo bound to that Tx, and the raw *sql.Tx for FK seed queries.
func withTx(t *testing.T) (context.Context, *PgRepo, *sql.Tx) {
	t.Helper()
	db := openTestDB(t)
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("BeginTx: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback() })
	return context.Background(), NewPgRepo(tx), tx
}

func seedTenant(t *testing.T, ctx context.Context, tx *sql.Tx) string {
	t.Helper()
	slug := fmt.Sprintf("appr-%d", time.Now().UnixNano())
	var id string
	err := tx.QueryRowContext(ctx,
		`INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
		slug, "Approvals Test Tenant",
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedTenant: %v", err)
	}
	return id
}

func seedUser(t *testing.T, ctx context.Context, tx *sql.Tx, tenantID string) string {
	t.Helper()
	email := fmt.Sprintf("appr-%d@example.com", time.Now().UnixNano())
	var id string
	err := tx.QueryRowContext(ctx,
		`INSERT INTO users (tenant_id, email, role) VALUES ($1, $2, 'approver') RETURNING id`,
		tenantID, email,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedUser: %v", err)
	}
	return id
}

// seedResourceID inserts a throwaway product so we have a real UUID for
// resource_id; the approvals table doesn't FK resource_id but tests
// using resource_type='product' should at least pass UUID parsing.
func seedResourceID(t *testing.T, ctx context.Context, tx *sql.Tx, tenantID string) string {
	t.Helper()
	code := fmt.Sprintf("APPR-%d", time.Now().UnixNano())
	var id string
	err := tx.QueryRowContext(ctx,
		`INSERT INTO products (tenant_id, code, name, product_type)
		 VALUES ($1, $2, $3, 'short_duration_credit') RETURNING id`,
		tenantID, code, "Approvals Test Resource",
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedResourceID: %v", err)
	}
	return id
}

func TestPgRepo_Insert_AssignsIDAndDefaults(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	resourceID := seedResourceID(t, ctx, tx, tenantID)

	got, err := repo.Insert(ctx, ApprovalInput{
		TenantID: tenantID, ResourceType: "product", ResourceID: resourceID,
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}
	if got.ID == "" {
		t.Error("Insert: empty ID")
	}
	if got.Status != "pending" {
		t.Errorf("Insert status = %q, want pending", got.Status)
	}
	if got.CreatedAt.IsZero() {
		t.Error("Insert: zero CreatedAt")
	}
	if got.DecidedAt != nil {
		t.Error("Insert: DecidedAt should be nil for pending row")
	}
	if got.DecidedByUserID != nil {
		t.Error("Insert: DecidedByUserID should be nil for pending row")
	}
}

func TestPgRepo_GetByID_RoundTrip(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	resourceID := seedResourceID(t, ctx, tx, tenantID)

	in, _ := repo.Insert(ctx, ApprovalInput{
		TenantID: tenantID, ResourceType: "product", ResourceID: resourceID,
	})
	got, err := repo.GetByID(ctx, in.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.ID != in.ID {
		t.Errorf("ID mismatch: got %q want %q", got.ID, in.ID)
	}
	if got.TenantID != tenantID {
		t.Errorf("TenantID mismatch: got %q want %q", got.TenantID, tenantID)
	}
	if got.ResourceType != "product" {
		t.Errorf("ResourceType: got %q want product", got.ResourceType)
	}
	if got.ResourceID != resourceID {
		t.Errorf("ResourceID mismatch: got %q want %q", got.ResourceID, resourceID)
	}
}

func TestPgRepo_GetByID_NotFound(t *testing.T) {
	ctx, repo, _ := withTx(t)
	_, err := repo.GetByID(ctx, "00000000-0000-0000-0000-000000000000")
	if !IsNotFound(err) {
		t.Fatalf("GetByID(unknown): err = %v, want IsNotFound", err)
	}
}

func TestPgRepo_ListPending_FiltersToPendingOnly(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	rA := seedResourceID(t, ctx, tx, tenantID)
	rB := seedResourceID(t, ctx, tx, tenantID)
	userID := seedUser(t, ctx, tx, tenantID)

	a, _ := repo.Insert(ctx, ApprovalInput{TenantID: tenantID, ResourceType: "product", ResourceID: rA})
	b, _ := repo.Insert(ctx, ApprovalInput{TenantID: tenantID, ResourceType: "product", ResourceID: rB})
	if _, err := repo.Decide(ctx, b.ID, DecideInput{Status: "approved", DecidedByID: userID}); err != nil {
		t.Fatalf("Decide setup: %v", err)
	}

	got, err := repo.ListPending(ctx)
	if err != nil {
		t.Fatalf("ListPending: %v", err)
	}
	// Filter to rows from this test (the test container persists across runs;
	// stray data from prior committed work doesn't exist because every test
	// is Tx-rolled, but be defensive against the case where the runner left
	// real rows in the table by some other path).
	var seenA bool
	for _, row := range got {
		if row.ID == a.ID {
			seenA = true
		}
		if row.ID == b.ID {
			t.Errorf("ListPending returned decided row %q (status=%q)", row.ID, row.Status)
		}
	}
	if !seenA {
		t.Errorf("ListPending did not return pending row %q", a.ID)
	}
}

func TestPgRepo_Decide_HappyPath(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	resourceID := seedResourceID(t, ctx, tx, tenantID)
	userID := seedUser(t, ctx, tx, tenantID)

	in, _ := repo.Insert(ctx, ApprovalInput{TenantID: tenantID, ResourceType: "product", ResourceID: resourceID})
	got, err := repo.Decide(ctx, in.ID, DecideInput{Status: "approved", DecidedByID: userID})
	if err != nil {
		t.Fatalf("Decide: %v", err)
	}
	if got.Status != "approved" {
		t.Errorf("Status = %q, want approved", got.Status)
	}
	if got.DecidedByUserID == nil || *got.DecidedByUserID != userID {
		t.Errorf("DecidedByUserID = %v, want %q", got.DecidedByUserID, userID)
	}
	if got.DecidedAt == nil {
		t.Error("DecidedAt should be set after Decide")
	}
}

func TestPgRepo_Decide_FirstDecideWinsReturnsAlreadyDecided(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	resourceID := seedResourceID(t, ctx, tx, tenantID)
	userID := seedUser(t, ctx, tx, tenantID)

	in, _ := repo.Insert(ctx, ApprovalInput{TenantID: tenantID, ResourceType: "product", ResourceID: resourceID})
	if _, err := repo.Decide(ctx, in.ID, DecideInput{Status: "approved", DecidedByID: userID}); err != nil {
		t.Fatalf("first Decide: %v", err)
	}
	_, err := repo.Decide(ctx, in.ID, DecideInput{Status: "rejected", DecidedByID: userID})
	if !IsAlreadyDecided(err) {
		t.Fatalf("second Decide: err = %v, want IsAlreadyDecided", err)
	}

	got, err := repo.GetByID(ctx, in.ID)
	if err != nil {
		t.Fatalf("GetByID after re-decide: %v", err)
	}
	if got.Status != "approved" {
		t.Errorf("post re-decide status = %q, want approved (first wins)", got.Status)
	}
}

func TestPgRepo_Decide_NotFoundOnUnknownID(t *testing.T) {
	ctx, repo, _ := withTx(t)
	_, err := repo.Decide(ctx, "00000000-0000-0000-0000-000000000000", DecideInput{Status: "approved", DecidedByID: "00000000-0000-0000-0000-000000000001"})
	if !IsNotFound(err) {
		t.Fatalf("Decide(unknown): err = %v, want IsNotFound", err)
	}
}

func TestPgRepo_Decide_RejectsInvalidStatus(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	resourceID := seedResourceID(t, ctx, tx, tenantID)

	in, _ := repo.Insert(ctx, ApprovalInput{TenantID: tenantID, ResourceType: "product", ResourceID: resourceID})
	_, err := repo.Decide(ctx, in.ID, DecideInput{Status: "maybe", DecidedByID: "u1"})
	if err == nil {
		t.Fatal("Decide(maybe): want error, got nil")
	}
	if IsNotFound(err) || IsAlreadyDecided(err) {
		t.Fatalf("Decide(maybe): err categorized as not-found/already-decided: %v", err)
	}
}
