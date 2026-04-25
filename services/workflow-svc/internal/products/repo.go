package products

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// errNotFound is unexported; callers branch via IsNotFound.
var errNotFound = errors.New("products: not found")

// errStaleStatus is unexported; callers branch via IsStaleStatus. Returned
// from UpdateStatus when the optimistic-concurrency WHERE clause matches
// zero rows (either the id is unknown, or the row's status drifted under
// us — SQL cannot distinguish those cases).
var errStaleStatus = errors.New("products: stale status — row not updated")

// IsNotFound reports whether err is a "row not found" error from this
// package. GetByID wraps sql.ErrNoRows into errNotFound via %w before
// returning, so callers should never need to inspect sql.ErrNoRows directly.
func IsNotFound(err error) bool {
	return errors.Is(err, errNotFound)
}

// IsStaleStatus reports whether err is the optimistic-concurrency miss
// from UpdateStatus.
func IsStaleStatus(err error) bool {
	return errors.Is(err, errStaleStatus)
}

// querier is the subset of *sql.DB / *sql.Tx the repo actually uses.
// Lets callers (and tests) bind the repo to a Tx for rollback semantics.
type querier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

// Products is the product-table repository. Caller owns lifetime of the
// underlying querier.
type Products struct {
	tx querier
}

// New binds a Products repo to the given querier (typically *sql.DB or
// *sql.Tx). Use *sql.Tx in tests for rollback isolation.
func New(tx querier) *Products {
	return &Products{tx: tx}
}

// Tx returns the underlying querier — only useful in tests that need to
// seed FK rows inside the same transaction. Production callers should
// not depend on this.
func (p *Products) Tx() querier {
	return p.tx
}

// Insert persists a new product and returns the row including server
// defaults (id, status, created_at, updated_at).
func (p *Products) Insert(ctx context.Context, in ProductInput) (*Product, error) {
	const q = `
		INSERT INTO products (tenant_id, code, name, product_type)
		VALUES ($1, $2, $3, $4)
		RETURNING id, tenant_id, code, name, product_type, status, rails_product_id, created_at, updated_at
	`
	var got Product
	err := p.tx.QueryRowContext(ctx, q, in.TenantID, in.Code, in.Name, in.ProductType).Scan(
		&got.ID, &got.TenantID, &got.Code, &got.Name, &got.ProductType,
		&got.Status, &got.RailsProductID, &got.CreatedAt, &got.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("products.Insert: %w", err)
	}
	return &got, nil
}

// UpdateStatus performs an optimistic-concurrency status change:
// UPDATE products SET status=$3 WHERE id=$1 AND status=$2.
// If the WHERE matches zero rows (either the id is unknown or the
// row's status drifted under us), IsStaleStatus(err) returns true —
// the SQL cannot distinguish those two cases and the handler maps
// both to HTTP 409.
//
// Lifecycle validity (is fromStatus -> toStatus a legal edge?) is the
// caller's responsibility — this method writes blindly to whatever
// pair is passed and lets the DB CHECK constraint reject illegal
// status strings as a backstop.
func (p *Products) UpdateStatus(ctx context.Context, id, fromStatus, toStatus string) (*Product, error) {
	const q = `
		UPDATE products
		SET status = $3, updated_at = NOW()
		WHERE id = $1 AND status = $2
		RETURNING id, tenant_id, code, name, product_type, status, rails_product_id, created_at, updated_at
	`
	var got Product
	err := p.tx.QueryRowContext(ctx, q, id, fromStatus, toStatus).Scan(
		&got.ID, &got.TenantID, &got.Code, &got.Name, &got.ProductType,
		&got.Status, &got.RailsProductID, &got.CreatedAt, &got.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("products.UpdateStatus(%q, %q->%q): %w", id, fromStatus, toStatus, errStaleStatus)
	}
	if err != nil {
		return nil, fmt.Errorf("products.UpdateStatus(%q, %q->%q): %w", id, fromStatus, toStatus, err)
	}
	return &got, nil
}

// List returns up to limit products for the given tenant, ordered by
// created_at DESC, skipping the first offset rows. Limit must be > 0;
// callers should clamp at the handler level (the repo trusts its
// inputs). Returns an empty slice (never nil) when no rows match.
func (p *Products) List(ctx context.Context, tenantID string, limit, offset int) ([]*Product, error) {
	const q = `
		SELECT id, tenant_id, code, name, product_type, status, rails_product_id, created_at, updated_at
		FROM products
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := p.tx.QueryContext(ctx, q, tenantID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("products.List(%q): %w", tenantID, err)
	}
	defer rows.Close()

	out := make([]*Product, 0, limit)
	for rows.Next() {
		var got Product
		if err := rows.Scan(
			&got.ID, &got.TenantID, &got.Code, &got.Name, &got.ProductType,
			&got.Status, &got.RailsProductID, &got.CreatedAt, &got.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("products.List(%q): scan: %w", tenantID, err)
		}
		out = append(out, &got)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("products.List(%q): rows: %w", tenantID, err)
	}
	return out, nil
}

// GetByID returns the product with the given id, or an error for which
// IsNotFound returns true if no such row exists.
func (p *Products) GetByID(ctx context.Context, id string) (*Product, error) {
	const q = `
		SELECT id, tenant_id, code, name, product_type, status, rails_product_id, created_at, updated_at
		FROM products WHERE id = $1
	`
	var got Product
	err := p.tx.QueryRowContext(ctx, q, id).Scan(
		&got.ID, &got.TenantID, &got.Code, &got.Name, &got.ProductType,
		&got.Status, &got.RailsProductID, &got.CreatedAt, &got.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("products.GetByID(%q): %w", id, errNotFound)
	}
	if err != nil {
		return nil, fmt.Errorf("products.GetByID(%q): %w", id, err)
	}
	return &got, nil
}
