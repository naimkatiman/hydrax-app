# Plan — Railway prototype deploy (static site)

**Date:** 2026-04-24
**Slice:** Ship the HTML/JS/CSS prototype as a static site on Railway so the team has a shareable URL.

## Goal

One-line goal: get [index.html](../../index.html) reachable at a public Railway URL so design partners and stakeholders can click through the operator console without a local clone.

## Scope

**WILL build:**
- `package.json` at repo root with a `start` script that serves the three static files on `$PORT`
- `railway.json` pinning `startCommand` and `healthcheckPath`
- Railway service `hydrax-app/production/prototype` deployed via `railway up --detach`
- Verification log entry in [STATE.yaml](../../STATE.yaml) with Railway build id + commit sha

**Will NOT build:**
- Any backend service (workflow, approval, audit, adapters) — out of scope; blocked on prd-v2 §14
- Postgres / Mongo addons — not needed; prototype has no server state
- Custom domain / CNAME — can add later from Railway dashboard
- Build step / bundler — static files serve as-is
- CI/CD pipeline — manual `railway up` is the shipping path for the prototype

**Deferred (log, do not silently implement):**
- Auto-deploy on `git push` (Railway dashboard Source connect — user action only)
- `docs/env.md` per CLAUDE.md Railway Rules — prototype has zero env vars today; create the file when the first var appears
- Security headers (CSP, HSTS) — `serve` defaults are fine for a prototype; revisit for v1

## Why Railway (not Vercel / Cloudflare Pages)

[CLAUDE.md](../../CLAUDE.md) mandates Railway for all hydrax-app deployables. Using a different host for the prototype would fragment the operational story and require migrating the URL later. Railway's static-site cost (~$5/mo) is acceptable for a prototype that will be superseded by real services.

## Approach

Use `serve` (battle-tested static server, minimal dep footprint) with `$PORT` binding. Railway auto-detects the `start` script; no Dockerfile needed.

```json
// package.json (sketch)
{
  "name": "hydrax-prototype",
  "private": true,
  "scripts": {
    "start": "serve -s . -l ${PORT:-3000} --no-clipboard"
  },
  "dependencies": {
    "serve": "^14.2.4"
  }
}
```

```json
// railway.json (sketch)
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

## Files Touched

| File | New/Modified | Purpose |
|---|---|---|
| `package.json` | new | `start` script + `serve` dep |
| `railway.json` | new | Railway build + deploy config |
| `.gitignore` | new (if absent) | ignore `node_modules/` |
| `STATE.yaml` | modified | verification_log entry |
| `docs/plans/2026-04-24-railway-prototype-deploy.md` | new | this file |

Total: 5 files. Within the 15-file commit cap.

## Commits (one concern per commit)

1. `chore(deploy): add Railway static-site scaffolding` — `package.json`, `railway.json`, `.gitignore`, plan doc
2. `chore(state): record Railway prototype deploy build id` — `STATE.yaml` only, after successful deploy

## Verification

Per item, smallest proof that works:

1. **package.json valid JSON** — `node -e "require('./package.json')"` exits 0
2. **railway.json valid JSON** — `node -e "require('./railway.json')"` exits 0
3. **`serve` works locally** — `npm install && PORT=3001 npm start &`, then `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/` returns `200`, then `curl -s http://localhost:3001/ | grep -c "<title>"` returns `1`
4. **Railway deploy succeeds** — `railway up --detach` exits 0; `railway status` shows `SUCCESS`
5. **Public URL responds** — `curl -sI https://<deployed-url>/ | head -1` returns `HTTP/2 200`
6. **STATE.yaml verification_log** entry added with Railway build id + commit sha + deployed URL

## Risks

1. **Billing surprise.** Railway starter plan is $5/mo. Acceptable, but document in STATE.yaml so user knows a service is live.
2. **Auto-deploy confusion.** GitHub auto-deploy is NOT wired. Any future update needs `railway up --detach` until user connects the repo in the dashboard. Document this explicitly.
3. **`serve` dep footprint.** `serve@14` pulls ~50 transitive deps. Overkill for 3 static files, but it's the boring, proven path. Alternatives (raw `http-server`, `python -m http.server`) have equivalent or larger footprints.
4. **CLAUDE.md v1-layout drift.** Target layout expects `web/apps/*` with per-app Railway services. This prototype deploy uses repo root as the deployable — flag as temporary in `STATE.yaml` so nobody mistakes it for the v1 pattern.

## Stop Conditions

- Local smoke test fails → fix before Railway
- Railway project link fails → stop, ask user
- Railway deploy exits non-zero → capture logs with `railway logs`, stop, do not retry blindly
- Any step would touch a billing-affecting setting (upgrade plan, add addon) → stop, ask

## Success Criteria

Public URL serves [index.html](../../index.html) with working JS/CSS, all three panels (Orders, Venues, Activity) interactive, localStorage persistence working across reloads on the deployed URL.
