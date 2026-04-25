# notify-svc

Node/TS service. Owns email, in-app, and webhook notifications.

## Run locally

    pnpm -F @hydrax/notify-svc dev

Listens on `:7101` (override with `PORT`).

## Health

    curl -s http://localhost:7101/healthz
    # {"service":"notify-svc","status":"ok"}

## Test

    pnpm -F @hydrax/notify-svc test

## Build

    pnpm -F @hydrax/notify-svc build

## Deploy

Railway service `notify-svc`. Build with repo root as Docker context: `docker build -f services/notify-svc/Dockerfile .`
