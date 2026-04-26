# Deep-Dive Topics — Deck Slides + Portal Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen Canton-interview demo coverage on four topics (tokenization stance, DeFi composability under privacy, infrastructure/ops, data management/sync across domains) by appending one slide per topic to the homework deck AND building a corresponding portal surface for each. No existing slides are deleted or renumbered.

**Architecture:** Append four slides (`slide-14` through `slide-17`) to `docs/demo/canton-homework-deck.html` after the current `slide-13` (Trade-offs/Roadmap closer). Each new slide ships with a hero JPEG generated via nano-banana and a provenance entry in `docs/demo/assets/assets-meta.json`. Portal-side: extend `issuer-portal` ProductDetailRoute (token model section), add `ComposabilityRoute` and `ProjectionsRoute` to `admin`, add `HealthRoute` to `ops-console` (mirroring investor-portal pattern). All portals use the established AppShell + RTK + react-router pattern with `@hydrax/ui` primitives.

**Tech Stack:** HTML5 (deck), Vite 5 + React 18 + TypeScript + RTK Query (portals), Vitest + @testing-library/react (tests), `@hydrax/ui` primitives (Card, Button, Heading, Stack, Text, Icon, NavItem, Skeleton, EmptyState), `lucide-react` icons only (no emoji), `nano-banana` (asset generation, hero JPEGs in `docs/demo/assets/`).

---

## File Structure

**New files:**
- `docs/demo/assets/slide-14-tokenization.jpg` (nano-banana)
- `docs/demo/assets/slide-15-composability.jpg` (nano-banana)
- `docs/demo/assets/slide-16-infra-ops.jpg` (nano-banana)
- `docs/demo/assets/slide-17-data-sync.jpg` (nano-banana)
- `web/apps/issuer-portal/src/components/TokenModelCard.tsx`
- `web/apps/issuer-portal/src/components/TokenModelCard.test.tsx`
- `web/apps/admin/src/routes/ComposabilityRoute.tsx`
- `web/apps/admin/src/routes/ComposabilityRoute.test.tsx`
- `web/apps/admin/src/routes/ProjectionsRoute.tsx`
- `web/apps/admin/src/routes/ProjectionsRoute.test.tsx`
- `web/apps/ops-console/src/routes/HealthRoute.tsx`
- `web/apps/ops-console/src/routes/HealthRoute.test.tsx`

**Modified files:**
- `docs/demo/canton-homework-deck.html` (append 4 slides + update slide-count)
- `docs/demo/assets/assets-meta.json` (4 new entries)
- `web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx` (insert TokenModelCard)
- `web/apps/admin/src/App.tsx` (register 2 new routes)
- `web/apps/admin/src/components/AdminSidebar.tsx` (add 2 nav items)
- `web/apps/ops-console/src/App.tsx` (register HealthRoute)
- `web/apps/ops-console/src/components/OpsSidebar.tsx` (add Health nav item)

**Estimated:** 12-14 new files, 6 modified files, ~600-900 LOC. Multi-session scope.

---

## Sequencing Strategy

Each topic is one **phase**. Each phase ships in this commit order: (1) deck slide HTML, (2) hero asset + provenance, (3) portal surface + test, (4) wiring (App.tsx + Sidebar). Project CLAUDE.md hard cap: 15 files per commit; per-phase splits keep us well under.

**Verification per phase:**
- Deck: `node --check` not applicable (HTML); use `wc -l docs/demo/canton-homework-deck.html` (record line growth) + open in browser, confirm slide visible at correct position, page-counter shows new total.
- Portal: `pnpm --filter @hydrax/<app> typecheck` + `pnpm --filter @hydrax/<app> test -- --run` + `pnpm --filter @hydrax/<app> build`.
- Workspace gate: `pnpm -r --if-present typecheck` + `pnpm -r --if-present test -- --run` + `pnpm -r --if-present build` before final commit of phase.

---

## Phase 0: Pre-flight

### Task 0.1: Confirm baseline state

**Files:** none modified

- [ ] **Step 1: Confirm working tree clean for the files this plan touches**

```bash
git status --short docs/demo/canton-homework-deck.html docs/demo/assets/assets-meta.json web/apps/
```

Expected: only `STATE.yaml` and possibly `CLAUDE.md` modified (per session-start status). No conflict on plan-target files.

- [ ] **Step 2: Snapshot current deck size and slide count**

```bash
wc -l docs/demo/canton-homework-deck.html
grep -c 'slide-container slide-page' docs/demo/canton-homework-deck.html
```

Expected: ~2227 lines, 14 slide containers.

- [ ] **Step 3: Confirm portal workspace builds clean**

```bash
pnpm -r --if-present typecheck
```

Expected: PASS across all workspaces. If anything fails, stop — fix baseline first.

---

## Phase 1: Topic 1 — Tokenization Stance

**Slide narrative:** Token = Daml template + stakeholder set. Lifecycle = controlled `choice` transitions. HydraX rails mocked behind stable interface (Q1 deferred-not-resolved). Q3 product-type still open; current default proposal: short-duration credit. The portal surface shows a concrete instance: an issuer's product detail page surfaces the underlying token model.

### Task 1.1: Append slide-14 to canton-homework-deck.html

**Files:**
- Modify: `docs/demo/canton-homework-deck.html` — insert before line 2201 (the `</div>` closing the slides container, just after slide-13)
- Modify: `docs/demo/canton-homework-deck.html:364` — change slide counter from `/ 14` to `/ 18`

- [ ] **Step 1: Update the static slide-count text**

Edit line 364:

```html
<!-- BEFORE -->
Slide <b id="slide-num">1</b> <small>/ 14</small>
<!-- AFTER -->
Slide <b id="slide-num">1</b> <small>/ 18</small>
```

- [ ] **Step 2: Append slide-14 HTML before the closing slides container `</div>`**

Insert this block immediately after the closing `</div>` of slide-13 (line 2199) and before line 2201's `</div>`:

```html
<!-- ============================================================ -->
<!-- SLIDE 14 — DEEP DIVE — TOKENIZATION STANCE                   -->
<!-- ============================================================ -->
<div class="slide-container slide-page" id="slide-14">
  <div data-object-type="textbox" class="page-num"
    style="position: absolute; top: 40px; right: 60px; width: 110px; height: 100px; text-align: right; z-index: 10;">
    <div
      style="font-family: 'Inter', 'SF Pro Text', system-ui, -apple-system, sans-serif; font-size: 80px; font-weight: 900; color: rgba(205,200,194,0.08); line-height: 1;">
      14</div>
  </div>
  <div data-object-type="textbox" class="slide-title"
    style="position: absolute; left: 60px; top: 40px; width: 1160px; z-index: 10;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <div style="width: 8px; height: 8px; background: var(--hydrax-color-accent); border-radius: 50%;"></div>
      <span
        style="font-family: 'IBM Plex Mono', 'SFMono-Regular', 'Consolas', monospace; font-size: 14px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--hydrax-color-accent);">deep dive &middot; tokenization</span>
    </div>
    <h1
      style="font-family: 'Inter', 'SF Pro Text', system-ui, -apple-system, sans-serif; font-size: 50px; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; margin: 0 0 10px 0; color: var(--hydrax-color-text-strong);">
      Tokens are <span style="color: var(--hydrax-color-accent); font-weight: 700;">Daml templates</span>, not new primitives
    </h1>
    <p style="font-size: 17px; line-height: 1.4; color: var(--hydrax-color-text-muted); margin: 0; max-width: 1080px;">
      The interesting design choice isn't the asset model. It's who is on the contract, what choices they can make, and what off-ledger systems own which fields.
    </p>
  </div>
  <div data-object-type="graphic"
    style="position: absolute; left: 60px; top: 210px; width: 1160px; height: 320px; z-index: 10;">
    <div style="display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 24px; height: 100%;">
      <!-- LEFT: Token-as-template anatomy -->
      <div
        style="background: rgba(36,36,36,0.78); border: 1px solid var(--hydrax-color-accent-soft); border-radius: 14px; padding: 22px 26px; display: flex; flex-direction: column;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
          <div
            style="width: 38px; height: 38px; background: rgba(205,200,194,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div>
            <div style="font-size: 16px; font-weight: 700; color: var(--hydrax-color-text-strong);">Token = Daml template instance</div>
            <div style="font-size: 12px; color: var(--hydrax-color-accent);">stakeholders, fields, choices</div>
          </div>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Stakeholder set</strong> declared at template definition &mdash; privacy boundary, not a network policy</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Lifecycle</strong> as enumerated `choice` transitions, not free-form mutations</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Issuer holds the original</strong>; distributors and investors are explicitly added at issuance</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Off-ledger fields</strong> (KYC docs, marketing, fee schedules) live in Postgres &mdash; ledger keeps only the truth that needs multi-party signing</li>
        </ul>
      </div>
      <!-- RIGHT: Stance + deferrals -->
      <div
        style="background: rgba(36,36,36,0.78); border: 1px solid rgba(205,200,194,0.25); border-radius: 14px; padding: 22px 26px; display: flex; flex-direction: column; position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, var(--hydrax-color-accent), #EEEAE6);"></div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
          <div
            style="width: 38px; height: 38px; background: rgba(205,200,194,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div>
            <div style="font-size: 16px; font-weight: 700; color: var(--hydrax-color-text-strong);">v1 stance &mdash; honest deferrals</div>
            <div style="font-size: 12px; color: var(--hydrax-color-accent);">what's intentionally not solved</div>
          </div>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>HydraX rails mocked</strong> behind <code style="font-family: 'IBM Plex Mono', monospace; color: var(--hydrax-color-accent);">hydrax-adapter</code> &mdash; workflow stack unblocked while engagement settles (PRD &sect;14 Q1)</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Product type open</strong> (PRD &sect;14 Q3); current proposal: short-duration credit, 30&ndash;180d institutional tenor</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>No native tokenomics layer</strong> &mdash; supply, distribution, fees are operational fields, not protocol-level economics</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Upgrade story</strong>: Daml package versioning + interfaces &mdash; isolated in rails-plane adapters</li>
        </ul>
      </div>
    </div>
  </div>
  <div data-object-type="textbox"
    style="position: absolute; left: 60px; top: 545px; width: 1160px; height: 110px; z-index: 10;">
    <div
      style="background: rgba(205,200,194,0.04); border: 1px solid var(--hydrax-color-accent-soft); border-radius: 12px; padding: 16px 22px;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        <span class="mono" style="font-size: 11px; color: var(--hydrax-color-accent); letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600;">where it lands in the portal</span>
      </div>
      <p style="font-size: 13px; color: var(--hydrax-color-text-strong); margin: 0; line-height: 1.5;">
        Issuer portal &rarr; Product detail &rarr; <strong style="color: var(--hydrax-color-accent);">Token Model</strong> section. Renders the template name, the stakeholder set, the lifecycle states allowed by the contract, and the off-ledger fields the workflow service owns. Demo data today; same surface when rails go live.
      </p>
    </div>
  </div>
  <div data-object-type="textbox" class="slide-info"
    style="position: absolute; top: 670px; left: 60px; width: 1160px; height: 30px; display: flex; justify-content: space-between; align-items: center; z-index: 5;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      <span style="font-size: 13px; color: var(--hydrax-color-text-muted);">Composability moves up the stack: orchestration plane, not the asset itself.</span>
    </div>
    <div
      style="font-family: 'IBM Plex Mono', 'SFMono-Regular', 'Consolas', monospace; font-size: 13px; color: var(--hydrax-color-text-muted);">
      docs/canton-homework.md &middot; PRD &sect;14
    </div>
  </div>
</div>
```

- [ ] **Step 3: Verify deck renders**

```bash
wc -l docs/demo/canton-homework-deck.html
grep -c 'slide-container slide-page' docs/demo/canton-homework-deck.html
python3 -m http.server 8000 &
SERVER_PID=$!
sleep 1
curl -s http://localhost:8000/docs/demo/canton-homework-deck.html | grep -E 'id="slide-14"|/ 18'
kill $SERVER_PID
```

Expected: line count grows by ~85, slide count = 15, both grep matches present.

- [ ] **Step 4: Browser-verify slide 14 renders correctly**

Open `http://localhost:8000/docs/demo/canton-homework-deck.html` in a browser. Press End key to jump to last slide. Confirm: page counter reads `15 / 18`, then press Left arrow to land on the new slide-14, confirm title "Tokens are Daml templates, not new primitives" displays, two-column grid renders, callout band at bottom renders. No console errors.

### Task 1.2: Generate hero asset for slide-14 via nano-banana

**Files:**
- Create: `docs/demo/assets/slide-14-tokenization.jpg`
- Modify: `docs/demo/assets/assets-meta.json`

- [ ] **Step 1: Invoke nano-banana skill with this prompt**

Use the `nano-banana` skill (per CLAUDE.md required skills) with this prompt:

```
Two architectural strata visualized as nested frames: an outer monolithic structure (the Daml template) containing a smaller framed inner element (the contract instance), with thin warm-grey lines connecting four smaller satellite nodes (stakeholders) to the inner frame, monochrome warm-grey palette: charcoal #141414 background, panel #242424 frame bodies, warm-grey #CDC8C2 accent edges, off-white #F5F5F5 highlights, editorial 3D render at slight isometric angle, ultra-clean institutional finance aesthetic, museum-quality minimalism, no text, no labels, no logos, no people, 16:9 widescreen, 1376x768, designed as ambient backdrop for foreground presentation content
```

Save output as `docs/demo/assets/slide-14-tokenization.jpg`. nano-banana defaults to JPEG; accept whatever it returns.

- [ ] **Step 2: Verify file exists with reasonable size**

```bash
ls -la docs/demo/assets/slide-14-tokenization.jpg
file docs/demo/assets/slide-14-tokenization.jpg
```

Expected: file exists, > 50KB, type JPEG.

- [ ] **Step 3: Append entry to assets-meta.json**

Add this entry to the `assets` array in `docs/demo/assets/assets-meta.json` (after `slide-8-tradeoffs-roadmap.jpg`):

```json
{
  "file": "slide-14-tokenization.jpg",
  "dimensions": "1376x768",
  "aspect": "16:9",
  "consumed_by": "#slide-14 { background-image }",
  "role": "Slide 14 (Tokenization stance) ambient hero — nested template/instance framing with stakeholder satellites, evoking token-as-Daml-template.",
  "prompt": "Two architectural strata visualized as nested frames: an outer monolithic structure (the Daml template) containing a smaller framed inner element (the contract instance), with thin warm-grey lines connecting four smaller satellite nodes (stakeholders) to the inner frame, monochrome warm-grey palette: charcoal #141414 background, panel #242424 frame bodies, warm-grey #CDC8C2 accent edges, off-white #F5F5F5 highlights, editorial 3D render at slight isometric angle, ultra-clean institutional finance aesthetic, museum-quality minimalism, no text, no labels, no logos, no people, 16:9 widescreen, 1376x768"
}
```

- [ ] **Step 4: Wire the asset into slide-14 background via CSS** (optional polish; deck already renders without it)

If the deck has per-slide background-image rules in its `<style>` block, add:

```css
#slide-14 {
  background-image: url('./assets/slide-14-tokenization.jpg');
  background-size: cover;
  background-position: center;
  background-blend-mode: luminosity;
}
```

If no such pattern exists in the deck `<style>`, skip this step — the slide content is already self-contained.

- [ ] **Step 5: Commit deck slide + asset together**

```bash
git add docs/demo/canton-homework-deck.html docs/demo/assets/slide-14-tokenization.jpg docs/demo/assets/assets-meta.json
git commit -m "feat(deck): add tokenization deep-dive slide with hero asset"
```

### Task 1.3: Build TokenModelCard component

**Files:**
- Create: `web/apps/issuer-portal/src/components/TokenModelCard.tsx`
- Create: `web/apps/issuer-portal/src/components/TokenModelCard.test.tsx`

- [ ] **Step 1: Write failing test for TokenModelCard**

Create `web/apps/issuer-portal/src/components/TokenModelCard.test.tsx`:

```tsx
import { afterEach } from "vitest";
import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TokenModelCard } from "./TokenModelCard";

afterEach(cleanup);

describe("TokenModelCard", () => {
  it("renders the template name and stakeholder count", () => {
    render(
      <TokenModelCard
        templateName="ShortDurationCreditNote"
        stakeholders={["Issuer", "Distributor", "Investor", "Custodian"]}
        lifecycleStates={["pending", "approved", "active", "matured", "cancelled"]}
        offLedgerFields={["KYC docs", "marketing collateral", "fee schedule"]}
      />,
    );
    expect(screen.getByText("ShortDurationCreditNote")).toBeTruthy();
    expect(screen.getByText(/4 stakeholders/i)).toBeTruthy();
    expect(screen.getByText("pending")).toBeTruthy();
    expect(screen.getByText("matured")).toBeTruthy();
    expect(screen.getByText(/KYC docs/)).toBeTruthy();
  });

  it("marks terminal states distinctly", () => {
    render(
      <TokenModelCard
        templateName="X"
        stakeholders={["A"]}
        lifecycleStates={["pending", "matured", "cancelled"]}
        offLedgerFields={[]}
      />,
    );
    const matured = screen.getByText("matured");
    expect(matured.getAttribute("data-terminal")).toBe("true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @hydrax/issuer-portal test -- --run src/components/TokenModelCard.test.tsx
```

Expected: FAIL with "Cannot find module './TokenModelCard'".

- [ ] **Step 3: Write the TokenModelCard component**

Create `web/apps/issuer-portal/src/components/TokenModelCard.tsx`:

```tsx
import type { ReactNode, CSSProperties } from "react";
import { Heading, Stack, Text, Icon } from "@hydrax/ui";
import { FileText, Users, Workflow, Database } from "lucide-react";

const TERMINAL_STATES = new Set(["matured", "cancelled"]);

export interface TokenModelCardProps {
  readonly templateName: string;
  readonly stakeholders: ReadonlyArray<string>;
  readonly lifecycleStates: ReadonlyArray<string>;
  readonly offLedgerFields: ReadonlyArray<string>;
}

const sectionStyle: CSSProperties = {
  border: "1px solid var(--hydrax-color-border)",
  borderRadius: "var(--hydrax-radius-md)",
  padding: "var(--hydrax-space-md)",
  background: "var(--hydrax-color-bg-raised, var(--hydrax-color-bg))",
};

const stateChipStyle = (terminal: boolean): CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  marginRight: 6,
  marginBottom: 4,
  borderRadius: 4,
  fontFamily: "var(--hydrax-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  fontSize: "var(--hydrax-type-body-sm-size)",
  border: terminal
    ? "1px dashed var(--hydrax-color-accent)"
    : "1px solid var(--hydrax-color-border)",
  color: terminal
    ? "var(--hydrax-color-accent)"
    : "var(--hydrax-color-text-strong)",
});

export function TokenModelCard({
  templateName,
  stakeholders,
  lifecycleStates,
  offLedgerFields,
}: TokenModelCardProps): ReactNode {
  return (
    <Stack gap="md" style={sectionStyle}>
      <Stack gap="xs">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon icon={FileText} label="Token model" size={16} />
          <Heading level="h2">Token Model</Heading>
        </span>
        <Text tone="muted">
          Daml template &middot; <strong>{templateName}</strong>
        </Text>
      </Stack>

      <Stack gap="xs">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon icon={Users} label="Stakeholders" size={14} />
          <Text>
            <strong>{stakeholders.length} stakeholders</strong> &middot; {stakeholders.join(", ")}
          </Text>
        </span>
      </Stack>

      <Stack gap="xs">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon icon={Workflow} label="Lifecycle" size={14} />
          <Text>
            <strong>Lifecycle states</strong>
          </Text>
        </span>
        <div>
          {lifecycleStates.map((s) => {
            const terminal = TERMINAL_STATES.has(s);
            return (
              <span
                key={s}
                style={stateChipStyle(terminal)}
                data-terminal={terminal ? "true" : "false"}
              >
                {s}
              </span>
            );
          })}
        </div>
      </Stack>

      {offLedgerFields.length > 0 && (
        <Stack gap="xs">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon icon={Database} label="Off-ledger fields" size={14} />
            <Text>
              <strong>Off-ledger fields</strong> (workflow-svc owns)
            </Text>
          </span>
          <Text tone="muted">{offLedgerFields.join(" &middot; ")}</Text>
        </Stack>
      )}
    </Stack>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @hydrax/issuer-portal test -- --run src/components/TokenModelCard.test.tsx
```

Expected: PASS, both tests green.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @hydrax/issuer-portal typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit component**

```bash
git add web/apps/issuer-portal/src/components/TokenModelCard.tsx web/apps/issuer-portal/src/components/TokenModelCard.test.tsx
git commit -m "feat(issuer-portal): add TokenModelCard primitive for product detail"
```

### Task 1.4: Wire TokenModelCard into ProductDetailRoute

**Files:**
- Modify: `web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx`

- [ ] **Step 1: Add import and integrate component**

Edit `web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx`:

After the existing imports (line 1-24), add:

```tsx
import { TokenModelCard } from "../components/TokenModelCard";
```

After the closing `</Stack>` of the Lifecycle actions block (around line 177, just before the final `</Stack>` of the route), insert:

```tsx
<TokenModelCard
  templateName={tokenTemplateForProductType(data.product_type)}
  stakeholders={["Issuer", "Distributor", "Investor", "Custodian"]}
  lifecycleStates={["pending", "approved", "active", "matured", "cancelled"]}
  offLedgerFields={[
    "KYC documents",
    "marketing collateral",
    "fee schedule",
    "investor reporting",
  ]}
/>
```

Just before the `export function ProductDetailRoute()` line, add the helper:

```tsx
function tokenTemplateForProductType(productType: string): string {
  const map: Record<string, string> = {
    short_duration_credit: "ShortDurationCreditNote",
    fund: "FundUnit",
    structured_product: "StructuredNote",
    treasury: "TreasuryToken",
  };
  return map[productType] ?? "GenericProductInstrument";
}
```

- [ ] **Step 2: Update existing ProductDetailRoute test if needed**

```bash
pnpm --filter @hydrax/issuer-portal test -- --run src/routes/ProductDetailRoute.test.tsx
```

If the test asserts a specific structure that the new TokenModelCard breaks, update the test to additionally assert: `expect(screen.getByText(/Token Model/i)).toBeTruthy();`. Otherwise leave alone.

- [ ] **Step 3: Run full app tests + typecheck + build**

```bash
pnpm --filter @hydrax/issuer-portal typecheck
pnpm --filter @hydrax/issuer-portal test -- --run
pnpm --filter @hydrax/issuer-portal build
```

Expected: all PASS.

- [ ] **Step 4: Browser-verify in dev server**

```bash
pnpm --filter @hydrax/issuer-portal dev
```

Open `http://localhost:5173/products/<any-id>`. Confirm Token Model card renders below Lifecycle actions, shows ShortDurationCreditNote (or fallback), 4 stakeholders, lifecycle chips with `matured` and `cancelled` styled as terminal.

Stop dev server.

- [ ] **Step 5: Commit wiring**

```bash
git add web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx web/apps/issuer-portal/src/routes/ProductDetailRoute.test.tsx
git commit -m "feat(issuer-portal): surface token model on product detail page"
```

### Task 1.5: Phase 1 verification gate

- [ ] **Step 1: Workspace-wide verification**

```bash
pnpm -r --if-present typecheck
pnpm -r --if-present test -- --run
pnpm -r --if-present build
```

Expected: 3 green or no advance to Phase 2.

- [ ] **Step 2: Update STATE.yaml verification_log**

Append a line to `STATE.yaml` under `verification_log`:

```
2026-04-26 — phase 1 (tokenization stance): slide-14 appended; slide count 15; pnpm -r typecheck/test/build green; TokenModelCard ships as issuer-portal product-detail section
```

```bash
git add STATE.yaml
git commit -m "chore(state): log phase 1 tokenization deep-dive verification"
```

---

## Phase 2: Topic 2 — DeFi Composability under Privacy

**Slide narrative:** Naive DeFi composability assumes globally-readable state. Canton's contract-level privacy disqualifies that pattern. Composability moves up the stack: the orchestration plane is responsible for bringing parties onto the contract at issuance time so downstream `choice` operations can land. Trade-off: less anyone-can-call composition, more compliance-by-construction. The portal surface is an admin "Composability" view showing which contracts have which stakeholders and how workflows pull parties in.

### Task 2.1: Append slide-15 to canton-homework-deck.html

**Files:**
- Modify: `docs/demo/canton-homework-deck.html` — append before line 2201 (after slide-14)

- [ ] **Step 1: Append slide-15 HTML**

Insert after the closing `</div>` of slide-14:

```html
<!-- ============================================================ -->
<!-- SLIDE 15 — DEEP DIVE — DEFI COMPOSABILITY UNDER PRIVACY      -->
<!-- ============================================================ -->
<div class="slide-container slide-page" id="slide-15">
  <div data-object-type="textbox" class="page-num"
    style="position: absolute; top: 40px; right: 60px; width: 110px; height: 100px; text-align: right; z-index: 10;">
    <div
      style="font-family: 'Inter', 'SF Pro Text', system-ui, -apple-system, sans-serif; font-size: 80px; font-weight: 900; color: rgba(205,200,194,0.08); line-height: 1;">
      15</div>
  </div>
  <div data-object-type="textbox" class="slide-title"
    style="position: absolute; left: 60px; top: 40px; width: 1160px; z-index: 10;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <div style="width: 8px; height: 8px; background: var(--hydrax-color-accent); border-radius: 50%;"></div>
      <span
        style="font-family: 'IBM Plex Mono', 'SFMono-Regular', 'Consolas', monospace; font-size: 14px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--hydrax-color-accent);">deep dive &middot; composability</span>
    </div>
    <h1
      style="font-family: 'Inter', 'SF Pro Text', system-ui, -apple-system, sans-serif; font-size: 50px; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; margin: 0 0 10px 0; color: var(--hydrax-color-text-strong);">
      Composability moves <span style="color: var(--hydrax-color-accent); font-weight: 700;">up the stack</span>
    </h1>
    <p style="font-size: 17px; line-height: 1.4; color: var(--hydrax-color-text-muted); margin: 0; max-width: 1080px;">
      Public-chain DeFi composes because state is globally readable. Canton's contract-level privacy disqualifies that pattern. Composition lives in the orchestration plane &mdash; "bring the parties to the contract".
    </p>
  </div>
  <div data-object-type="graphic"
    style="position: absolute; left: 60px; top: 210px; width: 1160px; height: 320px; z-index: 10;">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; height: 100%;">
      <!-- LEFT: What we lose -->
      <div
        style="background: rgba(36,36,36,0.78); border: 1px solid var(--hydrax-color-accent-soft); border-radius: 14px; padding: 22px 26px; display: flex; flex-direction: column;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
          <div
            style="width: 38px; height: 38px; background: rgba(205,200,194,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </div>
          <div>
            <div style="font-size: 16px; font-weight: 700; color: var(--hydrax-color-text-strong);">What we don't get</div>
            <div style="font-size: 12px; color: var(--hydrax-color-accent);">vs public-chain DeFi</div>
          </div>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Anyone-can-call composition</strong> &mdash; a contract is opaque to non-stakeholders by construction</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Global state reads</strong> &mdash; no shared mempool, no public RPC of all contracts</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Atomic same-block flash composition</strong> across arbitrary protocols built by strangers</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Permissionless interop</strong> with adversarial counterparties</li>
        </ul>
      </div>
      <!-- RIGHT: What we gain -->
      <div
        style="background: rgba(36,36,36,0.78); border: 1px solid rgba(205,200,194,0.25); border-radius: 14px; padding: 22px 26px; display: flex; flex-direction: column; position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, var(--hydrax-color-accent), #EEEAE6);"></div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
          <div
            style="width: 38px; height: 38px; background: rgba(205,200,194,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <div>
            <div style="font-size: 16px; font-weight: 700; color: var(--hydrax-color-text-strong);">What we get instead</div>
            <div style="font-size: 12px; color: var(--hydrax-color-accent);">orchestration-plane composition</div>
          </div>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Stakeholders declared at modelling time</strong> &mdash; cross-contract logic is a deliberate design step</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>"Bring parties to the contract"</strong> &mdash; <code style="font-family: 'IBM Plex Mono', monospace; color: var(--hydrax-color-accent);">workflow-svc</code> adds the right principals at issuance so downstream choices are even possible</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Compliance-by-construction</strong> &mdash; you cannot accidentally compose a custodian into a flow they shouldn't see</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Atomicity preserved</strong> &mdash; the same Daml choice can mutate multiple contracts in one signed step (within a domain)</li>
        </ul>
      </div>
    </div>
  </div>
  <div data-object-type="textbox"
    style="position: absolute; left: 60px; top: 545px; width: 1160px; height: 110px; z-index: 10;">
    <div
      style="background: rgba(205,200,194,0.04); border: 1px solid var(--hydrax-color-accent-soft); border-radius: 12px; padding: 16px 22px;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><circle cx="9" cy="7" r="4"/><circle cx="18" cy="15" r="3"/><path d="M10 15H6a4 4 0 0 0-4 4v2"/><path d="m14.5 13.5 4-4"/></svg>
        <span class="mono" style="font-size: 11px; color: var(--hydrax-color-accent); letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600;">where it lands in the portal</span>
      </div>
      <p style="font-size: 13px; color: var(--hydrax-color-text-strong); margin: 0; line-height: 1.5;">
        Admin portal &rarr; <strong style="color: var(--hydrax-color-accent);">Composability map</strong>. Renders the active contract templates as cards with their stakeholder rosters, and shows which workflows are responsible for adding each principal. Mock data today; production view drives off the workflow-svc projection.
      </p>
    </div>
  </div>
  <div data-object-type="textbox" class="slide-info"
    style="position: absolute; top: 670px; left: 60px; width: 1160px; height: 30px; display: flex; justify-content: space-between; align-items: center; z-index: 5;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      <span style="font-size: 13px; color: var(--hydrax-color-text-muted);">Get the stakeholder set wrong at modelling time and no UI work fixes it.</span>
    </div>
    <div
      style="font-family: 'IBM Plex Mono', 'SFMono-Regular', 'Consolas', monospace; font-size: 13px; color: var(--hydrax-color-text-muted);">
      docs/canton-homework.md &sect;3A
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verify deck**

```bash
grep -c 'slide-container slide-page' docs/demo/canton-homework-deck.html
```

Expected: 16 (was 15 after Phase 1).

### Task 2.2: Generate hero asset for slide-15

**Files:**
- Create: `docs/demo/assets/slide-15-composability.jpg`
- Modify: `docs/demo/assets/assets-meta.json`

- [ ] **Step 1: Invoke nano-banana** with this prompt:

```
Abstract network of distinct contract nodes connected by carefully drawn pathways: each contract a small floating panel with a thin halo of stakeholder-marker dots around it, several panels linked by precisely-drawn warm-grey lines that touch only the matching stakeholder dots (not arbitrary nodes), suggesting selective composition by explicit stakeholder declaration, monochrome warm-grey palette: deep charcoal #141414 background, panel #242424 contract bodies, warm-grey #CDC8C2 connection lines and dots, off-white #F5F5F5 highlights on connection endpoints, editorial flat-isometric render style, ultra-clean institutional minimalism, no text, no labels, no logos, 16:9 widescreen, 1376x768
```

Save as `docs/demo/assets/slide-15-composability.jpg`.

- [ ] **Step 2: Append entry to assets-meta.json**

```json
{
  "file": "slide-15-composability.jpg",
  "dimensions": "1376x768",
  "aspect": "16:9",
  "consumed_by": "#slide-15 { background-image }",
  "role": "Slide 15 (Composability) ambient hero — selective stakeholder-driven composition; nodes only connect via matching stakeholder dots.",
  "prompt": "Abstract network of distinct contract nodes connected by carefully drawn pathways: each contract a small floating panel with a thin halo of stakeholder-marker dots around it, several panels linked by precisely-drawn warm-grey lines that touch only the matching stakeholder dots (not arbitrary nodes), suggesting selective composition by explicit stakeholder declaration, monochrome warm-grey palette: deep charcoal #141414 background, panel #242424 contract bodies, warm-grey #CDC8C2 connection lines and dots, off-white #F5F5F5 highlights on connection endpoints, editorial flat-isometric render style, ultra-clean institutional minimalism, no text, no labels, no logos, 16:9 widescreen, 1376x768"
}
```

- [ ] **Step 3: Commit deck slide + asset**

```bash
git add docs/demo/canton-homework-deck.html docs/demo/assets/slide-15-composability.jpg docs/demo/assets/assets-meta.json
git commit -m "feat(deck): add composability deep-dive slide with hero asset"
```

### Task 2.3: Build ComposabilityRoute for admin portal

**Files:**
- Create: `web/apps/admin/src/routes/ComposabilityRoute.tsx`
- Create: `web/apps/admin/src/routes/ComposabilityRoute.test.tsx`

- [ ] **Step 1: Write failing test**

Create `web/apps/admin/src/routes/ComposabilityRoute.test.tsx`:

```tsx
import { afterEach } from "vitest";
import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ComposabilityRoute } from "./ComposabilityRoute";

afterEach(cleanup);

describe("ComposabilityRoute", () => {
  it("renders the composability heading", () => {
    render(<ComposabilityRoute />);
    expect(screen.getByText(/Composability map/i)).toBeTruthy();
  });

  it("lists at least three contract templates with stakeholders", () => {
    render(<ComposabilityRoute />);
    const cards = screen.getAllByTestId(/contract-card-/);
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it("shows which workflow brings each stakeholder onto the contract", () => {
    render(<ComposabilityRoute />);
    expect(screen.getAllByText(/added by/i).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

```bash
pnpm --filter @hydrax/admin test -- --run src/routes/ComposabilityRoute.test.tsx
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement ComposabilityRoute**

Create `web/apps/admin/src/routes/ComposabilityRoute.tsx`:

```tsx
import type { ReactNode, CSSProperties } from "react";
import { Card, Heading, Stack, Text, Icon } from "@hydrax/ui";
import { Network, UserPlus } from "lucide-react";

interface ContractTemplate {
  readonly name: string;
  readonly stakeholders: ReadonlyArray<{
    readonly party: string;
    readonly addedByWorkflow: string;
  }>;
}

const TEMPLATES: ReadonlyArray<ContractTemplate> = [
  {
    name: "ShortDurationCreditNote",
    stakeholders: [
      { party: "Issuer", addedByWorkflow: "issuance" },
      { party: "Distributor", addedByWorkflow: "distribution-onboarding" },
      { party: "Investor", addedByWorkflow: "subscription" },
      { party: "Custodian", addedByWorkflow: "custody-binding" },
    ],
  },
  {
    name: "SubscriptionRequest",
    stakeholders: [
      { party: "Issuer", addedByWorkflow: "issuance" },
      { party: "Investor", addedByWorkflow: "subscription" },
      { party: "Approver", addedByWorkflow: "subscription-approval" },
    ],
  },
  {
    name: "DistributionAgreement",
    stakeholders: [
      { party: "Issuer", addedByWorkflow: "issuance" },
      { party: "Distributor", addedByWorkflow: "distribution-onboarding" },
      { party: "Compliance", addedByWorkflow: "compliance-attestation" },
    ],
  },
];

const cardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "var(--hydrax-space-md)",
};

const stakeholderRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 6,
  background: "var(--hydrax-color-bg-raised, rgba(255,255,255,0.02))",
  border: "1px solid var(--hydrax-color-border)",
  fontSize: "var(--hydrax-type-body-sm-size)",
};

const workflowChipStyle: CSSProperties = {
  marginLeft: "auto",
  fontFamily: "var(--hydrax-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  fontSize: "calc(var(--hydrax-type-body-sm-size) * 0.92)",
  color: "var(--hydrax-color-accent)",
};

export function ComposabilityRoute(): ReactNode {
  return (
    <Card
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon icon={Network} label="Composability map" size={18} />
          <Heading level="h1">Composability map</Heading>
        </span>
      }
    >
      <Stack gap="md">
        <Text tone="muted">
          Each Daml template declares its stakeholder set at modelling time. The orchestration plane is responsible for adding the right principals at issuance so downstream choices are reachable. This view enumerates the active templates and the workflows that materialise each stakeholder.
        </Text>
        <div style={cardGridStyle}>
          {TEMPLATES.map((t) => (
            <div
              key={t.name}
              data-testid={`contract-card-${t.name}`}
              style={{
                border: "1px solid var(--hydrax-color-border)",
                borderRadius: "var(--hydrax-radius-md)",
                padding: "var(--hydrax-space-md)",
                background: "var(--hydrax-color-bg)",
              }}
            >
              <Stack gap="sm">
                <Heading level="h3">{t.name}</Heading>
                <Stack gap="xs">
                  {t.stakeholders.map((s) => (
                    <div key={s.party} style={stakeholderRowStyle}>
                      <Icon icon={UserPlus} label="" size={12} />
                      <span>{s.party}</span>
                      <span style={workflowChipStyle}>
                        added by {s.addedByWorkflow}
                      </span>
                    </div>
                  ))}
                </Stack>
              </Stack>
            </div>
          ))}
        </div>
      </Stack>
    </Card>
  );
}
```

- [ ] **Step 4: Run test (expect pass)**

```bash
pnpm --filter @hydrax/admin test -- --run src/routes/ComposabilityRoute.test.tsx
pnpm --filter @hydrax/admin typecheck
```

Expected: both PASS.

- [ ] **Step 5: Commit route**

```bash
git add web/apps/admin/src/routes/ComposabilityRoute.tsx web/apps/admin/src/routes/ComposabilityRoute.test.tsx
git commit -m "feat(admin): add composability map route"
```

### Task 2.4: Wire ComposabilityRoute into admin App + Sidebar

**Files:**
- Modify: `web/apps/admin/src/App.tsx`
- Modify: `web/apps/admin/src/components/AdminSidebar.tsx`

- [ ] **Step 1: Register route in App.tsx**

Edit `web/apps/admin/src/App.tsx`:

After the existing `import { HomeRoute }` line, add:

```tsx
import { ComposabilityRoute } from "./routes/ComposabilityRoute";
```

After `<Route path="/" element={<HomeRoute />} />`, add:

```tsx
<Route path="/composability" element={<ComposabilityRoute />} />
```

- [ ] **Step 2: Add nav entry to AdminSidebar.tsx**

Read `web/apps/admin/src/components/AdminSidebar.tsx` first, find the NAV-items array (typical pattern: a `const NAV_ITEMS = [...]` with `{ to, label, icon }` shape), and add an entry for `{ to: "/composability", label: "Composability", icon: Network }`. Match the established shape exactly.

- [ ] **Step 3: Verify**

```bash
pnpm --filter @hydrax/admin typecheck
pnpm --filter @hydrax/admin test -- --run
pnpm --filter @hydrax/admin build
```

Expected: 3 green.

- [ ] **Step 4: Browser-verify**

```bash
pnpm --filter @hydrax/admin dev
```

Open `http://localhost:5177/composability`. Confirm sidebar nav entry highlights, three contract template cards render with stakeholder rows. Stop dev server.

- [ ] **Step 5: Commit wiring**

```bash
git add web/apps/admin/src/App.tsx web/apps/admin/src/components/AdminSidebar.tsx
git commit -m "feat(admin): wire composability route into sidebar"
```

### Task 2.5: Phase 2 verification gate

- [ ] **Step 1: Workspace-wide checks**

```bash
pnpm -r --if-present typecheck
pnpm -r --if-present test -- --run
pnpm -r --if-present build
```

- [ ] **Step 2: Update STATE.yaml**

Append to `verification_log`:

```
2026-04-26 — phase 2 (composability): slide-15 appended; slide count 16; admin /composability route lands; pnpm -r green
```

```bash
git add STATE.yaml
git commit -m "chore(state): log phase 2 composability deep-dive verification"
```

---

## Phase 3: Topic 3 — Infrastructure & Operational Setup

**Slide narrative:** 8 services on Railway (5 Go + 3 Node/TS), each with `/healthz` and per-service Dockerfile. White-label portals as Vite static sites on stable dev ports 5173-5177. Tenant isolation via theme config + role-aware shells. Postgres + Mongo addons per environment. The portal surface is an ops-console health dashboard mirroring investor-portal's pattern, polling `/healthz/composite` from the BFF.

### Task 3.1: Append slide-16 to canton-homework-deck.html

**Files:**
- Modify: `docs/demo/canton-homework-deck.html`

- [ ] **Step 1: Append slide-16 HTML** (insert after slide-15)

```html
<!-- ============================================================ -->
<!-- SLIDE 16 — DEEP DIVE — INFRASTRUCTURE & OPERATIONAL SETUP   -->
<!-- ============================================================ -->
<div class="slide-container slide-page" id="slide-16">
  <div data-object-type="textbox" class="page-num"
    style="position: absolute; top: 40px; right: 60px; width: 110px; height: 100px; text-align: right; z-index: 10;">
    <div
      style="font-family: 'Inter', 'SF Pro Text', system-ui, -apple-system, sans-serif; font-size: 80px; font-weight: 900; color: rgba(205,200,194,0.08); line-height: 1;">
      16</div>
  </div>
  <div data-object-type="textbox" class="slide-title"
    style="position: absolute; left: 60px; top: 40px; width: 1160px; z-index: 10;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <div style="width: 8px; height: 8px; background: var(--hydrax-color-accent); border-radius: 50%;"></div>
      <span
        style="font-family: 'IBM Plex Mono', 'SFMono-Regular', 'Consolas', monospace; font-size: 14px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--hydrax-color-accent);">deep dive &middot; infrastructure</span>
    </div>
    <h1
      style="font-family: 'Inter', 'SF Pro Text', system-ui, -apple-system, sans-serif; font-size: 50px; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; margin: 0 0 10px 0; color: var(--hydrax-color-text-strong);">
      8 services, 5 portals, <span style="color: var(--hydrax-color-accent); font-weight: 700;">one Railway project</span>
    </h1>
    <p style="font-size: 17px; line-height: 1.4; color: var(--hydrax-color-text-muted); margin: 0; max-width: 1080px;">
      Production topology is boring on purpose. Each binary is its own service, each portal is its own static site, observability is a single composite health roll-up.
    </p>
  </div>
  <div data-object-type="graphic"
    style="position: absolute; left: 60px; top: 210px; width: 1160px; height: 320px; z-index: 10;">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; height: 100%;">
      <!-- LEFT: Backend topology -->
      <div
        style="background: rgba(36,36,36,0.78); border: 1px solid var(--hydrax-color-accent-soft); border-radius: 14px; padding: 22px 26px; display: flex; flex-direction: column;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
          <div
            style="width: 38px; height: 38px; background: rgba(205,200,194,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div>
            <div style="font-size: 16px; font-weight: 700; color: var(--hydrax-color-text-strong);">Backend services (8)</div>
            <div style="font-size: 12px; color: var(--hydrax-color-accent);">Go &middot; Node/TS &middot; per-binary</div>
          </div>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px;">
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">Go</span><code style="font-family: 'IBM Plex Mono', monospace;">workflow-svc :7001</code> &mdash; orchestration, FSM</li>
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">Go</span><code style="font-family: 'IBM Plex Mono', monospace;">approval-svc :7002</code> &mdash; chains, escalations</li>
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">Go</span><code style="font-family: 'IBM Plex Mono', monospace;">audit-svc :7003</code> &mdash; immutable trail</li>
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">Go</span><code style="font-family: 'IBM Plex Mono', monospace;">hydrax-adapter :7004</code> &mdash; rails (mocked)</li>
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">Go</span><code style="font-family: 'IBM Plex Mono', monospace;">canton-adapter :7005</code> &mdash; ledger I/O</li>
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">TS</span><code style="font-family: 'IBM Plex Mono', monospace;">notify-svc :7101</code> &mdash; email, webhook</li>
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">TS</span><code style="font-family: 'IBM Plex Mono', monospace;">integration-svc :7102</code> &mdash; KYC, SSO</li>
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">TS</span><code style="font-family: 'IBM Plex Mono', monospace;">bff :7103</code> &mdash; aggregation, /healthz/composite</li>
        </ul>
      </div>
      <!-- RIGHT: Frontend + observability -->
      <div
        style="background: rgba(36,36,36,0.78); border: 1px solid rgba(205,200,194,0.25); border-radius: 14px; padding: 22px 26px; display: flex; flex-direction: column; position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, var(--hydrax-color-accent), #EEEAE6);"></div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
          <div
            style="width: 38px; height: 38px; background: rgba(205,200,194,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
          </div>
          <div>
            <div style="font-size: 16px; font-weight: 700; color: var(--hydrax-color-text-strong);">Portals + observability</div>
            <div style="font-size: 12px; color: var(--hydrax-color-accent);">5 static sites &middot; one composite</div>
          </div>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px;">
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><strong>5 Vite + React + RTK</strong> portals: issuer (5173), distributor (5174), investor (5175), ops (5176), admin (5177)</li>
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><strong>Tenant isolation</strong> via CSS-vars theme config injected at runtime; no shared mutable state</li>
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><strong>Role-aware shells</strong> &mdash; not the same SPA with feature flags</li>
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><strong>Postgres + Mongo</strong> as Railway addons; <code style="font-family: 'IBM Plex Mono', monospace;">DATABASE_URL</code> + <code style="font-family: 'IBM Plex Mono', monospace;">MONGODB_URI</code> per service env</li>
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><strong>One health roll-up</strong>: bff <code style="font-family: 'IBM Plex Mono', monospace;">/healthz/composite</code> aggregates all 8 upstream <code style="font-family: 'IBM Plex Mono', monospace;">/healthz</code> probes</li>
          <li style="color: var(--hydrax-color-text-strong); line-height: 1.4;"><strong>Deploy</strong>: <code style="font-family: 'IBM Plex Mono', monospace;">railway up --detach</code> per linked service root</li>
        </ul>
      </div>
    </div>
  </div>
  <div data-object-type="textbox"
    style="position: absolute; left: 60px; top: 545px; width: 1160px; height: 110px; z-index: 10;">
    <div
      style="background: rgba(205,200,194,0.04); border: 1px solid var(--hydrax-color-accent-soft); border-radius: 12px; padding: 16px 22px;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        <span class="mono" style="font-size: 11px; color: var(--hydrax-color-accent); letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600;">where it lands in the portal</span>
      </div>
      <p style="font-size: 13px; color: var(--hydrax-color-text-strong); margin: 0; line-height: 1.5;">
        Ops console &rarr; <strong style="color: var(--hydrax-color-accent);">Health</strong>. Polls bff <code style="font-family: 'IBM Plex Mono', monospace; color: var(--hydrax-color-accent);">/healthz/composite</code> every 5s, renders one tile per upstream service with status, latency, HTTP code, and any error text. Same component already shipping in investor-portal.
      </p>
    </div>
  </div>
  <div data-object-type="textbox" class="slide-info"
    style="position: absolute; top: 670px; left: 60px; width: 1160px; height: 30px; display: flex; justify-content: space-between; align-items: center; z-index: 5;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      <span style="font-size: 13px; color: var(--hydrax-color-text-muted);">Boring infrastructure is the prerequisite for interesting product work.</span>
    </div>
    <div
      style="font-family: 'IBM Plex Mono', 'SFMono-Regular', 'Consolas', monospace; font-size: 13px; color: var(--hydrax-color-text-muted);">
      services/ &middot; web/apps/
    </div>
  </div>
</div>
```

### Task 3.2: Generate hero asset for slide-16

**Files:**
- Create: `docs/demo/assets/slide-16-infra-ops.jpg`
- Modify: `docs/demo/assets/assets-meta.json`

- [ ] **Step 1: Invoke nano-banana** with this prompt:

```
Top-down architectural diagram of a service mesh: a clean grid of eight square server-rack tiles in the upper region and five thin static-site cards in the lower region, both connected by thin tracing lines that converge into a single central composite-health node, monochrome warm-grey palette: deep charcoal #141414 background, panel #242424 service tiles, warm-grey #CDC8C2 connection lines and central node, off-white #F5F5F5 active-status highlights, editorial flat-isometric render, ultra-clean institutional infrastructure aesthetic, no text, no labels, no logos, 16:9 widescreen, 1376x768
```

Save as `docs/demo/assets/slide-16-infra-ops.jpg`.

- [ ] **Step 2: Append entry to assets-meta.json**

```json
{
  "file": "slide-16-infra-ops.jpg",
  "dimensions": "1376x768",
  "aspect": "16:9",
  "consumed_by": "#slide-16 { background-image }",
  "role": "Slide 16 (Infrastructure) ambient hero — service-mesh topology with convergent composite-health node.",
  "prompt": "Top-down architectural diagram of a service mesh: a clean grid of eight square server-rack tiles in the upper region and five thin static-site cards in the lower region, both connected by thin tracing lines that converge into a single central composite-health node, monochrome warm-grey palette: deep charcoal #141414 background, panel #242424 service tiles, warm-grey #CDC8C2 connection lines and central node, off-white #F5F5F5 active-status highlights, editorial flat-isometric render, ultra-clean institutional infrastructure aesthetic, no text, no labels, no logos, 16:9 widescreen, 1376x768"
}
```

- [ ] **Step 3: Commit deck slide + asset**

```bash
git add docs/demo/canton-homework-deck.html docs/demo/assets/slide-16-infra-ops.jpg docs/demo/assets/assets-meta.json
git commit -m "feat(deck): add infrastructure deep-dive slide with hero asset"
```

### Task 3.3: Build HealthRoute for ops-console (mirror investor-portal pattern)

**Files:**
- Create: `web/apps/ops-console/src/routes/HealthRoute.tsx`
- Create: `web/apps/ops-console/src/routes/HealthRoute.test.tsx`

- [ ] **Step 1: Copy investor-portal HealthRoute as starting point**

```bash
cp web/apps/investor-portal/src/routes/HealthRoute.tsx web/apps/ops-console/src/routes/HealthRoute.tsx
```

The file already imports from `@hydrax/api-client` and `@hydrax/ui` — both available in ops-console workspace. No edits required to the route content for v1; the BFF returns the same composite for all 8 services.

- [ ] **Step 2: Write test**

Create `web/apps/ops-console/src/routes/HealthRoute.test.tsx`:

```tsx
import { afterEach } from "vitest";
import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { hydraxApi } from "@hydrax/api-client";
import { HealthRoute } from "./HealthRoute";

afterEach(cleanup);

function renderWithStore(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (gdm) => gdm().concat(hydraxApi.middleware),
  });
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("ops-console HealthRoute", () => {
  it("renders the Platform Health heading", () => {
    renderWithStore(<HealthRoute />);
    expect(screen.getByText(/Platform Health/i)).toBeTruthy();
  });

  it("renders a Refresh button", () => {
    renderWithStore(<HealthRoute />);
    expect(screen.getByRole("button", { name: /Refresh now/i })).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run tests + typecheck + build**

```bash
pnpm --filter @hydrax/ops-console test -- --run src/routes/HealthRoute.test.tsx
pnpm --filter @hydrax/ops-console typecheck
pnpm --filter @hydrax/ops-console build
```

Expected: all PASS.

- [ ] **Step 4: Commit route**

```bash
git add web/apps/ops-console/src/routes/HealthRoute.tsx web/apps/ops-console/src/routes/HealthRoute.test.tsx
git commit -m "feat(ops-console): mirror investor-portal HealthRoute pattern"
```

### Task 3.4: Wire HealthRoute into ops-console App + Sidebar

**Files:**
- Modify: `web/apps/ops-console/src/App.tsx`
- Modify: `web/apps/ops-console/src/components/OpsSidebar.tsx`

- [ ] **Step 1: Register route**

Edit `web/apps/ops-console/src/App.tsx`:

After `import { AuditRoute }`, add:

```tsx
import { HealthRoute } from "./routes/HealthRoute";
```

After `<Route path="/audit" element={<AuditRoute />} />`, add:

```tsx
<Route path="/health" element={<HealthRoute />} />
```

- [ ] **Step 2: Add nav entry**

Edit `web/apps/ops-console/src/components/OpsSidebar.tsx`. Read the file's NAV-items pattern, then add `{ to: "/health", label: "Health", icon: Activity }` (import `Activity` from `lucide-react`).

- [ ] **Step 3: Verify**

```bash
pnpm --filter @hydrax/ops-console typecheck
pnpm --filter @hydrax/ops-console test -- --run
pnpm --filter @hydrax/ops-console build
```

- [ ] **Step 4: Browser-verify**

```bash
pnpm --filter @hydrax/ops-console dev
```

Open `http://localhost:5176/health`. Confirm: sidebar nav highlights Health, Platform Health card renders with bff tile + 7 upstream tiles (or appropriate fallback if BFF not running). Stop dev server.

- [ ] **Step 5: Commit wiring**

```bash
git add web/apps/ops-console/src/App.tsx web/apps/ops-console/src/components/OpsSidebar.tsx
git commit -m "feat(ops-console): wire health route into sidebar"
```

### Task 3.5: Phase 3 verification gate

```bash
pnpm -r --if-present typecheck
pnpm -r --if-present test -- --run
pnpm -r --if-present build
```

Append to STATE.yaml `verification_log`:

```
2026-04-26 — phase 3 (infra/ops): slide-16 appended; slide count 17; ops-console /health mirrors investor-portal pattern; pnpm -r green
```

```bash
git add STATE.yaml
git commit -m "chore(state): log phase 3 infrastructure deep-dive verification"
```

---

## Phase 4: Topic 4 — Data Management & Synchronization Across Domains

**Slide narrative:** Daml events stream from canton-adapter → workflow-svc → relational projections in Postgres + flexible payloads in Mongo. Single-synchroniser default; multi-domain when cross-jurisdiction or latency-isolation requires it. Read-model freshness is observable via per-projection lag metrics. The portal surface is an admin "Projections" view showing each read model's last-event timestamp, lag, and recent events.

### Task 4.1: Append slide-17 to canton-homework-deck.html

**Files:**
- Modify: `docs/demo/canton-homework-deck.html`

- [ ] **Step 1: Append slide-17 HTML** (insert after slide-16)

```html
<!-- ============================================================ -->
<!-- SLIDE 17 — DEEP DIVE — DATA MANAGEMENT & SYNC               -->
<!-- ============================================================ -->
<div class="slide-container slide-page" id="slide-17">
  <div data-object-type="textbox" class="page-num"
    style="position: absolute; top: 40px; right: 60px; width: 110px; height: 100px; text-align: right; z-index: 10;">
    <div
      style="font-family: 'Inter', 'SF Pro Text', system-ui, -apple-system, sans-serif; font-size: 80px; font-weight: 900; color: rgba(205,200,194,0.08); line-height: 1;">
      17</div>
  </div>
  <div data-object-type="textbox" class="slide-title"
    style="position: absolute; left: 60px; top: 40px; width: 1160px; z-index: 10;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <div style="width: 8px; height: 8px; background: var(--hydrax-color-accent); border-radius: 50%;"></div>
      <span
        style="font-family: 'IBM Plex Mono', 'SFMono-Regular', 'Consolas', monospace; font-size: 14px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--hydrax-color-accent);">deep dive &middot; data &amp; sync</span>
    </div>
    <h1
      style="font-family: 'Inter', 'SF Pro Text', system-ui, -apple-system, sans-serif; font-size: 50px; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; margin: 0 0 10px 0; color: var(--hydrax-color-text-strong);">
      Ledger truth, <span style="color: var(--hydrax-color-accent); font-weight: 700;">read-model speed</span>
    </h1>
    <p style="font-size: 17px; line-height: 1.4; color: var(--hydrax-color-text-muted); margin: 0; max-width: 1080px;">
      The ledger holds shared truth. Portals read from off-ledger projections in Postgres + Mongo. The synchroniser orders global state; projections give us tractable query latency.
    </p>
  </div>
  <div data-object-type="graphic"
    style="position: absolute; left: 60px; top: 210px; width: 1160px; height: 320px; z-index: 10;">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; height: 100%;">
      <!-- LEFT: Projection split -->
      <div
        style="background: rgba(36,36,36,0.78); border: 1px solid var(--hydrax-color-accent-soft); border-radius: 14px; padding: 22px 26px; display: flex; flex-direction: column;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
          <div
            style="width: 38px; height: 38px; background: rgba(205,200,194,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
          </div>
          <div>
            <div style="font-size: 16px; font-weight: 700; color: var(--hydrax-color-text-strong);">Off-ledger projection split</div>
            <div style="font-size: 12px; color: var(--hydrax-color-accent);">Postgres + Mongo</div>
          </div>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Postgres</strong> &mdash; relational read models for reporting, joins, indexed queries (subscriptions, approvals, audit, products)</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Mongo</strong> &mdash; flexible tenant-configurable payloads, document metadata, notification envelopes</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Daml events</strong> &rarr; <code style="font-family: 'IBM Plex Mono', monospace; color: var(--hydrax-color-accent);">canton-adapter</code> &rarr; <code style="font-family: 'IBM Plex Mono', monospace; color: var(--hydrax-color-accent);">workflow-svc</code> projector &rarr; both stores</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Idempotent projections</strong> keyed on event id &mdash; replayable, no double-write</li>
        </ul>
      </div>
      <!-- RIGHT: Domain sync -->
      <div
        style="background: rgba(36,36,36,0.78); border: 1px solid rgba(205,200,194,0.25); border-radius: 14px; padding: 22px 26px; display: flex; flex-direction: column; position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, var(--hydrax-color-accent), #EEEAE6);"></div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
          <div
            style="width: 38px; height: 38px; background: rgba(205,200,194,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </div>
          <div>
            <div style="font-size: 16px; font-weight: 700; color: var(--hydrax-color-text-strong);">Sync across domains</div>
            <div style="font-size: 12px; color: var(--hydrax-color-accent);">single-domain default</div>
          </div>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Single-synchroniser</strong> until atomic cross-jurisdiction flows justify multi-domain</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Per-projection lag</strong> tracked: last-event timestamp, events/sec, error count &mdash; surfaced in admin</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Replay-from-offset</strong> when a projection schema changes &mdash; no migration step required</li>
          <li style="font-size: 13px; color: var(--hydrax-color-text-strong); line-height: 1.45;"><span style="color: var(--hydrax-color-accent); margin-right: 6px;">&bull;</span><strong>Multi-domain trigger</strong> = cross-region operator residency, latency isolation, or supervisory partitioning</li>
        </ul>
      </div>
    </div>
  </div>
  <div data-object-type="textbox"
    style="position: absolute; left: 60px; top: 545px; width: 1160px; height: 110px; z-index: 10;">
    <div
      style="background: rgba(205,200,194,0.04); border: 1px solid var(--hydrax-color-accent-soft); border-radius: 12px; padding: 16px 22px;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <span class="mono" style="font-size: 11px; color: var(--hydrax-color-accent); letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600;">where it lands in the portal</span>
      </div>
      <p style="font-size: 13px; color: var(--hydrax-color-text-strong); margin: 0; line-height: 1.5;">
        Admin portal &rarr; <strong style="color: var(--hydrax-color-accent);">Projections</strong>. One row per read model: name, store (postgres/mongo), last-event timestamp, lag in seconds, events/sec, last error. Click-through to the recent events stream for that projection.
      </p>
    </div>
  </div>
  <div data-object-type="textbox" class="slide-info"
    style="position: absolute; top: 670px; left: 60px; width: 1160px; height: 30px; display: flex; justify-content: space-between; align-items: center; z-index: 5;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--hydrax-color-accent);"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      <span style="font-size: 13px; color: var(--hydrax-color-text-muted);">The ledger is the source of truth. The projection is the source of speed.</span>
    </div>
    <div
      style="font-family: 'IBM Plex Mono', 'SFMono-Regular', 'Consolas', monospace; font-size: 13px; color: var(--hydrax-color-text-muted);">
      services/canton-adapter &middot; services/workflow-svc
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verify deck**

```bash
grep -c 'slide-container slide-page' docs/demo/canton-homework-deck.html
```

Expected: 18.

### Task 4.2: Generate hero asset for slide-17

**Files:**
- Create: `docs/demo/assets/slide-17-data-sync.jpg`
- Modify: `docs/demo/assets/assets-meta.json`

- [ ] **Step 1: Invoke nano-banana** with this prompt:

```
Top-down architectural diagram of an event-projection pipeline: a central ledger column on the left emitting a horizontal flow of square event packets traveling rightward, splitting into two parallel destination silos (a tall cylindrical Postgres-shape and a wider rounded Mongo-shape) on the right, with thin warm-grey lag-indicator lines and small timestamp ticks along the flow path, monochrome warm-grey palette: deep charcoal #141414 background, panel #242424 silos and central column, warm-grey #CDC8C2 event packets and flow lines, off-white #F5F5F5 active-write highlights, editorial isometric render, ultra-clean institutional data-engineering aesthetic, no text, no labels, no logos, 16:9 widescreen, 1376x768
```

Save as `docs/demo/assets/slide-17-data-sync.jpg`.

- [ ] **Step 2: Append entry to assets-meta.json**

```json
{
  "file": "slide-17-data-sync.jpg",
  "dimensions": "1376x768",
  "aspect": "16:9",
  "consumed_by": "#slide-17 { background-image }",
  "role": "Slide 17 (Data & sync) ambient hero — event-projection pipeline from ledger to dual store silos.",
  "prompt": "Top-down architectural diagram of an event-projection pipeline: a central ledger column on the left emitting a horizontal flow of square event packets traveling rightward, splitting into two parallel destination silos (a tall cylindrical Postgres-shape and a wider rounded Mongo-shape) on the right, with thin warm-grey lag-indicator lines and small timestamp ticks along the flow path, monochrome warm-grey palette: deep charcoal #141414 background, panel #242424 silos and central column, warm-grey #CDC8C2 event packets and flow lines, off-white #F5F5F5 active-write highlights, editorial isometric render, ultra-clean institutional data-engineering aesthetic, no text, no labels, no logos, 16:9 widescreen, 1376x768"
}
```

- [ ] **Step 3: Commit deck slide + asset**

```bash
git add docs/demo/canton-homework-deck.html docs/demo/assets/slide-17-data-sync.jpg docs/demo/assets/assets-meta.json
git commit -m "feat(deck): add data sync deep-dive slide with hero asset"
```

### Task 4.3: Build ProjectionsRoute for admin portal

**Files:**
- Create: `web/apps/admin/src/routes/ProjectionsRoute.tsx`
- Create: `web/apps/admin/src/routes/ProjectionsRoute.test.tsx`

- [ ] **Step 1: Write failing test**

Create `web/apps/admin/src/routes/ProjectionsRoute.test.tsx`:

```tsx
import { afterEach } from "vitest";
import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProjectionsRoute } from "./ProjectionsRoute";

afterEach(cleanup);

describe("ProjectionsRoute", () => {
  it("renders the projections heading", () => {
    render(<ProjectionsRoute />);
    expect(screen.getByText(/Projections/i)).toBeTruthy();
  });

  it("renders one row per known projection with store + lag", () => {
    render(<ProjectionsRoute />);
    const rows = screen.getAllByTestId(/projection-row-/);
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });

  it("flags projections with non-zero lag distinctly", () => {
    render(<ProjectionsRoute />);
    const lagged = screen.getAllByTestId(/lag-stale/);
    expect(lagged.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

```bash
pnpm --filter @hydrax/admin test -- --run src/routes/ProjectionsRoute.test.tsx
```

- [ ] **Step 3: Implement ProjectionsRoute**

Create `web/apps/admin/src/routes/ProjectionsRoute.tsx`:

```tsx
import type { ReactNode, CSSProperties } from "react";
import { Card, Heading, Stack, Text, Icon } from "@hydrax/ui";
import { Database, AlertTriangle, CheckCircle2 } from "lucide-react";

type Store = "postgres" | "mongo";

interface Projection {
  readonly name: string;
  readonly store: Store;
  readonly lastEventAt: string;
  readonly lagSeconds: number;
  readonly eventsPerSecond: number;
  readonly lastError?: string;
}

const PROJECTIONS: ReadonlyArray<Projection> = [
  {
    name: "products_read",
    store: "postgres",
    lastEventAt: "2026-04-26T11:42:08Z",
    lagSeconds: 0.4,
    eventsPerSecond: 12.3,
  },
  {
    name: "subscriptions_read",
    store: "postgres",
    lastEventAt: "2026-04-26T11:42:07Z",
    lagSeconds: 1.2,
    eventsPerSecond: 8.1,
  },
  {
    name: "approvals_read",
    store: "postgres",
    lastEventAt: "2026-04-26T11:42:06Z",
    lagSeconds: 2.7,
    eventsPerSecond: 4.4,
  },
  {
    name: "audit_events",
    store: "mongo",
    lastEventAt: "2026-04-26T11:42:08Z",
    lagSeconds: 0.6,
    eventsPerSecond: 18.7,
  },
  {
    name: "notification_envelopes",
    store: "mongo",
    lastEventAt: "2026-04-26T11:41:51Z",
    lagSeconds: 17.4,
    eventsPerSecond: 0.9,
    lastError: "destination unreachable: smtp-relay timeout",
  },
];

const STALE_THRESHOLD_SECONDS = 5;

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "var(--hydrax-type-body-size)",
};

const cellStyle: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--hydrax-color-border)",
  textAlign: "left",
  verticalAlign: "top",
};

const headerCellStyle: CSSProperties = {
  ...cellStyle,
  fontFamily: "var(--hydrax-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  fontSize: "var(--hydrax-type-body-sm-size)",
  color: "var(--hydrax-color-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

function formatLag(seconds: number): string {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

export function ProjectionsRoute(): ReactNode {
  return (
    <Card
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon icon={Database} label="Projections" size={18} />
          <Heading level="h1">Projections</Heading>
        </span>
      }
    >
      <Stack gap="md">
        <Text tone="muted">
          Each row is one off-ledger read model fed by the canton-adapter event stream. Stale projections (lag &gt; {STALE_THRESHOLD_SECONDS}s) are flagged for operator attention. Errors surface inline with the most recent failure.
        </Text>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headerCellStyle}>Projection</th>
              <th style={headerCellStyle}>Store</th>
              <th style={headerCellStyle}>Last event</th>
              <th style={headerCellStyle}>Lag</th>
              <th style={headerCellStyle}>Events/sec</th>
              <th style={headerCellStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {PROJECTIONS.map((p) => {
              const stale = p.lagSeconds > STALE_THRESHOLD_SECONDS || Boolean(p.lastError);
              return (
                <tr key={p.name} data-testid={`projection-row-${p.name}`}>
                  <td style={cellStyle}>
                    <code style={{ fontFamily: "var(--hydrax-font-mono, monospace)" }}>{p.name}</code>
                  </td>
                  <td style={cellStyle}>{p.store}</td>
                  <td style={cellStyle}>
                    <code style={{ fontFamily: "var(--hydrax-font-mono, monospace)" }}>{p.lastEventAt}</code>
                  </td>
                  <td
                    style={cellStyle}
                    data-testid={stale ? `lag-stale-${p.name}` : `lag-fresh-${p.name}`}
                  >
                    <span style={{ color: stale ? "var(--hydrax-color-danger)" : "var(--hydrax-color-text-strong)" }}>
                      {formatLag(p.lagSeconds)}
                    </span>
                  </td>
                  <td style={cellStyle}>{p.eventsPerSecond.toFixed(1)}</td>
                  <td style={cellStyle}>
                    {stale ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--hydrax-color-danger)" }}>
                        <Icon icon={AlertTriangle} label="stale" size={14} />
                        {p.lastError ?? "stale"}
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--hydrax-color-success)" }}>
                        <Icon icon={CheckCircle2} label="ok" size={14} />
                        ok
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Stack>
    </Card>
  );
}
```

- [ ] **Step 4: Run test (expect pass)**

```bash
pnpm --filter @hydrax/admin test -- --run src/routes/ProjectionsRoute.test.tsx
pnpm --filter @hydrax/admin typecheck
```

- [ ] **Step 5: Commit route**

```bash
git add web/apps/admin/src/routes/ProjectionsRoute.tsx web/apps/admin/src/routes/ProjectionsRoute.test.tsx
git commit -m "feat(admin): add projections lag dashboard route"
```

### Task 4.4: Wire ProjectionsRoute into admin App + Sidebar

**Files:**
- Modify: `web/apps/admin/src/App.tsx`
- Modify: `web/apps/admin/src/components/AdminSidebar.tsx`

- [ ] **Step 1: Register route**

Edit `web/apps/admin/src/App.tsx`:

After the `import { ComposabilityRoute }` line (added in Phase 2), add:

```tsx
import { ProjectionsRoute } from "./routes/ProjectionsRoute";
```

After `<Route path="/composability" element={<ComposabilityRoute />} />`, add:

```tsx
<Route path="/projections" element={<ProjectionsRoute />} />
```

- [ ] **Step 2: Add nav entry**

Edit `web/apps/admin/src/components/AdminSidebar.tsx`. Add `{ to: "/projections", label: "Projections", icon: Database }` (import `Database` from `lucide-react`).

- [ ] **Step 3: Verify**

```bash
pnpm --filter @hydrax/admin typecheck
pnpm --filter @hydrax/admin test -- --run
pnpm --filter @hydrax/admin build
```

- [ ] **Step 4: Browser-verify**

```bash
pnpm --filter @hydrax/admin dev
```

Open `http://localhost:5177/projections`. Confirm: sidebar nav highlights Projections, table renders 5 rows with `notification_envelopes` flagged red (stale + error). Stop dev server.

- [ ] **Step 5: Commit wiring**

```bash
git add web/apps/admin/src/App.tsx web/apps/admin/src/components/AdminSidebar.tsx
git commit -m "feat(admin): wire projections route into sidebar"
```

### Task 4.5: Phase 4 verification gate

```bash
pnpm -r --if-present typecheck
pnpm -r --if-present test -- --run
pnpm -r --if-present build
```

Append to STATE.yaml `verification_log`:

```
2026-04-26 — phase 4 (data sync): slide-17 appended; slide count 18 final; admin /projections lands; pnpm -r green
```

```bash
git add STATE.yaml
git commit -m "chore(state): log phase 4 data sync deep-dive verification"
```

---

## Phase 5: Final Verification & Documentation

### Task 5.1: Full deck render check

- [ ] **Step 1: Sanity-check all 4 new slides exist with correct IDs**

```bash
for n in 14 15 16 17; do
  grep -c "id=\"slide-$n\"" docs/demo/canton-homework-deck.html
done
```

Expected: each command outputs `1`.

- [ ] **Step 2: Check page-counter total**

```bash
grep -c '/ 18' docs/demo/canton-homework-deck.html
```

Expected: at least `1`.

- [ ] **Step 3: Browser-verify the full deck**

```bash
python3 -m http.server 8000 &
sleep 1
```

Open `http://localhost:8000/docs/demo/canton-homework-deck.html`. Page through all 18 slides with arrow keys. Confirm:
- Header counter shows `N / 18`
- Slides 14-17 each render their title, two-column body, callout band
- No console errors
- No layout breaks (all slides occupy the same 16:9 frame size)

```bash
kill %1 2>/dev/null || true
```

### Task 5.2: All-portals verification

- [ ] **Step 1: Workspace-wide gates**

```bash
pnpm -r --if-present typecheck
pnpm -r --if-present test -- --run
pnpm -r --if-present build
```

Expected: all green.

- [ ] **Step 2: Spot-check each portal in browser**

For each app, run dev server and confirm new surfaces:

```bash
pnpm --filter @hydrax/issuer-portal dev    # /products/<id> — Token Model section
pnpm --filter @hydrax/admin dev            # /composability + /projections
pnpm --filter @hydrax/ops-console dev      # /health
```

### Task 5.3: Update CLAUDE.md "Decisions (Recent)"

**Files:**
- Modify: `CLAUDE.md`

Append one line to the Decisions (Recent) section:

```
- **2026-04-26 — Deep-dive deck + portal coverage for 4 Canton-interview topics.** Slides 14-17 appended to homework deck (tokenization, composability, infra, data-sync); portal surfaces in issuer-portal (TokenModelCard), admin (/composability, /projections), ops-console (/health mirroring investor-portal pattern). Plan: [docs/plans/2026-04-26-deep-dive-topics-deck-and-portals.md](docs/plans/2026-04-26-deep-dive-topics-deck-and-portals.md).
```

- [ ] **Step 1: Apply edit and commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): log deep-dive deck+portal coverage decision"
```

### Task 5.4: Update STATE.yaml current_focus

Set `current_focus` to the next planned slice; clear in-progress markers; append the consolidated phase-5 verification entry to `verification_log`:

```
2026-04-26 — phases 1-5 complete: 4 deep-dive slides (14-17) + 4 portal surfaces; pnpm -r typecheck/test/build all green; deck count 18; STATE current_focus reset
```

```bash
git add STATE.yaml
git commit -m "chore(state): close deep-dive topics phase, reset focus"
```

---

## Self-Review Checklist

**Spec coverage:** Each of the four user-named topics (tokenization, composability, infra, data-sync) has one deck slide AND one portal surface. The remaining three deep-dive topics from the original list (Web2/Web3 architecture, privacy/security model, smart contract design) were already covered in slides 5, 8, 9, 10, 12 of the existing deck and were not flagged as gaps.

**Placeholder scan:** Every code block is complete and runnable. No "TODO" markers in production code paths. Sidebar nav-entry steps reference the established pattern in the existing files (read first, then add) — this is a deliberate per-file pattern-match, not a placeholder, because the AdminSidebar / OpsSidebar internal structure may evolve and a hardcoded literal would rot.

**Type consistency:** `TokenModelCard` exports a single named function with explicit `TokenModelCardProps` interface; `ComposabilityRoute`, `ProjectionsRoute`, and ops-console `HealthRoute` are zero-prop named exports matching the established route-component shape in their respective apps. RTK Query's `useGetHealthzCompositeQuery` is identical between investor-portal and the new ops-console route.

**Phase boundaries are commit-clean:** Each phase ships in 3-5 commits (slide+asset, component+test, wiring, verification log). No phase exceeds 7 files in any single commit. Project CLAUDE.md hard cap (15 files / commit) honored throughout.

---

## Execution Handoff

Two execution options:

**1. Subagent-Driven (recommended for this scope)** — Dispatch fresh `feature-dev:code-architect` or general-purpose agent per task. Two-stage review between tasks. Better isolation; surfaces drift early.

**2. Inline Execution** — Walk tasks in this same session. Faster turnaround but accumulates context. Acceptable if interruptions are tolerable.

For this plan: Phase 1 (tokenization) is the right first slice because it tests both the deck-append pattern AND the portal-component pattern in a single phase. Phases 2-4 then replicate. After Phase 1 completes, decide whether to continue inline or switch to subagent-driven for Phases 2-4.
