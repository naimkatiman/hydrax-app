package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"sort"
	"strconv"
	"sync"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/products"
)

// recordingEmitter is the test double for AuditEmitter — it buffers
// every EmitProductTransitioned call. emitErr controls what the call
// returns so the "audit-svc failed but transition still 200" path is
// directly testable.
type recordingEmitter struct {
	mu      sync.Mutex
	calls   []emitCall
	emitErr error
}

type emitCall struct {
	tenantID  string
	productID string
	from      string
	to        string
}

func (r *recordingEmitter) EmitProductTransitioned(_ context.Context, tenantID, productID, from, to string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.calls = append(r.calls, emitCall{tenantID, productID, from, to})
	return r.emitErr
}

func (r *recordingEmitter) snapshot() []emitCall {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]emitCall, len(r.calls))
	copy(out, r.calls)
	return out
}

// errAuditTestFailure is the canned error the recordingEmitter returns
// when a test wants to simulate audit-svc rejecting the emission. Used
// to prove the handler still returns 200 on the 2xx path even when the
// emitter fails.
var errAuditTestFailure = errors.New("audit emission rejected (test fixture)")

// recordingIssuer is the test double for RailsIssuer. Mirrors the
// shape of recordingEmitter — buffers calls, lets the test pin the
// returned rails id and choose whether to fail the round trip.
type recordingIssuer struct {
	mu       sync.Mutex
	calls    []issueCall
	railsID  string
	issueErr error
}

type issueCall struct {
	tenantID    string
	productCode string
}

func (r *recordingIssuer) IssueProduct(_ context.Context, tenantID, productCode string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.calls = append(r.calls, issueCall{tenantID, productCode})
	if r.issueErr != nil {
		return "", r.issueErr
	}
	return r.railsID, nil
}

func (r *recordingIssuer) snapshot() []issueCall {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]issueCall, len(r.calls))
	copy(out, r.calls)
	return out
}

// errRailsTestFailure is the canned error the recordingIssuer returns
// when a test wants to simulate hydrax-adapter rejecting the issuance.
var errRailsTestFailure = errors.New("rails issuance rejected (test fixture)")

// tenantIDForProduct reads the tenant_id of an already-inserted product
// out of the same Tx the repo is bound to. Lets the emit-asserting
// tests verify the AuditEmitter saw the right tenant scope.
func tenantIDForProduct(t *testing.T, repo *products.Products, productID string) string {
	t.Helper()
	var tenantID string
	if err := repo.Tx().QueryRowContext(context.Background(),
		`SELECT tenant_id FROM products WHERE id = $1`, productID,
	).Scan(&tenantID); err != nil {
		t.Fatalf("tenantIDForProduct(%s): %v", productID, err)
	}
	return tenantID
}

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
	tenantID := tenantIDForProduct(t, repo, id)
	emitter := &recordingEmitter{}

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+id+"/transition",
		bytes.NewReader([]byte(`{"to":"approved"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()

	Transition(repo, emitter, nil)(rr, req)

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

	calls := emitter.snapshot()
	if len(calls) != 1 {
		t.Fatalf("emitter calls: got %d, want 1; calls=%+v", len(calls), calls)
	}
	want := emitCall{tenantID: tenantID, productID: id, from: "pending", to: "approved"}
	if calls[0] != want {
		t.Errorf("emitter call: got %+v, want %+v", calls[0], want)
	}
}

func TestTransitionPendingToActiveReturns422(t *testing.T) {
	repo := txProducts(t)
	id := seedPendingProduct(t, repo, "t2xa", "T2XA-CODE")
	emitter := &recordingEmitter{}

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+id+"/transition",
		bytes.NewReader([]byte(`{"to":"active"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()

	Transition(repo, emitter, nil)(rr, req)

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
	if calls := emitter.snapshot(); len(calls) != 0 {
		t.Errorf("422 path must not emit audit event, got %d call(s): %+v", len(calls), calls)
	}
}

func TestTransitionUnknownIDReturns404(t *testing.T) {
	repo := txProducts(t)
	bogus := "00000000-0000-0000-0000-000000000000"
	emitter := &recordingEmitter{}

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+bogus+"/transition",
		bytes.NewReader([]byte(`{"to":"approved"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", bogus)
	rr := httptest.NewRecorder()

	Transition(repo, emitter, nil)(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("status: got %d want 404; body=%s", rr.Code, rr.Body.String())
	}
	if calls := emitter.snapshot(); len(calls) != 0 {
		t.Errorf("404 path must not emit audit event, got %d call(s)", len(calls))
	}
}

func TestTransitionMissingToFieldReturns400(t *testing.T) {
	repo := txProducts(t)
	id := seedPendingProduct(t, repo, "t3xa", "T3XA-CODE")
	emitter := &recordingEmitter{}

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+id+"/transition",
		bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()

	Transition(repo, emitter, nil)(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400; body=%s", rr.Code, rr.Body.String())
	}
	if calls := emitter.snapshot(); len(calls) != 0 {
		t.Errorf("400 path must not emit audit event, got %d call(s)", len(calls))
	}
}

// TestTransitionEmitFailureStill200 covers the contract that audit
// emission is best-effort: even if audit-svc returns an error, the
// transition itself succeeded in the DB and the originating caller
// must still see 200.
func TestTransitionEmitFailureStill200(t *testing.T) {
	repo := txProducts(t)
	id := seedPendingProduct(t, repo, "t5xa", "T5XA-CODE")
	emitter := &recordingEmitter{emitErr: errAuditTestFailure}

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+id+"/transition",
		bytes.NewReader([]byte(`{"to":"approved"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()

	Transition(repo, emitter, nil)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200 (emit failure must not block transition); body=%s",
			rr.Code, rr.Body.String())
	}
	if calls := emitter.snapshot(); len(calls) != 1 {
		t.Errorf("emitter must still be invoked exactly once on the 2xx path; got %d", len(calls))
	}
}

// TestTransitionNilEmitterStill200 covers the local-dev path where
// AUDIT_SVC_URL is unset and main.go passes a nil emitter — the 2xx
// flow must still succeed without panicking on the nil dereference.
func TestTransitionNilEmitterStill200(t *testing.T) {
	repo := txProducts(t)
	id := seedPendingProduct(t, repo, "t6xa", "T6XA-CODE")

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+id+"/transition",
		bytes.NewReader([]byte(`{"to":"approved"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()

	Transition(repo, nil, nil)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200; body=%s", rr.Code, rr.Body.String())
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

// productCodeFor reads the code of an already-inserted product out of
// the same Tx the repo is bound to. Lets the rails-asserting tests
// verify the issuer saw the right (tenant_id, product_code) tuple
// without having to thread the code through seedPendingProduct.
func productCodeFor(t *testing.T, repo *products.Products, productID string) string {
	t.Helper()
	var code string
	if err := repo.Tx().QueryRowContext(context.Background(),
		`SELECT code FROM products WHERE id = $1`, productID,
	).Scan(&code); err != nil {
		t.Fatalf("productCodeFor(%s): %v", productID, err)
	}
	return code
}

// railsProductIDFor reads the rails_product_id column for a row,
// returning ("", false) when the column is null. Used by tests that
// must distinguish "stamped" from "not stamped" in the underlying row
// (the JSON response only carries the value via omitempty pointer).
func railsProductIDFor(t *testing.T, repo *products.Products, productID string) (string, bool) {
	t.Helper()
	var id sql.NullString
	if err := repo.Tx().QueryRowContext(context.Background(),
		`SELECT rails_product_id FROM products WHERE id = $1`, productID,
	).Scan(&id); err != nil {
		t.Fatalf("railsProductIDFor(%s): %v", productID, err)
	}
	if !id.Valid {
		return "", false
	}
	return id.String, true
}

func TestTransitionPendingToApprovedCallsRailsAndStamps(t *testing.T) {
	repo := txProducts(t)
	id := seedPendingProduct(t, repo, "trails1", "TRAILS-001")
	tenantID := tenantIDForProduct(t, repo, id)
	productCode := productCodeFor(t, repo, id)
	emitter := &recordingEmitter{}
	issuer := &recordingIssuer{railsID: "rails-prod-12345"}

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+id+"/transition",
		bytes.NewReader([]byte(`{"to":"approved"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()

	Transition(repo, emitter, issuer)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200; body=%s", rr.Code, rr.Body.String())
	}

	calls := issuer.snapshot()
	if len(calls) != 1 {
		t.Fatalf("issuer calls: got %d, want 1; calls=%+v", len(calls), calls)
	}
	want := issueCall{tenantID: tenantID, productCode: productCode}
	if calls[0] != want {
		t.Errorf("issuer call: got %+v, want %+v", calls[0], want)
	}

	var got productResponse
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.RailsProductID == nil || *got.RailsProductID != "rails-prod-12345" {
		t.Errorf("response rails_product_id: got %v want rails-prod-12345", got.RailsProductID)
	}

	stamped, ok := railsProductIDFor(t, repo, id)
	if !ok || stamped != "rails-prod-12345" {
		t.Errorf("db rails_product_id: got (%q,%v) want (rails-prod-12345,true)", stamped, ok)
	}
}

func TestTransitionApprovedToActiveDoesNotCallRails(t *testing.T) {
	repo := txProducts(t)
	id := seedPendingProduct(t, repo, "trails2", "TRAILS-002")
	// Walk row from pending -> approved without going through the handler
	// so the test exercises only the approved->active edge.
	if _, err := repo.UpdateStatus(context.Background(), id, "pending", "approved"); err != nil {
		t.Fatalf("seed approved: %v", err)
	}
	emitter := &recordingEmitter{}
	issuer := &recordingIssuer{railsID: "should-not-be-stamped"}

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+id+"/transition",
		bytes.NewReader([]byte(`{"to":"active"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()

	Transition(repo, emitter, issuer)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200; body=%s", rr.Code, rr.Body.String())
	}
	if calls := issuer.snapshot(); len(calls) != 0 {
		t.Errorf("approved->active path must not call rails issuer; got %d call(s): %+v", len(calls), calls)
	}
	if _, ok := railsProductIDFor(t, repo, id); ok {
		t.Errorf("approved->active path must not stamp rails_product_id")
	}
}

func TestTransitionRailsFailureStill200WithNullRailsID(t *testing.T) {
	repo := txProducts(t)
	id := seedPendingProduct(t, repo, "trails3", "TRAILS-003")
	emitter := &recordingEmitter{}
	issuer := &recordingIssuer{issueErr: errRailsTestFailure}

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+id+"/transition",
		bytes.NewReader([]byte(`{"to":"approved"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()

	Transition(repo, emitter, issuer)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200 (rails failure must not block transition); body=%s",
			rr.Code, rr.Body.String())
	}
	if calls := issuer.snapshot(); len(calls) != 1 {
		t.Errorf("issuer must still be invoked exactly once on the 2xx path; got %d", len(calls))
	}
	var got productResponse
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.RailsProductID != nil {
		t.Errorf("rails failure must leave rails_product_id null; got %v", *got.RailsProductID)
	}
	// And the row in the DB must also remain null (not partially stamped).
	if stamped, ok := railsProductIDFor(t, repo, id); ok {
		t.Errorf("rails failure must leave db rails_product_id null; got %q", stamped)
	}
	// Status must still have advanced — the rails best-effort policy
	// commits the transition even when issuance fails.
	if got.Status != "approved" {
		t.Errorf("status must advance to approved despite rails failure; got %q", got.Status)
	}
}

func TestTransitionNilRailsStill200OnPendingToApproved(t *testing.T) {
	repo := txProducts(t)
	id := seedPendingProduct(t, repo, "trails4", "TRAILS-004")
	emitter := &recordingEmitter{}

	req := httptest.NewRequest(http.MethodPost, "/v1/products/"+id+"/transition",
		bytes.NewReader([]byte(`{"to":"approved"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", id)
	rr := httptest.NewRecorder()

	Transition(repo, emitter, nil)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200; body=%s", rr.Code, rr.Body.String())
	}
	if _, ok := railsProductIDFor(t, repo, id); ok {
		t.Errorf("nil issuer must not stamp rails_product_id")
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
