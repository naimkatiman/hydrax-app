package approvals

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// querier is the subset of *sql.DB / *sql.Tx PgRepo actually uses.
// Lets tests bind PgRepo to a Tx for rollback isolation.
type querier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

// PgRepo is the Postgres-backed approvals storage. Caller owns the
// lifetime of the underlying querier. Concurrency is the database's
// problem, not the repo's.
type PgRepo struct {
	tx querier
}

// NewPgRepo binds a PgRepo to the given querier (typically *sql.DB or
// *sql.Tx). Use *sql.Tx in tests for rollback isolation.
func NewPgRepo(tx querier) *PgRepo {
	return &PgRepo{tx: tx}
}

// Insert persists a new pending approval and returns the row including
// server defaults (id, status='pending', created_at).
func (r *PgRepo) Insert(ctx context.Context, in ApprovalInput) (*Approval, error) {
	const q = `
		INSERT INTO approvals (tenant_id, resource_type, resource_id)
		VALUES ($1, $2, $3)
		RETURNING id, tenant_id, resource_type, resource_id, status, decided_by_user_id, decided_at, created_at
	`
	var row Approval
	err := r.tx.QueryRowContext(ctx, q, in.TenantID, in.ResourceType, in.ResourceID).Scan(
		&row.ID, &row.TenantID, &row.ResourceType, &row.ResourceID,
		&row.Status, &row.DecidedByUserID, &row.DecidedAt, &row.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("approvals.PgRepo.Insert: %w", err)
	}
	return &row, nil
}

// GetByID returns the row, or an error for which IsNotFound returns
// true if no such row exists.
func (r *PgRepo) GetByID(ctx context.Context, id string) (*Approval, error) {
	const q = `
		SELECT id, tenant_id, resource_type, resource_id, status, decided_by_user_id, decided_at, created_at
		FROM approvals WHERE id = $1
	`
	var row Approval
	err := r.tx.QueryRowContext(ctx, q, id).Scan(
		&row.ID, &row.TenantID, &row.ResourceType, &row.ResourceID,
		&row.Status, &row.DecidedByUserID, &row.DecidedAt, &row.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("approvals.PgRepo.GetByID(%q): %w", id, errNotFound)
	}
	if err != nil {
		return nil, fmt.Errorf("approvals.PgRepo.GetByID(%q): %w", id, err)
	}
	return &row, nil
}

// ListPending returns all rows with status='pending'. Order is
// created_at DESC. No pagination yet — pagination is a follow-up
// once a portal needs it.
func (r *PgRepo) ListPending(ctx context.Context) ([]Approval, error) {
	const q = `
		SELECT id, tenant_id, resource_type, resource_id, status, decided_by_user_id, decided_at, created_at
		FROM approvals WHERE status = 'pending'
		ORDER BY created_at DESC
	`
	rows, err := r.tx.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("approvals.PgRepo.ListPending: %w", err)
	}
	defer rows.Close()

	out := make([]Approval, 0)
	for rows.Next() {
		var row Approval
		if err := rows.Scan(
			&row.ID, &row.TenantID, &row.ResourceType, &row.ResourceID,
			&row.Status, &row.DecidedByUserID, &row.DecidedAt, &row.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("approvals.PgRepo.ListPending: scan: %w", err)
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("approvals.PgRepo.ListPending: rows: %w", err)
	}
	return out, nil
}

// Decide applies the decision atomically with first-decide-wins
// semantics: UPDATE ... WHERE id=$3 AND status='pending'. When the
// WHERE matches zero rows we issue a follow-up SELECT to disambiguate
// 404 (unknown id) from 409 (already decided).
func (r *PgRepo) Decide(ctx context.Context, id string, in DecideInput) (*Approval, error) {
	if in.Status != "approved" && in.Status != "rejected" {
		return nil, errors.New(`approval: status must be "approved" or "rejected"`)
	}
	const updateQ = `
		UPDATE approvals
		SET status = $1, decided_by_user_id = $2, decided_at = NOW()
		WHERE id = $3 AND status = 'pending'
		RETURNING id, tenant_id, resource_type, resource_id, status, decided_by_user_id, decided_at, created_at
	`
	var row Approval
	err := r.tx.QueryRowContext(ctx, updateQ, in.Status, in.DecidedByID, id).Scan(
		&row.ID, &row.TenantID, &row.ResourceType, &row.ResourceID,
		&row.Status, &row.DecidedByUserID, &row.DecidedAt, &row.CreatedAt,
	)
	if err == nil {
		return &row, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("approvals.PgRepo.Decide(%q): %w", id, err)
	}
	// WHERE matched zero rows — disambiguate via follow-up SELECT.
	const probeQ = `SELECT 1 FROM approvals WHERE id = $1`
	var probe int
	probeErr := r.tx.QueryRowContext(ctx, probeQ, id).Scan(&probe)
	if errors.Is(probeErr, sql.ErrNoRows) {
		return nil, fmt.Errorf("approvals.PgRepo.Decide(%q): %w", id, errNotFound)
	}
	if probeErr != nil {
		return nil, fmt.Errorf("approvals.PgRepo.Decide(%q): probe: %w", id, probeErr)
	}
	return nil, fmt.Errorf("approvals.PgRepo.Decide(%q): %w", id, errAlreadyDecided)
}
