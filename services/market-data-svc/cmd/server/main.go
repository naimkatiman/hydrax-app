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

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/api"
	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/cache"
	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/config"
	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/handlers"
	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/observability"
	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/upstream/binance"
	"github.com/naimkatiman/hydrax-app/services/market-data-svc/internal/upstream/hub"
)

const serviceName = "market-data-svc"

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	binClient := binance.New(cfg.BinanceAPIBase, cfg.BinanceAPIKey, 5*time.Second)
	hubClient := hub.New(cfg.HubURL, cfg.HubTimeout)

	apiHandlers := &api.Handlers{
		Binance:      binClient,
		Hub:          hubClient,
		CandlesCache: cache.New[api.CandleResponse](512, nil),
		QuoteCache:   cache.New[api.QuoteResponse](128, nil),
		FXCache:      cache.New[api.FXResponse](128, nil),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Health(serviceName))
	mux.Handle("/metrics", promhttp.Handler())

	// Mount /v1 sub-tree onto the main mux. ServeMux's pattern syntax
	// (Go 1.22+) lets us delegate via Handle.
	v1Mux := apiHandlers.ServeMux()
	mux.Handle("/v1/", v1Mux)

	// Middleware chain: logging wraps metrics wraps mux. Both middlewares
	// short-circuit on /metrics so Prometheus scrapes don't get logged or
	// counted into themselves.
	logger := observability.NewLogger(nil)
	wrapped := observability.LoggingMiddleware(logger)(observability.MetricsMiddleware(mux))

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           wrapped,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("%s listening on :%s (hub=%s binance=%s)",
			serviceName, cfg.Port, cfg.HubURL, cfg.BinanceAPIBase)
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
