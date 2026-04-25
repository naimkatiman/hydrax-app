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

	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/handlers"
	"github.com/naimkatiman/hydrax-app/services/workflow-svc/internal/railsclient"
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

	// Cross-service rails client. workflow-svc never imports hydraxrails
	// directly — all rails calls go through this HTTP boundary so the same
	// shape works whether the server side is MockRails (v1) or a real
	// HydraX-backed impl (PRD-v2 §14 Q1 unblock).
	rails := railsclient.New(hydraxURL, 5*time.Second)
	_ = rails // exposed to handlers in a follow-up commit when workflow logic actually issues

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))

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
}
