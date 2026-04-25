package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/naimkatiman/hydrax-app/services/approval-svc/internal/approvals"
	"github.com/naimkatiman/hydrax-app/services/approval-svc/internal/handlers"
)

const serviceName = "approval-svc"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7002"
	}
	repo := approvals.NewMemRepo()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))
	mux.HandleFunc("/v1/approvals", routeCollection(repo))
	mux.HandleFunc("/v1/approvals/", routeItem(repo))

	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("%s listening on :%s (in-memory repo — persistence deferred)", serviceName, port)
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

// routeCollection fans /v1/approvals.
func routeCollection(repo *approvals.MemRepo) http.HandlerFunc {
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
func routeItem(repo *approvals.MemRepo) http.HandlerFunc {
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
