// Package hydraxrails defines the workflow-layer interface to HydraX
// tokenisation, custody, and trading rails. Per CLAUDE.md decision
// 2026-04-25, v1 ships MockRails behind this interface so the workflow
// stack can build without blocking on HydraX engagement.
package hydraxrails

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"sync/atomic"
	"time"
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

// SubscribeRequest is an investor's ask to subscribe to an issued product.
type SubscribeRequest struct {
	TenantID     string
	ProductID    string
	InvestorRef  string
	Units        uint64
}

// SubscribeResult is the rails-issued subscription handle.
type SubscribeResult struct {
	SubscriptionID string
}

// CustodyRequest moves units between two custody addresses on rails.
type CustodyRequest struct {
	TenantID string
	From     string
	To       string
	AssetRef string
	Units    uint64
}

// CustodyResult is the rails-issued transfer handle.
type CustodyResult struct {
	TransferID string
}

// SettleRequest finalises a subscription on rails.
type SettleRequest struct {
	TenantID       string
	SubscriptionID string
}

// SettleResult is the rails-issued settlement handle plus terminal status.
type SettleResult struct {
	SettlementID string
	Status       string
}

// NAVResult is the deterministic NAV reading for a product.
type NAVResult struct {
	ProductID string
	NAV       string
	AsOf      time.Time
}

// Rails is the stable interface workflow-svc depends on.
// Real and mock implementations both satisfy it.
type Rails interface {
	IssueProduct(ctx context.Context, req IssueRequest) (IssueResult, error)
	Subscribe(ctx context.Context, req SubscribeRequest) (SubscribeResult, error)
	TransferCustody(ctx context.Context, req CustodyRequest) (CustodyResult, error)
	Settle(ctx context.Context, req SettleRequest) (SettleResult, error)
	NAV(ctx context.Context, productID string) (NAVResult, error)
}

// MockRails is the in-memory implementation used in v1 until the real
// HydraX surface is wired (PRD-v2 §14 Q1). All counters live on the
// struct so distinct verbs cannot collide on the same id.
type MockRails struct {
	issueCounter   atomic.Uint64
	subCounter     atomic.Uint64
	xferCounter    atomic.Uint64
	settleCounter  atomic.Uint64
}

func NewMockRails() *MockRails {
	return &MockRails{}
}

func (m *MockRails) IssueProduct(_ context.Context, req IssueRequest) (IssueResult, error) {
	if req.TenantID == "" {
		return IssueResult{}, errors.New("hydraxrails: TenantID required")
	}
	n := m.issueCounter.Add(1)
	return IssueResult{ProductID: fmt.Sprintf("mock-%s-%d", req.ProductCode, n)}, nil
}

func (m *MockRails) Subscribe(_ context.Context, req SubscribeRequest) (SubscribeResult, error) {
	if req.TenantID == "" {
		return SubscribeResult{}, errors.New("hydraxrails: TenantID required")
	}
	if req.ProductID == "" {
		return SubscribeResult{}, errors.New("hydraxrails: ProductID required")
	}
	n := m.subCounter.Add(1)
	return SubscribeResult{SubscriptionID: fmt.Sprintf("sub-mock-%d", n)}, nil
}

func (m *MockRails) TransferCustody(_ context.Context, req CustodyRequest) (CustodyResult, error) {
	if req.TenantID == "" {
		return CustodyResult{}, errors.New("hydraxrails: TenantID required")
	}
	if req.From == "" || req.To == "" {
		return CustodyResult{}, errors.New("hydraxrails: From and To required")
	}
	n := m.xferCounter.Add(1)
	return CustodyResult{TransferID: fmt.Sprintf("xfer-mock-%d", n)}, nil
}

func (m *MockRails) Settle(_ context.Context, req SettleRequest) (SettleResult, error) {
	if req.TenantID == "" {
		return SettleResult{}, errors.New("hydraxrails: TenantID required")
	}
	if req.SubscriptionID == "" {
		return SettleResult{}, errors.New("hydraxrails: SubscriptionID required")
	}
	n := m.settleCounter.Add(1)
	return SettleResult{
		SettlementID: fmt.Sprintf("set-mock-%d", n),
		Status:       "settled",
	}, nil
}

func (m *MockRails) NAV(_ context.Context, productID string) (NAVResult, error) {
	if productID == "" {
		return NAVResult{}, errors.New("hydraxrails: productID required")
	}
	// Deterministic: same productID always returns the same NAV.
	// Truncate AsOf to UTC date so demo screenshots stay stable within a day.
	h := fnv.New64a()
	_, _ = h.Write([]byte(productID))
	frac := h.Sum64() % 5000
	return NAVResult{
		ProductID: productID,
		NAV:       fmt.Sprintf("1.%04d", frac),
		AsOf:      time.Now().UTC().Truncate(24 * time.Hour),
	}, nil
}

// Compile-time guard: MockRails must satisfy Rails.
var _ Rails = (*MockRails)(nil)
