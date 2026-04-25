package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/lifecycle"
	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/products"
)

// AuditEmitter is the small audit-svc surface the Transition handler
// needs. The real implementation lives in internal/auditclient; tests
// inject a recording fake. Emission failures are best-effort — they
// log and the handler still returns 2xx for the originating request.
type AuditEmitter interface {
	EmitProductTransitioned(ctx context.Context, tenantID, productID, from, to string) error
}

// RailsIssuer is the small hydrax-adapter surface the Transition handler
// needs. The real implementation lives in internal/railsclient; tests
// inject a recording fake. Issuance is invoked only on pending->approved
// transitions; failures are best-effort — they log and the handler still
// returns 2xx, leaving rails_product_id null for a future reconciliation
// slice to backfill. A nil issuer is the no-op default used in local dev
// when HYDRAX_ADAPTER_URL is unset.
type RailsIssuer interface {
	IssueProduct(ctx context.Context, tenantID, productCode string) (railsProductID string, err error)
}

// RailsIssuerFunc adapts a plain function to RailsIssuer (mirrors
// http.HandlerFunc). Lets main.go wrap *railsclient.Client without
// pulling railsclient into this package.
type RailsIssuerFunc func(ctx context.Context, tenantID, productCode string) (string, error)

// IssueProduct satisfies RailsIssuer.
func (f RailsIssuerFunc) IssueProduct(ctx context.Context, tenantID, productCode string) (string, error) {
	return f(ctx, tenantID, productCode)
}

// auditEmitTimeout caps the inline audit POST budget. Derived from
// context.Background(), not r.Context(), so it survives the response
// writer closing.
const auditEmitTimeout = 2 * time.Second

// railsIssueTimeout caps the hydrax-adapter call budget. Larger than
// auditEmitTimeout because issuance crosses into rails — eventual real
// HydraX integration may include ledger commits — but still small enough
// that a stuck adapter does not pin the workflow-svc response.
const railsIssueTimeout = 5 * time.Second

type createBody struct {
	TenantID    string `json:"tenant_id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	ProductType string `json:"product_type"`
}

type productResponse struct {
	ID             string   `json:"id"`
	TenantID       string   `json:"tenant_id"`
	Code           string   `json:"code"`
	Name           string   `json:"name"`
	ProductType    string   `json:"product_type"`
	Status         string   `json:"status"`
	RailsProductID *string  `json:"rails_product_id,omitempty"`
	AllowedNext    []string `json:"allowed_next"`
	CreatedAt      string   `json:"created_at"`
	UpdatedAt      string   `json:"updated_at"`
}

func toResponse(p *products.Product) productResponse {
	next := lifecycle.AllowedNext(lifecycle.State(p.Status))
	out := make([]string, 0, len(next))
	for _, s := range next {
		out = append(out, string(s))
	}
	sort.Strings(out) // deterministic JSON for tests + clients
	return productResponse{
		ID:             p.ID,
		TenantID:       p.TenantID,
		Code:           p.Code,
		Name:           p.Name,
		ProductType:    p.ProductType,
		Status:         p.Status,
		RailsProductID: p.RailsProductID,
		AllowedNext:    out,
		CreatedAt:      p.CreatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
		UpdatedAt:      p.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000000Z"),
	}
}

func errorJSON(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code, "message": msg})
}

// Create handles POST /v1/products. Requires tenant_id, code, name,
// product_type. Returns 201 with the inserted row, 400 on bad input or
// missing fields, 409 on duplicate (tenant_id, code), 500 on other
// errors.
func Create(repo *products.Products) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		var body createBody
		r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			errorJSON(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		if body.TenantID == "" || body.Code == "" || body.Name == "" || body.ProductType == "" {
			errorJSON(w, http.StatusBadRequest, "missing_fields",
				"tenant_id, code, name, and product_type are required")
			return
		}

		got, err := repo.Insert(r.Context(), products.ProductInput{
			TenantID:    body.TenantID,
			Code:        body.Code,
			Name:        body.Name,
			ProductType: body.ProductType,
		})
		if err != nil {
			// Surface DB unique-constraint as 409 by string sniff — pgx
			// errors expose code "23505" but importing pgconn just for
			// this is more weight than it's worth in MVP.
			if isUniqueViolation(err) {
				errorJSON(w, http.StatusConflict, "duplicate_code",
					"a product with this code already exists for this tenant")
				return
			}
			log.Printf("workflow-svc: products.Create: %v", err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(toResponse(got))
	}
}

// isUniqueViolation matches Postgres SQLSTATE 23505 by string. Cheap
// and correct for our use; swap to pgconn.PgError if we ever need
// finer-grained handling.
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	var dup interface{ SQLState() string }
	if errors.As(err, &dup) && dup.SQLState() == "23505" {
		return true
	}
	return false
}

// listResponse is the JSON shape returned by GET /v1/products. NextOffset
// is a cheap "probably more rows" hint: set to offset+len(products) when
// the response is full (len == limit), nil otherwise. No total count to
// keep the query cheap.
type listResponse struct {
	Products   []productResponse `json:"products"`
	NextOffset *int              `json:"next_offset"`
}

const (
	listDefaultLimit = 50
	listMaxLimit     = 100
)

// List handles GET /v1/products?tenant_id=&limit=&offset=. Returns
//
//	200 with {"products":[...], "next_offset": <int|null>} on success
//	400 on missing tenant_id or unparseable limit/offset
//	405 on non-GET
//	500 on db failure
//
// Tenant scoping is mandatory — the caller (BFF) is responsible for
// supplying the tenant_id derived from the session. workflow-svc trusts
// that caller in this slice; future slice replaces the query param with
// a header propagated by auth middleware.
func List(repo *products.Products) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "GET only")
			return
		}
		q := r.URL.Query()
		tenantID := q.Get("tenant_id")
		if tenantID == "" {
			errorJSON(w, http.StatusBadRequest, "missing_tenant", "tenant_id query param required")
			return
		}

		limit := listDefaultLimit
		if raw := q.Get("limit"); raw != "" {
			n, err := strconv.Atoi(raw)
			if err != nil || n <= 0 {
				errorJSON(w, http.StatusBadRequest, "bad_query", "limit must be a positive integer")
				return
			}
			limit = n
			if limit > listMaxLimit {
				limit = listMaxLimit
			}
		}

		offset := 0
		if raw := q.Get("offset"); raw != "" {
			n, err := strconv.Atoi(raw)
			if err != nil || n < 0 {
				errorJSON(w, http.StatusBadRequest, "bad_query", "offset must be a non-negative integer")
				return
			}
			offset = n
		}

		got, err := repo.List(r.Context(), tenantID, limit, offset)
		if err != nil {
			log.Printf("workflow-svc: products.List(%q, limit=%d, offset=%d): %v", tenantID, limit, offset, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}

		out := make([]productResponse, 0, len(got))
		for _, p := range got {
			out = append(out, toResponse(p))
		}
		var next *int
		if len(out) == limit {
			n := offset + len(out)
			next = &n
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(listResponse{Products: out, NextOffset: next})
	}
}

// Get handles GET /v1/products/{id}. Returns 200 with the row, 404 if
// not found, 405 on non-GET, 500 otherwise.
func Get(repo *products.Products) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "GET only")
			return
		}
		id := r.PathValue("id")
		if id == "" {
			errorJSON(w, http.StatusBadRequest, "missing_id", "id path param required")
			return
		}
		got, err := repo.GetByID(r.Context(), id)
		if err != nil {
			if products.IsNotFound(err) {
				errorJSON(w, http.StatusNotFound, "not_found", "no product with that id")
				return
			}
			log.Printf("workflow-svc: products.Get(%q): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(toResponse(got))
	}
}

type transitionBody struct {
	To string `json:"to"`
}

// Transition handles POST /v1/products/{id}/transition.
//
// This endpoint is for system-driven transitions (e.g. scheduler-driven
// active->matured) and ops-console operator overrides. Production
// user-facing approval UX in distributor-portal routes through
// approval-svc, NOT this endpoint — even though pending->approved is
// reachable here, the approval-svc audit trail and multi-approver
// chain are bypassed if you call this directly.
//
// On 2xx the handler emits a product.transitioned event to audit-svc
// via the supplied AuditEmitter. Emission is best-effort: a failure is
// logged and the 200 still flows back to the caller. The audit_events
// table is append-only and replay-safe; durability is a future slice.
// The emitter call uses a derived 2-second context (NOT r.Context())
// so it survives the response writer closing. A nil emitter is the
// no-op default — used during local dev when AUDIT_SVC_URL is unset.
//
// On pending->approved specifically, the handler also calls
// issuer.IssueProduct against hydrax-adapter to mint the underlying
// tokenization id, then stamps it onto the row via SetRailsProductID.
// Issuance is best-effort with the same shape as audit emission —
// failure logs and the originating caller still sees 2xx; rails_product_id
// stays null for a reconciliation slice to backfill. Other transitions
// (approved->active, active->matured, etc.) do NOT call rails. A nil
// issuer is the no-op default used when HYDRAX_ADAPTER_URL is unset.
//
// Returns:
//
//	200 with updated product on success
//	400 on bad JSON / missing fields
//	404 when the product id does not exist
//	409 when status drifted between GetByID and UpdateStatus (race) or id is unknown by the time UpdateStatus runs
//	422 when (current_status, body.to) is not a legal lifecycle edge
//	500 on other errors
func Transition(repo *products.Products, emitter AuditEmitter, issuer RailsIssuer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			errorJSON(w, http.StatusMethodNotAllowed, "method_not_allowed", "POST only")
			return
		}
		id := r.PathValue("id")
		if id == "" {
			errorJSON(w, http.StatusBadRequest, "missing_id", "id path param required")
			return
		}
		var body transitionBody
		r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			errorJSON(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}
		if body.To == "" {
			errorJSON(w, http.StatusBadRequest, "missing_to", "to field required")
			return
		}

		current, err := repo.GetByID(r.Context(), id)
		if err != nil {
			if products.IsNotFound(err) {
				errorJSON(w, http.StatusNotFound, "not_found", "no product with that id")
				return
			}
			log.Printf("workflow-svc: products.Transition GetByID(%q): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}

		from := lifecycle.State(current.Status)
		to := lifecycle.State(body.To)
		if err := lifecycle.Transition(from, to); err != nil {
			errorJSON(w, http.StatusUnprocessableEntity, "invalid_transition", err.Error())
			return
		}

		updated, err := repo.UpdateStatus(r.Context(), id, current.Status, body.To)
		if err != nil {
			if products.IsStaleStatus(err) {
				errorJSON(w, http.StatusConflict, "stale_status",
					"product status changed under us — refetch and retry")
				return
			}
			log.Printf("workflow-svc: products.Transition UpdateStatus(%q): %v", id, err)
			errorJSON(w, http.StatusInternalServerError, "internal", "an internal error occurred")
			return
		}

		// Rails issuance fires only on pending->approved and only if an
		// issuer was wired. Inline (not deferred) so the response body
		// can carry the freshly stamped rails_product_id when the round
		// trip succeeds. Failures fall through to the 200 below — the
		// transition itself is committed and rails_product_id stays
		// null for a future reconciliation slice to backfill.
		if issuer != nil && current.Status == string(lifecycle.StatePending) && body.To == string(lifecycle.StateApproved) {
			issueCtx, issueCancel := context.WithTimeout(context.Background(), railsIssueTimeout)
			railsProductID, issueErr := issuer.IssueProduct(issueCtx, current.TenantID, current.Code)
			issueCancel()
			if issueErr != nil {
				log.Printf("workflow-svc: rails issuance failed for product=%s code=%s tenant=%s: %v",
					id, current.Code, current.TenantID, issueErr)
			} else {
				stamped, stampErr := repo.SetRailsProductID(r.Context(), id, railsProductID)
				if stampErr != nil {
					log.Printf("workflow-svc: rails_product_id stamp failed for product=%s rails_id=%s: %v",
						id, railsProductID, stampErr)
				} else {
					updated = stamped
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(toResponse(updated))

		if emitter != nil {
			emitCtx, cancel := context.WithTimeout(context.Background(), auditEmitTimeout)
			defer cancel()
			if err := emitter.EmitProductTransitioned(emitCtx, current.TenantID, id, current.Status, body.To); err != nil {
				log.Printf("workflow-svc: audit emission failed for product=%s transition=%s->%s: %v",
					id, current.Status, body.To, err)
			}
		}
	}
}
