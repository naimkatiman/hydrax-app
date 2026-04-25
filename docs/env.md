# Environment Variables and Toolchains

Every environment variable and toolchain dependency used anywhere in the repo is documented here.

## Toolchains

### Daml SDK

- Version: 2.9.5 (pinned, LTS)
- Install: `curl -sSL https://get.daml.com/ | sh -s 2.9.5`
- Verify: `daml version` shows `SDK version: 2.9.5`
- Used by: `services/canton-adapter/daml/*`
- Why pinned to 2.9: Daml 3.x is pre-GA as of 2026-04-25. Upgrade re-decision is out of scope for the governance spike.

## Environment variables

### `VITE_BFF_URL`

- Used by: `web/packages/api-client` (read via `import.meta.env` in apps; falls back to `process.env.VITE_BFF_URL` in tests).
- Default: `http://localhost:8080` when unset.
- Where set: each `web/apps/*/.env.local` for development, Railway service env for staging/prod.
- Why: api-client's `fetchBaseQuery` baseUrl. Apps consume RTK Query hooks; no other surface reads this var.
