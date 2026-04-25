package audit

import (
	"context"
	"database/sql"
	"encoding/json"
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

// withTx wraps a test in a Tx that always rolls back. Returns the
// context, an *Events bound to that Tx, and the raw *sql.Tx for
// direct seed queries.
func withTx(t *testing.T) (context.Context, *Events, *sql.Tx) {
	t.Helper()
	db := openTestDB(t)
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("BeginTx: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback() })
	return context.Background(), New(tx), tx
}

// seedTenant inserts a throwaway tenant inside the given Tx and
// returns its id.
func seedTenant(t *testing.T, ctx context.Context, tx *sql.Tx) string {
	t.Helper()
	var id string
	err := tx.QueryRowContext(ctx,
		`INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
		"acme-audit-test", "Acme Audit Test",
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedTenant: %v", err)
	}
	return id
}

// seedProduct inserts a throwaway product so we have a valid
// resource_id to reference.
func seedProduct(t *testing.T, ctx context.Context, tx *sql.Tx, tenantID string) string {
	t.Helper()
	var id string
	err := tx.QueryRowContext(ctx,
		`INSERT INTO products (tenant_id, code, name, product_type)
		 VALUES ($1, 'AUDIT-TEST-001', 'Audit Test Product', 'short_duration_credit')
		 RETURNING id`,
		tenantID,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedProduct: %v", err)
	}
	return id
}

func TestAppendReturnsRowWithDefaults(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	productID := seedProduct(t, ctx, tx, tenantID)

	got, err := repo.Append(ctx, EventInput{
		TenantID:     tenantID,
		Action:       "product.created",
		ResourceType: "product",
		ResourceID:   productID,
		Payload:      json.RawMessage(`{"code":"AUDIT-TEST-001"}`),
	})
	if err != nil {
		t.Fatalf("Append: %v", err)
	}
	if got.ID == "" {
		t.Error("expected generated ID, got empty")
	}
	if got.CreatedAt.IsZero() {
		t.Error("expected CreatedAt populated")
	}
	if got.Action != "product.created" {
		t.Errorf("Action mismatch: got %q", got.Action)
	}
}

func TestAppendAcceptsNilActorAndEmptyPayload(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	productID := seedProduct(t, ctx, tx, tenantID)

	got, err := repo.Append(ctx, EventInput{
		TenantID:     tenantID,
		ActorUserID:  nil,
		Action:       "system.heartbeat",
		ResourceType: "product",
		ResourceID:   productID,
		Payload:      nil,
	})
	if err != nil {
		t.Fatalf("Append: %v", err)
	}
	if got.ActorUserID != nil {
		t.Errorf("expected nil ActorUserID, got %v", got.ActorUserID)
	}
	if string(got.Payload) != "{}" {
		t.Errorf("expected default payload {}, got %s", string(got.Payload))
	}
}

func TestAppendRejectsBadResourceType(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	productID := seedProduct(t, ctx, tx, tenantID)

	_, err := repo.Append(ctx, EventInput{
		TenantID:     tenantID,
		Action:       "weird.action",
		ResourceType: "spaceship",
		ResourceID:   productID,
		Payload:      json.RawMessage(`{}`),
	})
	if err == nil {
		t.Fatal("expected CHECK constraint to reject 'spaceship', got nil error")
	}
}

func TestListByResourceReturnsAllAppendedEventsForResource(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)
	productID := seedProduct(t, ctx, tx, tenantID)

	want := []string{"product.created", "product.approved", "product.activated"}
	for _, action := range want {
		if _, err := repo.Append(ctx, EventInput{
			TenantID:     tenantID,
			Action:       action,
			ResourceType: "product",
			ResourceID:   productID,
			Payload:      json.RawMessage(`{}`),
		}); err != nil {
			t.Fatalf("Append %s: %v", action, err)
		}
	}

	got, err := repo.ListByResource(ctx, tenantID, "product", productID)
	if err != nil {
		t.Fatalf("ListByResource: %v", err)
	}
	if len(got) != len(want) {
		t.Fatalf("expected %d events, got %d", len(want), len(got))
	}
	// Membership-only assertion: within a single Tx, all rows share
	// NOW() (which is transaction_timestamp), so created_at DESC +
	// id DESC tiebreak orders by UUID lexically — effectively random.
	// The production ORDER BY guarantee (newest first across Txs)
	// holds and is verifiable only across separate transactions,
	// which test isolation here precludes. Verify membership instead.
	seen := map[string]bool{}
	for _, ev := range got {
		seen[ev.Action] = true
	}
	for _, action := range want {
		if !seen[action] {
			t.Errorf("expected %q in results, missing", action)
		}
	}
}

func TestListByResourceReturnsEmptySliceForNoMatches(t *testing.T) {
	ctx, repo, tx := withTx(t)
	tenantID := seedTenant(t, ctx, tx)

	got, err := repo.ListByResource(ctx, tenantID, "product",
		"00000000-0000-0000-0000-000000000000")
	if err != nil {
		t.Fatalf("ListByResource: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty slice, got %d events", len(got))
	}
}
