package db

import (
	"context"
	"os"
	"testing"
	"time"
)

// requireDSN aborts the test if DATABASE_URL is not set. We do not skip
// — missing DB during test is a regression, not an environmental
// excuse. Run db/postgres/docker-compose.test.yml first.
func requireDSN(t *testing.T) string {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Fatal("DATABASE_URL not set; run docker compose -f db/postgres/docker-compose.test.yml up -d")
	}
	return dsn
}

func TestOpenPoolPings(t *testing.T) {
	dsn := requireDSN(t)
	pool, err := OpenPool(dsn)
	if err != nil {
		t.Fatalf("OpenPool: %v", err)
	}
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := pool.PingContext(ctx); err != nil {
		t.Fatalf("PingContext: %v", err)
	}
}
