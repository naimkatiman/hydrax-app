# Web Monorepo Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the empty `web/` tree as a runnable pnpm workspace — three shared packages (`tenant-theme`, `ui`, `api-client`) and five role-aware apps (`issuer-portal`, `distributor-portal`, `investor-portal`, `ops-console`, `admin`) — each producing a buildable, type-checked, testable shell that renders an `AppShell` and a tenant-themed home route. No domain logic, no real backend.

**Architecture:** pnpm workspace at the repo root. Three shared packages compiled with `tsc` and consumed via workspace protocol. Each app is a Vite 5 + React 18 + Redux Toolkit + react-router-dom v6 SPA. Tenant theming is CSS variables injected by a `<ThemeProvider>`. UI primitives wrap `lucide-react` icons. `api-client` exposes one RTK Query stub (`getHealth`) targeting an env-driven BFF URL — the BFF is mocked in tests, no live endpoint required for the scaffold to ship.

**Tech Stack:** pnpm 9, Node 20, TypeScript 5.4, Vite 5, React 18, @reduxjs/toolkit, react-redux, react-router-dom 6, lucide-react, vitest, @testing-library/react, jsdom.

---

## Boundary Conditions (read before starting)

1. **PRD §14 gates are still open.** This plan ships **structure only** — no tenant assumptions, no product types, no real HydraX rails calls. Anything that would prejudice a Q1–Q7 decision belongs in a later plan. If a step here looks like it's making a domain decision, stop and escalate.
2. **Prototype stays untouched.** [index.html](../../index.html), [app.js](../../app.js), [styles.css](../../styles.css) at the repo root are the live Railway prototype. No edits to those three files in this plan. Verification audits in [CLAUDE.md](../../CLAUDE.md) for the prototype still apply when the prototype is touched in a separate slice.
3. **One concern per commit, ≤15 files.** Each phase below is one commit. If a phase grows past 15 files, split by file role (config → source → tests).
4. **No domain code.** Pages render literal strings ("Issuer Portal — Home") and one lucide icon. No fixtures, no fake data, no API calls beyond the health stub.
5. **No emoji anywhere** (CLAUDE.md). Lucide icons only in UI. Plain text in commits, code, logs.
6. **Skill triggers.** Invoke `superpowers:writing-plans` when this plan changes shape. Invoke `frontend-design` + `taste-skill` when a follow-up plan adds visual polish to `AppShell` or any portal landing. Invoke `nano-banana` when generating background imagery (out of scope for this scaffold). Invoke `design-system` when extending `packages/ui` past primitives.
7. **STATE.yaml gets updated after each phase commits.** `current_focus`, `recently_verified`, `verification_log` all get an entry citing this plan.

## File Structure

After this plan lands the repo will gain:

```
hydrax-app/
  pnpm-workspace.yaml                          # NEW (Phase 0)
  .npmrc                                       # NEW (Phase 0)
  tsconfig.base.json                           # NEW (Phase 0)
  package.json                                 # MODIFIED (Phase 0) — add workspace scripts + devDeps
  .gitignore                                   # MODIFIED (Phase 0) — add web/**/dist, .vite, *.tsbuildinfo
  web/
    packages/
      tenant-theme/
        package.json
        tsconfig.json
        src/index.ts
        src/types.ts
        src/default-theme.ts
        src/applyTheme.ts
        src/applyTheme.test.ts
        src/ThemeProvider.tsx
        src/ThemeProvider.test.tsx
      ui/
        package.json
        tsconfig.json
        src/index.ts
        src/Button.tsx
        src/Button.test.tsx
        src/Card.tsx
        src/Icon.tsx
        src/AppShell.tsx
        src/AppShell.test.tsx
        src/test-setup.ts
        vitest.config.ts
      api-client/
        package.json
        tsconfig.json
        src/index.ts
        src/api.ts
        src/api.test.ts
    apps/
      issuer-portal/
      distributor-portal/
      investor-portal/
      ops-console/
      admin/
        # each app has the same 9-file shape:
        # package.json, tsconfig.json, vite.config.ts, vitest.config.ts,
        # index.html, src/main.tsx, src/App.tsx, src/App.test.tsx, src/test-setup.ts
```

The three packages live together because they change together: a new `ui` primitive often needs a theme variable, which often needs a typed entry in the tenant config, which often needs an API surface. The five apps are siblings because they share zero state — each is a deployable.

## Decision Log (locked before tasks)

These are the boring, proven choices. Do not relitigate during execution.

| Decision | Choice | Why |
|---|---|---|
| Package manager | pnpm 9 | Workspace protocol, no hoist surprises, fast |
| Build tool | Vite 5 | Project default per [CLAUDE.md](../../CLAUDE.md) |
| Test runner | vitest 1.x | Same config as Vite; no Jest split-brain |
| Router | react-router-dom 6 | Stable, small, no SSR yet |
| State | RTK + react-redux | Project default per [CLAUDE.md](../../CLAUDE.md) |
| Server state | RTK Query (`@reduxjs/toolkit/query/react`) | Matches CLAUDE.md "RTK + RTK Query" |
| Icons | `lucide-react` only | Project rule. No emoji. |
| Styles | Plain CSS + CSS variables; no Tailwind | Matches `tenant-theme` design; YAGNI for utility CSS |
| Workspace scopes | `@hydrax/<name>` | Internal-only scope; not published to npm |
| Path aliases | None | Use workspace package names directly |
| ESLint | Deferred | YAGNI; `tsc --noEmit` is the type gate for the scaffold |
| Turbo / Nx | Not used | YAGNI; pnpm `-r` is enough for 5 apps |
| MSW | Deferred | Health stub is mocked with `vi.fn()` for the scaffold |
| Tailwind / shadcn | Deferred | Belongs in a `frontend-design` follow-up plan |

## Verification Gates (every phase)

After every phase, **all** of these must pass before the commit:

1. `pnpm -w typecheck` — clean across the touched workspace(s).
2. `pnpm -w test --run` — all tests green, no `.skip`, no `.only`.
3. `pnpm -w build` — every package and app produces `dist/`.
4. `git diff --stat` — confirms only the files listed for the phase changed (no drive-by edits, no stray formatting).
5. STATE.yaml updated: append `verification_log` entry citing this plan, update `current_focus`, set `recently_verified` to the new state.

If any gate fails, fix the underlying cause. Never `--no-verify`. Never delete a failing test to make the suite pass.

---

## Phase 0: Monorepo Plumbing

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `tsconfig.base.json`
- Modify: `package.json` (root)
- Modify: `.gitignore`
- Create: `web/.gitkeep`

**Goal:** Make the root a pnpm workspace without breaking the existing prototype `start` script.

- [ ] **Step 1: Confirm Node + pnpm versions**

Run:
```bash
node --version
pnpm --version || corepack enable pnpm && corepack prepare pnpm@9.12.0 --activate
pnpm --version
```
Expected: `node` ≥ v20, `pnpm` ≥ 9.0.0. If pnpm is missing and corepack is unavailable, install with `npm i -g pnpm@9` and re-run.

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

Path: `/home/naim/.openclaw/workspace/hydrax-app/pnpm-workspace.yaml`

```yaml
packages:
  - "web/packages/*"
  - "web/apps/*"
```

- [ ] **Step 3: Create `.npmrc`**

Path: `/home/naim/.openclaw/workspace/hydrax-app/.npmrc`

```ini
strict-peer-dependencies=false
auto-install-peers=true
shamefully-hoist=false
```

- [ ] **Step 4: Create `tsconfig.base.json`**

Path: `/home/naim/.openclaw/workspace/hydrax-app/tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "useDefineForClassFields": true
  }
}
```

- [ ] **Step 5: Modify root `package.json` to add workspace scripts**

Replace the entire file at `/home/naim/.openclaw/workspace/hydrax-app/package.json` with:

```json
{
  "name": "hydrax-prototype",
  "version": "0.1.0",
  "private": true,
  "description": "Static HTML/JS/CSS prototype of the HydraX operator console + web monorepo (apps/packages).",
  "scripts": {
    "start": "serve -s . -l tcp://0.0.0.0:${PORT:-3000} --no-clipboard",
    "typecheck": "pnpm -r --if-present typecheck",
    "test": "pnpm -r --if-present test --run",
    "build": "pnpm -r --if-present build",
    "dev": "pnpm -r --parallel --if-present dev"
  },
  "dependencies": {
    "serve": "^14.2.4"
  },
  "devDependencies": {
    "typescript": "5.4.5"
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  }
}
```

- [ ] **Step 6: Append to `.gitignore`**

Append to `/home/naim/.openclaw/workspace/hydrax-app/.gitignore`:

```
# Web monorepo build outputs
web/**/dist/
web/**/.vite/
web/**/coverage/
*.tsbuildinfo
```

- [ ] **Step 7: Create the empty `web/` tree placeholders**

```bash
mkdir -p web/packages web/apps
touch web/.gitkeep
```

- [ ] **Step 8: Install workspace root deps**

Run from repo root:
```bash
pnpm install
```
Expected: `Done in <Xs>`. No errors. A `pnpm-lock.yaml` is generated at the root. The prototype's `node_modules` is now under pnpm management; the existing `package-lock.json` becomes redundant — **delete it** (`git rm package-lock.json`) since pnpm is now the single source of truth.

- [ ] **Step 9: Confirm prototype start script still works**

```bash
pnpm start &
sleep 2
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/
kill %1
```
Expected: prints `200`. Then kill the background server.

- [ ] **Step 10: Commit Phase 0**

```bash
git add pnpm-workspace.yaml .npmrc tsconfig.base.json package.json pnpm-lock.yaml .gitignore web/.gitkeep
git rm package-lock.json
git commit -m "chore(monorepo): convert root to pnpm workspace for web/

Plan: docs/plans/2026-04-25-web-monorepo-scaffold.md (Phase 0)"
```

- [ ] **Step 11: Update STATE.yaml**

Append a `verification_log` entry:
```
- 2026-04-25 — web monorepo Phase 0: pnpm 9 workspace at root; pnpm-workspace.yaml, .npmrc, tsconfig.base.json present; root package.json adds typecheck/test/build/dev workspace scripts; pnpm-lock.yaml generated; package-lock.json removed; pnpm start serves prototype HTTP 200 on :3000; git diff --stat confirms 7 files changed (1 deleted)
```
Update `current_focus` to: `Web monorepo scaffold — Phase 0 monorepo plumbing landed; next is shared packages (tenant-theme, ui, api-client).`

---

## Phase 1: Package — `@hydrax/tenant-theme`

**Files:**
- Create: `web/packages/tenant-theme/package.json`
- Create: `web/packages/tenant-theme/tsconfig.json`
- Create: `web/packages/tenant-theme/src/index.ts`
- Create: `web/packages/tenant-theme/src/types.ts`
- Create: `web/packages/tenant-theme/src/default-theme.ts`
- Create: `web/packages/tenant-theme/src/applyTheme.ts`
- Create: `web/packages/tenant-theme/src/applyTheme.test.ts`
- Create: `web/packages/tenant-theme/src/ThemeProvider.tsx`
- Create: `web/packages/tenant-theme/src/ThemeProvider.test.tsx`
- Create: `web/packages/tenant-theme/src/test-setup.ts`
- Create: `web/packages/tenant-theme/vitest.config.ts`

**Goal:** Typed tenant theme + a `<ThemeProvider>` that injects CSS variables on `:root`. Single default theme (no real tenants exist yet — domain decision deferred).

- [ ] **Step 1: Create `package.json`**

Path: `web/packages/tenant-theme/package.json`

```json
{
  "name": "@hydrax/tenant-theme",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest"
  },
  "peerDependencies": {
    "react": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.4.5",
    "@testing-library/react": "15.0.7",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "jsdom": "24.0.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "typescript": "5.4.5",
    "vitest": "1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

Path: `web/packages/tenant-theme/tsconfig.json`

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": false
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test-setup.ts", "dist"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

Path: `web/packages/tenant-theme/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: false,
    css: false,
  },
});
```

- [ ] **Step 4: Create `src/test-setup.ts`**

Path: `web/packages/tenant-theme/src/test-setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Create `src/types.ts`**

Path: `web/packages/tenant-theme/src/types.ts`

```ts
export interface TenantTheme {
  readonly id: string;
  readonly name: string;
  readonly tokens: TenantThemeTokens;
}

export interface TenantThemeTokens {
  readonly colorBg: string;
  readonly colorSurface: string;
  readonly colorText: string;
  readonly colorTextMuted: string;
  readonly colorBorder: string;
  readonly colorAccent: string;
  readonly colorAccentSoft: string;
  readonly colorDanger: string;
  readonly colorSuccess: string;
  readonly fontSans: string;
  readonly fontMono: string;
  readonly radiusSm: string;
  readonly radiusMd: string;
  readonly radiusLg: string;
  readonly spaceUnit: string;
}
```

- [ ] **Step 6: Create `src/default-theme.ts`**

Path: `web/packages/tenant-theme/src/default-theme.ts`

```ts
import type { TenantTheme } from "./types";

export const DEFAULT_TENANT_THEME: TenantTheme = {
  id: "default",
  name: "HydraX Default",
  tokens: {
    colorBg: "hsl(220, 16%, 8%)",
    colorSurface: "hsl(220, 14%, 12%)",
    colorText: "hsl(220, 12%, 92%)",
    colorTextMuted: "hsl(220, 8%, 64%)",
    colorBorder: "hsl(220, 10%, 22%)",
    colorAccent: "hsl(190, 90%, 55%)",
    colorAccentSoft: "hsla(190, 90%, 55%, 0.12)",
    colorDanger: "hsl(0, 72%, 58%)",
    colorSuccess: "hsl(140, 60%, 50%)",
    fontSans:
      "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    radiusSm: "4px",
    radiusMd: "8px",
    radiusLg: "12px",
    spaceUnit: "4px",
  },
};
```

- [ ] **Step 7: Write the failing test for `applyTheme`**

Path: `web/packages/tenant-theme/src/applyTheme.test.ts`

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { applyTheme } from "./applyTheme";
import { DEFAULT_TENANT_THEME } from "./default-theme";

describe("applyTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-tenant");
  });

  it("writes every token as a --hydrax-* CSS variable on :root", () => {
    applyTheme(DEFAULT_TENANT_THEME);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--hydrax-color-bg")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorBg,
    );
    expect(root.style.getPropertyValue("--hydrax-color-accent")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorAccent,
    );
    expect(root.style.getPropertyValue("--hydrax-font-sans")).toBe(
      DEFAULT_TENANT_THEME.tokens.fontSans,
    );
    expect(root.style.getPropertyValue("--hydrax-radius-md")).toBe(
      DEFAULT_TENANT_THEME.tokens.radiusMd,
    );
  });

  it("stamps data-tenant=<id> on :root for CSS targeting", () => {
    applyTheme({ ...DEFAULT_TENANT_THEME, id: "acme" });
    expect(document.documentElement.getAttribute("data-tenant")).toBe("acme");
  });

  it("clears previously applied tokens when called again", () => {
    applyTheme(DEFAULT_TENANT_THEME);
    applyTheme({
      id: "minimal",
      name: "Minimal",
      tokens: { ...DEFAULT_TENANT_THEME.tokens, colorAccent: "red" },
    });
    expect(document.documentElement.style.getPropertyValue("--hydrax-color-accent")).toBe("red");
    expect(document.documentElement.getAttribute("data-tenant")).toBe("minimal");
  });
});
```

- [ ] **Step 8: Run the test, expect it to fail**

```bash
pnpm --filter @hydrax/tenant-theme test --run
```
Expected: 3 failures, all because `./applyTheme` cannot be resolved.

- [ ] **Step 9: Implement `src/applyTheme.ts`**

Path: `web/packages/tenant-theme/src/applyTheme.ts`

```ts
import type { TenantTheme, TenantThemeTokens } from "./types";

const TOKEN_TO_CSS_VAR: Record<keyof TenantThemeTokens, string> = {
  colorBg: "--hydrax-color-bg",
  colorSurface: "--hydrax-color-surface",
  colorText: "--hydrax-color-text",
  colorTextMuted: "--hydrax-color-text-muted",
  colorBorder: "--hydrax-color-border",
  colorAccent: "--hydrax-color-accent",
  colorAccentSoft: "--hydrax-color-accent-soft",
  colorDanger: "--hydrax-color-danger",
  colorSuccess: "--hydrax-color-success",
  fontSans: "--hydrax-font-sans",
  fontMono: "--hydrax-font-mono",
  radiusSm: "--hydrax-radius-sm",
  radiusMd: "--hydrax-radius-md",
  radiusLg: "--hydrax-radius-lg",
  spaceUnit: "--hydrax-space-unit",
};

export function applyTheme(theme: TenantTheme): void {
  const root = document.documentElement;
  (Object.keys(TOKEN_TO_CSS_VAR) as Array<keyof TenantThemeTokens>).forEach((key) => {
    root.style.setProperty(TOKEN_TO_CSS_VAR[key], theme.tokens[key]);
  });
  root.setAttribute("data-tenant", theme.id);
}
```

- [ ] **Step 10: Run the test, expect it to pass**

```bash
pnpm --filter @hydrax/tenant-theme test --run
```
Expected: 3 passing, 0 failing.

- [ ] **Step 11: Write the failing test for `<ThemeProvider>`**

Path: `web/packages/tenant-theme/src/ThemeProvider.test.tsx`

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { DEFAULT_TENANT_THEME } from "./default-theme";

function ThemeReadout() {
  const theme = useTheme();
  return <span data-testid="tenant-id">{theme.id}</span>;
}

describe("<ThemeProvider>", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-tenant");
  });

  it("applies the theme on mount and exposes it via useTheme()", () => {
    render(
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <ThemeReadout />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("tenant-id").textContent).toBe("default");
    expect(document.documentElement.getAttribute("data-tenant")).toBe("default");
    expect(document.documentElement.style.getPropertyValue("--hydrax-color-bg")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorBg,
    );
  });

  it("re-applies when the theme prop changes", () => {
    const { rerender } = render(
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <ThemeReadout />
      </ThemeProvider>,
    );
    rerender(
      <ThemeProvider theme={{ ...DEFAULT_TENANT_THEME, id: "acme" }}>
        <ThemeReadout />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("tenant-id").textContent).toBe("acme");
    expect(document.documentElement.getAttribute("data-tenant")).toBe("acme");
  });
});
```

- [ ] **Step 12: Run the test, expect it to fail**

```bash
pnpm --filter @hydrax/tenant-theme test --run
```
Expected: failures resolving `./ThemeProvider`.

- [ ] **Step 13: Implement `src/ThemeProvider.tsx`**

Path: `web/packages/tenant-theme/src/ThemeProvider.tsx`

```tsx
import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { TenantTheme } from "./types";
import { applyTheme } from "./applyTheme";

const ThemeContext = createContext<TenantTheme | null>(null);

interface ThemeProviderProps {
  readonly theme: TenantTheme;
  readonly children: ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): TenantTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme() must be used inside <ThemeProvider>");
  }
  return ctx;
}
```

- [ ] **Step 14: Create `src/index.ts`**

Path: `web/packages/tenant-theme/src/index.ts`

```ts
export type { TenantTheme, TenantThemeTokens } from "./types";
export { DEFAULT_TENANT_THEME } from "./default-theme";
export { applyTheme } from "./applyTheme";
export { ThemeProvider, useTheme } from "./ThemeProvider";
```

- [ ] **Step 15: Install package deps and run all gates**

From repo root:
```bash
pnpm install
pnpm --filter @hydrax/tenant-theme typecheck
pnpm --filter @hydrax/tenant-theme test --run
pnpm --filter @hydrax/tenant-theme build
ls web/packages/tenant-theme/dist
```
Expected: typecheck clean. 5 tests pass. `dist/` contains `index.js`, `index.d.ts`, plus the per-source artifacts.

- [ ] **Step 16: Commit Phase 1**

```bash
git add pnpm-lock.yaml web/packages/tenant-theme
git commit -m "feat(web/tenant-theme): add typed tenant theme with ThemeProvider

Plan: docs/plans/2026-04-25-web-monorepo-scaffold.md (Phase 1)"
```

- [ ] **Step 17: Update STATE.yaml**

Append:
```
- 2026-04-25 — web monorepo Phase 1: @hydrax/tenant-theme scaffolded; TenantTheme/TenantThemeTokens types; DEFAULT_TENANT_THEME constant; applyTheme() writes 15 --hydrax-* CSS vars + data-tenant attr; <ThemeProvider> with useTheme(); 5 tests pass; tsc build emits dist/{index.js,index.d.ts}; git diff --stat confirms 11 files changed
```

---

## Phase 2: Package — `@hydrax/ui`

**Files:**
- Create: `web/packages/ui/package.json`
- Create: `web/packages/ui/tsconfig.json`
- Create: `web/packages/ui/vitest.config.ts`
- Create: `web/packages/ui/src/test-setup.ts`
- Create: `web/packages/ui/src/index.ts`
- Create: `web/packages/ui/src/Icon.tsx`
- Create: `web/packages/ui/src/Button.tsx`
- Create: `web/packages/ui/src/Button.test.tsx`
- Create: `web/packages/ui/src/Card.tsx`
- Create: `web/packages/ui/src/AppShell.tsx`
- Create: `web/packages/ui/src/AppShell.test.tsx`

**Goal:** Minimal primitive component library: `Icon` (lucide wrapper enforcing the no-emoji rule), `Button`, `Card`, and an `AppShell` layout with a sidebar slot, topbar slot, and main slot. No styles beyond inline styles consuming `--hydrax-*` CSS vars — visual polish is a follow-up plan invoked under `frontend-design` + `taste-skill`.

- [ ] **Step 1: Create `package.json`**

Path: `web/packages/ui/package.json`

```json
{
  "name": "@hydrax/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest"
  },
  "peerDependencies": {
    "react": "^18.3.1"
  },
  "dependencies": {
    "lucide-react": "0.378.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.4.5",
    "@testing-library/react": "15.0.7",
    "@testing-library/user-event": "14.5.2",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "jsdom": "24.0.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "typescript": "5.4.5",
    "vitest": "1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

Path: `web/packages/ui/tsconfig.json`

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test-setup.ts", "dist"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

Path: `web/packages/ui/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: false,
    css: false,
  },
});
```

- [ ] **Step 4: Create `src/test-setup.ts`**

Path: `web/packages/ui/src/test-setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Create `src/Icon.tsx`**

Path: `web/packages/ui/src/Icon.tsx`

```tsx
import { type LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

interface IconProps extends Omit<ComponentProps<LucideIcon>, "ref"> {
  readonly icon: LucideIcon;
  readonly label: string;
}

export function Icon({ icon: LucideIconComponent, label, size = 16, ...rest }: IconProps) {
  return <LucideIconComponent aria-label={label} role="img" size={size} {...rest} />;
}
```

- [ ] **Step 6: Write the failing test for `<Button>`**

Path: `web/packages/ui/src/Button.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("<Button>", () => {
  it("renders its children and forwards onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Submit</Button>);
    const btn = screen.getByRole("button", { name: "Submit" });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("supports a 'primary' and 'secondary' variant via data-variant attr", () => {
    const { rerender } = render(<Button variant="primary">A</Button>);
    expect(screen.getByRole("button").getAttribute("data-variant")).toBe("primary");
    rerender(<Button variant="secondary">A</Button>);
    expect(screen.getByRole("button").getAttribute("data-variant")).toBe("secondary");
  });

  it("disables interaction when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Nope
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run the test, expect it to fail**

```bash
pnpm --filter @hydrax/ui test --run
```
Expected: failures resolving `./Button`.

- [ ] **Step 8: Implement `src/Button.tsx`**

Path: `web/packages/ui/src/Button.tsx`

```tsx
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
}

const VARIANT_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--hydrax-color-accent)",
    color: "var(--hydrax-color-bg)",
    border: "1px solid var(--hydrax-color-accent)",
  },
  secondary: {
    background: "transparent",
    color: "var(--hydrax-color-text)",
    border: "1px solid var(--hydrax-color-border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--hydrax-color-text-muted)",
    border: "1px solid transparent",
  },
};

export function Button({
  variant = "primary",
  type = "button",
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      style={{
        padding: "8px 14px",
        borderRadius: "var(--hydrax-radius-md)",
        fontFamily: "var(--hydrax-font-sans)",
        fontSize: 14,
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.5 : 1,
        ...VARIANT_STYLE[variant],
        ...style,
      }}
      {...rest}
    />
  );
}
```

- [ ] **Step 9: Run the test, expect it to pass**

```bash
pnpm --filter @hydrax/ui test --run
```
Expected: 3 passing.

- [ ] **Step 10: Implement `src/Card.tsx`**

Path: `web/packages/ui/src/Card.tsx`

```tsx
import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLElement> {
  readonly title?: ReactNode;
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
}

export function Card({ title, footer, children, style, ...rest }: CardProps) {
  return (
    <section
      style={{
        background: "var(--hydrax-color-surface)",
        color: "var(--hydrax-color-text)",
        border: "1px solid var(--hydrax-color-border)",
        borderRadius: "var(--hydrax-radius-md)",
        padding: 16,
        fontFamily: "var(--hydrax-font-sans)",
        ...style,
      }}
      {...rest}
    >
      {title ? (
        <header style={{ marginBottom: 12, fontWeight: 600 }}>{title}</header>
      ) : null}
      <div>{children}</div>
      {footer ? (
        <footer style={{ marginTop: 12, color: "var(--hydrax-color-text-muted)" }}>
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 11: Write the failing test for `<AppShell>`**

Path: `web/packages/ui/src/AppShell.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

describe("<AppShell>", () => {
  it("renders sidebar, topbar, and main regions with provided children", () => {
    render(
      <AppShell
        sidebar={<nav data-testid="sb">SB</nav>}
        topbar={<header data-testid="tb">TB</header>}
      >
        <p data-testid="content">hello</p>
      </AppShell>,
    );
    expect(screen.getByTestId("sb")).toBeInTheDocument();
    expect(screen.getByTestId("tb")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("applies the application name to the document via data-app-name", () => {
    render(<AppShell appName="issuer-portal">x</AppShell>);
    expect(screen.getByRole("main").parentElement?.getAttribute("data-app-name")).toBe(
      "issuer-portal",
    );
  });
});
```

- [ ] **Step 12: Run the test, expect it to fail**

```bash
pnpm --filter @hydrax/ui test --run
```
Expected: 2 new failures resolving `./AppShell`.

- [ ] **Step 13: Implement `src/AppShell.tsx`**

Path: `web/packages/ui/src/AppShell.tsx`

```tsx
import type { ReactNode } from "react";

interface AppShellProps {
  readonly appName: string;
  readonly sidebar?: ReactNode;
  readonly topbar?: ReactNode;
  readonly children: ReactNode;
}

export function AppShell({ appName, sidebar, topbar, children }: AppShellProps) {
  return (
    <div
      data-app-name={appName}
      style={{
        minHeight: "100vh",
        background: "var(--hydrax-color-bg)",
        color: "var(--hydrax-color-text)",
        fontFamily: "var(--hydrax-font-sans)",
        display: "grid",
        gridTemplateColumns: sidebar ? "240px 1fr" : "1fr",
        gridTemplateRows: topbar ? "56px 1fr" : "1fr",
        gridTemplateAreas: sidebar
          ? topbar
            ? `"sidebar topbar" "sidebar main"`
            : `"sidebar main"`
          : topbar
            ? `"topbar" "main"`
            : `"main"`,
      }}
    >
      {sidebar ? (
        <aside
          style={{
            gridArea: "sidebar",
            borderRight: "1px solid var(--hydrax-color-border)",
            padding: 16,
          }}
        >
          {sidebar}
        </aside>
      ) : null}
      {topbar ? (
        <div
          style={{
            gridArea: "topbar",
            borderBottom: "1px solid var(--hydrax-color-border)",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
          }}
        >
          {topbar}
        </div>
      ) : null}
      <main style={{ gridArea: "main", padding: 24 }}>{children}</main>
    </div>
  );
}
```

- [ ] **Step 14: Create `src/index.ts`**

Path: `web/packages/ui/src/index.ts`

```ts
export { Icon } from "./Icon";
export { Button } from "./Button";
export { Card } from "./Card";
export { AppShell } from "./AppShell";
```

- [ ] **Step 15: Install + run all gates**

```bash
pnpm install
pnpm --filter @hydrax/ui typecheck
pnpm --filter @hydrax/ui test --run
pnpm --filter @hydrax/ui build
ls web/packages/ui/dist
```
Expected: typecheck clean. 5 tests pass. `dist/` populated.

- [ ] **Step 16: Commit Phase 2**

```bash
git add pnpm-lock.yaml web/packages/ui
git commit -m "feat(web/ui): add Icon/Button/Card/AppShell primitives

Plan: docs/plans/2026-04-25-web-monorepo-scaffold.md (Phase 2)"
```

- [ ] **Step 17: Update STATE.yaml**

Append:
```
- 2026-04-25 — web monorepo Phase 2: @hydrax/ui scaffolded; Icon (lucide wrapper requiring aria-label), Button (primary/secondary/ghost), Card, AppShell with sidebar/topbar/main grid; 5 tests pass; tsc build emits dist/; git diff --stat confirms 11 files changed
```

---

## Phase 3: Package — `@hydrax/api-client`

**Files:**
- Create: `web/packages/api-client/package.json`
- Create: `web/packages/api-client/tsconfig.json`
- Create: `web/packages/api-client/vitest.config.ts`
- Create: `web/packages/api-client/src/index.ts`
- Create: `web/packages/api-client/src/api.ts`
- Create: `web/packages/api-client/src/api.test.ts`

**Goal:** RTK Query base with one stub endpoint (`getHealth`) so apps can wire `<Provider store>` and `useGetHealthQuery()` and prove the plumbing without a live BFF. Endpoint definitions for real domains land in a follow-up plan once §14 Q1 is resolved.

- [ ] **Step 1: Create `package.json`**

Path: `web/packages/api-client/package.json`

```json
{
  "name": "@hydrax/api-client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest"
  },
  "peerDependencies": {
    "react": "^18.3.1",
    "react-redux": "^9.1.2"
  },
  "dependencies": {
    "@reduxjs/toolkit": "2.2.5"
  },
  "devDependencies": {
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-redux": "9.1.2",
    "typescript": "5.4.5",
    "vitest": "1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

Path: `web/packages/api-client/tsconfig.json`

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts", "dist"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

Path: `web/packages/api-client/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
  },
});
```

- [ ] **Step 4: Write the failing test**

Path: `web/packages/api-client/src/api.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { hydraxApi } from "./api";

describe("hydraxApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes a reducer mounted at the configured reducerPath", () => {
    expect(hydraxApi.reducerPath).toBe("hydraxApi");
    expect(typeof hydraxApi.reducer).toBe("function");
  });

  it("getHealth resolves with { ok: true } when the BFF returns one", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const store = configureStore({
      reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
      middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
    });

    const result = await store.dispatch(hydraxApi.endpoints.getHealth.initiate());
    expect(result.data).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5: Run, expect failure**

```bash
pnpm --filter @hydrax/api-client test --run
```
Expected: failure resolving `./api`.

- [ ] **Step 6: Implement `src/api.ts`**

Path: `web/packages/api-client/src/api.ts`

```ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export interface HealthResponse {
  readonly ok: boolean;
}

const BFF_URL =
  (typeof process !== "undefined" && process.env.VITE_BFF_URL) ||
  "http://localhost:8080";

export const hydraxApi = createApi({
  reducerPath: "hydraxApi",
  baseQuery: fetchBaseQuery({ baseUrl: BFF_URL }),
  endpoints: (builder) => ({
    getHealth: builder.query<HealthResponse, void>({
      query: () => "/health",
    }),
  }),
});

export const { useGetHealthQuery } = hydraxApi;
```

- [ ] **Step 7: Create `src/index.ts`**

Path: `web/packages/api-client/src/index.ts`

```ts
export { hydraxApi, useGetHealthQuery } from "./api";
export type { HealthResponse } from "./api";
```

- [ ] **Step 8: Install + run all gates**

```bash
pnpm install
pnpm --filter @hydrax/api-client typecheck
pnpm --filter @hydrax/api-client test --run
pnpm --filter @hydrax/api-client build
```
Expected: typecheck clean. 2 tests pass. `dist/` populated.

- [ ] **Step 9: Document the new env var**

Modify `/home/naim/.openclaw/workspace/hydrax-app/docs/env.md`. Replace the "(None yet …)" line with:

```md
## Environment variables

### `VITE_BFF_URL`

- Used by: `web/packages/api-client` (reads via `import.meta.env` in apps; falls back to `process.env.VITE_BFF_URL` in tests).
- Default: `http://localhost:8080` when unset.
- Where set: each `web/apps/*/.env.local` for development, Railway service env for staging/prod.
- Why: api-client's `fetchBaseQuery` baseUrl. Apps consume RTK Query hooks; no other surface reads this var.
```

- [ ] **Step 10: Commit Phase 3**

```bash
git add pnpm-lock.yaml web/packages/api-client docs/env.md
git commit -m "feat(web/api-client): add RTK Query base with health stub

Plan: docs/plans/2026-04-25-web-monorepo-scaffold.md (Phase 3)"
```

- [ ] **Step 11: Update STATE.yaml**

Append:
```
- 2026-04-25 — web monorepo Phase 3: @hydrax/api-client scaffolded; createApi reducerPath=hydraxApi; getHealth endpoint hits VITE_BFF_URL/health (default localhost:8080); useGetHealthQuery exported; 2 tests pass with mocked fetch; docs/env.md documents VITE_BFF_URL; git diff --stat confirms 7 files changed
```

---

## Phase 4: App — `@hydrax/issuer-portal`

**Files (per app — every Phase 4 through 8 follows this exact shape):**
- Create: `web/apps/issuer-portal/package.json`
- Create: `web/apps/issuer-portal/tsconfig.json`
- Create: `web/apps/issuer-portal/vite.config.ts`
- Create: `web/apps/issuer-portal/vitest.config.ts`
- Create: `web/apps/issuer-portal/index.html`
- Create: `web/apps/issuer-portal/src/main.tsx`
- Create: `web/apps/issuer-portal/src/App.tsx`
- Create: `web/apps/issuer-portal/src/App.test.tsx`
- Create: `web/apps/issuer-portal/src/test-setup.ts`

**Goal:** Buildable, type-checked, testable Vite SPA that mounts `<Provider store>`, `<ThemeProvider>`, `<BrowserRouter>`, and an `<AppShell>` with one home route. Issuer-portal first because PRD §23 names it as the primary v1 wedge persona — the shape locked in here is the reference template for the remaining four apps.

- [ ] **Step 1: Create `package.json`**

Path: `web/apps/issuer-portal/package.json`

```json
{
  "name": "@hydrax/issuer-portal",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest"
  },
  "dependencies": {
    "@hydrax/api-client": "workspace:*",
    "@hydrax/tenant-theme": "workspace:*",
    "@hydrax/ui": "workspace:*",
    "@reduxjs/toolkit": "2.2.5",
    "lucide-react": "0.378.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-redux": "9.1.2",
    "react-router-dom": "6.23.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.4.5",
    "@testing-library/react": "15.0.7",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "@vitejs/plugin-react": "4.3.0",
    "jsdom": "24.0.0",
    "typescript": "5.4.5",
    "vite": "5.2.11",
    "vitest": "1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

Path: `web/apps/issuer-portal/tsconfig.json`

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": ".",
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

Path: `web/apps/issuer-portal/vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: { outDir: "dist", sourcemap: true },
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

Path: `web/apps/issuer-portal/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: false,
    css: false,
  },
});
```

- [ ] **Step 5: Create `index.html`**

Path: `web/apps/issuer-portal/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HydraX — Issuer Portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/test-setup.ts`**

Path: `web/apps/issuer-portal/src/test-setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 7: Write the failing test**

Path: `web/apps/issuer-portal/src/App.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("<App> (issuer-portal)", () => {
  it("renders the AppShell with the portal name and the home heading", () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText("Issuer Portal")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /home/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("stamps data-app-name='issuer-portal' on the AppShell wrapper", () => {
    const { container } = render(<App />);
    expect(container.querySelector("[data-app-name='issuer-portal']")).not.toBeNull();
  });
});
```

- [ ] **Step 8: Run, expect failure**

```bash
pnpm --filter @hydrax/issuer-portal test --run
```
Expected: failure resolving `./App`.

- [ ] **Step 9: Implement `src/App.tsx`**

Path: `web/apps/issuer-portal/src/App.tsx`

```tsx
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Building2, Home as HomeIcon } from "lucide-react";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell, Card, Icon } from "@hydrax/ui";

const store = configureStore({
  reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
  middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
});

function HomeRoute() {
  return (
    <Card title={<h1 style={{ margin: 0, fontSize: 20 }}>Home</h1>}>
      <p>Issuer Portal scaffold. Real home content lands in a follow-up plan.</p>
    </Card>
  );
}

export function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <BrowserRouter>
          <AppShell
            appName="issuer-portal"
            topbar={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Icon icon={Building2} label="Issuer Portal logo" size={18} />
                Issuer Portal
              </span>
            }
            sidebar={
              <nav>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Icon icon={HomeIcon} label="Home" size={16} />
                  Home
                </span>
              </nav>
            }
          >
            <Routes>
              <Route path="/" element={<HomeRoute />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
}
```

- [ ] **Step 10: Implement `src/main.tsx`**

Path: `web/apps/issuer-portal/src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root not found in index.html");
}
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 11: Install, run gates, smoke-test the build**

```bash
pnpm install
pnpm --filter @hydrax/issuer-portal typecheck
pnpm --filter @hydrax/issuer-portal test --run
pnpm --filter @hydrax/issuer-portal build
ls web/apps/issuer-portal/dist
```
Expected: typecheck clean. 2 tests pass. `dist/index.html` + `dist/assets/*.js` exist.

- [ ] **Step 12: Manual dev-server smoke test**

```bash
pnpm --filter @hydrax/issuer-portal dev &
sleep 3
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:5173/
kill %1
```
Expected: prints `200`.

- [ ] **Step 13: Commit Phase 4**

```bash
git add pnpm-lock.yaml web/apps/issuer-portal
git commit -m "feat(web/issuer-portal): scaffold Vite+RTK+router shell

Plan: docs/plans/2026-04-25-web-monorepo-scaffold.md (Phase 4)"
```

- [ ] **Step 14: Update STATE.yaml**

Append:
```
- 2026-04-25 — web monorepo Phase 4: @hydrax/issuer-portal scaffolded; Vite 5 + React 18 + RTK store wiring hydraxApi reducer/middleware; ThemeProvider with DEFAULT_TENANT_THEME; BrowserRouter with /; AppShell shows "Issuer Portal" topbar and Home sidebar entry (lucide Building2 + Home icons); 2 tests pass; vite build emits dist/index.html + dist/assets/*; dev server HTTP 200 on :5173; git diff --stat confirms 9 files changed
```

---

## Phase 5: App — `@hydrax/distributor-portal`

**Files:** Same 9-file shape as Phase 4, replacing `issuer-portal` with `distributor-portal`.

- [ ] **Step 1: Create `package.json`**

Path: `web/apps/distributor-portal/package.json`. Identical to Phase 4 Step 1's `package.json` except:
- `"name": "@hydrax/distributor-portal"`

- [ ] **Step 2: Create `tsconfig.json`**

Path: `web/apps/distributor-portal/tsconfig.json`. Byte-identical to Phase 4 Step 2.

- [ ] **Step 3: Create `vite.config.ts`**

Path: `web/apps/distributor-portal/vite.config.ts`. Identical to Phase 4 Step 3 except `port: 5174`.

- [ ] **Step 4: Create `vitest.config.ts`**

Path: `web/apps/distributor-portal/vitest.config.ts`. Byte-identical to Phase 4 Step 4.

- [ ] **Step 5: Create `index.html`**

Path: `web/apps/distributor-portal/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HydraX — Distributor Portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/test-setup.ts`**

Path: `web/apps/distributor-portal/src/test-setup.ts`. Byte-identical to Phase 4 Step 6.

- [ ] **Step 7: Write the failing test**

Path: `web/apps/distributor-portal/src/App.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("<App> (distributor-portal)", () => {
  it("renders the AppShell with the portal name and the home heading", () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText("Distributor Portal")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /home/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("stamps data-app-name='distributor-portal' on the AppShell wrapper", () => {
    const { container } = render(<App />);
    expect(container.querySelector("[data-app-name='distributor-portal']")).not.toBeNull();
  });
});
```

- [ ] **Step 8: Run, expect failure**

```bash
pnpm --filter @hydrax/distributor-portal test --run
```

- [ ] **Step 9: Implement `src/App.tsx`**

Path: `web/apps/distributor-portal/src/App.tsx`. Identical to Phase 4 Step 9 except:
- Replace `appName="issuer-portal"` with `appName="distributor-portal"`.
- Replace topbar text `Issuer Portal` with `Distributor Portal`.
- Replace topbar icon import `Building2` with `Network` (still from lucide-react).
- Replace icon `label="Issuer Portal logo"` with `label="Distributor Portal logo"`.
- Card body text: `Distributor Portal scaffold. Real home content lands in a follow-up plan.`

- [ ] **Step 10: Implement `src/main.tsx`**

Path: `web/apps/distributor-portal/src/main.tsx`. Byte-identical to Phase 4 Step 10.

- [ ] **Step 11: Install + run all gates**

```bash
pnpm install
pnpm --filter @hydrax/distributor-portal typecheck
pnpm --filter @hydrax/distributor-portal test --run
pnpm --filter @hydrax/distributor-portal build
```
Expected: typecheck clean. 2 tests pass. `dist/` populated.

- [ ] **Step 12: Commit Phase 5**

```bash
git add pnpm-lock.yaml web/apps/distributor-portal
git commit -m "feat(web/distributor-portal): scaffold Vite+RTK+router shell

Plan: docs/plans/2026-04-25-web-monorepo-scaffold.md (Phase 5)"
```

- [ ] **Step 13: Update STATE.yaml**

Append:
```
- 2026-04-25 — web monorepo Phase 5: @hydrax/distributor-portal scaffolded (port 5174); same shape as issuer-portal; lucide Network topbar icon; 2 tests pass; vite build emits dist/; git diff --stat confirms 9 files changed
```

---

## Phase 6: App — `@hydrax/investor-portal`

Same 9-file shape and steps as Phase 5, with these substitutions:

- App name: `investor-portal`
- `package.json` → `"name": "@hydrax/investor-portal"`
- `vite.config.ts` → `port: 5175`
- `index.html` → `<title>HydraX — Investor Portal</title>`
- `App.tsx` topbar text: `Investor Portal`; topbar icon: `Wallet` from `lucide-react`; icon label `Investor Portal logo`; `appName="investor-portal"`; Card body: `Investor Portal scaffold. Real home content lands in a follow-up plan.`
- `App.test.tsx` matches `Investor Portal` and `data-app-name='investor-portal'`.

- [ ] **Step 1: Create all nine files following the Phase 5 template with the substitutions above.**
- [ ] **Step 2: Run gates** — `pnpm install`, `typecheck`, `test --run`, `build` for `@hydrax/investor-portal`.
- [ ] **Step 3: Commit Phase 6**

```bash
git add pnpm-lock.yaml web/apps/investor-portal
git commit -m "feat(web/investor-portal): scaffold Vite+RTK+router shell

Plan: docs/plans/2026-04-25-web-monorepo-scaffold.md (Phase 6)"
```

- [ ] **Step 4: Update STATE.yaml**

Append:
```
- 2026-04-25 — web monorepo Phase 6: @hydrax/investor-portal scaffolded (port 5175); lucide Wallet topbar icon; 2 tests pass; vite build emits dist/; git diff --stat confirms 9 files changed
```

---

## Phase 7: App — `@hydrax/ops-console`

Same 9-file shape and steps as Phase 5, with these substitutions:

- App name: `ops-console`
- `package.json` → `"name": "@hydrax/ops-console"`
- `vite.config.ts` → `port: 5176`
- `index.html` → `<title>HydraX — Ops Console</title>`
- `App.tsx` topbar text: `Ops Console`; topbar icon: `MonitorCog` from `lucide-react`; icon label `Ops Console logo`; `appName="ops-console"`; Card body: `Ops Console scaffold. Real home content lands in a follow-up plan.`
- `App.test.tsx` matches `Ops Console` and `data-app-name='ops-console'`.

- [ ] **Step 1: Create all nine files following the Phase 5 template with the substitutions above.**
- [ ] **Step 2: Run gates** — `pnpm install`, `typecheck`, `test --run`, `build` for `@hydrax/ops-console`.
- [ ] **Step 3: Commit Phase 7**

```bash
git add pnpm-lock.yaml web/apps/ops-console
git commit -m "feat(web/ops-console): scaffold Vite+RTK+router shell

Plan: docs/plans/2026-04-25-web-monorepo-scaffold.md (Phase 7)"
```

- [ ] **Step 4: Update STATE.yaml**

Append:
```
- 2026-04-25 — web monorepo Phase 7: @hydrax/ops-console scaffolded (port 5176); lucide MonitorCog topbar icon; 2 tests pass; vite build emits dist/; git diff --stat confirms 9 files changed
```

---

## Phase 8: App — `@hydrax/admin`

Same 9-file shape and steps as Phase 5, with these substitutions:

- App name: `admin`
- `package.json` → `"name": "@hydrax/admin"`
- `vite.config.ts` → `port: 5177`
- `index.html` → `<title>HydraX — Admin</title>`
- `App.tsx` topbar text: `Admin`; topbar icon: `ShieldCheck` from `lucide-react`; icon label `Admin logo`; `appName="admin"`; Card body: `Admin scaffold. Real home content lands in a follow-up plan.`
- `App.test.tsx` matches `Admin` and `data-app-name='admin'`.

- [ ] **Step 1: Create all nine files following the Phase 5 template with the substitutions above.**
- [ ] **Step 2: Run gates** — `pnpm install`, `typecheck`, `test --run`, `build` for `@hydrax/admin`.
- [ ] **Step 3: Commit Phase 8**

```bash
git add pnpm-lock.yaml web/apps/admin
git commit -m "feat(web/admin): scaffold Vite+RTK+router shell

Plan: docs/plans/2026-04-25-web-monorepo-scaffold.md (Phase 8)"
```

- [ ] **Step 4: Update STATE.yaml**

Append:
```
- 2026-04-25 — web monorepo Phase 8: @hydrax/admin scaffolded (port 5177); lucide ShieldCheck topbar icon; 2 tests pass; vite build emits dist/; git diff --stat confirms 9 files changed
```

---

## Phase 9: Workspace-Wide Verification + Roadmap Update

**Files:**
- Modify: `STATE.yaml`
- Modify: `CLAUDE.md` (add a "Web monorepo — invariants" section)

**Goal:** Prove the whole tree builds together, and lock the conventions established here into [CLAUDE.md](../../CLAUDE.md) so future agents don't re-invent the wheel.

- [ ] **Step 1: Workspace-wide gate**

```bash
pnpm install
pnpm -w typecheck
pnpm -w test --run
pnpm -w build
```
Expected:
- `typecheck`: clean across 8 workspaces (3 packages + 5 apps).
- `test --run`: 22 tests pass total (5 tenant-theme + 5 ui + 2 api-client + 2 × 5 apps = 22). 0 failures, 0 skipped, 0 only-marked.
- `build`: every package emits `dist/index.js` + `dist/index.d.ts`; every app emits `dist/index.html` + `dist/assets/*.{js,css}`.

- [ ] **Step 2: File-count + diff sanity**

```bash
find web -type f -not -path '*/node_modules/*' -not -path '*/dist/*' | wc -l
git diff --stat HEAD~9..HEAD
```
Expected:
- File count under `web/` (excluding `node_modules` and `dist`) = 11 (tenant-theme) + 11 (ui) + 6 (api-client) + 9 × 5 (apps) + 1 (`.gitkeep`) = 74.
- Diff stat across the 9 commits in this plan touches roughly: 1 phase-0 commit (~7 files), 3 package commits (~11+11+7 files), 5 app commits (9 each = 45 files), plus `pnpm-lock.yaml` updates per commit, plus STATE.yaml. No commit exceeds the 15-file gate (lockfile changes do not count toward the gate per CLAUDE.md "purely generated" exemption).

- [ ] **Step 3: Append to `CLAUDE.md` a "Web monorepo" section**

Append after the "TradeClaw — When modifying signal generation" block at the end of `/home/naim/.openclaw/workspace/hydrax-app/CLAUDE.md`:

```md
## Web Monorepo — Invariants

Locked by [docs/plans/2026-04-25-web-monorepo-scaffold.md](docs/plans/2026-04-25-web-monorepo-scaffold.md). Do not relitigate without a new plan doc.

- pnpm 9 workspace at the repo root. Workspaces live under `web/packages/*` and `web/apps/*`. Lockfile is `pnpm-lock.yaml`.
- Every package and app extends `tsconfig.base.json`. No path aliases — workspace package names (`@hydrax/<name>`) resolve via pnpm.
- Apps use Vite 5 + React 18 + RTK + react-router-dom 6 + vitest. No Tailwind, no Next, no Turbo until a plan adds them.
- UI primitives live in `@hydrax/ui`. Icons come from `lucide-react` only and must be wrapped in `<Icon icon=… label=… />` so a11y labels stay mandatory. **No emoji in JSX.**
- Tenant theming is CSS variables on `:root` written by `<ThemeProvider>` from `@hydrax/tenant-theme`. New tokens land in `TenantThemeTokens` first, then `applyTheme`'s map, then any consumer.
- BFF URL is `VITE_BFF_URL` (documented in [docs/env.md](docs/env.md)). The api-client never hardcodes hosts.
- Apps depend on packages via `workspace:*`. Apps do **not** depend on each other.
- Per-app dev ports are reserved: issuer-portal 5173, distributor-portal 5174, investor-portal 5175, ops-console 5176, admin 5177.
- Verification gates (mandatory before commit): `pnpm -w typecheck`, `pnpm -w test --run`, `pnpm -w build`. All three green or no commit.
- Visual polish (real layouts, real colors, real imagery) is **out of scope for this scaffold**. It lands under separate plans invoked through `frontend-design` + `taste-skill` + `design-system` + `nano-banana`.
```

- [ ] **Step 4: Final STATE.yaml update**

In `STATE.yaml`:
- Set `current_focus` to: `Web monorepo scaffold landed (3 packages + 5 apps). Next slice is user-direction: visual polish under frontend-design/taste-skill, real BFF + api-client domain endpoints (gated on PRD §14 Q1), or first real route inside one app.`
- Set `recently_verified` block to: `pnpm -w typecheck clean; pnpm -w test --run = 22 passing; pnpm -w build emits dist/ for all 8 workspaces; CLAUDE.md "Web monorepo — Invariants" section recorded; no prototype files (index.html, app.js, styles.css) modified during this plan.`
- Append the final `verification_log` entry:
```
- 2026-04-25 — web monorepo Phase 9 (workspace-wide): pnpm -w typecheck clean across 8 workspaces; pnpm -w test --run = 22 passing (5 tenant-theme + 5 ui + 2 api-client + 10 across 5 apps); pnpm -w build emits dist/index.{js,d.ts} for packages and dist/index.html + dist/assets/* for apps; CLAUDE.md updated with Web Monorepo Invariants section citing this plan; root prototype files unchanged (index.html=617, app.js=1961, styles.css=2036 line counts unchanged); git diff --stat HEAD~9..HEAD confirms 9 commits all under the 15-file gate
```

- [ ] **Step 5: Commit Phase 9**

```bash
git add STATE.yaml CLAUDE.md
git commit -m "docs(state): record web monorepo scaffold completion + lock invariants

Plan: docs/plans/2026-04-25-web-monorepo-scaffold.md (Phase 9)"
```

---

## Self-Review Notes

Spec coverage:
- Five empty apps named in args → Phases 4–8, one each. ✓
- Three empty packages named in args → Phases 1–3, one each. ✓
- Lucide icons in `web/packages/ui` → Phase 2 (`Icon.tsx` + per-app topbar icons). ✓
- White-label theming → Phase 1 (`tenant-theme`). ✓
- RTK Query from BFF OpenAPI → Phase 3 ships the RTK Query base + one stub; **OpenAPI codegen is deferred** because no BFF / OpenAPI spec exists yet. Documented in this plan and in CLAUDE.md follow-up rule. ✓
- `frontend-design` / `taste-skill` / `nano-banana` skill triggers → Boundary Conditions §6 + Phase 9 CLAUDE.md addendum tell future agents when to invoke them. Visual polish is out of scope for the scaffold; this is intentional and stated up front. ✓

Placeholder scan: every code block contains complete, runnable code. Phases 5–8 use Phase 4 as a template but explicitly enumerate each substitution rather than saying "same as before."

Type consistency: `TenantTheme`/`TenantThemeTokens` named identically across types.ts → applyTheme.ts → ThemeProvider.tsx → Phase 4 `App.tsx` import. `hydraxApi` reducer path/middleware names match between Phase 3 and Phase 4. `AppShell` props (`appName`, `sidebar`, `topbar`, `children`) match between Phase 2 implementation and Phase 4+ usage. `Icon` props (`icon`, `label`, `size`) consistent.

Out-of-scope items consciously deferred (logged here so they don't get re-invented as drive-bys):
- ESLint config
- Tailwind / shadcn
- MSW for BFF mocking
- OpenAPI → RTK Query codegen
- Dockerfiles / Railway services for each app
- Auth / SSO scaffolding
- Real tenant config loader (replaces hardcoded `DEFAULT_TENANT_THEME`)
- Multi-route routing inside any portal
- Visual design pass under `frontend-design` + `taste-skill`
- nano-banana hero/empty-state imagery
