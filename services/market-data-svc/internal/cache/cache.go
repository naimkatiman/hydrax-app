// Package cache is an in-process TTL cache with LRU eviction for upstream
// responses. Per docs/plans/2026-04-25-market-data-adapter.md §4.2:
// candles cached for min(interval, 30s), tickers 30s, FX rates 60s.
//
// Single-replica only — when measurements justify multi-replica, swap to
// Redis behind the same Cache[T] interface.
package cache

import (
	"container/list"
	"sync"
	"time"
)

// Cache is a generic TTL+LRU cache. Concurrent-safe.
type Cache[T any] struct {
	mu       sync.Mutex
	maxSize  int
	clock    func() time.Time
	items    map[string]*list.Element
	order    *list.List // front = most recently used
}

type entry[T any] struct {
	key       string
	value     T
	expiresAt time.Time
}

// New constructs a Cache with the given size cap. clock defaults to time.Now;
// inject for testability.
func New[T any](maxSize int, clock func() time.Time) *Cache[T] {
	if clock == nil {
		clock = time.Now
	}
	return &Cache[T]{
		maxSize: maxSize,
		clock:   clock,
		items:   make(map[string]*list.Element, maxSize),
		order:   list.New(),
	}
}

// Set stores value under key with the given TTL, replacing any existing entry.
// Evicts the least-recently-used entry if the cache is full.
func (c *Cache[T]) Set(key string, value T, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := c.clock()
	if existing, ok := c.items[key]; ok {
		existing.Value.(*entry[T]).value = value
		existing.Value.(*entry[T]).expiresAt = now.Add(ttl)
		c.order.MoveToFront(existing)
		return
	}

	if len(c.items) >= c.maxSize {
		c.evictOldest()
	}

	e := &entry[T]{key: key, value: value, expiresAt: now.Add(ttl)}
	el := c.order.PushFront(e)
	c.items[key] = el
}

// Get returns the cached value if present and not expired.
func (c *Cache[T]) Get(key string) (T, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	var zero T
	el, ok := c.items[key]
	if !ok {
		return zero, false
	}

	e := el.Value.(*entry[T])
	if c.clock().After(e.expiresAt) {
		c.removeElement(el)
		return zero, false
	}
	c.order.MoveToFront(el)
	return e.value, true
}

// Len returns the current number of (possibly expired) entries.
func (c *Cache[T]) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.items)
}

func (c *Cache[T]) evictOldest() {
	el := c.order.Back()
	if el != nil {
		c.removeElement(el)
	}
}

func (c *Cache[T]) removeElement(el *list.Element) {
	e := el.Value.(*entry[T])
	delete(c.items, e.key)
	c.order.Remove(el)
}
