package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/naimkatiman/hydrax-app/services/canton-adapter/internal/handlers"
	"github.com/naimkatiman/hydrax-app/services/canton-adapter/internal/ledger"
)

const serviceName = "canton-adapter"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7005"
	}

	// Mock-only in v1 per decision 2026-04-25; swap the in-memory ledger
	// for a real participant client once Canton infra is approved
	// (PRD-v2 §14 Q1).
	l := ledger.New()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))
	mux.HandleFunc("POST /v1/parties", handlers.AllocateParty(l))
	mux.HandleFunc("GET /v1/parties", handlers.ListParties(l))
	mux.HandleFunc("POST /v1/commands", handlers.SubmitCommand(l))
	mux.HandleFunc("GET /v1/events", handlers.ListEvents(l))

	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("%s listening on :%s (mock testnet)", serviceName, port)
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
