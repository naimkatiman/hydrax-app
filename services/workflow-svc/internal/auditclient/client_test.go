package auditclient

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestEmitProductTransitioned_HappyPath(t *testing.T) {
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method: got %q, want POST", r.Method)
		}
		if r.URL.Path != "/v1/audit/events" {
			t.Errorf("path: got %q, want /v1/audit/events", r.URL.Path)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("content-type: got %q, want application/json", ct)
		}
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		if err := json.Unmarshal(raw, &gotBody); err != nil {
			t.Fatalf("unmarshal body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"id":"evt-1","tenant_id":"t1","action":"product.transitioned","resource_type":"product","resource_id":"p1","payload":{"from":"pending","to":"approved"},"created_at":"2026-04-26T00:00:00.000000Z"}`))
	}))
	defer srv.Close()

	c := New(srv.URL, 2*time.Second)
	if err := c.EmitProductTransitioned(context.Background(), "t1", "p1", "pending", "approved"); err != nil {
		t.Fatalf("EmitProductTransitioned: %v", err)
	}

	// Body shape: top-level keys
	if gotBody["tenant_id"] != "t1" {
		t.Errorf("tenant_id: got %v want t1", gotBody["tenant_id"])
	}
	if gotBody["action"] != "product.transitioned" {
		t.Errorf("action: got %v want product.transitioned", gotBody["action"])
	}
	if gotBody["resource_type"] != "product" {
		t.Errorf("resource_type: got %v want product", gotBody["resource_type"])
	}
	if gotBody["resource_id"] != "p1" {
		t.Errorf("resource_id: got %v want p1", gotBody["resource_id"])
	}
	if _, present := gotBody["actor_user_id"]; present {
		t.Errorf("actor_user_id should be omitted on the wire when nil, got %v", gotBody["actor_user_id"])
	}
	payload, ok := gotBody["payload"].(map[string]any)
	if !ok {
		t.Fatalf("payload: got %T, want object", gotBody["payload"])
	}
	if payload["from"] != "pending" || payload["to"] != "approved" {
		t.Errorf("payload: got %v want {from:pending,to:approved}", payload)
	}
}

func TestEmitProductTransitioned_ServerRejects400(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"missing_fields","message":"tenant_id, action, resource_type, and resource_id are required"}`))
	}))
	defer srv.Close()

	c := New(srv.URL, 2*time.Second)
	err := c.EmitProductTransitioned(context.Background(), "", "p1", "pending", "approved")
	if !errors.Is(err, ErrRejected) {
		t.Fatalf("expected ErrRejected, got %v", err)
	}
	if !strings.Contains(err.Error(), "tenant_id") {
		t.Errorf("error should include server message, got %q", err.Error())
	}
}

func TestEmitProductTransitioned_ServerError500(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := New(srv.URL, 2*time.Second)
	err := c.EmitProductTransitioned(context.Background(), "t1", "p1", "pending", "approved")
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("expected ErrUpstream, got %v", err)
	}
}

func TestEmitProductTransitioned_Timeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(500 * time.Millisecond):
		case <-r.Context().Done():
		}
	}))
	defer srv.Close()

	c := New(srv.URL, 50*time.Millisecond)
	err := c.EmitProductTransitioned(context.Background(), "t1", "p1", "pending", "approved")
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("expected ErrUpstream from timeout, got %v", err)
	}
}
