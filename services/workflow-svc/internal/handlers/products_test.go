package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/products"
)

// txProducts spins up a *products.Products bound to a Tx that rolls back
// on test cleanup, so handler tests share the same isolation as the
// repo tests.
func txProducts(t *testing.T) *products.Products {
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
	return products.New(tx)
}

func TestCreateProduct201Returns(t *testing.T) {
	repo := txProducts(t)
	// Tenant must exist for FK; insert into the same Tx.
	var tenantID string
	err := repo.Tx().QueryRowContext(context.Background(),
		`INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
		"htest", "HTest",
	).Scan(&tenantID)
	if err != nil {
		t.Fatalf("seed tenant: %v", err)
	}

	body, _ := json.Marshal(map[string]string{
		"tenant_id":    tenantID,
		"code":         "SDC-HTEST-001",
		"name":         "Handler Test SDC",
		"product_type": "short_duration_credit",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/products", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	Create(repo)(rr, req)

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
}

func TestCreateProduct400OnMissingFields(t *testing.T) {
	repo := txProducts(t)
	body := []byte(`{"tenant_id":"00000000-0000-0000-0000-000000000000"}`)
	req := httptest.NewRequest(http.MethodPost, "/v1/products", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	Create(repo)(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400; body=%s", rr.Code, rr.Body.String())
	}
}

func TestCreateProduct405OnGet(t *testing.T) {
	repo := txProducts(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/products", nil)
	rr := httptest.NewRecorder()
	Create(repo)(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status: got %d want 405", rr.Code)
	}
}
