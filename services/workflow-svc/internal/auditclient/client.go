// Package auditclient is workflow-svc's HTTP client for audit-svc.
// Calls cross the network (workflow-svc :7001 -> audit-svc :7003), even
// when both run on the same Railway project — workflow does not import
// audit-svc directly. Mirrors the railsclient package pattern.
//
// Emission is best-effort: callers should log and continue on error
// rather than fail the originating request. The audit_events table is
// append-only and replay-safe; durability is a future slice.
package auditclient

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

// Client speaks the audit-svc HTTP contract.
type Client struct {
	baseURL string
	http    *http.Client
}

// New constructs a Client. timeout applies per request.
func New(baseURL string, timeout time.Duration) *Client {
	return &Client{
		baseURL: baseURL,
		http:    &http.Client{Timeout: timeout},
	}
}

// Errors callers branch on via errors.Is.
var (
	ErrUpstream = errors.New("auditclient: upstream error")
	ErrRejected = errors.New("auditclient: server rejected request")
)

// appendRequestBody mirrors audit-svc's appendBody JSON shape exactly.
// actor_user_id is intentionally omitempty — workflow-svc has no auth
// context yet, so the field is dropped entirely on the wire.
type appendRequestBody struct {
	TenantID     string          `json:"tenant_id"`
	ActorUserID  *string         `json:"actor_user_id,omitempty"`
	Action       string          `json:"action"`
	ResourceType string          `json:"resource_type"`
	ResourceID   string          `json:"resource_id"`
	Payload      json.RawMessage `json:"payload,omitempty"`
}

type errorResponseBody struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// EmitProductTransitioned posts a product.transitioned audit event to
// POST /v1/audit/events. ActorUserID is nil until workflow-svc receives
// an auth context (auth-foundation slice 2 follow-up). On 201 returns
// nil. On 4xx returns ErrRejected wrapping the server message. On 5xx
// or transport failure returns ErrUpstream.
func (c *Client) EmitProductTransitioned(ctx context.Context, tenantID, productID, from, to string) error {
	payloadJSON, err := json.Marshal(struct {
		From string `json:"from"`
		To   string `json:"to"`
	}{From: from, To: to})
	if err != nil {
		return fmt.Errorf("auditclient: marshal payload: %w", err)
	}

	body, err := json.Marshal(appendRequestBody{
		TenantID:     tenantID,
		ActorUserID:  nil,
		Action:       "product.transitioned",
		ResourceType: "product",
		ResourceID:   productID,
		Payload:      payloadJSON,
	})
	if err != nil {
		return fmt.Errorf("auditclient: marshal body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/audit/events", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("auditclient: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode == http.StatusCreated:
		// Drain the body so the connection can be reused. We do not
		// need the response shape for emission.
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return nil
	case resp.StatusCode >= 400 && resp.StatusCode < 500:
		var ebody errorResponseBody
		_ = json.NewDecoder(resp.Body).Decode(&ebody)
		msg := ebody.Message
		if msg == "" {
			msg = "no message"
		}
		return fmt.Errorf("%w: %s", ErrRejected, msg)
	case resp.StatusCode >= 500:
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
		return fmt.Errorf("%w: status %s body=%q", ErrUpstream, strconv.Itoa(resp.StatusCode), body)
	default:
		return fmt.Errorf("%w: unexpected status %d", ErrUpstream, resp.StatusCode)
	}
}
