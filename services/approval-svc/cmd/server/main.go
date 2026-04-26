package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/naimkatiman/hydrax-app/services/approval-svc/internal/approvals"
	"github.com/naimkatiman/hydrax-app/services/approval-svc/internal/db"
	"github.com/naimkatiman/hydrax-app/services/approval-svc/internal/handlers"
)

const serviceName = "approval-svc"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7002"
	}
	dbURL := os.Getenv("DATABASE_URL")

	var repo approvals.Repo
	var pool interface{ Close() error }
	if dbURL != "" {
		p, err := db.OpenPool(dbURL)
		if err != nil {
			log.Fatalf("db.OpenPool: %v", err)
		}
		// Startup ping: fail fast on bad DSN rather than at first query.
		pingCtx, pingCancel := context.WithTimeout(context.Background(), 3*time.Second)
		if err := p.PingContext(pingCtx); err != nil {
			pingCancel()
			log.Fatalf("db.OpenPool ping: %v", err)
		}
		pingCancel()
		pool = p
		repo = approvals.NewPgRepo(p)
		log.Printf("%s pg-backed approvals enabled (db=%s)", serviceName, redactDSN(dbURL))
	} else {
		repo = approvals.NewMemRepo()
		log.Printf("%s DATABASE_URL unset — falling back to in-memory MemRepo (process restart wipes state)", serviceName)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))
	mux.HandleFunc("/v1/approvals", routeCollection(repo))
	mux.HandleFunc("/v1/approvals/", routeItem(repo))

	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("%s listening on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
	if pool != nil {
		_ = pool.Close()
	}
}

// routeCollection fans /v1/approvals.
func routeCollection(repo approvals.Repo) http.HandlerFunc {
	appendH := handlers.Append(repo)
	listH := handlers.ListPending(repo)
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			appendH(w, r)
		case http.MethodGet:
			listH(w, r)
		default:
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusMethodNotAllowed)
			_, _ = w.Write([]byte(`{"error":"method_not_allowed","message":"GET or POST only"}`))
		}
	}
}

// routeItem fans /v1/approvals/{id} and /v1/approvals/{id}/decide.
func routeItem(repo approvals.Repo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/v1/approvals/")
		// path is now either "{id}" or "{id}/decide".
		parts := strings.Split(path, "/")
		switch {
		case len(parts) == 1 && parts[0] != "":
			handlers.Get(repo, parts[0])(w, r)
		case len(parts) == 2 && parts[1] == "decide":
			handlers.Decide(repo, parts[0])(w, r)
		default:
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":"not_found"}`))
		}
	}
}

// redactDSN strips credentials from a Postgres URL for logging. Mirrors
// workflow-svc's helper.
func redactDSN(dsn string) string {
	u, err := url.Parse(dsn)
	if err != nil {
		return "<unparseable-dsn>"
	}
	return u.Redacted()
}
