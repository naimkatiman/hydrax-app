# Favicon Rollout Across Portals & Sites — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing HydraX favicon set across all 5 Vite portal apps, the operator prototype, the canton site, and the 4 demo decks so every browser tab shows the brand mark.

**Architecture:** Reuse the existing favicon set already living at `web/portal-deploy/` (favicon.ico, two PNG sizes, apple-touch-icon, two android-chrome PNGs, site.webmanifest). Copy that set into each Vite app's `public/` directory (Vite copies `public/` verbatim into the build root, honoring `VITE_BASE_PATH`). Drop a single `favicon.ico` next to each non-Vite HTML file (operator prototype, canton site, demo decks) and reference it via relative path. Rebuild the 5 portal bundles so the deployed `web/portal-deploy/{admin,distributor,investor,issuer,ops}/index.html` files pick up the link tags.

**Tech Stack:** Vite 5 `public/` asset convention; static HTML `<link rel="icon">`; pnpm workspace builds.

---

## File Structure

**Source-of-truth favicon set** (already exists, copied verbatim):
- `web/portal-deploy/favicon.ico` (4376 B)
- `web/portal-deploy/favicon-16x16.png` (483 B)
- `web/portal-deploy/favicon-32x32.png` (1420 B)
- `web/portal-deploy/apple-touch-icon.png` (22 KB)
- `web/portal-deploy/android-chrome-192x192.png` (25 KB)
- `web/portal-deploy/android-chrome-512x512.png` (167 KB)
- `web/portal-deploy/site.webmanifest` (380 B)

**Copies to make** — each Vite app needs its own `public/` dir with the full set so combined-deploy under `/admin/`, `/issuer/`, etc. resolves correctly:
- Create: `web/apps/admin/public/{favicon.ico,favicon-16x16.png,favicon-32x32.png,apple-touch-icon.png,android-chrome-192x192.png,android-chrome-512x512.png,site.webmanifest}`
- Create: `web/apps/distributor-portal/public/<same 7 files>`
- Create: `web/apps/investor-portal/public/<same 7 files>`
- Create: `web/apps/issuer-portal/public/<same 7 files>`
- Create: `web/apps/ops-console/public/<same 7 files>`

**Single `favicon.ico` next to each non-Vite HTML** (smaller scope — only the .ico, since these are reference/demo surfaces, not PWA-installable apps):
- Create: `favicon.ico` at repo root (for operator prototype `index.html`)
- Create: `docs/demo/favicon.ico` (for 4 deck HTMLs)
- Create: `docs/demo/site/favicon.ico` (for canton site)

**HTML files to edit:**
- Modify: `web/apps/admin/index.html` — add 5 link tags inside `<head>`
- Modify: `web/apps/distributor-portal/index.html` — same
- Modify: `web/apps/investor-portal/index.html` — same
- Modify: `web/apps/issuer-portal/index.html` — same
- Modify: `web/apps/ops-console/index.html` — same
- Modify: `index.html` (root operator prototype) — add 1 link tag inside `<head>`
- Modify: `docs/demo/site/index.html` — add 1 link tag inside `<head>`
- Modify: `docs/demo/canton-interview.html` — add 1 link tag inside `<head>`
- Modify: `docs/demo/canton-homework-deck.html` — add 1 link tag inside `<head>`
- Modify: `docs/demo/canton-interview-stills.html` — add 1 link tag inside `<head>`
- Modify: `docs/demo/video-deck.html` — add 1 link tag inside `<head>`

**Build outputs (regenerated, not hand-edited):**
- `web/portal-deploy/{admin,distributor,investor,issuer,ops}/index.html` and asset bundles — produced by rebuilding the 5 Vite apps.

**STATE.yaml** — append a verification log entry.

---

## Vite app `index.html` patch (used in Tasks 1-5)

The 5 link tags inserted just before `</head>` in each `web/apps/*/index.html`:

```html
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
    <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
    <link rel="manifest" href="site.webmanifest" />
```

Relative `href` (no leading `/`) is mandatory: with `VITE_BASE_PATH=/admin/`, the browser resolves `favicon.ico` against `/admin/`, hitting `/admin/favicon.ico` which Vite serves from each app's `public/`. An absolute `/favicon.ico` would not exist under `/admin/`.

---

## Task 1: Wire favicons into web/apps/admin

**Files:**
- Create: `web/apps/admin/public/favicon.ico` and 6 sibling files
- Modify: `web/apps/admin/index.html`

- [ ] **Step 1: Create the public/ dir and copy the favicon set**

```bash
mkdir -p web/apps/admin/public
cp web/portal-deploy/favicon.ico \
   web/portal-deploy/favicon-16x16.png \
   web/portal-deploy/favicon-32x32.png \
   web/portal-deploy/apple-touch-icon.png \
   web/portal-deploy/android-chrome-192x192.png \
   web/portal-deploy/android-chrome-512x512.png \
   web/portal-deploy/site.webmanifest \
   web/apps/admin/public/
```

- [ ] **Step 2: Verify copy**

Run: `ls web/apps/admin/public/`
Expected: 7 files listed.

- [ ] **Step 3: Insert favicon link tags**

Edit `web/apps/admin/index.html`. Locate the line `</head>` (line 7). Insert the 5 link tags from the patch above immediately before it, indented to match the existing 4-space indent inside `<head>`.

- [ ] **Step 4: Verify the edit**

Run: `grep -c "favicon\|apple-touch-icon\|manifest" web/apps/admin/index.html`
Expected: `5`

## Task 2: Wire favicons into web/apps/distributor-portal

**Files:**
- Create: `web/apps/distributor-portal/public/<7 files>`
- Modify: `web/apps/distributor-portal/index.html`

- [ ] **Step 1: Create + copy**

```bash
mkdir -p web/apps/distributor-portal/public
cp web/portal-deploy/favicon.ico \
   web/portal-deploy/favicon-16x16.png \
   web/portal-deploy/favicon-32x32.png \
   web/portal-deploy/apple-touch-icon.png \
   web/portal-deploy/android-chrome-192x192.png \
   web/portal-deploy/android-chrome-512x512.png \
   web/portal-deploy/site.webmanifest \
   web/apps/distributor-portal/public/
```

- [ ] **Step 2: Edit `web/apps/distributor-portal/index.html`** — insert the 5 link tags before `</head>`.

- [ ] **Step 3: Verify**

Run: `ls web/apps/distributor-portal/public/ | wc -l && grep -c "favicon\|apple-touch-icon\|manifest" web/apps/distributor-portal/index.html`
Expected: `7` then `5`.

## Task 3: Wire favicons into web/apps/investor-portal

**Files:**
- Create: `web/apps/investor-portal/public/<7 files>`
- Modify: `web/apps/investor-portal/index.html`

Same pattern as Task 2. After: `ls web/apps/investor-portal/public/ | wc -l && grep -c "favicon\|apple-touch-icon\|manifest" web/apps/investor-portal/index.html` → `7` then `5`.

## Task 4: Wire favicons into web/apps/issuer-portal

Same pattern as Task 2 → `web/apps/issuer-portal/public/`. Verify with the same grep.

## Task 5: Wire favicons into web/apps/ops-console

Same pattern as Task 2 → `web/apps/ops-console/public/`. Verify with the same grep.

## Task 6: Wire favicon into the operator prototype (repo root index.html)

**Files:**
- Create: `favicon.ico` at repo root
- Modify: `index.html` (root)

- [ ] **Step 1: Copy favicon to repo root**

```bash
cp web/portal-deploy/favicon.ico ./favicon.ico
```

- [ ] **Step 2: Edit `index.html`** — insert one link tag before `</head>` (currently at line 12), indented 4 spaces:

```html
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
```

- [ ] **Step 3: Verify**

Run: `grep -c "favicon" index.html && [ -f favicon.ico ] && echo OK`
Expected: `1` then `OK`.

## Task 7: Wire favicon into the canton site

**Files:**
- Create: `docs/demo/site/favicon.ico`
- Modify: `docs/demo/site/index.html`

- [ ] **Step 1: Copy**

```bash
cp web/portal-deploy/favicon.ico docs/demo/site/favicon.ico
```

- [ ] **Step 2: Edit `docs/demo/site/index.html`** — insert before `</head>` (line 16), indented 2 spaces (matches existing head indent):

```html
  <link rel="icon" type="image/x-icon" href="favicon.ico" />
```

- [ ] **Step 3: Verify**

Run: `grep -c "favicon" docs/demo/site/index.html && [ -f docs/demo/site/favicon.ico ] && echo OK`
Expected: `1` then `OK`.

## Task 8: Wire favicon into 4 demo decks

**Files:**
- Create: `docs/demo/favicon.ico`
- Modify: `docs/demo/canton-interview.html`
- Modify: `docs/demo/canton-homework-deck.html`
- Modify: `docs/demo/canton-interview-stills.html`
- Modify: `docs/demo/video-deck.html`

- [ ] **Step 1: Copy**

```bash
cp web/portal-deploy/favicon.ico docs/demo/favicon.ico
```

- [ ] **Step 2: Edit each deck HTML** — insert one link tag inside `<head>`, after the `<title>` line:

```html
  <link rel="icon" type="image/x-icon" href="favicon.ico" />
```

For each deck, match the existing indent of the `<title>` line.

- [ ] **Step 3: Verify**

Run:
```bash
for f in docs/demo/canton-interview.html docs/demo/canton-homework-deck.html docs/demo/canton-interview-stills.html docs/demo/video-deck.html; do
  printf '%s: ' "$f"; grep -c 'favicon' "$f"
done
[ -f docs/demo/favicon.ico ] && echo OK
```
Expected: each line ends with `1`, then `OK`.

## Task 9: Rebuild the 5 portal bundles

**Files:**
- Regenerate: `web/portal-deploy/{admin,distributor,investor,issuer,ops}/index.html` and `assets/`

- [ ] **Step 1: Build each app with the appropriate VITE_BASE_PATH**

```bash
VITE_BASE_PATH=/admin/        pnpm -C web/apps/admin              run build
VITE_BASE_PATH=/distributor/  pnpm -C web/apps/distributor-portal run build
VITE_BASE_PATH=/investor/     pnpm -C web/apps/investor-portal    run build
VITE_BASE_PATH=/issuer/       pnpm -C web/apps/issuer-portal      run build
VITE_BASE_PATH=/ops/          pnpm -C web/apps/ops-console        run build
```

- [ ] **Step 2: Copy each app's `dist/` into `web/portal-deploy/<slug>/`**

For each app, after build:
```bash
rm -rf web/portal-deploy/admin && cp -r web/apps/admin/dist web/portal-deploy/admin
rm -rf web/portal-deploy/distributor && cp -r web/apps/distributor-portal/dist web/portal-deploy/distributor
rm -rf web/portal-deploy/investor && cp -r web/apps/investor-portal/dist web/portal-deploy/investor
rm -rf web/portal-deploy/issuer && cp -r web/apps/issuer-portal/dist web/portal-deploy/issuer
rm -rf web/portal-deploy/ops && cp -r web/apps/ops-console/dist web/portal-deploy/ops
```

- [ ] **Step 3: Verify each portal's deployed index.html has favicon links**

Run:
```bash
for p in admin distributor investor issuer ops; do
  printf '%s: ' "$p"; grep -c 'favicon\|apple-touch-icon\|manifest' "web/portal-deploy/$p/index.html"
done
```
Expected: each prints `5`.

- [ ] **Step 4: Verify each portal's favicon assets are present**

Run:
```bash
for p in admin distributor investor issuer ops; do
  printf '%s: ' "$p"; ls web/portal-deploy/$p/favicon.ico web/portal-deploy/$p/site.webmanifest 2>/dev/null | wc -l
done
```
Expected: each prints `2`.

## Task 10: Workspace verification gates

- [ ] **Step 1: Typecheck the web workspace**

Run: `pnpm -r --if-present typecheck`
Expected: no failures (no TS source touched).

- [ ] **Step 2: Run web tests**

Run: `pnpm -r --if-present test -- --run`
Expected: all green (no test logic touched).

- [ ] **Step 3: HTML smoke check**

Run:
```bash
for f in web/apps/*/index.html; do
  printf '%s: ' "$f"; grep -c 'favicon\|apple-touch-icon\|manifest' "$f"
done
```
Expected: each prints `5`.

## Task 11: Update STATE.yaml and commit

- [ ] **Step 1: Append `verification_log` entry to STATE.yaml**

Add a line of the form:
```yaml
- 2026-04-27 — favicon rollout: 5 vite apps + 4 demo decks + canton site + operator prototype now wire the existing HydraX favicon; 5 portal bundles rebuilt; pnpm -r typecheck/test/build all green
```

- [ ] **Step 2: Stage exactly the changed paths**

```bash
git add \
  web/apps/admin/public web/apps/admin/index.html \
  web/apps/distributor-portal/public web/apps/distributor-portal/index.html \
  web/apps/investor-portal/public web/apps/investor-portal/index.html \
  web/apps/issuer-portal/public web/apps/issuer-portal/index.html \
  web/apps/ops-console/public web/apps/ops-console/index.html \
  web/portal-deploy/admin web/portal-deploy/distributor web/portal-deploy/investor web/portal-deploy/issuer web/portal-deploy/ops \
  index.html ./favicon.ico \
  docs/demo/favicon.ico docs/demo/canton-interview.html docs/demo/canton-homework-deck.html docs/demo/canton-interview-stills.html docs/demo/video-deck.html \
  docs/demo/site/favicon.ico docs/demo/site/index.html \
  docs/plans/2026-04-27-favicon-rollout.md \
  STATE.yaml
```

- [ ] **Step 3: Verify staging**

Run: `git diff --cached --name-only`
Expected: only the paths above; reconcile any unrelated paths via `git restore --staged`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(brand): wire HydraX favicon across all portals, decks, and sites"
```

---

## Out of scope / not in this plan

- Designing a new favicon. The existing `web/portal-deploy/favicon.*` set is the source of truth.
- PWA manifest icons for non-Vite surfaces (decks, demo site, operator prototype) — these only ship the `.ico` link, not the full manifest set. They are not installable apps.
- Theme-color `<meta name="theme-color">` tags — separate brand-polish concern.
- Railway deploy. Plan ends at commit; deploy is a follow-up at the user's discretion.
