package products

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// errNotFound is unexported; callers branch via IsNotFound.
var errNotFound = errors.New("products: not found")

// IsNotFound reports whether err is a "row not found" error from this
// package. GetByID wraps sql.ErrNoRows into errNotFound via %w before
// returning, so callers should never need to inspect sql.ErrNoRows directly.
func IsNotFound(err error) bool {
	return errors.Is(err, errNotFound)
}

// querier is the subset of *sql.DB / *sql.Tx the repo actually uses.
// Lets callers (and tests) bind the repo to a Tx for rollback semantics.
type querier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
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
