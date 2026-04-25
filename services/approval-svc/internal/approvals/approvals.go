// Package approvals owns approval-chain definitions and runtime state.
// Concrete chain types land alongside the first product template (PRD-v2 §14 Q3).
package approvals

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
