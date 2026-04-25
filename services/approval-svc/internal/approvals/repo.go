package approvals

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

var errNotFound = errors.New("approval: not found")

// IsNotFound reports whether err signals a missing approval row.
func IsNotFound(err error) bool {
	return errors.Is(err, errNotFound)
}

// MemRepo is the process-local in-memory approval store. Safe for
// concurrent use. Persistence is deferred to a future plan.
type MemRepo struct {
	mu   sync.RWMutex
	data map[string]*Approval
}

// NewMemRepo constructs an empty in-memory repo.
func NewMemRepo() *MemRepo {
	return &MemRepo{data: make(map[string]*Approval)}
}

func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("approvals: rand.Read: " + err.Error())
	}
	return hex.EncodeToString(b)
}

// Insert creates a pending approval and returns the persisted row.
func (r *MemRepo) Insert(_ context.Context, in ApprovalInput) (*Approval, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	row := &Approval{
		ID:           newID(),
		TenantID:     in.TenantID,
		ResourceType: in.ResourceType,
		ResourceID:   in.ResourceID,
		Status:       "pending",
		CreatedAt:    time.Now().UTC(),
	}
	r.data[row.ID] = row
	return cloneApproval(row), nil
}

// GetByID returns a copy of the row, or ErrNotFound.
func (r *MemRepo) GetByID(_ context.Context, id string) (*Approval, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	row, ok := r.data[id]
	if !ok {
		return nil, errNotFound
	}
	return cloneApproval(row), nil
}

// ListPending returns copies of all pending rows. Order is undefined.
func (r *MemRepo) ListPending(_ context.Context) ([]Approval, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Approval, 0)
	for _, row := range r.data {
		if row.Status == "pending" {
			out = append(out, *cloneApproval(row))
		}
	}
	return out, nil
}

// Decide applies the decision and returns the updated row.
func (r *MemRepo) Decide(_ context.Context, id string, in DecideInput) (*Approval, error) {
	if in.Status != "approved" && in.Status != "rejected" {
		return nil, errors.New(`approval: status must be "approved" or "rejected"`)
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	row, ok := r.data[id]
	if !ok {
		return nil, errNotFound
	}
	now := time.Now().UTC()
	by := in.DecidedByID
	row.Status = in.Status
	row.DecidedByUserID = &by
	row.DecidedAt = &now
	return cloneApproval(row), nil
}

func cloneApproval(in *Approval) *Approval {
	out := *in
	if in.DecidedByUserID != nil {
		v := *in.DecidedByUserID
		out.DecidedByUserID = &v
	}
	if in.DecidedAt != nil {
		v := *in.DecidedAt
		out.DecidedAt = &v
	}
	return &out
}
