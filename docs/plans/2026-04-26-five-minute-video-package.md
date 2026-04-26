# Plan — Five-Minute Video Package for HydraX Operator Console

**Date:** 2026-04-26
**Owner:** Naim
**Skill:** `proceed-with-claude-recommendation` (orchestrator) + inline doc fallback per item
**Scope:** Three coordinated demo artefacts under `docs/demo/`. No code changes. No service edits. No new dependencies.

## Why now

User invoked `/proceed-with-claude-recommendation` on the recommendation:
> (a) draft the spoken script with timestamps, (b) produce a shot list against the actual prototype routes, (c) build a slide deck under `docs/demo/`

Existing surface in repo today (verified Phase 1):

- `docs/demo/canton-interview.html` — 9-slide deep deck (slide-0 … slide-8, 1922 LOC) currently modified in working tree. Detail-rich; not paced for a 5-minute video.
- `index.html` + `app.js` + `styles.css` — interactive prototype, 6 workspace panels: orders, positions, venues, risk, settings, activity. `cycleMode` and `cycleState` are the two screen-recordable controls that show motion.
- No script, no shot list, no slim presenter deck exist yet.

## Deliverables (in original order)

### (a) Spoken script — `docs/demo/script-5min.md`

- WILL build: narration broken into 6 segments summing to 5:00, each tagged with a slide reference (canton-interview.html `#slide-N`) AND a screen anchor (index.html element id or panel id), ~700–750 words total at 150 wpm.
- Will NOT build: teleprompter cue file, alternate-length cuts, multilingual variants, A/B copy options.
- Verification: `wc -w docs/demo/script-5min.md` ≈ 700–800; grep that timestamps `00:00`–`05:00` are present and monotonic; every `#slide-N` reference resolves to an id in `canton-interview.html`; every panel reference resolves to a `data-panel` value or element id in `index.html`.
- Fallback: inline (no specialist skill).

### (b) Shot list — `docs/demo/shot-list.md`

- WILL build: per-segment table (`time | screen | element | action | transition`) anchored to real ids/panels. Includes the two motion beats (`cycleMode` for routing posture, `cycleState` for loading→ready→empty). Includes one drill-down beat (orders detail-rail).
- Will NOT build: B-roll, music selection, post-production effects, storyboard sketches.
- Verification: grep — every element id or slide id referenced in shot list must exist in `index.html` or `canton-interview.html`. Zero misses.
- Fallback: inline.

### (c) Slim presenter deck — `docs/demo/video-deck.html`

- WILL build: a 5-slide self-contained HTML deck purpose-built for video. Large type, minimum copy per slide, presenter-pace. Each slide titled with its timestamp. Inline styles or relative link to `../../styles.css`. Self-contained — no JS required to advance (keyboard arrows fine).
- Will NOT build: replace, restyle, or edit `canton-interview.html`. No new asset generation. No `nano-banana` calls (the deck is type-driven, not imagery-driven, and visual-imagery work is out of scope of a 5-min script package per CLAUDE.md verification gates).
- Verification: file opens in a browser without console errors; `grep -c 'class="slide"\|slide-page' docs/demo/video-deck.html` returns 5 slide containers; `node --check` is N/A (HTML); manual visual check on `python3 -m http.server 8000`.
- Fallback: inline.

## Out of scope (deferred)

- Recording the actual video.
- Generating hero imagery for the deck (the deck is intentionally type-driven; hero imagery work would warrant a separate slice with `frontend-design` + `nano-banana` per CLAUDE.md).
- Editing `canton-interview.html` — orthogonal concern; a future slice can reconcile the deep deck and the slim deck if needed.
- B-roll, music, and post-production cues — out of scope of "script + shot list + deck".

## Tagging (per `proceed-with-claude-recommendation` Phase 1)

| # | Item | Tag | Routed to |
|---|---|---|---|
| 1 | Spoken script | `safe` | inline |
| 2 | Shot list | `safe` | inline |
| 3 | Slim presenter deck | `safe` | inline |

No `needs-approval` items. No destructive actions. No deploy. No commit (user has not asked to commit).

## Commit gate

If user later requests a commit, this lands as **one commit** under the single concern "video demo package":

```
docs(demo): add 5-minute video package — script, shot list, presenter deck

Plan: docs/plans/2026-04-26-five-minute-video-package.md
```

Three artefacts share one concern; this does not violate "one concern per commit". Plan doc + 3 deliverables = 4 files, well under the 15-file cap.

## Verification log (filled during execution)

- [ ] (a) `script-5min.md` — word count + timestamp grep + reference grep
- [ ] (b) `shot-list.md` — element-id reference grep against index.html and canton-interview.html
- [ ] (c) `video-deck.html` — slide count grep + browser open check
- [ ] STATE.yaml `verification_log` appended with one dated line summarising the slice
