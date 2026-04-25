package audit

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
)

// querier is the subset of *sql.DB / *sql.Tx the repo actually uses.
// Lets callers (and tests) bind the repo to a Tx for rollback semantics.
type querier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

// Events is the audit_events repository. Caller owns lifetime of the
// underlying querier.
type Events struct {
	tx querier
}

// New binds an Events repo to the given querier (typically *sql.DB or
// *sql.Tx). Use *sql.Tx in tests for rollback isolation.
func New(tx querier) *Events {
	return &Events{tx: tx}
}

// Tx returns the underlying querier — only useful in tests that need
// to seed FK rows inside the same transaction. Production callers
// should not depend on this.
func (e *Events) Tx() querier {
	return e.tx
}

// Append persists a new audit event and returns the row including
// server defaults (id, created_at, payload default).
func (e *Events) Append(ctx context.Context, in EventInput) (*Event, error) {
	payload := in.Payload
	if payload == nil {
		payload = json.RawMessage(`{}`)
	}
	const q = `
		INSERT INTO audit_events
			(tenant_id, actor_user_id, action, resource_type, resource_id, payload)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, tenant_id, actor_user_id, action, resource_type, resource_id, payload, created_at
	`
	var got Event
	err := e.tx.QueryRowContext(ctx, q,
		in.TenantID, in.ActorUserID, in.Action, in.ResourceType, in.ResourceID, payload,
	).Scan(
		&got.ID, &got.TenantID, &got.ActorUserID, &got.Action,
		&got.ResourceType, &got.ResourceID, &got.Payload, &got.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("audit.Append: %w", err)
	}
	return &got, nil
}

// ListByResource returns audit events for the given resource, newest
// first. Returns an empty slice (not nil-error nil-slice) when no
// matches exist.
func (e *Events) ListByResource(ctx context.Context, tenantID, resourceType, resourceID string) ([]Event, error) {
	const q = `
		SELECT id, tenant_id, actor_user_id, action, resource_type, resource_id, payload, created_at
		FROM audit_events
		WHERE tenant_id = $1 AND resource_type = $2 AND resource_id = $3
		ORDER BY created_at DESC, id DESC
	`
	rows, err := e.tx.QueryContext(ctx, q, tenantID, resourceType, resourceID)
	if err != nil {
		return nil, fmt.Errorf("audit.ListByResource: %w", err)
	}
	defer rows.Close()

	out := make([]Event, 0)
	for rows.Next() {
		var ev Event
		if err := rows.Scan(
			&ev.ID, &ev.TenantID, &ev.ActorUserID, &ev.Action,
			&ev.ResourceType, &ev.ResourceID, &ev.Payload, &ev.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("audit.ListByResource scan: %w", err)
		}
		out = append(out, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("audit.ListByResource rows: %w", err)
	}
	return out, nil
}
