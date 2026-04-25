package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/db"
	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/handlers"
	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/products"
	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/railsclient"
	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/subscriptions"
)

const serviceName = "workflow-svc"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7001"
	}
	hydraxURL := os.Getenv("HYDRAX_ADAPTER_URL")
	if hydraxURL == "" {
		hydraxURL = "http://localhost:7004"
	}
	dbURL := os.Getenv("DATABASE_URL")

	rails := railsclient.New(hydraxURL, 5*time.Second)
	_ = rails // wired in a follow-up plan when workflow logic dispatches to hydrax

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))

	var pool interface{ Close() error }
	if dbURL != "" {
		p, err := db.OpenPool(dbURL)
		if err != nil {
			log.Fatalf("db.OpenPool: %v", err)
		}
		// Startup ping: fail fast on bad DSN rather than at first query.
		// Folded in from Task 2 code-review nit.
		pingCtx, pingCancel := context.WithTimeout(context.Background(), 3*time.Second)
		if err := p.PingContext(pingCtx); err != nil {
			pingCancel()
			log.Fatalf("db.OpenPool ping: %v", err)
		}
		pingCancel()
		pool = p
		repo := products.New(p)
		mux.HandleFunc("POST /v1/products", handlers.Create(repo))
		mux.HandleFunc("GET /v1/products", handlers.List(repo))
		mux.HandleFunc("GET /v1/products/{id}", handlers.Get(repo))
		mux.HandleFunc("POST /v1/products/{id}/transition", handlers.Transition(repo))
		log.Printf("%s product routes enabled (db=%s)", serviceName, redactDSN(dbURL))
		subRepo := subscriptions.New(p)
		mux.HandleFunc("POST /v1/subscriptions", handlers.CreateSubscription(subRepo))
		mux.HandleFunc("GET /v1/subscriptions/{id}", handlers.GetSubscription(subRepo))
		log.Printf("%s subscription routes enabled (db=%s)", serviceName, redactDSN(dbURL))
	} else {
		log.Printf("%s DATABASE_URL unset — product routes disabled (health only)", serviceName)
		log.Printf("%s DATABASE_URL unset — subscription routes disabled (health only)", serviceName)
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("%s listening on :%s (rails=%s)", serviceName, port, hydraxURL)
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

// redactDSN strips credentials from a Postgres URL for logging.
// Uses url.URL.Redacted (Go 1.15+) which masks the password while
// preserving scheme, user, host, port, path, and query string.
func redactDSN(dsn string) string {
	u, err := url.Parse(dsn)
	if err != nil {
		return "<unparseable-dsn>"
	}
	return u.Redacted()
}
