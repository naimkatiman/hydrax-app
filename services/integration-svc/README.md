# integration-svc

Node/TS service. Owns external-system integrations: KYC/KYB, SSO, CRM.

## Run locally

    pnpm -F @hydrax/integration-svc dev

Listens on `:7102` (override with `PORT`).

## Health

    curl -s http://localhost:7102/healthz
    # {"service":"integration-svc","status":"ok"}

## Test

    pnpm -F @hydrax/integration-svc test

## Build

    pnpm -F @hydrax/integration-svc build

## Deploy

Railway service `integration-svc`. Build with repo root as Docker context: `docker build -f services/integration-svc/Dockerfile .`
