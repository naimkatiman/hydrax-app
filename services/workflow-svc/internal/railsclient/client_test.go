package railsclient

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestIssueProduct_HappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method: got %q, want POST", r.Method)
		}
		if r.URL.Path != "/v1/issue" {
			t.Errorf("path: got %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"product_id":"mock-MMF-USD-1"}`))
	}))
	defer srv.Close()

	c := New(srv.URL, 2*time.Second)
	got, err := c.IssueProduct(context.Background(), "t1", "MMF-USD")
	if err != nil {
		t.Fatalf("IssueProduct: %v", err)
	}
	if got.ProductID != "mock-MMF-USD-1" {
		t.Errorf("ProductID: got %q", got.ProductID)
	}
}

func TestIssueProduct_ServerRejects400(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"issue_rejected","message":"hydraxrails: TenantID required"}`))
	}))
	defer srv.Close()

	c := New(srv.URL, 2*time.Second)
	_, err := c.IssueProduct(context.Background(), "", "MMF-USD")
	if !errors.Is(err, ErrRejected) {
		t.Fatalf("expected ErrRejected, got %v", err)
	}
	if !strings.Contains(err.Error(), "TenantID required") {
		t.Errorf("error should include server message, got %q", err.Error())
	}
}

func TestIssueProduct_ServerError500(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := New(srv.URL, 2*time.Second)
	_, err := c.IssueProduct(context.Background(), "t1", "X")
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("expected ErrUpstream, got %v", err)
	}
}

func TestIssueProduct_Timeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(500 * time.Millisecond):
		case <-r.Context().Done():
		}
	}))
	defer srv.Close()

	c := New(srv.URL, 50*time.Millisecond)
	_, err := c.IssueProduct(context.Background(), "t1", "X")
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("expected ErrUpstream from timeout, got %v", err)
	}
}
