// Package db is workflow-svc's Postgres helper. Owns connection-pool
// construction. Repositories under sibling packages depend on a
// *sql.DB built here.
package db

import (
	"database/sql"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// OpenPool returns a *sql.DB backed by pgx's database/sql driver.
// dsn is a libpq-style connection string, e.g.
// "postgres://user:pass@host:5432/db?sslmode=disable".
//
// Caller owns the pool and must Close it at shutdown.
func OpenPool(dsn string) (*sql.DB, error) {
	if dsn == "" {
		return nil, fmt.Errorf("db.OpenPool: empty dsn")
	}
	pool, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("db.OpenPool: open: %w", err)
	}
	pool.SetMaxOpenConns(20)
	pool.SetMaxIdleConns(5)
	return pool, nil
}
