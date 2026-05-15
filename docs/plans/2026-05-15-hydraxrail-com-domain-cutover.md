# Plan — Wire `hydraxrail.com` onto the live portal stack

**Date:** 2026-05-15
**Author:** session-driven (user purchased the domain `hydraxrail.com`)
**Status:** in-progress — codebase changes ship now; DNS + Railway dashboard + BFF env update are operator-only steps documented below
**Scope:** [services/bff/src/cors.ts](../../services/bff/src/cors.ts) + [services/bff/src/cors.test.ts](../../services/bff/src/cors.test.ts) + user-visible link references across README + `docs/demo/` + `docs/demo/site/`. Plus a new operator runbook in this doc for the dashboard/DNS work I cannot perform from here.
**Driven by:** user purchase of `hydraxrail.com`. The portal stack already serves at `https://hydraxrail.up.railway.app/` (Railway service `hydrax-rail`); the BFF at `https://hydrax-bff-production.up.railway.app` has CORS locked to that single origin. Pointing the new domain at the existing service requires three coordinated changes (DNS, Railway custom-domain attach, BFF CORS allowlist) — without all three, the new origin loads HTML but every BFF call fails with a CORS error.

## Goal

A user typing `https://hydraxrail.com/` reaches the same React multi-portal shell currently reachable at `https://hydraxrail.up.railway.app/`, and every BFF-backed route (`/issuer/products`, `/investor/products`, `/{role}/health`, etc.) succeeds end-to-end. The Railway subdomain remains a working fallback during cutover so any cached external link does not break.

## Non-goals

- Sunsetting the `hydraxrail.up.railway.app` URL. That happens later, after at least one week of stable traffic on `hydraxrail.com`. The plan keeps both alive.
- Pointing `hydraxrail.com` at the canton-context site (`hydrax-layer.up.railway.app`) or the bare prototype. Those keep their existing Railway URLs; only the multi-portal landing gets the human-friendly domain.
- Adding a CDN, edge cache, or marketing redirect logic. Railway terminates TLS and serves the SPAs directly.
- Email — `hydraxrail.com` is web-only in v1. No MX records, no mailbox.

## Design decisions

### D1 — CORS: extend the loader to a comma-separated allowlist (not switch)

The BFF [cors.ts](../../services/bff/src/cors.ts) loader currently reads a single `BFF_CORS_ALLOWED_ORIGIN` and emits exactly that origin on every response. Three options were on the table:

| Option | Description | Trade-off |
|---|---|---|
| Switch | Set `BFF_CORS_ALLOWED_ORIGIN=https://hydraxrail.com` once DNS is live. | Simplest. Cutover window leaves the old `up.railway.app` origin broken; any tab/link cached on it loses BFF for the period. |
| **Extend (chosen)** | Accept comma-separated list `https://hydraxrail.com,https://hydraxrail.up.railway.app`. Match the inbound `Origin` header against the allowlist; echo only the matched value (or omit headers when no match). | Both URLs work concurrently. Origin-echo (not a wildcard) preserves PRD §13 least-privilege. Small change, fully testable. |
| Wildcard | `Access-Control-Allow-Origin: *`. | Violates least-privilege default. Rejected. |

Chosen: extend. Footprint is `cors.ts` + `cors.test.ts` only. Backward-compatible — a single-value env var (no commas) keeps the old single-origin behavior bit-for-bit.

### D2 — Apex vs www

Default: serve the apex `hydraxrail.com`. Add `www.hydraxrail.com` as a Railway alias that 301-redirects to the apex (Railway handles this in the dashboard). The deck and README link to the apex.

### D3 — TLS

Railway provisions Let's Encrypt automatically once the DNS validation passes. No manual cert handling. Confirm the cert in the verification step.

### D4 — Code references

User-visible link references (README, demo deck links, shot-list, demo site `Live App` buttons) flip to `https://hydraxrail.com`. Internal references inside plan docs and STATE history are left as-is (they document a moment in time and shouldn't be rewritten retroactively). Test fixtures in `cors.test.ts` get a small new test for the multi-origin path; the existing `https://hydraxrail.up.railway.app` fixtures stay because that URL must remain a working second origin for the cutover window.

## Phases

Each phase is one commit per CLAUDE.md commit-discipline rules.

### Phase 1 — BFF: extend CORS loader to multi-origin allowlist

**Files** (2):
- `services/bff/src/cors.ts` — add list-parsing to `loadCorsConfig`; change `CorsConfig.allowedOrigin: string | null` to `CorsConfig.allowedOrigins: readonly string[]`. Add `pickAllowedOrigin(req, config)` helper that matches the inbound `Origin` header against the allowlist. Update `applyCorsHeaders` and `handlePreflight` to use the helper and echo only the matched origin (or omit headers if no match).
- `services/bff/src/cors.test.ts` — add tests for: comma-separated parsing with whitespace trimming, empty entries discarded, single-value parsing unchanged, `pickAllowedOrigin` returns matched origin, `pickAllowedOrigin` returns null for unlisted origin, `applyCorsHeaders` echoes only the matched origin, `handlePreflight` echoes only the matched origin.

**Verification:**
- `cd services/bff && pnpm typecheck && pnpm test -- --run && pnpm build` — all green.
- `node --check services/bff/dist/cors.js` after build — sanity.

**Commit:** `feat(bff): support comma-separated CORS allowlist for hydraxrail.com cutover`

### Phase 2 — Code references: flip user-visible URLs to hydraxrail.com

**Files** (≤8):
- `README.md` — primary table entry for the multi-portal demo.
- `docs/demo/site/index.html` + `docs/demo/site/script.html` — `Live App` link href (3 occurrences in `index.html`, 1 in `script.html`).
- `docs/demo/script-pitch-5min.md` — visual cue + listed live URLs.
- `docs/demo/script-5min.md` — production landing reference.
- `docs/demo/shot-list.md` — executive demo URL.
- `docs/demo/edit-pack-pitch-video.md` — screen-recording source URL.

**Out of scope for this phase** (explicitly preserved for forensics):
- `docs/plans/2026-04-2*.md` — historical plan docs reference the URL as it was when the plan was written. Don't rewrite history.
- `STATE.yaml` history entries — same reason.
- `docs/demo/AUDIT-2026-04-27.md` — audit snapshot of a specific point in time.
- `services/bff/src/cors.test.ts` — keeps both fixtures because both origins remain valid post-cutover.

**Verification:**
- `git diff --stat` — only the listed files plus this plan.
- Visual smoke: open the changed `index.html` in a browser, hover the `Live App` link, confirm `hydraxrail.com` in the status bar.

**Commit:** `docs(demo): point user-visible portal links at hydraxrail.com`

### Phase 3 — Operator runbook (this doc, Operator Steps section)

**File:** this plan doc (already includes the Operator Steps section below).

**Commit:** folded into the Phase 1 or Phase 2 commit (no separate commit for plan-only changes).

### Phase 4 — STATE.yaml verification log

**File:** `STATE.yaml` — append a `verification_log` entry recording: `tsc + vitest + build all green on bff after CORS multi-origin change`; `wc -l` for cors.ts + cors.test.ts; `git diff --stat`; commit shas. Mark domain cutover as `pending operator` until they confirm DNS propagation + Railway env update + live curl probes.

**Commit:** `chore(state): record hydraxrail.com cutover plan and BFF CORS multi-origin change`

## Operator Steps (cannot be done from this session)

These require Railway dashboard access, registrar (where you bought `hydraxrail.com`) DNS access, and the ability to redeploy the BFF service. **None of these run automatically.**

### Step A — DNS at the registrar where you bought `hydraxrail.com`

Add the records Railway will give you in the next step. Generic shape:

| Host | Type | Value | Notes |
|---|---|---|---|
| `@` (apex) | `A` (or `ALIAS`/`ANAME` if registrar supports) | Railway-provided IP(s) | Some registrars don't support apex CNAME — Railway will give A records in that case. Cloudflare, DNSimple, Namecheap support `ALIAS`/`ANAME`. |
| `www` | `CNAME` | `hydraxrail.up.railway.app` (or whatever Railway shows) | Will 301-redirect to apex via Railway settings. |

TTL: 300s for the cutover window so changes propagate fast; raise to 3600s afterward.

### Step B — Railway dashboard: attach custom domains

1. Open the `hydrax-rail` Railway service.
2. Settings → Networking → Custom Domains → Add `hydraxrail.com`.
3. Railway shows the exact DNS records to add — copy them into Step A above.
4. Add `www.hydraxrail.com` as a second domain. Set it to redirect to the apex (Railway has a redirect toggle).
5. Wait for the DNS validation green check (usually <5 min once records propagate; up to 24h worst case).
6. Confirm Let's Encrypt cert provisioned (Railway shows a padlock badge once active).

### Step C — Railway dashboard: BFF CORS env

1. Open the `hydrax-bff-production` Railway service.
2. Variables → edit `BFF_CORS_ALLOWED_ORIGIN`.
3. Change the value from:
   ```
   https://hydraxrail.up.railway.app
   ```
   to:
   ```
   https://hydraxrail.com,https://hydraxrail.up.railway.app
   ```
4. Save. Railway will redeploy the BFF service automatically (this is a config-only redeploy, no rebuild).

### Step D — Verification curls (run from the editor box)

```bash
# Apex resolves and serves the portal landing
curl -sI https://hydraxrail.com/ | head -1
# expect: HTTP/2 200

# www redirects to apex
curl -sI https://www.hydraxrail.com/ | head -3
# expect: HTTP/2 301
# location: https://hydraxrail.com/

# Title check (don't trust 200 alone — see CLAUDE.md "Past Mistakes" 2026-04-26 Railway up wrong-cwd lesson)
curl -s https://hydraxrail.com/ | grep -i '<title>'
# expect: <title>HydraX Workflow | Institutional Onboarding & Issuance Workspace</title>

# CORS preflight from the new origin against the BFF
curl -sS -H "Origin: https://hydraxrail.com" -X OPTIONS \
  https://hydrax-bff-production.up.railway.app/v1/products -i | head -10
# expect: HTTP/2 204 + Access-Control-Allow-Origin: https://hydraxrail.com

# CORS preflight from the OLD origin still works (cutover safety)
curl -sS -H "Origin: https://hydraxrail.up.railway.app" -X OPTIONS \
  https://hydrax-bff-production.up.railway.app/v1/products -i | head -10
# expect: HTTP/2 204 + Access-Control-Allow-Origin: https://hydraxrail.up.railway.app

# CORS preflight from a foreign origin is rejected (least-privilege check)
curl -sS -H "Origin: https://attacker.example" -X OPTIONS \
  https://hydrax-bff-production.up.railway.app/v1/products -i | head -10
# expect: HTTP/2 204 with NO Access-Control-Allow-Origin header
```

### Step E — Browser verification (operator)

Open `https://hydraxrail.com/issuer/products` in a fresh tab. The product list must populate (real data from BFF), not show a "Could not load products" error. DevTools → Network → confirm the `/v1/products` call returns 200 and the response has `Access-Control-Allow-Origin: https://hydraxrail.com`.

### Step F — Update STATE.yaml after cutover

Append to `verification_log`:
```
YYYY-MM-DD — hydraxrail.com cutover: DNS propagated; Railway custom-domain validated; BFF CORS env updated to multi-origin allowlist; curl /issuer/products returns 200 with matching Access-Control-Allow-Origin; browser smoke green.
```

## Risks

- **DNS propagation lag.** Some recursive resolvers cache for 24h. The www redirect may show stale results. Mitigation: 300s TTL during cutover; verify from multiple resolvers (`dig +short hydraxrail.com @1.1.1.1`, `@8.8.8.8`).
- **Apex CNAME unsupported.** If the registrar (e.g. GoDaddy, IONOS) doesn't support `ALIAS`/`ANAME` on apex, Railway provides A records — use those. Don't try to fake it with a CNAME on apex; some clients will fail.
- **Order of operations.** If Phase 1 (multi-origin CORS) deploys AFTER the operator updates the env var, the BFF will reject the comma-separated value as a literal single origin and break ALL CORS. Order: ship Phase 1 + redeploy BFF first → verify single-origin still works → operator updates env var → verify multi-origin works.
- **Stale browser cache.** A user with a tab open on `hydraxrail.up.railway.app` after the env update will succeed (origin still allowed). A user with a tab open on a *foreign* origin will see a CORS rejection in DevTools — that's correct.
- **Email expectations.** `hydraxrail.com` will not have email in v1. If anyone tries `@hydraxrail.com` they'll bounce. Communicate this if relevant.

## Rollback

If the new origin breaks something subtle:
1. Revert `BFF_CORS_ALLOWED_ORIGIN` to the single value `https://hydraxrail.up.railway.app` in Railway → BFF redeploys. The portal at `hydraxrail.com` will start failing CORS within seconds; the portal at `hydraxrail.up.railway.app` keeps working.
2. Optionally remove the custom domain from the `hydrax-rail` Railway service — `hydraxrail.com` returns a Railway 404. The DNS records can stay; they just point at nothing.
3. The Phase 1 multi-origin CORS code is safe to leave in place — it handles a single-value env var identically to the prior single-origin loader.
