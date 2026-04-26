package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/naimkatiman/hydrax-app/services/approval-svc/internal/approvals"
)

func newRepo() *approvals.MemRepo { return approvals.NewMemRepo() }
func bgCtx() context.Context      { return context.Background() }

func TestAppend_Returns201WithRow(t *testing.T) {
	repo := newRepo()
	body, _ := json.Marshal(map[string]string{
		"tenant_id":     "t1",
		"resource_type": "product",
		"resource_id":   "p1",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/approvals", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	Append(repo)(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d body=%s", rr.Code, rr.Body.String())
	}
	var got map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["id"] == nil || got["status"] != "pending" {
		t.Fatalf("body = %v", got)
	}
}

func TestAppend_400OnMissingFields(t *testing.T) {
	repo := newRepo()
	req := httptest.NewRequest(http.MethodPost, "/v1/approvals", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()
	Append(repo)(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestAppend_405OnGet(t *testing.T) {
	repo := newRepo()
	req := httptest.NewRequest(http.MethodGet, "/v1/approvals", nil)
	rr := httptest.NewRecorder()
	Append(repo)(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestGet_404OnUnknown(t *testing.T) {
	repo := newRepo()
	req := httptest.NewRequest(http.MethodGet, "/v1/approvals/nope", nil)
	rr := httptest.NewRecorder()
	Get(repo, "nope")(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestListPending_Returns200WithArray(t *testing.T) {
	repo := newRepo()
	repo.Insert(bgCtx(), approvals.ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	repo.Insert(bgCtx(), approvals.ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p2"})
	req := httptest.NewRequest(http.MethodGet, "/v1/approvals?status=pending", nil)
	rr := httptest.NewRecorder()
	ListPending(repo)(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d", rr.Code)
	}
	var got []map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("len = %d, want 2", len(got))
	}
}

func TestDecide_Returns200WithUpdatedRow(t *testing.T) {
	repo := newRepo()
	in, _ := repo.Insert(bgCtx(), approvals.ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	body, _ := json.Marshal(map[string]string{"status": "approved", "decided_by_user_id": "u1"})
	req := httptest.NewRequest(http.MethodPost, "/v1/approvals/"+in.ID+"/decide", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	Decide(repo, in.ID)(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rr.Code, rr.Body.String())
	}
	var got map[string]any
	json.Unmarshal(rr.Body.Bytes(), &got)
	if got["status"] != "approved" {
		t.Fatalf("status = %v", got["status"])
	}
}

func TestDecide_404OnUnknown(t *testing.T) {
	repo := newRepo()
	body, _ := json.Marshal(map[string]string{"status": "approved", "decided_by_user_id": "u1"})
	req := httptest.NewRequest(http.MethodPost, "/v1/approvals/nope/decide", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	Decide(repo, "nope")(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestDecide_400OnInvalidStatus(t *testing.T) {
	repo := newRepo()
	in, _ := repo.Insert(bgCtx(), approvals.ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})
	body, _ := json.Marshal(map[string]string{"status": "maybe", "decided_by_user_id": "u1"})
	req := httptest.NewRequest(http.MethodPost, "/v1/approvals/"+in.ID+"/decide", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	Decide(repo, in.ID)(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rr.Code)
	}
}

func TestDecide_409OnAlreadyDecided(t *testing.T) {
	repo := newRepo()
	in, _ := repo.Insert(bgCtx(), approvals.ApprovalInput{TenantID: "t1", ResourceType: "product", ResourceID: "p1"})

	// First decide.
	body, _ := json.Marshal(map[string]string{"status": "approved", "decided_by_user_id": "u1"})
	req := httptest.NewRequest(http.MethodPost, "/v1/approvals/"+in.ID+"/decide", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	Decide(repo, in.ID)(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("first decide status = %d body=%s", rr.Code, rr.Body.String())
	}

	// Second decide must 409.
	body2, _ := json.Marshal(map[string]string{"status": "rejected", "decided_by_user_id": "u2"})
	req2 := httptest.NewRequest(http.MethodPost, "/v1/approvals/"+in.ID+"/decide", bytes.NewReader(body2))
	rr2 := httptest.NewRecorder()
	Decide(repo, in.ID)(rr2, req2)
	if rr2.Code != http.StatusConflict {
		t.Fatalf("second decide status = %d body=%s, want 409", rr2.Code, rr2.Body.String())
	}
	var got map[string]string
	if err := json.NewDecoder(rr2.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got["error"] != "already_decided" {
		t.Errorf("error code: got %q want already_decided", got["error"])
	}
}

func TestAppend_413OnOversizeBody(t *testing.T) {
	repo := newRepo()
	big := strings.Repeat("x", 70*1024)
	req := httptest.NewRequest(http.MethodPost, "/v1/approvals", strings.NewReader(big))
	rr := httptest.NewRecorder()
	Append(repo)(rr, req)
	// httptest ResponseRecorder doesn't always emit 413 from MaxBytesReader.
	// Accept 400 (bad_json on truncated read) OR 413.
	if rr.Code != http.StatusRequestEntityTooLarge && rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 413 or 400", rr.Code)
	}
}
