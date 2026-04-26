package subscriptions

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// errNotFound is unexported; callers branch via IsNotFound.
var errNotFound = errors.New("subscriptions: not found")

// errStaleStatus is unexported; callers branch via IsStaleStatus. Returned
// from UpdateStatus when the optimistic-concurrency WHERE clause matches
// zero rows (either the id is unknown, or the row's status drifted under
// us — SQL cannot distinguish those cases).
var errStaleStatus = errors.New("subscriptions: stale status — row not updated")

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

// UpdateStatus performs an optimistic-concurrency status change:
// UPDATE subscriptions SET status=$3 WHERE id=$1 AND status=$2.
// If the WHERE matches zero rows (either the id is unknown or the
// row's status drifted under us), IsStaleStatus(err) returns true —
// the SQL cannot distinguish those two cases and the handler maps
// both to HTTP 409.
//
// Lifecycle validity (is fromStatus -> toStatus a legal edge?) is the
// caller's responsibility — this method writes blindly to whatever
// pair is passed and lets the DB CHECK constraint reject illegal
// status strings as a backstop.
func (s *Subscriptions) UpdateStatus(ctx context.Context, id, fromStatus, toStatus string) (*Subscription, error) {
	const q = `
		UPDATE subscriptions
		SET status = $3, updated_at = NOW()
		WHERE id = $1 AND status = $2
		RETURNING id, product_id, investor_user_id, amount_minor, currency, status, created_at, updated_at
	`
	var got Subscription
	err := s.tx.QueryRowContext(ctx, q, id, fromStatus, toStatus).Scan(
		&got.ID, &got.ProductID, &got.InvestorUserID, &got.AmountMinor,
		&got.Currency, &got.Status, &got.CreatedAt, &got.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("subscriptions.UpdateStatus(%q, %q->%q): %w", id, fromStatus, toStatus, errStaleStatus)
	}
	if err != nil {
		return nil, fmt.Errorf("subscriptions.UpdateStatus(%q, %q->%q): %w", id, fromStatus, toStatus, err)
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
