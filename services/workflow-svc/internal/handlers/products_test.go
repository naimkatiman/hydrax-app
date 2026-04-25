package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sort"
	"strconv"
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

func TestGetProduct200Returns(t *testing.T) {
	repo := txProducts(t)
	var tenantID string
	err := repo.Tx().QueryRowContext(context.Background(),
		`INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
		"gtest", "GTest",
	).Scan(&tenantID)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	created, err := repo.Insert(context.Background(), products.ProductInput{
		TenantID: tenantID, Code: "GET-001", Name: "Get Test", ProductType: "short_duration_credit",
	})
	if err != nil {
		t.Fatalf("insert: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/products/"+created.ID, nil)
	req.SetPathValue("id", created.ID)
	rr := httptest.NewRecorder()
	Get(repo)(rr, req)

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
}

func TestGetProduct404OnUnknown(t *testing.T) {
	repo := txProducts(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/products/00000000-0000-0000-0000-000000000000", nil)
	req.SetPathValue("id", "00000000-0000-0000-0000-000000000000")
	rr := httptest.NewRecorder()
	Get(repo)(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status: got %d want 404", rr.Code)
	}
}

func TestTransitionPendingToApprovedReturns200WithUpdatedProduct(t *testing.T) {
	repo := txProducts(t)
	id := seedPendingProduct(t, repo, "t1xa", "T1XA-CODE")

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+id+"/transition",
		bytes.NewReader([]byte(`{"to":"approved"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()

	Transition(repo)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200; body=%s", rr.Code, rr.Body.String())
	}
	var got productResponse
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Status != "approved" {
		t.Errorf("status = %q, want approved", got.Status)
	}
	wantNext := []string{"active", "cancelled"}
	if !equalStringSets(got.AllowedNext, wantNext) {
		t.Errorf("allowed_next = %v, want %v (any order)", got.AllowedNext, wantNext)
	}
}

func TestTransitionPendingToActiveReturns422(t *testing.T) {
	repo := txProducts(t)
	id := seedPendingProduct(t, repo, "t2xa", "T2XA-CODE")

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+id+"/transition",
		bytes.NewReader([]byte(`{"to":"active"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()

	Transition(repo)(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status: got %d want 422; body=%s", rr.Code, rr.Body.String())
	}
	var errBody map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&errBody); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if errBody["error"] != "invalid_transition" {
		t.Errorf("error code = %q, want invalid_transition", errBody["error"])
	}
}

func TestTransitionUnknownIDReturns404(t *testing.T) {
	repo := txProducts(t)
	bogus := "00000000-0000-0000-0000-000000000000"

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+bogus+"/transition",
		bytes.NewReader([]byte(`{"to":"approved"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", bogus)
	rr := httptest.NewRecorder()

	Transition(repo)(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("status: got %d want 404; body=%s", rr.Code, rr.Body.String())
	}
}

func TestTransitionMissingToFieldReturns400(t *testing.T) {
	repo := txProducts(t)
	id := seedPendingProduct(t, repo, "t3xa", "T3XA-CODE")

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+id+"/transition",
		bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()

	Transition(repo)(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400; body=%s", rr.Code, rr.Body.String())
	}
}

func TestGetProductIncludesAllowedNext(t *testing.T) {
	repo := txProducts(t)
	id := seedPendingProduct(t, repo, "t4xa", "T4XA-CODE")

	req := httptest.NewRequest(http.MethodGet, "/v1/products/"+id, nil)
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()

	Get(repo)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200; body=%s", rr.Code, rr.Body.String())
	}
	var got productResponse
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	want := []string{"approved", "cancelled"} // pending product
	if !equalStringSets(got.AllowedNext, want) {
		t.Errorf("allowed_next = %v, want %v", got.AllowedNext, want)
	}
}

// helpers

// equalStringSets returns true if a and b contain the same strings,
// regardless of order. Used for AllowedNext assertions since
// lifecycle.AllowedNext returns unordered slice and the handler sorts;
// the test should not depend on the handler's sort behavior.
func equalStringSets(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	ac := append([]string(nil), a...)
	bc := append([]string(nil), b...)
	sort.Strings(ac)
	sort.Strings(bc)
	for i := range ac {
		if ac[i] != bc[i] {
			return false
		}
	}
	return true
}

// seedTenant inserts a tenants row inside the bound Tx and returns its
// id. Lets List tests seed multiple products under the same tenant
// without depending on seedPendingProduct's one-tenant-per-call shape.
func seedTenant(t *testing.T, repo *products.Products, tag string) string {
	t.Helper()
	var tenantID string
	err := repo.Tx().QueryRowContext(context.Background(),
		`INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
		tag, "T-"+tag,
	).Scan(&tenantID)
	if err != nil {
		t.Fatalf("seed tenant: %v", err)
	}
	return tenantID
}

func TestListProducts200WithRows(t *testing.T) {
	repo := txProducts(t)
	tenantID := seedTenant(t, repo, "tlist1")
	for i := 0; i < 3; i++ {
		if _, err := repo.Insert(context.Background(), products.ProductInput{
			TenantID: tenantID, Code: "L1-" + strconv.Itoa(i), Name: "L1", ProductType: "short_duration_credit",
		}); err != nil {
			t.Fatalf("insert product %d: %v", i, err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/products?tenant_id="+tenantID, nil)
	rr := httptest.NewRecorder()
	List(repo)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200; body=%s", rr.Code, rr.Body.String())
	}
	var body listResponse
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Products) != 3 {
		t.Errorf("products: got %d want 3", len(body.Products))
	}
	if body.NextOffset != nil {
		t.Errorf("next_offset: got %v want nil (page not full)", *body.NextOffset)
	}
}

func TestListProducts200EmptyForUnknownTenant(t *testing.T) {
	repo := txProducts(t)
	tenantID := seedTenant(t, repo, "tlist2") // tenant exists but no products

	req := httptest.NewRequest(http.MethodGet, "/v1/products?tenant_id="+tenantID, nil)
	rr := httptest.NewRecorder()
	List(repo)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200; body=%s", rr.Code, rr.Body.String())
	}
	var body listResponse
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Products) != 0 {
		t.Errorf("products: got %d want 0", len(body.Products))
	}
	// JSON decoder gives []productResponse{} not nil; assertion is on length.
	if body.NextOffset != nil {
		t.Errorf("next_offset: got %v want nil (empty page)", *body.NextOffset)
	}
}

func TestListProducts400MissingTenant(t *testing.T) {
	repo := txProducts(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/products", nil)
	rr := httptest.NewRecorder()
	List(repo)(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400; body=%s", rr.Code, rr.Body.String())
	}
	var ebody map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&ebody); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if ebody["error"] != "missing_tenant" {
		t.Errorf("error code: got %q want missing_tenant", ebody["error"])
	}
}

func TestListProducts400BadLimit(t *testing.T) {
	repo := txProducts(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/products?tenant_id=t&limit=zero", nil)
	rr := httptest.NewRecorder()
	List(repo)(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400; body=%s", rr.Code, rr.Body.String())
	}
	var ebody map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&ebody); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if ebody["error"] != "bad_query" {
		t.Errorf("error code: got %q want bad_query", ebody["error"])
	}
}

func TestListProducts405OnNonGET(t *testing.T) {
	repo := txProducts(t)
	req := httptest.NewRequest(http.MethodPost, "/v1/products?tenant_id=t", nil)
	rr := httptest.NewRecorder()
	List(repo)(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status: got %d want 405; body=%s", rr.Code, rr.Body.String())
	}
}

func TestListProducts200NextOffsetSetWhenPageFull(t *testing.T) {
	repo := txProducts(t)
	tenantID := seedTenant(t, repo, "tlist3")
	for i := 0; i < 3; i++ {
		if _, err := repo.Insert(context.Background(), products.ProductInput{
			TenantID: tenantID, Code: "L3-" + strconv.Itoa(i), Name: "L3", ProductType: "short_duration_credit",
		}); err != nil {
			t.Fatalf("insert product %d: %v", i, err)
		}
	}

	// Page size 2 with 3 products: first page should be full → next_offset=2.
	req := httptest.NewRequest(http.MethodGet, "/v1/products?tenant_id="+tenantID+"&limit=2", nil)
	rr := httptest.NewRecorder()
	List(repo)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200; body=%s", rr.Code, rr.Body.String())
	}
	var body listResponse
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Products) != 2 {
		t.Errorf("products: got %d want 2", len(body.Products))
	}
	if body.NextOffset == nil || *body.NextOffset != 2 {
		t.Errorf("next_offset: got %v want 2", body.NextOffset)
	}
}

// seedPendingProduct seeds a tenant + a pending product, returning the
// product id. Each call uses a unique tenant slug derived from `tag`.
func seedPendingProduct(t *testing.T, repo *products.Products, tag, code string) string {
	t.Helper()
	var tenantID string
	err := repo.Tx().QueryRowContext(context.Background(),
		`INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
		tag, "T-"+tag,
	).Scan(&tenantID)
	if err != nil {
		t.Fatalf("seed tenant: %v", err)
	}
	p, err := repo.Insert(context.Background(), products.ProductInput{
		TenantID: tenantID, Code: code, Name: "T-product", ProductType: "short_duration_credit",
	})
	if err != nil {
		t.Fatalf("insert product: %v", err)
	}
	return p.ID
}
