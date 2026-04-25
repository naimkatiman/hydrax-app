// Package workflow holds workflow-orchestration domain logic.
// Today this file declares the public surface only; concrete state
// machines land in follow-up tasks once the first product template is chosen
// (PRD-v2 §14 Q3).
package workflow

// Definition identifies a workflow template (e.g., "subscription.v1").
type Definition struct {
	ID      string
	Name    string
	Version string
}

// State is the runtime status of a workflow instance.
type State string

const (
	StatePending  State = "pending"
	StateRunning  State = "running"
	StateBlocked  State = "blocked"
	StateComplete State = "complete"
	StateFailed   State = "failed"
)
