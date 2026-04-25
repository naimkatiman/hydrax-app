// Package audit holds the immutable action-log domain model.
// Append-only log entries land here; persistence backend (Postgres) wires
// in a follow-up once schema is finalized.
package audit

import "time"

// Event is one row in the audit log.
// All fields are immutable post-write; updates create new entries.
type Event struct {
	ID         string
	TenantID   string
	ActorID    string
	Action     string
	TargetType string
	TargetID   string
	OccurredAt time.Time
	Metadata   map[string]any
}
