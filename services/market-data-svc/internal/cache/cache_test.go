package cache

import (
	"testing"
	"time"
)

func TestCache_HitMiss(t *testing.T) {
	c := New[string](4, nil)
	if _, ok := c.Get("a"); ok {
		t.Fatal("expected miss")
	}
	c.Set("a", "1", time.Minute)
	got, ok := c.Get("a")
	if !ok || got != "1" {
		t.Fatalf("expected hit, got=%q ok=%v", got, ok)
	}
}

func TestCache_TTLExpiry(t *testing.T) {
	now := time.Unix(1000, 0)
	clock := func() time.Time { return now }
	c := New[int](4, clock)

	c.Set("k", 42, 5*time.Second)
	if v, ok := c.Get("k"); !ok || v != 42 {
		t.Fatalf("hit pre-expiry: got %d ok=%v", v, ok)
	}
	now = now.Add(6 * time.Second)
	if _, ok := c.Get("k"); ok {
		t.Fatal("expected expired miss")
	}
	if c.Len() != 0 {
		t.Fatalf("expected len 0 after expiry, got %d", c.Len())
	}
}

func TestCache_LRUEviction(t *testing.T) {
	c := New[string](2, nil)
	c.Set("a", "1", time.Minute)
	c.Set("b", "2", time.Minute)
	if _, ok := c.Get("a"); !ok {
		t.Fatal("a should still be present")
	}
	c.Set("c", "3", time.Minute)
	if _, ok := c.Get("b"); ok {
		t.Fatal("b should have been evicted (LRU after a was accessed)")
	}
	if _, ok := c.Get("a"); !ok {
		t.Fatal("a should be present (recently accessed)")
	}
	if _, ok := c.Get("c"); !ok {
		t.Fatal("c should be present (just inserted)")
	}
}

func TestCache_OverwriteRefreshesPosition(t *testing.T) {
	c := New[int](2, nil)
	c.Set("a", 1, time.Minute)
	c.Set("b", 2, time.Minute)
	c.Set("a", 99, time.Minute) // should refresh a's value AND its LRU position
	c.Set("c", 3, time.Minute)  // evicts b, not a

	if _, ok := c.Get("b"); ok {
		t.Fatal("b should have been evicted")
	}
	if v, ok := c.Get("a"); !ok || v != 99 {
		t.Fatalf("a: got %d ok=%v, want 99 true", v, ok)
	}
}
