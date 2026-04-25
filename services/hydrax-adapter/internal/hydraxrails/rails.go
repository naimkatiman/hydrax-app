// Package hydraxrails defines the workflow-layer interface to HydraX
// tokenisation, custody, and trading rails. Per CLAUDE.md decision
// 2026-04-25, v1 ships MockRails behind this interface so the workflow
// stack can build without blocking on HydraX engagement.
package hydraxrails

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
)

// IssueRequest is the workflow-layer ask to mint a tokenised product on rails.
type IssueRequest struct {
	TenantID    string
	ProductCode string
}

// IssueResult is what rails returns once issuance is durably recorded.
type IssueResult struct {
	ProductID string
}

// Rails is the stable interface workflow-svc depends on.
// Real and mock implementations both satisfy it.
type Rails interface {
	IssueProduct(ctx context.Context, req IssueRequest) (IssueResult, error)
}

// MockRails is the in-memory implementation used in v1 until the real
// HydraX surface is wired (PRD-v2 §14 Q1).
type MockRails struct {
	counter atomic.Uint64
}

func NewMockRails() *MockRails {
	return &MockRails{}
}

func (m *MockRails) IssueProduct(_ context.Context, req IssueRequest) (IssueResult, error) {
	if req.TenantID == "" {
		return IssueResult{}, errors.New("hydraxrails: TenantID required")
	}
	n := m.counter.Add(1)
	return IssueResult{ProductID: fmt.Sprintf("mock-%s-%d", req.ProductCode, n)}, nil
}

// Compile-time guard: MockRails must satisfy Rails.
var _ Rails = (*MockRails)(nil)
