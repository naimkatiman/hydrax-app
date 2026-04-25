package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/subscriptions"
)

// txSubsHarness opens a Tx that rolls back at test end and returns a
// subscriptions repo bound to it plus the raw *sql.Tx for FK seeds. Mirrors
// the withTx pattern from internal/subscriptions/repo_test.go but lives
// here so handler tests don't depend on unexported test helpers.
func txSubsHarness(t *testing.T) (*subscriptions.Subscriptions, *sql.Tx) {
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
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("BeginTx: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback() })
	return subscriptions.New(tx), tx
}

// seedTenantSubH inserts a throwaway tenant within tx; uniquified slug.
func seedTenantSubH(t *testing.T, tx *sql.Tx) string {
	t.Helper()
	slug := fmt.Sprintf("hsub-%d", time.Now().UnixNano())
	var id string
	err := tx.QueryRowContext(context.Background(),
		`INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
		slug, "Handler Sub Tenant",
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedTenantSubH: %v", err)
	}
	return id
}

func seedUserSubH(t *testing.T, tx *sql.Tx, tenantID string) string {
	t.Helper()
	email := fmt.Sprintf("hsub-%d@example.com", time.Now().UnixNano())
	var id string
	err := tx.QueryRowContext(context.Background(),
		`INSERT INTO users (tenant_id, email, role) VALUES ($1, $2, 'viewer') RETURNING id`,
		tenantID, email,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedUserSubH: %v", err)
	}
	return id
}

func seedProductSubH(t *testing.T, tx *sql.Tx, tenantID string) string {
	t.Helper()
	code := fmt.Sprintf("HSUB-%d", time.Now().UnixNano())
	var id string
	err := tx.QueryRowContext(context.Background(),
		`INSERT INTO products (tenant_id, code, name, product_type)
		 VALUES ($1, $2, $3, 'short_duration_credit') RETURNING id`,
		tenantID, code, "Handler Sub Product",
	).Scan(&id)
	if err != nil {
		t.Fatalf("seedProductSubH: %v", err)
	}
	return id
}

func TestCreateSubscriptionHappy(t *testing.T) {
	repo, tx := txSubsHarness(t)
	tenantID := seedTenantSubH(t, tx)
	userID := seedUserSubH(t, tx, tenantID)
	productID := seedProductSubH(t, tx, tenantID)

	body, _ := json.Marshal(map[string]any{
		"product_id":       productID,
		"investor_user_id": userID,
		"amount_minor":     50000,
		"currency":         "USD",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/subscriptions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateSubscription(repo)(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status: got %d want 201; body=%s", rr.Code, rr.Body.String())
	}
	var got map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got["id"] == "" || got["id"] == nil {
		t.Errorf("expected id in response, got %v", got)
	}
	if got["status"] != "pending" {
		t.Errorf("expected status=pending, got %v", got["status"])
	}
	if got["product_id"] != productID {
		t.Errorf("product_id mismatch: got %v want %s", got["product_id"], productID)
	}
}

func TestCreateSubscriptionMethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/v1/subscriptions", nil)
	rr := httptest.NewRecorder()
	CreateSubscription(nil)(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status: got %d want 405; body=%s", rr.Code, rr.Body.String())
	}
}

func TestCreateSubscriptionBadJSON(t *testing.T) {
	body := bytes.NewReader([]byte(`{not json`))
	req := httptest.NewRequest(http.MethodPost, "/v1/subscriptions", body)
	rr := httptest.NewRecorder()
	CreateSubscription(nil)(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400; body=%s", rr.Code, rr.Body.String())
	}
	var got map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got["error"] != "bad_json" {
		t.Errorf("expected error=bad_json, got %q", got["error"])
	}
}

func TestCreateSubscriptionMissingFields(t *testing.T) {
	body := bytes.NewReader([]byte(`{}`))
	req := httptest.NewRequest(http.MethodPost, "/v1/subscriptions", body)
	rr := httptest.NewRecorder()
	CreateSubscription(nil)(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400; body=%s", rr.Code, rr.Body.String())
	}
	var got map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got["error"] != "missing_fields" {
		t.Errorf("expected error=missing_fields, got %q", got["error"])
	}
}

func TestCreateSubscriptionBodyCap(t *testing.T) {
	// 65KB > 64KB cap; MaxBytesReader fires when Decode reads past the limit.
	big := strings.Repeat("a", 65*1024)
	body := bytes.NewReader([]byte(`{"product_id":"x","investor_user_id":"y","amount_minor":1,"currency":"USD","junk":"` + big + `"}`))
	req := httptest.NewRequest(http.MethodPost, "/v1/subscriptions", body)
	rr := httptest.NewRecorder()
	CreateSubscription(nil)(rr, req)
	// In production *http.response, MaxBytesReader auto-writes 413 with
	// Connection: close. In httptest.ResponseRecorder (which lacks the
	// unexported requestTooLarge hook), the trip surfaces to Decode as
	// "http: request body too large", which the handler maps to 400
	// bad_json. Either status proves the body cap fired; we accept both
	// rather than embed test-environment-specific behavior in the assertion.
	if rr.Code != http.StatusRequestEntityTooLarge && rr.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 413 or 400; body=%s", rr.Code, rr.Body.String())
	}
	if rr.Code == http.StatusBadRequest && !strings.Contains(rr.Body.String(), "request body too large") {
		t.Fatalf("400 should be the body-cap variant; body=%s", rr.Body.String())
	}
}

func TestGetSubscriptionHappy(t *testing.T) {
	repo, tx := txSubsHarness(t)
	tenantID := seedTenantSubH(t, tx)
	userID := seedUserSubH(t, tx, tenantID)
	productID := seedProductSubH(t, tx, tenantID)

	created, err := repo.Insert(context.Background(), subscriptions.SubscriptionInput{
		ProductID:      productID,
		InvestorUserID: userID,
		AmountMinor:    250_000_00,
		Currency:       "USD",
	})
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/subscriptions/"+created.ID, nil)
	req.SetPathValue("id", created.ID)
	rr := httptest.NewRecorder()
	GetSubscription(repo)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200; body=%s", rr.Code, rr.Body.String())
	}
	var got map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got["id"] != created.ID {
		t.Errorf("id mismatch: got %v want %s", got["id"], created.ID)
	}
	if got["currency"] != "USD" {
		t.Errorf("currency mismatch: got %v", got["currency"])
	}
}

func TestGetSubscriptionNotFound(t *testing.T) {
	repo, _ := txSubsHarness(t)
	id := "00000000-0000-0000-0000-000000000000"
	req := httptest.NewRequest(http.MethodGet, "/v1/subscriptions/"+id, nil)
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()
	GetSubscription(repo)(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status: got %d want 404; body=%s", rr.Code, rr.Body.String())
	}
}

func TestGetSubscriptionMethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/v1/subscriptions/abc", nil)
	req.SetPathValue("id", "abc")
	rr := httptest.NewRecorder()
	GetSubscription(nil)(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status: got %d want 405; body=%s", rr.Code, rr.Body.String())
	}
}
