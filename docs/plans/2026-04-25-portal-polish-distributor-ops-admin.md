# Portal Polish — distributor-portal, ops-console, admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the same dark-institutional polish that issuer-portal received (commit `da99c6d`) to the three remaining placeholder portals: distributor-portal, ops-console, admin. Each ships a Sidebar + TopBar + polished HomeRoute with portal-specific NAV, stat tiles, an EmptyState backed by a nano-banana hero JPEG, and 8 tests passing.

**Architecture:** Three parallelizable per-portal slices, all consuming the existing `@hydrax/ui` primitives (Stack, Heading, Text, Skeleton, EmptyState, NavItem, Avatar, AppShell with brand+sidebarFooter slots). Hero imagery lives in `web/packages/ui/src/assets/` and is generated via `/nano-banana`. No new ui primitives. No new theme tokens. No new dependencies.

**Tech Stack:** React 18, Vite 5, react-router-dom 6, vitest, lucide-react, `@hydrax/{ui,tenant-theme,api-client}`, OpenRouter Gemini 3.1 flash image preview (via nano-banana skill).

**Reference pattern:** [web/apps/issuer-portal/src/](../../web/apps/issuer-portal/src/) — App.tsx, components/IssuerSidebar.tsx, components/IssuerTopBar.tsx, routes/HomeRoute.tsx, img.d.ts.

---

## File Structure

Per portal `<P>` (where `<P>` ∈ `{distributor-portal, ops-console, admin}`):

- Modify: `web/apps/<P>/src/App.tsx` — replace inline topbar/sidebar/HomeRoute with the polished split
- Modify: `web/apps/<P>/src/App.test.tsx` — assert that the polished home structure renders
- Create: `web/apps/<P>/src/components/<Brand>Sidebar.tsx` — NavItem-driven sidebar + brand component
- Create: `web/apps/<P>/src/components/<Brand>TopBar.tsx` — search placeholder + notifications + Avatar
- Create: `web/apps/<P>/src/routes/HomeRoute.tsx` — Heading + intro + 3 stat tiles + EmptyState card
- Create: `web/apps/<P>/src/routes/HomeRoute.test.tsx` — 4 tests covering heading, tiles, empty state, connected toggle
- Create: `web/apps/<P>/src/img.d.ts` — ambient module decl for `*.jpg`

Shared, generated once in main session before subagents dispatch:
- Create: `web/packages/ui/src/assets/distributor-empty-state.jpg`
- Create: `web/packages/ui/src/assets/ops-console-empty-state.jpg`
- Create: `web/packages/ui/src/assets/admin-empty-state.jpg`
- Modify: `web/packages/ui/src/assets/assets-meta.json` — append three new entries with provenance
- Modify: `web/packages/ui/src/assets/assets.test.ts` — extend metadata smoke test if it currently asserts a single asset

Wrap-up:
- Modify: `CLAUDE.md` — append to "Web Monorepo — Invariants" the three new portal hero filenames and the fact that distributor/ops/admin now ship polished Home

---

## Task 0: Generate three hero images via nano-banana (main session, sequential)

**Files:**
- Create: `web/packages/ui/src/assets/distributor-empty-state.jpg`
- Create: `web/packages/ui/src/assets/ops-console-empty-state.jpg`
- Create: `web/packages/ui/src/assets/admin-empty-state.jpg`
- Modify: `web/packages/ui/src/assets/assets-meta.json`
- Modify: `web/packages/ui/src/assets/assets.test.ts` (only if it asserts a specific count)

- [ ] **Step 1: Read the existing assets-meta.json schema and assets.test.ts**

```bash
cat web/packages/ui/src/assets/assets-meta.json
cat web/packages/ui/src/assets/assets.test.ts
```

Expected: a JSON object with at least `issuer-empty-state.jpg` recorded with prompt + model + dimensions; a vitest spec that imports the JSON and asserts shape.

- [ ] **Step 2: Generate distributor hero via nano-banana**

Prompt (consistent visual language with issuer hero — minimalist line-art on near-black, single cyan accent):

> "Minimalist institutional dashboard line art on near-black canvas (#0b0d10). Hub-and-spokes distribution diagram in soft white strokes (1.5px), centered. One node accented in HydraX cyan (#00b8d4). No text, no gradients, no glow, no people, no logos. Subtle data-grid backdrop. Editorial, restrained, 1200x896."

Save to `web/packages/ui/src/assets/distributor-empty-state.jpg` (accept JPEG output).

- [ ] **Step 3: Generate ops-console hero via nano-banana**

> "Minimalist institutional ops dashboard line art on near-black canvas (#0b0d10). Five system-status gauge dials arranged in a horizontal row, soft white strokes (1.5px). Dial three accented in HydraX cyan (#00b8d4). No text, no gradients, no glow. Subtle data-grid backdrop. Editorial, restrained, 1200x896."

Save to `web/packages/ui/src/assets/ops-console-empty-state.jpg`.

- [ ] **Step 4: Generate admin hero via nano-banana**

> "Minimalist institutional governance line art on near-black canvas (#0b0d10). A key icon centered above a hierarchical permission tree (three branches, two leaves each), soft white strokes (1.5px). Key body accented in HydraX cyan (#00b8d4). No text, no gradients, no glow. Subtle data-grid backdrop. Editorial, restrained, 1200x896."

Save to `web/packages/ui/src/assets/admin-empty-state.jpg`.

- [ ] **Step 5: Append three entries to assets-meta.json**

Add a key per asset under the same shape used for `issuer-empty-state.jpg` — at minimum: `prompt`, `model: "google/gemini-3.0-flash-image-preview"`, `provider: "openrouter"`, `dimensions: "1200x896"`, `format: "jpeg"`, `generatedAt: "2026-04-25"`.

- [ ] **Step 6: Verify assets**

```bash
ls -la web/packages/ui/src/assets/*.jpg
file web/packages/ui/src/assets/*.jpg
```

Expected: 4 JPEGs (issuer + 3 new), each ~250–500 KB, dimensions ~1200x896.

- [ ] **Step 7: Re-run ui assets test + build**

```bash
cd web && pnpm --filter @hydrax/ui test -- --run && pnpm --filter @hydrax/ui build
```

Expected: assets-meta smoke test passes; build clean.

- [ ] **Step 8: Commit Task 0**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git add web/packages/ui/src/assets/distributor-empty-state.jpg \
        web/packages/ui/src/assets/ops-console-empty-state.jpg \
        web/packages/ui/src/assets/admin-empty-state.jpg \
        web/packages/ui/src/assets/assets-meta.json
git commit -m "feat(web/ui): add distributor/ops-console/admin empty-state heroes (nano-banana)"
```

---

## Task 1: Distributor portal polish (subagent A — parallelizable with Tasks 2 & 3)

**Files:**
- Modify: `web/apps/distributor-portal/src/App.tsx`
- Modify: `web/apps/distributor-portal/src/App.test.tsx`
- Create: `web/apps/distributor-portal/src/components/DistributorSidebar.tsx`
- Create: `web/apps/distributor-portal/src/components/DistributorTopBar.tsx`
- Create: `web/apps/distributor-portal/src/routes/HomeRoute.tsx`
- Create: `web/apps/distributor-portal/src/routes/HomeRoute.test.tsx`
- Create: `web/apps/distributor-portal/src/img.d.ts`

**Portal-specific values:**
- App name: `distributor-portal`
- Brand icon: `Network` from lucide-react
- Brand label: `Distributor Portal`
- NAV items: Home (`/`, `Home`), Allocations (`/allocations`, `Briefcase`), Investors (`/investors`, `Users`), Subscriptions (`/subscriptions`, `FileSignature`), Settlements (`/settlements`, `Receipt`), Activity (`/activity`, `History`), Settings (`/settings`, `Settings`)
- Intro copy: `"Distributor workspace. Connect an allocation feed to start populating these views."`
- Stat tiles (label, lucide icon, iconLabel): `("Live allocations", Briefcase, "Allocations")`, `("Pending subscriptions", FileSignature, "Subscriptions")`, `("Settlements this week", Receipt, "Settlements")`
- EmptyState title: `"No allocation activity yet"`
- EmptyState body: `"Once an allocation feed is connected, recent investor subscriptions and settlement events will appear here."`
- EmptyState imageSrc: `../../../../packages/ui/src/assets/distributor-empty-state.jpg`
- EmptyState imageAlt: `"Illustration of an empty distribution dashboard"`
- Avatar userName placeholder: `"Distributor Operator"` (passed via `<DistributorTopBar userName="Distributor Operator" />` in App.tsx; `<Avatar name={userName} />` derives initials inside the component — there is no `initials` prop on Avatar)

- [ ] **Step 1: Create img.d.ts**

```ts
declare module "*.jpg" {
  const src: string;
  export default src;
}
declare module "*.png" {
  const src: string;
  export default src;
}
```

- [ ] **Step 2: Create components/DistributorSidebar.tsx**

```tsx
import {
  Network,
  LayoutDashboard,
  Briefcase,
  Users,
  FileSignature,
  Receipt,
  History,
  Settings,
} from "lucide-react";
import { Link } from "react-router-dom";
import { NavItem, type NavItemLinkProps } from "@hydrax/ui";

interface DistributorSidebarProps {
  readonly currentPath: string;
}

function RouterLink({ to, style, onClick, children, ...rest }: NavItemLinkProps) {
  return (
    <Link to={to} style={style} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}

const NAV: ReadonlyArray<{
  readonly label: string;
  readonly path: string;
  readonly icon: typeof LayoutDashboard;
}> = [
  { label: "Home", path: "/", icon: LayoutDashboard },
  { label: "Allocations", path: "/allocations", icon: Briefcase },
  { label: "Investors", path: "/investors", icon: Users },
  { label: "Subscriptions", path: "/subscriptions", icon: FileSignature },
  { label: "Settlements", path: "/settlements", icon: Receipt },
  { label: "Activity", path: "/activity", icon: History },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function DistributorSidebar({ currentPath }: DistributorSidebarProps) {
  return (
    <>
      {NAV.map((item) => (
        <NavItem
          key={item.path}
          icon={item.icon}
          label={item.label}
          href={item.path}
          active={currentPath === item.path}
          linkComponent={RouterLink}
        />
      ))}
    </>
  );
}

export function DistributorBrand() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Network aria-label="Distributor Portal" role="img" size={16} />
      <span>Distributor Portal</span>
    </span>
  );
}
```

- [ ] **Step 3: Create components/DistributorTopBar.tsx**

This mirrors the `IssuerTopBar` shape exactly: takes a `userName` prop, passes it to `<Avatar name={userName} />`, uses `--hydrax-type-body-size` (NOT `bodySm` — the token name is `--hydrax-type-body-sm-size` with a hyphen, but here we use the regular body size).

```tsx
import { Search, Bell } from "lucide-react";
import { Avatar, Icon, Stack } from "@hydrax/ui";

interface DistributorTopBarProps {
  readonly userName: string;
}

export function DistributorTopBar({ userName }: DistributorTopBarProps) {
  return (
    <Stack direction="row" align="center" gap="md" style={{ flex: 1 }}>
      <div
        role="search"
        style={{
          flex: 1,
          maxWidth: 480,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          background: "var(--hydrax-color-surface)",
          border: "1px solid var(--hydrax-color-border)",
          borderRadius: "var(--hydrax-radius-md)",
          color: "var(--hydrax-color-text-muted)",
          fontFamily: "var(--hydrax-font-sans)",
          fontSize: "var(--hydrax-type-body-size)",
        }}
      >
        <Icon icon={Search} label="Search" size={14} />
        <span aria-hidden="true">Search allocations, investors, settlements…</span>
      </div>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        aria-label="Notifications"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: "var(--hydrax-radius-sm)",
          background: "transparent",
          border: "1px solid transparent",
          color: "var(--hydrax-color-text-muted)",
          cursor: "pointer",
        }}
      >
        <Icon icon={Bell} label="Notifications" size={16} />
      </button>
      <Avatar name={userName} />
    </Stack>
  );
}
```

- [ ] **Step 4: Create routes/HomeRoute.tsx**

```tsx
import { Inbox, TrendingUp, Briefcase, FileSignature, Receipt } from "lucide-react";
import {
  Card,
  EmptyState,
  Heading,
  Skeleton,
  Stack,
  Text,
  Icon,
} from "@hydrax/ui";
import emptyHero from "../../../../packages/ui/src/assets/distributor-empty-state.jpg";

interface HomeRouteProps {
  readonly connected?: boolean;
}

interface StatTileProps {
  readonly label: string;
  readonly icon: typeof TrendingUp;
  readonly iconLabel: string;
}

function StatTile({ label, icon, iconLabel }: StatTileProps) {
  return (
    <Card>
      <Stack gap="md">
        <Stack direction="row" gap="sm" align="center">
          <Icon icon={icon} label={iconLabel} size={14} />
          <Text size="bodySm" tone="muted">
            {label}
          </Text>
        </Stack>
        <Text family="mono" tone="strong" style={{ fontSize: "20px" }}>
          --
        </Text>
        <Text size="bodySm" tone="muted">
          No data connected yet.
        </Text>
      </Stack>
    </Card>
  );
}

function ActivitySkeleton() {
  return (
    <Stack gap="md" style={{ padding: "var(--hydrax-space-md)" }}>
      {[0, 1, 2].map((i) => (
        <Stack key={i} direction="row" align="center" gap="md">
          <Skeleton width={32} height={32} radius="md" aria-label="Loading row icon" />
          <Stack gap="xs" style={{ flex: 1 }}>
            <Skeleton width="60%" height={14} aria-label="Loading row title" />
            <Skeleton width="35%" height={12} aria-label="Loading row meta" />
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

export function HomeRoute({ connected = false }: HomeRouteProps) {
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">Home</Heading>
        <Text tone="muted">
          Distributor workspace. Connect an allocation feed to start populating these views.
        </Text>
      </Stack>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--hydrax-space-md)",
        }}
      >
        <StatTile label="Live allocations" icon={Briefcase} iconLabel="Allocations" />
        <StatTile label="Pending subscriptions" icon={FileSignature} iconLabel="Subscriptions" />
        <StatTile label="Settlements this week" icon={Receipt} iconLabel="Settlements" />
      </div>
      <Card title={<Heading level="h2">Recent activity</Heading>}>
        {connected ? (
          <ActivitySkeleton />
        ) : (
          <EmptyState
            icon={Inbox}
            iconLabel="No activity"
            title="No allocation activity yet"
            body="Once an allocation feed is connected, recent investor subscriptions and settlement events will appear here."
            imageSrc={emptyHero}
            imageAlt="Illustration of an empty distribution dashboard"
          />
        )}
      </Card>
    </Stack>
  );
}
```

- [ ] **Step 5: Create routes/HomeRoute.test.tsx**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell } from "@hydrax/ui";
import { HomeRoute } from "./HomeRoute";

function renderInShell(ui: React.ReactNode) {
  return render(
    <ThemeProvider theme={DEFAULT_TENANT_THEME}>
      <AppShell appName="distributor-portal">{ui}</AppShell>
    </ThemeProvider>,
  );
}

describe("<HomeRoute> (distributor-portal)", () => {
  it("renders the Home heading and the distributor intro", () => {
    renderInShell(<HomeRoute />);
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByText(/Distributor workspace/i)).toBeInTheDocument();
  });

  it("renders three stat tiles with placeholder dashes", () => {
    renderInShell(<HomeRoute />);
    expect(screen.getByText("Live allocations")).toBeInTheDocument();
    expect(screen.getByText("Pending subscriptions")).toBeInTheDocument();
    expect(screen.getByText("Settlements this week")).toBeInTheDocument();
    expect(screen.getAllByText("--").length).toBeGreaterThanOrEqual(3);
  });

  it("renders the empty state when not connected", () => {
    renderInShell(<HomeRoute />);
    expect(screen.getByText("No allocation activity yet")).toBeInTheDocument();
    expect(
      screen.getByAltText("Illustration of an empty distribution dashboard"),
    ).toBeInTheDocument();
  });

  it("renders the loading skeleton when connected", () => {
    renderInShell(<HomeRoute connected />);
    expect(screen.queryByText("No allocation activity yet")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/Loading/).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: Modify App.tsx**

```tsx
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell } from "@hydrax/ui";
import { DistributorSidebar, DistributorBrand } from "./components/DistributorSidebar";
import { DistributorTopBar } from "./components/DistributorTopBar";
import { HomeRoute } from "./routes/HomeRoute";

const store = configureStore({
  reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
  middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
});

function ShellContents() {
  const location = useLocation();
  return (
    <AppShell
      appName="distributor-portal"
      brand={<DistributorBrand />}
      sidebar={<DistributorSidebar currentPath={location.pathname} />}
      topbar={<DistributorTopBar userName="Distributor Operator" />}
    >
      <Routes>
        <Route path="/" element={<HomeRoute />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
}
```

- [ ] **Step 7: Modify App.test.tsx**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("<App> (distributor-portal)", () => {
  it("renders the AppShell with brand, topbar, and sidebar", () => {
    render(<App />);
    expect(screen.getByText("Distributor Portal")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders the polished Home route at /", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(screen.getByText("Live allocations")).toBeInTheDocument();
  });

  it("applies the distributor-portal data-app-name", () => {
    render(<App />);
    const root = screen.getByRole("main").parentElement;
    expect(root?.getAttribute("data-app-name")).toBe("distributor-portal");
  });

  it("renders the empty state hero by default", () => {
    render(<App />);
    expect(
      screen.getByAltText("Illustration of an empty distribution dashboard"),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run app gates**

```bash
cd web && pnpm --filter @hydrax/distributor-portal typecheck
pnpm --filter @hydrax/distributor-portal test -- --run
pnpm --filter @hydrax/distributor-portal build
```

Expected: typecheck clean; 8 tests pass (4 App + 4 HomeRoute); build emits dist/ with the hero JPEG bundled.

- [ ] **Step 9: Commit Task 1**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git add web/apps/distributor-portal/
git commit -m "feat(web/distributor-portal): polished Home with NAV, stat tiles, empty state"
```

---

## Task 2: Ops Console polish (subagent B — parallelizable with Tasks 1 & 3)

**Files (mirror Task 1 structure under `web/apps/ops-console/`):**
- Modify: `App.tsx`, `App.test.tsx`
- Create: `components/OpsSidebar.tsx`, `components/OpsTopBar.tsx`, `routes/HomeRoute.tsx`, `routes/HomeRoute.test.tsx`, `img.d.ts`

**Portal-specific values:**

| Field | Value |
|---|---|
| App name | `ops-console` |
| Brand icon (lucide) | `Settings` |
| Brand label | `Ops Console` |
| NAV items | Home `/` `LayoutDashboard`, Workflows `/workflows` `Workflow`, SLAs `/slas` `Timer`, Incidents `/incidents` `AlertTriangle`, Health `/health` `Activity`, Audit `/audit` `History`, Settings `/settings` `Settings` |
| Intro copy | `"Operations console. Connect a workflow stream to start populating these views."` |
| Stat tiles | `("Active workflows", Workflow, "Workflows")`, `("SLAs at risk", Timer, "SLAs")`, `("Open incidents", AlertTriangle, "Incidents")` |
| EmptyState title | `"No operational events yet"` |
| EmptyState body | `"Once a workflow stream is connected, recent SLA, incident, and approval events will appear here."` |
| EmptyState imageSrc | `../../../../packages/ui/src/assets/ops-console-empty-state.jpg` |
| EmptyState imageAlt | `"Illustration of an empty operations console"` |
| Avatar userName placeholder | `"Ops Operator"` |
| Search placeholder | `"Search workflows, SLAs, incidents…"` |
| Sidebar function name | `OpsSidebar` |
| Brand function name | `OpsBrand` |
| Topbar function name | `OpsTopBar` |
| Sidebar component file | `OpsSidebar.tsx` (exports both `OpsSidebar` and `OpsBrand`) |
| Topbar component file | `OpsTopBar.tsx` (exports `OpsTopBar`) |
| Home test description | `"<HomeRoute> (ops-console)"` |
| App test description | `"<App> (ops-console)"` |

**Substitution rule:** Every literal that appears in Task 1's code snippets — `Distributor`, `distributor-portal`, `Distributor Portal`, `DP`, `Network`, `distributor-empty-state.jpg`, NAV array, stat tiles, intro, empty-state copy, alt text — gets substituted using the table above. The structural shape of every file is identical to Task 1.

- [ ] **Step 1–7: Apply Task 1 steps 1–7 with the substitutions above.**

Every literal that needs substitution is named in the table. There are exactly seven substitution axes: App name, Brand (icon + label + initials), NAV array, intro copy, stat tiles, EmptyState (title + body + imageSrc + imageAlt), search placeholder. Apply all seven. Do not leave any "Distributor" or "distributor" string in the ops-console files.

- [ ] **Step 8: Run gates**

```bash
cd web && pnpm --filter @hydrax/ops-console typecheck
pnpm --filter @hydrax/ops-console test -- --run
pnpm --filter @hydrax/ops-console build
```

Expected: typecheck clean; 8 tests pass; build clean.

- [ ] **Step 9: Commit Task 2**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git add web/apps/ops-console/
git commit -m "feat(web/ops-console): polished Home with NAV, stat tiles, empty state"
```

---

## Task 3: Admin polish (subagent C — parallelizable with Tasks 1 & 2)

**Files (mirror Task 1 under `web/apps/admin/`):**
- Modify: `App.tsx`, `App.test.tsx`
- Create: `components/AdminSidebar.tsx`, `components/AdminTopBar.tsx`, `routes/HomeRoute.tsx`, `routes/HomeRoute.test.tsx`, `img.d.ts`

**Portal-specific values:**

| Field | Value |
|---|---|
| App name | `admin` |
| Brand icon (lucide) | `ShieldCheck` |
| Brand label | `Admin` |
| NAV items | Home `/` `LayoutDashboard`, Tenants `/tenants` `Building2`, Users `/users` `Users`, Roles `/roles` `KeyRound`, Audit log `/audit` `ScrollText`, Integrations `/integrations` `Plug`, Settings `/settings` `Settings` |
| Intro copy | `"Platform administration. Connect a tenant directory to start populating these views."` |
| Stat tiles | `("Active tenants", Building2, "Tenants")`, `("Users at risk", KeyRound, "Roles")`, `("Audit events today", ScrollText, "Audit")` |
| EmptyState title | `"No administrative events yet"` |
| EmptyState body | `"Once a tenant directory is connected, recent role, audit, and integration events will appear here."` |
| EmptyState imageSrc | `../../../../packages/ui/src/assets/admin-empty-state.jpg` |
| EmptyState imageAlt | `"Illustration of an empty administration console"` |
| Avatar userName placeholder | `"Platform Admin"` |
| Search placeholder | `"Search tenants, users, roles…"` |
| Sidebar function name | `AdminSidebar` |
| Brand function name | `AdminBrand` |
| Topbar function name | `AdminTopBar` |
| Sidebar component file | `AdminSidebar.tsx` |
| Topbar component file | `AdminTopBar.tsx` |
| Home test description | `"<HomeRoute> (admin)"` |
| App test description | `"<App> (admin)"` |

- [ ] **Step 1–7: Apply Task 1 steps 1–7 with the substitutions above.**

- [ ] **Step 8: Run gates**

```bash
cd web && pnpm --filter @hydrax/admin typecheck
pnpm --filter @hydrax/admin test -- --run
pnpm --filter @hydrax/admin build
```

Expected: typecheck clean; 8 tests pass; build clean.

- [ ] **Step 9: Commit Task 3**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git add web/apps/admin/
git commit -m "feat(web/admin): polished Home with NAV, stat tiles, empty state"
```

---

## Task 4: Workspace verification + CLAUDE.md invariants update (main session, sequential, after Tasks 1–3)

**Files:**
- Modify: `CLAUDE.md`
- Modify: `STATE.yaml` — append verification_log entry

- [ ] **Step 1: Run the full web verification matrix**

```bash
cd web && pnpm -r --if-present typecheck
pnpm -r --if-present test -- --run
pnpm -r --if-present build
```

Expected: 11/11 typecheck clean; all tests pass (issuer 8, distributor 8, investor 5, ops 8, admin 8 + packages); 5 apps build dist/.

- [ ] **Step 2: Append the new portal heroes to CLAUDE.md "Web Monorepo — Invariants"**

Append a single bullet under the existing "Hero / empty-state imagery" bullet:

```markdown
- Hero asset inventory (visual-polish + portal-polish, 2026-04-25): `issuer-empty-state.jpg`, `distributor-empty-state.jpg`, `ops-console-empty-state.jpg`, `admin-empty-state.jpg`. Each has a metadata entry in `assets-meta.json` with prompt + model + dimensions. The five-app polished baseline is now uniform — distributor-portal, ops-console, and admin each ship a Sidebar (NavItem-driven), TopBar (search + notifications + Avatar), and HomeRoute (Heading + intro + 3 stat tiles + EmptyState backed by their hero JPEG) matching the issuer-portal pattern.
```

- [ ] **Step 3: Append STATE.yaml verification_log entry**

Format: `2026-04-25 — portal-polish: 3 portals (distributor, ops-console, admin) polished to issuer parity; 4 commits (1 hero batch + 3 portal apps); pnpm typecheck/test/build all green; 5 apps now uniform`

- [ ] **Step 4: Commit Task 4**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
git add CLAUDE.md STATE.yaml
git commit -m "docs(claude.md,state): record portal-polish completion + hero asset inventory"
```

---

## Out of Scope

- Real per-portal routes beyond `/` (Allocations, Tenants, Audit, etc. remain non-route NAV stubs).
- Per-tenant theme overrides (DEFAULT_TENANT_THEME everywhere).
- Live data wiring (gated on PRD §14 Q1 — HydraX rails surface).
- Light theme.
- i18n.

## Verification Log (worktree-local; migrate to STATE.yaml at merge)

(Appended task-by-task by the executing agent.)
