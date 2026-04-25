// Package audit holds the immutable action-log domain model and the
// Postgres-backed repository. Append-only — events are never updated
// or deleted; corrections happen by appending a new event that
// references the same resource.
package audit

import (
	"encoding/json"
	"time"
)

// Event is one row of audit_events. Field names map 1:1 to the schema:
// id, tenant_id, actor_user_id, action, resource_type, resource_id,
// payload, created_at. ActorUserID is *string because the schema
// permits NULL (system-generated events have no user actor).
type Event struct {
	ID           string
	TenantID     string
	ActorUserID  *string
	Action       string
	ResourceType string
	ResourceID   string
	Payload      json.RawMessage
	CreatedAt    time.Time
}

// EventInput is the user-supplied subset for Append. Server fills id,
// created_at via DB defaults.
type EventInput struct {
	TenantID     string
	ActorUserID  *string
	Action       string
	ResourceType string
	ResourceID   string
	Payload      json.RawMessage
}
