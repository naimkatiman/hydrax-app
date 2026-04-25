package subscriptions

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// errNotFound is unexported; callers branch via IsNotFound.
var errNotFound = errors.New("subscriptions: not found")

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

// Subscriptions is the subscription-table repository. Caller owns lifetime
// of the underlying querier.
type Subscriptions struct {
	tx querier
}

// New binds a Subscriptions repo to the given querier (typically *sql.DB or
// *sql.Tx). Use *sql.Tx in tests for rollback isolation.
func New(tx querier) *Subscriptions {
	return &Subscriptions{tx: tx}
}

// Insert persists a new subscription and returns the row including server
// defaults (id, status, created_at, updated_at).
func (s *Subscriptions) Insert(ctx context.Context, in SubscriptionInput) (*Subscription, error) {
	const q = `
		INSERT INTO subscriptions (product_id, investor_user_id, amount_minor, currency)
		VALUES ($1, $2, $3, $4)
		RETURNING id, product_id, investor_user_id, amount_minor, currency, status, created_at, updated_at
	`
	var got Subscription
	err := s.tx.QueryRowContext(ctx, q, in.ProductID, in.InvestorUserID, in.AmountMinor, in.Currency).Scan(
		&got.ID, &got.ProductID, &got.InvestorUserID, &got.AmountMinor,
		&got.Currency, &got.Status, &got.CreatedAt, &got.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("subscriptions.Insert: %w", err)
	}
	return &got, nil
}

// GetByID returns the subscription with the given id, or an error for which
// IsNotFound returns true if no such row exists.
func (s *Subscriptions) GetByID(ctx context.Context, id string) (*Subscription, error) {
	const q = `
		SELECT id, product_id, investor_user_id, amount_minor, currency, status, created_at, updated_at
		FROM subscriptions WHERE id = $1
	`
	var got Subscription
	err := s.tx.QueryRowContext(ctx, q, id).Scan(
		&got.ID, &got.ProductID, &got.InvestorUserID, &got.AmountMinor,
		&got.Currency, &got.Status, &got.CreatedAt, &got.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("subscriptions.GetByID(%q): %w", id, errNotFound)
	}
	if err != nil {
		return nil, fmt.Errorf("subscriptions.GetByID(%q): %w", id, err)
	}
	return &got, nil
}
