# HydraX — 5-Minute Video Shot List

**Pairs with:** [script-5min.md](script-5min.md)
**Surfaces referenced:**

- Slim presenter deck — [video-deck.html](video-deck.html) — 5 slides, video-paced
- Deep deck — [canton-interview.html](canton-interview.html) — 9 slides, full detail
- Prototype — [../../index.html](../../index.html) — operator console, served via `python3 -m http.server 8000`

**Recording setup:**

- 1920 × 1080, 30 fps minimum, 60 fps preferred for smooth panel transitions
- Browser zoom 100% (Cmd/Ctrl + 0)
- Disable browser cache for the prototype tab so localStorage state is clean
- Single audio track, voice-over recorded separately and laid in post — do not capture browser audio
- Cursor magnification on (system accessibility) — operator-pointer is part of the read

**Pre-flight (before pressing record):**

1. Open `video-deck.html` in tab 1 (slides).
2. Open `index.html` in tab 2 (prototype). Click `#openDashboardHero` once to scroll into the workspace, then scroll back to top so the hero is the first frame.
3. Clear localStorage: `localStorage.removeItem('hydrax.workspace.v1'); localStorage.removeItem('hydrax.activity.v1');` then reload. This guarantees a clean activity log for Segment 3e.
4. Confirm `data-panel="orders"` is the active panel on first frame (it is the default per `index.html:200`).

---

## Shot table

| # | Time | Tab | Screen / anchor | Element id or selector | Action | Transition |
|---|------|-----|-----------------|------------------------|--------|------------|
| 1 | 00:00–00:15 | Slides | `video-deck.html` slide 1 | `#vd-slide-1` | Hold static while VO opens | Cut |
| 2 | 00:15–00:30 | Slides | `video-deck.html` slide 1 — emphasise "control room" line | `#vd-slide-1` | Subtle zoom 100→103% | Cross-fade |
| 3 | 00:30–01:00 | Slides | `video-deck.html` slide 2 — wedge | `#vd-slide-2` | Hold | Cut |
| 4 | 01:00–01:15 | Slides | `video-deck.html` slide 2 — bullet emphasis | `#vd-slide-2` | Pan to bullets | Cut to prototype |
| 5 | 01:15–01:25 | Prototype | Hero `#overview` | `index.html:51` `<section class="hero">` | Static frame on landing | Cut |
| 6 | 01:25–01:35 | Prototype | Click "Open System View" | `#openDashboardHero` (`index.html:61`) | Click; smooth-scroll to `#workspace` | None — use the page scroll |
| 7 | 01:35–01:45 | Prototype | Workspace topbar + breadcrumb | `#breadcrumbTrail`, `#panelTitle` | Hold; cursor on the lane sidebar | Cut |
| 8 | 01:45–01:55 | Prototype | Sort orders table by exposure | `th[data-sort-key="exposure"]` (in `#ordersTableBody` parent) | Click header, rows reorder | None |
| 9 | 01:55–02:05 | Prototype | Click first order row | `#ordersTableBody tr:first-child` → opens `#orderDetail` | Detail rail expands | Crossfade if compositing |
| 10 | 02:05–02:20 | Prototype | Cycle routing mode | `#cycleMode` (`index.html:101`) | Click 3× — Balanced Sweep → Latency Shield → Inventory Protect; watch `#routingMode` and `#driftValue` update | None |
| 11 | 02:20–02:35 | Prototype | Cycle workspace state | `#cycleState` (`index.html:268`) | Click 2× — loading → ready → empty; watch `[data-state]` cards swap with no layout shift | None |
| 12 | 02:35–02:45 | Prototype | Use cross-link from order detail to venues | venue chip inside `#orderDetail` | Click venue name; lands on `data-panel="venues"`, row highlighted | None — single page transition |
| 13 | 02:45–03:05 | Prototype | Switch to risk panel | nav button `[data-panel="risk"]` (`index.html:212`) | Click; panel `#panel-risk` becomes visible; cursor lands on first severity row | None |
| 14 | 03:05–03:20 | Prototype | Switch to activity panel | nav button `[data-panel="activity"]` (`index.html:220`); body `#panel-activity` | Click; rows already populated from Segment 3 actions | None |
| 15 | 03:20–03:30 | Prototype | Reload to prove persistence | browser refresh (F5) | Activity rows persist; `#activityCountPill` non-zero | Quick cut to slides |
| 16 | 03:30–03:55 | Slides | `video-deck.html` slide 3 — architecture | `#vd-slide-3` | Hold; subtle highlight on each cluster as VO names them | Cut |
| 17 | 03:55–04:15 | Slides | `video-deck.html` slide 3 — portals row | `#vd-slide-3` | Cursor traces the 5-portal row | Cut |
| 18 | 04:15–04:45 | Slides | `video-deck.html` slide 4 — open Qs | `#vd-slide-4` | Hold; bullet-by-bullet tick-through with VO | Cut |
| 19 | 04:45–05:00 | Slides | `video-deck.html` slide 5 — ask + close | `#vd-slide-5` | Hold; final card | Fade to black |

---

## Cross-anchor key (every reference, verified)

### `index.html` element ids used above

- `#overview` — hero section (`index.html:51`)
- `#workspace` — workspace section (`index.html:180`)
- `#openDashboardHero` — primary CTA (`index.html:61`)
- `#breadcrumbTrail`, `#panelTitle` — workspace toolbar (`index.html:254`, `index.html:259`)
- `#cycleMode` — system view button (`index.html:101`)
- `#cycleState` — workspace toolbar button (`index.html:268`)
- `#orderDetail` — orders detail rail (`index.html:342`)
- `#ordersTableBody` — orders table body (`index.html:335`)
- `#activityCountPill` — activity counter (`index.html:556`)

### `index.html` panel selectors used above

- `[data-panel="orders"]` — default active (`index.html:200`)
- `[data-panel="venues"]` — (`index.html:208`)
- `[data-panel="risk"]` — (`index.html:212`)
- `[data-panel="activity"]` — (`index.html:220`)
- `[data-panel-body]` — panel container attribute (used by `app.js:324`)
- `th.sortable` — sortable header class (used by `app.js:1928`)

### Slide ids in `video-deck.html` (built in Item 3)

- `#vd-slide-1` — Positioning
- `#vd-slide-2` — Wedge
- `#vd-slide-3` — Architecture
- `#vd-slide-4` — Open questions
- `#vd-slide-5` — Ask / close

### Slide ids in `canton-interview.html` (deep deck, fallback only)

- `#slide-0` … `#slide-8` — verified to exist via `grep -oE 'id="slide-[0-9]+"' docs/demo/canton-interview.html`.

---

## Recording gotchas

- **localStorage versioning** — keys are `hydrax.workspace.v1` (`app.js:207`) and `hydrax.activity.v1` (`app.js:376`). Clearing them gives a clean state. Do NOT delete other keys; you may stomp on a parallel session's state. (Note: the project CLAUDE.md cites these as `app.js:248` and `app.js:490`; those line numbers are stale — the keys have moved as the file grew.)
- **First frame must be the hero** — if you accidentally land mid-workspace because the previous session scrolled, scroll back to top before pressing record.
- **`#cycleState` auto-rotates** through loading → ready → empty. Two clicks = full demo. Three clicks lands you back on loading; cut before that if the rhythm matters.
- **Sort click visual feedback** — `th.sortable` adds an `is-sorted` class; if the cursor blocks the arrow indicator, offset the cursor before clicking.
- **Cross-link behaviour** — clicking a venue chip inside `#orderDetail` triggers a panel switch + row highlight via JS. There is no URL change; you will not see the address bar update.

---

## Out of scope for this shot list

- B-roll, music, voice-over takes, post-production effects.
- Recording the actual video.
- Recording on mobile or tablet form factors — desktop only.
