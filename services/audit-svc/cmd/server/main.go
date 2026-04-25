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

	"github.com/naimkatiman/hydrax-app/services/audit-svc/internal/handlers"
)

const serviceName = "audit-svc"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "7003"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))
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
