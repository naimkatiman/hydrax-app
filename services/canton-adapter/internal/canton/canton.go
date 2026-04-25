// Package canton bridges the Daml ledger and the workflow stack.
// The Daml spike at services/canton-adapter/daml/hydrax-governance/
// defines the on-ledger contracts; this package will exchange commands
// and events with the participant node once that wiring lands.
package canton

// CommandKind identifies what the bridge is being asked to submit.
type CommandKind string

const (
	CommandCreate   CommandKind = "create"
	CommandExercise CommandKind = "exercise"
)

// Command is the workflow-layer request to submit to the participant.
type Command struct {
	Kind        CommandKind
	TemplateID  string
	ContractID  string
	Choice      string
	PayloadJSON []byte
}
