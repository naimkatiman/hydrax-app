// Package approvals owns approval-chain definitions and runtime state.
// Concrete chain types land alongside the first product template (PRD-v2 §14 Q3).
package approvals

import "time"

// Decision is the outcome of a single approver's vote.
type Decision string

const (
	DecisionPending   Decision = "pending"
	DecisionApproved  Decision = "approved"
	DecisionRejected  Decision = "rejected"
	DecisionEscalated Decision = "escalated"
)

// Step is a single rung in an approval chain.
type Step struct {
	ID         string
	ApproverID string
	Decision   Decision
}

// Approval is a single approval record. Status transitions:
//   pending -> approved  (Decide with "approved")
//   pending -> rejected  (Decide with "rejected")
// Once decided, an approval is terminal in this minimal model.
type Approval struct {
	ID              string
	TenantID        string
	ResourceType    string
	ResourceID      string
	Status          string     // "pending", "approved", "rejected"
	DecidedByUserID *string    // null until Decide
	DecidedAt       *time.Time // null until Decide
	CreatedAt       time.Time
}

// ApprovalInput is the user-supplied subset for Insert.
type ApprovalInput struct {
	TenantID     string
	ResourceType string
	ResourceID   string
}

// DecideInput captures who decided and how.
type DecideInput struct {
	Status      string // "approved" or "rejected"
	DecidedByID string
}
