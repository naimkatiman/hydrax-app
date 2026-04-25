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

	"github.com/naimkatiman/hydrax-app/services/audit-svc/internal/audit"
	"github.com/naimkatiman/hydrax-app/services/audit-svc/internal/db"
	"github.com/naimkatiman/hydrax-app/services/audit-svc/internal/handlers"
)

const serviceName = "audit-svc"

func redactDSN(dsn string) string {
	u, err := url.Parse(dsn)
	if err != nil {
		return "<unparseable>"
	}
	return u.Redacted()
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7003"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("%s: DATABASE_URL unset — audit event routes disabled, only /healthz served", serviceName)
	} else {
		pool, err := db.OpenPool(dsn)
		if err != nil {
			log.Fatalf("%s: db.OpenPool(%s): %v", serviceName, redactDSN(dsn), err)
		}
		defer pool.Close()
		pingCtx, pingCancel := context.WithTimeout(context.Background(), 3*time.Second)
		if err := pool.PingContext(pingCtx); err != nil {
			pingCancel()
			log.Fatalf("%s: PingContext: %v", serviceName, err)
		}
		pingCancel()
		log.Printf("%s: DB pool ready (%s)", serviceName, redactDSN(dsn))

		repo := audit.New(pool)
		mux.HandleFunc("/v1/audit/events", routeEvents(repo))
	}

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
}

// routeEvents fans /v1/audit/events to Append (POST) or List (GET) by method.
// Single-path mux keeps the surface tight; method gate inside each handler
// returns 405 for the unsupported verb.
func routeEvents(repo *audit.Events) http.HandlerFunc {
	appendH := handlers.Append(repo)
	listH := handlers.List(repo)
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
