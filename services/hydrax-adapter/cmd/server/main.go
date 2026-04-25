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

	"github.com/naimkatiman/hydrax-app/services/hydrax-adapter/internal/handlers"
	"github.com/naimkatiman/hydrax-app/services/hydrax-adapter/internal/hydraxrails"
)

const serviceName = "hydrax-adapter"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7004"
	}

	// Mock-only in v1 per decision 2026-04-25; swap to a real impl
	// once the HydraX API surface is delivered.
	rails := hydraxrails.NewMockRails()
	_ = rails // wired into handlers in a follow-up task

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))

	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("%s listening on :%s (mock rails)", serviceName, port)
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
