package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/naimkatiman/hydrax-app/services/canton-adapter/internal/ledger"
)

// SubmitCommandRequestBody is the JSON shape POST /v1/commands accepts.
// PayloadJSON is RawMessage so any valid JSON value (object, array,
// string, null) is accepted and stored verbatim.
type SubmitCommandRequestBody struct {
	Kind        string          `json:"kind"`
	TemplateID  string          `json:"template_id"`
	ContractID  string          `json:"contract_id,omitempty"`
	Choice      string          `json:"choice,omitempty"`
	PayloadJSON json.RawMessage `json:"payload_json,omitempty"`
}

// SubmitCommandResponseBody is the JSON shape POST /v1/commands returns.
// For exercise the contract id echoes the input; for create it is the new cid.
type SubmitCommandResponseBody struct {
	ContractID string `json:"contract_id"`
	Offset     uint64 `json:"offset"`
}

// SubmitCommand exposes Ledger.SubmitCreate / SubmitExercise over HTTP.
func SubmitCommand(l *ledger.Ledger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body SubmitCommandRequestBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondError(w, http.StatusBadRequest, "bad_json", err.Error())
			return
		}

		payload := []byte(body.PayloadJSON)

		switch body.Kind {
		case "create":
			if body.TemplateID == "" {
				respondError(w, http.StatusBadRequest, "bad_command", "template_id is required for create")
				return
			}
			cid, off, err := l.SubmitCreate(body.TemplateID, payload)
			if err != nil {
				respondError(w, http.StatusBadRequest, "bad_command", err.Error())
				return
			}
			respondJSON(w, http.StatusOK, SubmitCommandResponseBody{ContractID: cid, Offset: off})
		case "exercise":
			if body.TemplateID == "" || body.ContractID == "" || body.Choice == "" {
				respondError(w, http.StatusBadRequest, "bad_command", "exercise requires template_id, contract_id, choice")
				return
			}
			off, err := l.SubmitExercise(body.TemplateID, body.ContractID, body.Choice, payload)
			if err != nil {
				respondError(w, http.StatusBadRequest, "bad_command", err.Error())
				return
			}
			respondJSON(w, http.StatusOK, SubmitCommandResponseBody{ContractID: body.ContractID, Offset: off})
		default:
			respondError(w, http.StatusBadRequest, "bad_kind", "kind must be 'create' or 'exercise'")
		}
	}
}
