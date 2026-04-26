# Canton Homework — Hosted Presentation Site

**Date:** 2026-04-26
**Owner:** Naim Katiman
**Status:** Plan — awaiting confirmation before execute

## Goal

Single polished URL the interviewer opens. They land on the **written companion** (the argument), navigate to the **deck** as appendix A, the **5-min video script** as appendix B, and click through to **the live HydraX app** and the **public GitHub repo**. Smooth, one-thread journey.

## Non-goals

- Build pipeline for markdown→HTML (hand-render once, ship)
- Custom domain (use Railway-provided subdomain for v1)
- Auth, analytics, comments, sharing widgets
- Re-styling the existing deck (reuse as-is, add only a top-nav strip)

## Approach (one-paragraph version)

Mirror the proven `web/portal-deploy/` pattern: tiny static folder served by `serve`, deployed to Railway as its own service. Three pages share a thin top nav + footer. The cover page is hand-rendered HTML from [docs/demo/canton-homework.md](docs/demo/canton-homework.md) using the same design tokens already in [docs/demo/canton-interview.html](docs/demo/canton-interview.html) (Inter + IBM Plex Mono, #CDC8C2 on #1a1a1a, lucide icons). The deck and script render as appendices behind the cover, not as siblings.

## Architecture

```
docs/demo/site/
  index.html         # COVER — the article, hero + 7 sections + appendix grid
  deck.html          # APPENDIX A — copy of canton-interview.html + top nav strip
  script.html        # APPENDIX B — rendered from script-5min.md
  styles.css         # shared design tokens (extracted from deck)
  assets/            # symlink or copy of docs/demo/assets/
  package.json       # serve@14, npm start
  railway.json       # NIXPACKS, healthcheck /
  serve.json         # rewrites for clean URLs
  .gitignore         # node_modules
```

Top nav (same on every page):

```
HydraX × Canton    Home · Deck · Script · Live App ↗ · GitHub ↗
```

Footer (same on every page):

```
Naim Katiman · April 2026 · Built for HydraX interview
```

## Files (new = N, modified = M)

| File | Status | Reason |
|---|---|---|
| docs/demo/site/index.html | N | Cover article, hero + 7 sections (thesis, conceptual, building, deep dives, deferrals, learning loop, appendix grid) |
| docs/demo/site/deck.html | N | Existing canton-interview.html copied + top-nav patch + path-fix for assets |
| docs/demo/site/script.html | N | Hand-rendered from script-5min.md, same design tokens |
| docs/demo/site/styles.css | N | Shared tokens, top-nav, footer, article body |
| docs/demo/site/package.json | N | Mirrors web/portal-deploy/package.json |
| docs/demo/site/railway.json | N | Mirrors web/portal-deploy/railway.json |
| docs/demo/site/serve.json | N | Clean URLs |
| docs/demo/site/.gitignore | N | node_modules |
| docs/demo/site/assets/ | N | Copy of docs/demo/assets/ (slide JPEGs) |
| docs/demo/canton-homework.md | M | Add live URL + public repo links at top |
| docs/demo/canton-interview.html | M | Add same top-nav strip so deck-only visitors can navigate back |
| docs/env.md | M | Document HOMEWORK_SITE_URL |
| STATE.yaml | M | verification_log entry |
| README.md (if exists at repo root) | M | Add a "Canton Homework" badge/link |

Total: 11 new + 4 modified = 15 files. **At the cap.** No room for drive-bys.

## Out-of-scope explicit deferrals

- No re-design of the deck. Slide content stays exactly as committed.
- No conversion of the deck to a new framework. It's static HTML and stays static HTML.
- No screenshot generation for slide thumbnails — use the existing JPEG assets in `docs/demo/assets/` (slide-0 through slide-8).
- No video recording. The script is a script; recording is a separate task.

## Sequence (one commit per layer)

1. **Plan doc landed** ← this file. (committed alone.)
2. **Site scaffold** — package.json, railway.json, serve.json, .gitignore, empty index/deck/script shells with top nav. Verify `npm install && npm start` locally hits 200 on / and /deck and /script. 1 commit.
3. **Cover page content** — hand-render canton-homework.md into index.html with proper hero + sections + appendix grid. 1 commit.
4. **Deck integration** — copy canton-interview.html → deck.html, patch nav, fix asset paths. 1 commit.
5. **Script page** — render script-5min.md into script.html. 1 commit.
6. **Cross-linking** — patch canton-homework.md and canton-interview.html with live URL + public repo URL after deploy. 1 commit.
7. **STATE.yaml + env.md updates.** 1 commit.

Each layer commit is small; together they hit the 15-file cap exactly once.

## Shared-state actions requiring explicit user confirmation

These are NOT executed without a separate green light:

1. **Repo visibility flip:** `gh repo edit naimkatiman/hydrax-app --visibility public --accept-visibility-change-consequences`
   - **Pre-flight required first:** scrub for secrets, real customer data, .env files, internal-only references, Slack/email/internal URLs, other project mentions in CLAUDE.md that shouldn't be public. Run a focused secret-scan (`git log --all -p | grep -iE 'API_KEY|SECRET|PASSWORD|TOKEN'` plus structured scan).
   - Also: confirm there's no proprietary content from sibling workspace projects (TradeClaw, market-data-hub, etc.) leaked into this repo.
2. **Railway service creation + deploy:** `railway up --detach` from `docs/demo/site/` after `railway link` to a new service named `hydrax-homework` under the existing project. Need user to confirm: (a) which Railway project to create the service under, (b) approval to deploy.
3. **Cross-link update with live URL:** only after deploy returns a URL.

## Verification gates (mandatory before each commit)

- HTML validity: `node --check` not applicable; instead, open each page in a local browser via `npm start` and confirm no console errors, all images load, all nav links resolve.
- ID/anchor audit: every `href="#x"` has a matching `id="x"` on the same page.
- Asset audit: every `<img src=` resolves to a file in `assets/`.
- Lighthouse pass (manual): no broken links, no missing meta tags, no console errors.
- `git diff --stat` confirms only the files for this layer changed.
- STATE.yaml `verification_log` entry per layer commit using the documented format.

## Risks

| Risk | Mitigation |
|---|---|
| Secrets leak when repo flips public | Pre-flight scrub + manual review of every committed file before flip |
| Sibling-project IP in CLAUDE.md / docs leaks | Audit CLAUDE.md, STATE.yaml, plans/, AGENTS.md before flip |
| Deck asset paths break when copied to /site/ | Use relative `assets/` and copy the assets folder; or update `<img src>` paths during deck.html copy |
| Railway service naming collision | Pre-check existing services in the project; use `hydrax-homework` only if free |
| Deploy succeeds but 404 on root | Confirm `serve.json` rewrites + `package.json` start command; healthcheck `/` in railway.json |
| Live URL never makes it back into cover doc | Step 6 in sequence is the explicit cross-linking commit |

## Open questions for confirmation

Before I execute steps 2–7, please answer:

1. **Repo public — yes/no?** If yes, I'll do the secret scrub first and surface anything risky for review. If no, the live URL still works but the GitHub link in the nav becomes a private-repo link (interviewer would need to be added as collaborator).
2. **Railway project to host under?** Existing `hydrax-app` Railway project, or a new project (e.g., `hydrax-interview`)?
3. **Service name OK?** Default proposal: `hydrax-homework`.
4. **What URL should the "Live App" nav link point to?** Is there an already-deployed HydraX app I should link to? If yes, paste the URL. If not, the nav link drops to "Live App" → /deck (deck IS the live demo for now) and we add the real URL when it exists.
5. **Should the existing `web/portal-deploy/` 5-portal demo also be linked from the homework cover** as "see the actual product I scaffolded"? Strong yes from me — it's the most concrete proof of "Building on Canton".

## Success criteria

- One URL the interviewer opens.
- They never need to clone the repo to read the answer.
- They can scroll the cover, click into the deck, click into the script, click out to the live app, click out to the public repo. No dead ends.
- Total interviewer time-to-first-substance < 10 seconds.
- Total deploy time from green-light to live URL < 30 minutes.
