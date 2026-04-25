package handlers

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/naimkatiman/hydrax-app/services/audit-svc/internal/audit"
)

// requireDB opens the compose-stack DB. Handler tests are full end-to-end:
// real Postgres, real INSERT. We do NOT mock the repo (per testing rule:
// integration tests must hit a real database).
func requireDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Fatal("DATABASE_URL not set")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

// seedTenantAndProduct inserts throwaway rows OUTSIDE a Tx so the handler
// (which uses its own pool connection) can see them. Cleanup deletes them
// in dependency order: products has ON DELETE RESTRICT for tenant_id, so
// products must go before tenants. audit_events cascades from tenants.
func seedTenantAndProduct(t *testing.T, db *sql.DB) (tenantID, productID string) {
	t.Helper()
	suffix := randSuffix()
	err := db.QueryRow(
		`INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
		"audit-handler-test-"+suffix, "Audit Handler Test",
	).Scan(&tenantID)
	if err != nil {
		t.Fatalf("seed tenant: %v", err)
	}
	err = db.QueryRow(
		`INSERT INTO products (tenant_id, code, name, product_type)
		 VALUES ($1, $2, 'Test', 'short_duration_credit') RETURNING id`,
		tenantID, "AHT-"+suffix,
	).Scan(&productID)
	if err != nil {
		t.Fatalf("seed product: %v", err)
	}
	t.Cleanup(func() {
		// Order matters: products RESTRICT tenant delete; audit_events
		// cascades from tenant, so deleting tenant cleans events too,
		// but products must go first.
		_, _ = db.Exec(`DELETE FROM products WHERE tenant_id = $1`, tenantID)
		_, _ = db.Exec(`DELETE FROM tenants WHERE id = $1`, tenantID)
	})
	return tenantID, productID
}

// randSuffix produces an 8-char hex tag (4 random bytes) so parallel
// runs do not collide on UNIQUE (tenants.slug) or UNIQUE
// (products.tenant_id, code).
func randSuffix() string {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "00000000"
	}
	return hex.EncodeToString(b)
}

func TestAppendHandlerReturns201(t *testing.T) {
	db := requireDB(t)
	tenantID, productID := seedTenantAndProduct(t, db)

	repo := audit.New(db)
	handler := Append(repo)

	body := map[string]any{
		"tenant_id":     tenantID,
		"action":        "product.created",
		"resource_type": "product",
		"resource_id":   productID,
		"payload":       map[string]string{"code": "AHT-x"},
	}
	buf := &bytes.Buffer{}
	if err := json.NewEncoder(buf).Encode(body); err != nil {
		t.Fatalf("encode: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/audit/events", buf)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d, body=%s", rec.Code, rec.Body.String())
	}
	var got map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got["id"] == nil || got["id"] == "" {
		t.Errorf("expected id in response, got %v", got)
	}
	if got["action"] != "product.created" {
		t.Errorf("expected action=product.created, got %v", got["action"])
	}
}

func TestAppendHandlerRejectsBadJSON(t *testing.T) {
	db := requireDB(t)
	repo := audit.New(db)
	handler := Append(repo)

	req := httptest.NewRequest(http.MethodPost, "/v1/audit/events", strings.NewReader("not json"))
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestAppendHandlerRejectsMissingFields(t *testing.T) {
	db := requireDB(t)
	repo := audit.New(db)
	handler := Append(repo)

	body := bytes.NewReader([]byte(`{"action":"x"}`))
	req := httptest.NewRequest(http.MethodPost, "/v1/audit/events", body)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d, body=%s", rec.Code, rec.Body.String())
	}
}

func TestAppendHandlerRejectsNonPOST(t *testing.T) {
	db := requireDB(t)
	repo := audit.New(db)
	handler := Append(repo)

	req := httptest.NewRequest(http.MethodGet, "/v1/audit/events", nil)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

func TestAppendHandlerRejectsOversizeBody(t *testing.T) {
	db := requireDB(t)
	repo := audit.New(db)
	handler := Append(repo)

	huge := bytes.Repeat([]byte("x"), 100*1024)
	body := []byte(`{"tenant_id":"x","action":"y","resource_type":"product","resource_id":"z","payload":"` + string(huge) + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/v1/audit/events", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 400 or 413 for oversize body, got %d", rec.Code)
	}
}

func TestListHandlerReturnsAppendedEvents(t *testing.T) {
	db := requireDB(t)
	tenantID, productID := seedTenantAndProduct(t, db)

	repo := audit.New(db)
	for _, action := range []string{"product.created", "product.approved"} {
		if _, err := repo.Append(context.TODO(), audit.EventInput{
			TenantID:     tenantID,
			Action:       action,
			ResourceType: "product",
			ResourceID:   productID,
			Payload:      json.RawMessage(`{}`),
		}); err != nil {
			t.Fatalf("seed Append: %v", err)
		}
	}

	listHandler := List(repo)
	url := "/v1/audit/events?tenant_id=" + tenantID + "&resource_type=product&resource_id=" + productID
	req := httptest.NewRequest(http.MethodGet, url, nil)
	rec := httptest.NewRecorder()
	listHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d, body=%s", rec.Code, rec.Body.String())
	}
	var got []map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 events, got %d", len(got))
	}
	// Membership-only assertion (same rationale as repo_test).
	seen := map[string]bool{}
	for _, ev := range got {
		seen[ev["action"].(string)] = true
	}
	for _, action := range []string{"product.created", "product.approved"} {
		if !seen[action] {
			t.Errorf("expected %q in results, missing", action)
		}
	}
}

func TestListHandlerRejectsMissingQueryParams(t *testing.T) {
	db := requireDB(t)
	repo := audit.New(db)
	handler := List(repo)

	req := httptest.NewRequest(http.MethodGet, "/v1/audit/events", nil)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing query params, got %d", rec.Code)
	}
}

func TestListHandlerRejectsNonGET(t *testing.T) {
	db := requireDB(t)
	repo := audit.New(db)
	handler := List(repo)

	req := httptest.NewRequest(http.MethodDelete, "/v1/audit/events?tenant_id=x&resource_type=product&resource_id=y", nil)
	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}
