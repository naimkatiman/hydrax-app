// Package railsclient is workflow-svc's HTTP client for hydrax-adapter.
// Calls cross the network (workflow-svc :7001 → hydrax-adapter :7004),
// even when both run on the same Railway project — workflow does not
// import hydraxrails directly. v1 server-side is still MockRails per
// Decision 2026-04-25.
package railsclient

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

// Client speaks the hydrax-adapter HTTP contract.
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

// IssueResult is the workflow-layer view of a successful issuance.
type IssueResult struct {
	ProductID string
}

// Errors callers branch on via errors.Is.
var (
	ErrUpstream = errors.New("railsclient: upstream error")
	ErrRejected = errors.New("railsclient: server rejected request")
)

type issueRequestBody struct {
	TenantID    string `json:"tenant_id"`
	ProductCode string `json:"product_code"`
}

type issueResponseBody struct {
	ProductID string `json:"product_id"`
}

type errorResponseBody struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// IssueProduct calls POST /v1/issue.
func (c *Client) IssueProduct(ctx context.Context, tenantID, productCode string) (*IssueResult, error) {
	payload, err := json.Marshal(issueRequestBody{TenantID: tenantID, ProductCode: productCode})
	if err != nil {
		return nil, fmt.Errorf("railsclient: marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/issue", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("railsclient: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode == http.StatusOK:
		var body issueResponseBody
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			return nil, fmt.Errorf("railsclient: decode 200: %w", err)
		}
		return &IssueResult{ProductID: body.ProductID}, nil
	case resp.StatusCode == http.StatusBadRequest:
		var ebody errorResponseBody
		_ = json.NewDecoder(resp.Body).Decode(&ebody)
		msg := ebody.Message
		if msg == "" {
			msg = "no message"
		}
		return nil, fmt.Errorf("%w: %s", ErrRejected, msg)
	case resp.StatusCode >= 500:
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
		return nil, fmt.Errorf("%w: status %s body=%q", ErrUpstream, strconv.Itoa(resp.StatusCode), body)
	default:
		return nil, fmt.Errorf("%w: unexpected status %d", ErrUpstream, resp.StatusCode)
	}
}
