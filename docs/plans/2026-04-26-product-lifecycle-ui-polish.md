# Product Lifecycle UI Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare-bones `web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx` lifecycle UI (plain "Transition to approved" buttons, `Status: pending` text) with status-specific labels, lucide icons per state, a reusable `StatusPill` primitive, a reusable `Toast` system for transition-success feedback, and a `Button` "danger" variant for destructive actions (Cancel). Closes the open follow-up flagged in STATE.yaml `next_actions` line 1.

**Architecture:** Promote the polish into shared `@hydrax/ui` primitives (StatusPill, Toast + ToastProvider + useToast) instead of one-offs in issuer-portal — every other portal (distributor, ops-console, admin) will eventually need the same surface. Button extends its existing `variant` union with `"danger"` rather than introducing a new `tone` prop. ProductDetailRoute composes the new primitives and reads `data.allowed_next` (server is source of truth, no FSM duplication).

**Tech Stack:** React 18, TypeScript 5, vitest, @testing-library/react, lucide-react, CSS variables (no Tailwind, no Framer Motion — match existing `@hydrax/ui` conventions). Animation via plain CSS keyframes on `transform` + `opacity` only.

---

## Visual Direction (locked by `/frontend-design` + `/taste-skill` + `/design-system`)

- **Aesthetic:** institutional dark + accent (matches existing portal polish — see `CLAUDE.md` Web Monorepo Invariants). Operator console, not consumer app.
- **Density:** ~5 (daily-app range). Cards stay because elevation communicates hierarchy here (product fields / status / actions are three distinct things).
- **Motion intensity:** ~3-4. CSS `:active` translateY(-1px) tactile feedback, 200ms ease-out toast slide-in, subtle 4s breathing dot on `active` status only. No magnetic buttons, no Framer Motion (not a dep). All animation on `transform` + `opacity`.
- **Color logic per state** (uses existing `TenantThemeTokens` — no new tokens):
  - `pending` → `colorTextMuted` text + `colorBorder` border (waiting)
  - `approved` → `colorAccent` text + `colorAccentSoft` background (ready to go)
  - `active` → `colorSuccess` text + soft success background + breathing dot (live)
  - `matured` → `colorTextStrong` text + `colorBgRaised` background (terminal-ok)
  - `cancelled` → `colorDanger` text + soft danger background (terminal-bad)
- **Button labels per transition** (replace "Transition to X" mechanical labels):
  - `approved` → "Approve" (variant=primary)
  - `active` → "Activate" (variant=primary)
  - `matured` → "Mark as matured" (variant=secondary)
  - `cancelled` → "Cancel product" (variant=danger — new)
- **Icons per state** (lucide-react via `<Icon>` wrapper, label mandatory):
  - `pending` → `Clock`
  - `approved` → `CheckCircle2`
  - `active` → `PlayCircle`
  - `matured` → `Flag`
  - `cancelled` → `XCircle`
- **AI-slop avoided:** no purple/blue glow, no oversaturated accents (uses theme tokens which are already calibrated), lucide icons (no emoji), labels are concrete verbs not "Elevate"/"Seamless", no centered hero, no 3-equal-card row, status pill replaces the generic "Status: pending" text.

## Anti-Scope (do not touch in this slice)

- Workflow-svc / BFF / api-client — UI-only slice. Server is already source of truth via `allowed_next`.
- Other portals (distributor / ops / admin / investor) — they will pick up `StatusPill` + `Toast` later via separate slices.
- New design tokens — uses existing 41-token surface.
- Tenant theming changes — out of scope.
- Optimistic-UI cache mutation — RTK Query already invalidates the `Product` tag on success and refetches; the toast + button-disabled state are sufficient feedback. No manual cache patching.
- Confirmation dialogs for destructive actions (Cancel) — could be added later; keep this slice focused.
- E2E Playwright coverage — out of scope; the existing vitest suite covers the primitive composition.

## Decisions Locked Before Coding

1. **`StatusPill` and `Toast` ship in `@hydrax/ui`**, not as one-offs in issuer-portal. Reason: cross-portal reuse is the explicit invariant in `CLAUDE.md` ("Apps depend on packages via `workspace:*`"). One-offs would create drift the moment ops-console renders the same lifecycle.
2. **Button gains `"danger"` variant** by extending the existing union, not by adding a new `tone` prop. Smaller surface change; matches existing primary/secondary/ghost shape.
3. **Toast uses an in-page absolutely-positioned container, not a React portal.** Reason: portal-based toast needs SSR/JSDOM ceremony (`createPortal` + container ref), and we don't have SSR here — Vite SPAs. Position-fixed inside the same React tree is simpler and works in JSDOM tests.
4. **`useToast` is consumed via context.** ToastProvider mounts once at the App root (issuer-portal `App.tsx`); routes call `useToast()` to dispatch. Provider owns the queue + timers + DOM. Tests wrap the route under test in `<ToastProvider>` (or assert via the queue's `role="status"` live region).
5. **Toast auto-dismisses after 4000ms.** Single configurable, not per-call. Live-region `role="status"` for a11y. Consumers can call `dismiss(id)` early but it's not exercised in this slice.
6. **No Framer Motion, no GSAP.** Plain CSS keyframes mounted in the provider (same pattern as `AppShell` mounts the skeleton-shimmer keyframes).
7. **The breathing-dot animation runs only when `state === "active"`**, never on every pill. Reason: communicates "live, currently servicing investors" — the only state where breathing carries semantic weight.
8. **Test fixtures stay in the test file**, not extracted. Plan-stage YAGNI — fixture reuse hasn't materialized.

## Commit Boundaries

Four commits, one concern each, all under the 15-file cap:

| # | Title | Files touched |
|---|---|---|
| C1 | `feat(web/ui): StatusPill primitive for product lifecycle states` | 3 |
| C2 | `feat(web/ui): Toast + ToastProvider + useToast for transient notifications` | 5 |
| C3 | `feat(web/ui): Button gains "danger" variant for destructive actions` | 2 |
| C4 | `feat(web/issuer-portal): polish /products/:id with icons, status pill, success toast` | 4 |

Total: 14 files. Within budget.

## File Structure

**Create:**
- `web/packages/ui/src/StatusPill.tsx`
- `web/packages/ui/src/StatusPill.test.tsx`
- `web/packages/ui/src/Toast.tsx`
- `web/packages/ui/src/ToastProvider.tsx`
- `web/packages/ui/src/Toast.test.tsx`

**Modify:**
- `web/packages/ui/src/index.ts` — re-export StatusPill, ToastProvider, useToast, Toast types
- `web/packages/ui/src/Button.tsx` — extend variant union with `"danger"`
- `web/packages/ui/src/Button.test.tsx` — assert danger variant renders + has correct data-variant
- `web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx` — use new primitives, status-specific labels/variants/icons
- `web/apps/issuer-portal/src/routes/ProductDetailRoute.test.tsx` — assert new labels, status pill, success toast
- `web/apps/issuer-portal/src/App.tsx` — wrap routes in `<ToastProvider>`

---

## Task 1: StatusPill primitive

**Files:**
- Create: `web/packages/ui/src/StatusPill.tsx`
- Create: `web/packages/ui/src/StatusPill.test.tsx`
- Modify: `web/packages/ui/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `web/packages/ui/src/StatusPill.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "./StatusPill";

describe("<StatusPill>", () => {
  it("renders the human label for each lifecycle state", () => {
    const { rerender } = render(<StatusPill state="pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    rerender(<StatusPill state="approved" />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
    rerender(<StatusPill state="active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    rerender(<StatusPill state="matured" />);
    expect(screen.getByText("Matured")).toBeInTheDocument();
    rerender(<StatusPill state="cancelled" />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("exposes the state via data-state for styling and tests", () => {
    render(<StatusPill state="active" />);
    const pill = screen.getByTestId("status-pill");
    expect(pill.getAttribute("data-state")).toBe("active");
  });

  it("renders an aria-labelled icon per state", () => {
    render(<StatusPill state="approved" />);
    expect(screen.getByRole("img", { name: /approved status/i })).toBeInTheDocument();
  });

  it("renders a breathing dot only on the 'active' state", () => {
    const { rerender } = render(<StatusPill state="pending" />);
    expect(screen.queryByTestId("status-pill-pulse")).toBeNull();
    rerender(<StatusPill state="active" />);
    expect(screen.getByTestId("status-pill-pulse")).toBeInTheDocument();
    rerender(<StatusPill state="cancelled" />);
    expect(screen.queryByTestId("status-pill-pulse")).toBeNull();
  });

  it("falls back gracefully on unknown states", () => {
    // Forward-compat: a future workflow-svc release may emit a state we don't know.
    render(<StatusPill state={"frozen" as unknown as "pending"} />);
    expect(screen.getByTestId("status-pill")).toHaveTextContent(/frozen/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web/packages/ui && pnpm test -- --run StatusPill`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `web/packages/ui/src/StatusPill.tsx`:

```typescript
import type { CSSProperties, ReactNode } from "react";
import { CheckCircle2, Clock, Flag, PlayCircle, XCircle, Circle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";

export type LifecycleState = "pending" | "approved" | "active" | "matured" | "cancelled";

interface StateConfig {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly fg: string;
  readonly bg: string;
  readonly border: string;
}

const STATE_CONFIG: Record<LifecycleState, StateConfig> = {
  pending: {
    label: "Pending",
    icon: Clock,
    fg: "var(--hydrax-color-text-muted)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-border)",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    fg: "var(--hydrax-color-accent)",
    bg: "var(--hydrax-color-accent-soft)",
    border: "var(--hydrax-color-accent)",
  },
  active: {
    label: "Active",
    icon: PlayCircle,
    fg: "var(--hydrax-color-success)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-success)",
  },
  matured: {
    label: "Matured",
    icon: Flag,
    fg: "var(--hydrax-color-text-strong)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-border)",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    fg: "var(--hydrax-color-danger)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-danger)",
  },
};

interface StatusPillProps {
  readonly state: LifecycleState;
  readonly style?: CSSProperties;
}

export function StatusPill({ state, style }: StatusPillProps): ReactNode {
  const known = STATE_CONFIG[state];
  const config: StateConfig = known ?? {
    label: String(state).replace(/^\w/, (c) => c.toUpperCase()),
    icon: Circle,
    fg: "var(--hydrax-color-text)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-border)",
  };

  return (
    <span
      data-testid="status-pill"
      data-state={state}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--hydrax-space-xs)",
        padding: "4px 10px",
        borderRadius: "var(--hydrax-radius-md)",
        background: config.bg,
        color: config.fg,
        border: `1px solid ${config.border}`,
        fontFamily: "var(--hydrax-font-sans)",
        fontSize: "var(--hydrax-type-body-sm-size)",
        lineHeight: "var(--hydrax-type-body-sm-line-height)",
        fontWeight: 500,
        letterSpacing: "0.01em",
        ...style,
      }}
    >
      {state === "active" && (
        <span
          data-testid="status-pill-pulse"
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: config.fg,
            animation: "hydrax-status-pulse 2.4s ease-in-out infinite",
          }}
        />
      )}
      <Icon icon={config.icon} label={`${config.label} status`} size={14} />
      <span>{config.label}</span>
      <style>{`
        @keyframes hydrax-status-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.18); }
        }
      `}</style>
    </span>
  );
}
```

The `<style>` block local to this primitive is the same approach `AppShell` uses for the skeleton-shimmer keyframes (per `CLAUDE.md` Web Monorepo Invariants). Multiple StatusPill mounts will redundantly inject the keyframe block, but browsers dedupe identical `@keyframes` rules so it's harmless. JSDOM doesn't actually run the animation; the test asserts presence, not motion.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web/packages/ui && pnpm test -- --run StatusPill`
Expected: 5 PASS.

- [ ] **Step 5: Re-export from the package barrel**

Edit `web/packages/ui/src/index.ts` — add the line at the bottom:

```typescript
export { StatusPill } from "./StatusPill";
export type { LifecycleState } from "./StatusPill";
```

- [ ] **Step 6: Run the full ui test suite**

Run: `cd web/packages/ui && pnpm test -- --run`
Expected: existing 40 tests still pass + 5 new = 45 total.

- [ ] **Step 7: Typecheck the ui package**

Run: `cd web/packages/ui && pnpm typecheck`
Expected: no errors.

- [ ] **Step 8: Commit C1**

```bash
git add web/packages/ui/src/StatusPill.tsx web/packages/ui/src/StatusPill.test.tsx web/packages/ui/src/index.ts
git commit -m "$(cat <<'EOF'
feat(web/ui): StatusPill primitive for product lifecycle states

Token-driven status badge — one icon, label, and color per lifecycle
state (pending, approved, active, matured, cancelled). The "active"
state gets a breathing dot to signal the product is live. Unknown
states fall back to a neutral surface with a Circle icon so the UI
stays sane during a rolling deploy that introduces a new state name.
EOF
)"
```

---

## Task 2: Toast + ToastProvider + useToast

**Files:**
- Create: `web/packages/ui/src/Toast.tsx`
- Create: `web/packages/ui/src/ToastProvider.tsx`
- Create: `web/packages/ui/src/Toast.test.tsx`
- Modify: `web/packages/ui/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `web/packages/ui/src/Toast.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./ToastProvider";

function ToastTrigger({
  tone,
  message,
}: {
  readonly tone: "success" | "danger" | "info";
  readonly message: string;
}) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast({ tone, message })}>
      Trigger
    </button>
  );
}

describe("<Toast> + useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing on first mount", () => {
    render(
      <ToastProvider>
        <div>app</div>
      </ToastProvider>,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("appears when showToast is called and lives in a role=status live region", async () => {
    render(
      <ToastProvider>
        <ToastTrigger tone="success" message="Status updated to approved." />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByRole("button", { name: "Trigger" }).click();
    });
    const live = screen.getByRole("status");
    expect(live).toHaveTextContent("Status updated to approved.");
  });

  it("auto-dismisses after the default 4000ms timeout", async () => {
    render(
      <ToastProvider>
        <ToastTrigger tone="success" message="Hello" />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByRole("button", { name: "Trigger" }).click();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Hello");
    await act(async () => {
      vi.advanceTimersByTime(4001);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("exposes data-tone for tone-specific styling", async () => {
    render(
      <ToastProvider>
        <ToastTrigger tone="danger" message="Boom" />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByRole("button", { name: "Trigger" }).click();
    });
    const toast = screen.getByTestId("toast-item");
    expect(toast.getAttribute("data-tone")).toBe("danger");
  });

  it("stacks multiple toasts and dismisses each independently", async () => {
    function MultiTrigger() {
      const { showToast } = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            showToast({ tone: "info", message: "first" });
            showToast({ tone: "success", message: "second" });
          }}
        >
          Trigger
        </button>
      );
    }
    render(
      <ToastProvider>
        <MultiTrigger />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByRole("button", { name: "Trigger" }).click();
    });
    expect(screen.getAllByTestId("toast-item")).toHaveLength(2);
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("throws a descriptive error when useToast is used outside a provider", () => {
    function Orphan() {
      useToast();
      return null;
    }
    // Suppress React's error logging for this expected throw.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(/useToast must be used inside a <ToastProvider>/);
    errSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web/packages/ui && pnpm test -- --run Toast`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement Toast.tsx**

Create `web/packages/ui/src/Toast.tsx`:

```typescript
import type { CSSProperties, ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Icon } from "./Icon";

export type ToastTone = "success" | "danger" | "info";

export interface ToastProps {
  readonly id: string;
  readonly tone: ToastTone;
  readonly message: string;
  readonly onDismiss?: (id: string) => void;
}

const TONE_STYLE: Record<ToastTone, { fg: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  success: {
    fg: "var(--hydrax-color-success)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-success)",
    icon: CheckCircle2,
  },
  danger: {
    fg: "var(--hydrax-color-danger)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-danger)",
    icon: AlertCircle,
  },
  info: {
    fg: "var(--hydrax-color-text-strong)",
    bg: "var(--hydrax-color-bg-raised)",
    border: "var(--hydrax-color-border)",
    icon: Info,
  },
};

export function Toast({ id, tone, message, onDismiss }: ToastProps): ReactNode {
  const style = TONE_STYLE[tone];
  const baseStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--hydrax-space-sm)",
    padding: "10px 14px 10px 12px",
    borderRadius: "var(--hydrax-radius-md)",
    background: style.bg,
    color: style.fg,
    border: `1px solid ${style.border}`,
    boxShadow: "var(--hydrax-shadow-md)",
    fontFamily: "var(--hydrax-font-sans)",
    fontSize: "var(--hydrax-type-body-sm-size)",
    lineHeight: "var(--hydrax-type-body-sm-line-height)",
    minWidth: 260,
    maxWidth: 420,
    animation: "hydrax-toast-in var(--hydrax-motion-fast) var(--hydrax-ease-out)",
  };
  return (
    <div data-testid="toast-item" data-tone={tone} style={baseStyle}>
      <Icon icon={style.icon} label={`${tone} notification`} size={16} />
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => onDismiss(id)}
          style={{
            background: "transparent",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            opacity: 0.7,
            padding: 4,
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement ToastProvider.tsx**

Create `web/packages/ui/src/ToastProvider.tsx`:

```typescript
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Toast, type ToastTone } from "./Toast";

interface ToastInput {
  readonly tone: ToastTone;
  readonly message: string;
}

interface ToastEntry extends ToastInput {
  readonly id: string;
}

interface ToastContextValue {
  readonly showToast: (input: ToastInput) => string;
  readonly dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `toast-${nextId}`;
}

interface ToastProviderProps {
  readonly children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps): ReactNode {
  const [toasts, setToasts] = useState<readonly ToastEntry[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (input: ToastInput): string => {
      const id = makeId();
      setToasts((prev) => [...prev, { ...input, id }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    // Snapshot the timer map so cleanup uses the same Map instance the effect saw.
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast, dismiss }), [showToast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="false"
          style={{
            position: "fixed",
            top: "var(--hydrax-space-lg)",
            right: "var(--hydrax-space-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--hydrax-space-sm)",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          {toasts.map((t) => (
            <div key={t.id} style={{ pointerEvents: "auto" }}>
              <Toast id={t.id} tone={t.tone} message={t.message} onDismiss={dismiss} />
            </div>
          ))}
        </div>
      )}
      <style>{`
        @keyframes hydrax-toast-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside a <ToastProvider>");
  }
  return ctx;
}
```

- [ ] **Step 5: Re-export from the package barrel**

Edit `web/packages/ui/src/index.ts` — add at the bottom:

```typescript
export { Toast } from "./Toast";
export type { ToastProps, ToastTone } from "./Toast";
export { ToastProvider, useToast } from "./ToastProvider";
```

- [ ] **Step 6: Run Toast tests**

Run: `cd web/packages/ui && pnpm test -- --run Toast`
Expected: 6 PASS.

- [ ] **Step 7: Run the full ui test suite**

Run: `cd web/packages/ui && pnpm test -- --run`
Expected: existing 45 tests still pass + 6 new = 51 total.

- [ ] **Step 8: Typecheck and build the ui package**

Run: `cd web/packages/ui && pnpm typecheck && pnpm build`
Expected: no errors; emits `dist/index.{js,d.ts,d.ts.map}`.

- [ ] **Step 9: Commit C2**

```bash
git add web/packages/ui/src/Toast.tsx web/packages/ui/src/ToastProvider.tsx web/packages/ui/src/Toast.test.tsx web/packages/ui/src/index.ts
git commit -m "$(cat <<'EOF'
feat(web/ui): Toast + ToastProvider + useToast for transient notifications

Three tones (success, danger, info) with one lucide icon each. Auto-
dismiss at 4s, manual dismiss via the close button. Stacked toasts
each manage their own timer in a ref Map so removing one doesn't
restart the others. Lives inside a fixed-position role=status live
region near top-right; pointer-events isolated so it never blocks
clicks behind it.
EOF
)"
```

---

## Task 3: Button danger variant

**Files:**
- Modify: `web/packages/ui/src/Button.tsx`
- Modify: `web/packages/ui/src/Button.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `web/packages/ui/src/Button.test.tsx`:

```typescript
  it("renders the 'danger' variant for destructive actions", () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole("button", { name: "Delete" });
    expect(btn.getAttribute("data-variant")).toBe("danger");
  });
```

(Place inside the existing `describe("<Button>", ...)` block, before the closing `});` brace.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web/packages/ui && pnpm test -- --run Button`
Expected: FAIL — TypeScript rejects `variant="danger"`.

- [ ] **Step 3: Extend the variant union and the style map**

Edit `web/packages/ui/src/Button.tsx`. Replace the `ButtonVariant` and `VARIANT_STYLE` declarations with:

```typescript
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_STYLE: Record<ButtonVariant, CSSProperties> = {
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
  danger: {
    background: "transparent",
    color: "var(--hydrax-color-danger)",
    border: "1px solid var(--hydrax-color-danger)",
  },
};
```

The `danger` variant is intentionally an outlined (transparent fill) treatment, not a filled red button. Filled-red is the AI-slop default; outlined-danger reads as "destructive but considered" and stays visually quiet next to a primary action — matches the institutional aesthetic of the existing portals.

- [ ] **Step 4: Run all Button tests**

Run: `cd web/packages/ui && pnpm test -- --run Button`
Expected: 4 PASS (3 existing + 1 new).

- [ ] **Step 5: Run the full ui test suite**

Run: `cd web/packages/ui && pnpm test -- --run`
Expected: 52 PASS (51 prior + 1 new).

- [ ] **Step 6: Typecheck**

Run: `cd web/packages/ui && pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit C3**

```bash
git add web/packages/ui/src/Button.tsx web/packages/ui/src/Button.test.tsx
git commit -m "$(cat <<'EOF'
feat(web/ui): Button gains "danger" variant for destructive actions

Outlined (transparent fill, danger-color border + text) so destructive
actions read as "considered" rather than urgent. Stays visually quiet
next to a primary CTA, which is the institutional-portal aesthetic.
EOF
)"
```

---

## Task 4: ProductDetailRoute polish

**Files:**
- Modify: `web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx`
- Modify: `web/apps/issuer-portal/src/routes/ProductDetailRoute.test.tsx`
- Modify: `web/apps/issuer-portal/src/App.tsx`

- [ ] **Step 1: Wrap the App in ToastProvider**

Inspect first: `cat web/apps/issuer-portal/src/App.tsx`. Identify the root render tree. Add the import:

```typescript
import { ToastProvider } from "@hydrax/ui";
```

Wrap the existing root content in `<ToastProvider>...</ToastProvider>`. Concretely:

- If `App.tsx` returns `<Provider store={...}><BrowserRouter>...</BrowserRouter></Provider>` or similar, the wrap goes immediately inside `<Provider>` and outside `<BrowserRouter>`:

```typescript
<Provider store={store}>
  <ToastProvider>
    <BrowserRouter>
      ...existing tree...
    </BrowserRouter>
  </ToastProvider>
</Provider>
```

If the file uses a different root shape, wrap the entire app tree under the existing top-level provider, leaving everything else unchanged.

- [ ] **Step 2: Update the route component**

Replace the contents of `web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx` with:

```typescript
import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  useGetProductQuery,
  useTransitionProductMutation,
} from "@hydrax/api-client";
import {
  Button,
  Heading,
  Icon,
  Skeleton,
  Stack,
  StatusPill,
  Text,
  useToast,
  type LifecycleState,
} from "@hydrax/ui";
import {
  CheckCircle2,
  Flag,
  PlayCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

interface TransitionAction {
  readonly to: LifecycleState;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly variant: "primary" | "secondary" | "danger";
}

const TRANSITION_ACTIONS: Record<LifecycleState, TransitionAction> = {
  pending: { to: "pending", label: "Pending", icon: CheckCircle2, variant: "secondary" },
  approved: { to: "approved", label: "Approve", icon: CheckCircle2, variant: "primary" },
  active: { to: "active", label: "Activate", icon: PlayCircle, variant: "primary" },
  matured: { to: "matured", label: "Mark as matured", icon: Flag, variant: "secondary" },
  cancelled: { to: "cancelled", label: "Cancel product", icon: XCircle, variant: "danger" },
};

export function ProductDetailRoute() {
  const { id = "" } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useGetProductQuery(id, { skip: !id });
  const [transition, transitionState] = useTransitionProductMutation();
  const { showToast } = useToast();

  useEffect(() => {
    if (transitionState.isSuccess && transitionState.data) {
      showToast({
        tone: "success",
        message: `Status updated to ${transitionState.data.status}.`,
      });
      transitionState.reset();
    }
  }, [transitionState.isSuccess, transitionState.data, showToast, transitionState]);

  useEffect(() => {
    if (transitionState.isError) {
      showToast({ tone: "danger", message: "Transition failed." });
      transitionState.reset();
    }
  }, [transitionState.isError, showToast, transitionState]);

  const allowedActions = useMemo<readonly TransitionAction[]>(() => {
    const allowed = data?.allowed_next ?? [];
    return allowed
      .map((state) => TRANSITION_ACTIONS[state as LifecycleState])
      .filter((a): a is TransitionAction => Boolean(a));
  }, [data]);

  if (isLoading) {
    return <Skeleton aria-label="Loading product" />;
  }
  if (isError || !data) {
    return (
      <Text tone="danger" role="alert">
        Could not load product.
      </Text>
    );
  }

  const handleTransition = (to: string): void => {
    if (!id) return;
    void transition({ id, to });
  };

  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <Heading level="h1">{data.name}</Heading>
        <StatusPill state={data.status as LifecycleState} />
      </Stack>
      <Stack gap="sm">
        <Text>
          <Text tone="muted">Code: </Text>
          {data.code}
        </Text>
        <Text>
          <Text tone="muted">Type: </Text>
          {data.product_type}
        </Text>
        <Text>
          <Text tone="muted">Created: </Text>
          {data.created_at}
        </Text>
      </Stack>
      <Stack gap="sm">
        <Heading level="h2">Lifecycle actions</Heading>
        {allowedActions.length === 0 ? (
          <Text tone="muted" data-testid="terminal-state">
            No further actions — product is in a terminal state.
          </Text>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--hydrax-space-sm)",
            }}
          >
            {allowedActions.map((a) => (
              <Button
                key={a.to}
                data-testid={`transition-${a.to}`}
                variant={a.variant}
                disabled={transitionState.isLoading}
                onClick={() => handleTransition(a.to)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Icon icon={a.icon} label={a.label} size={14} />
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </Stack>
    </Stack>
  );
}
```

Key changes from the prior version:

- Status moved up next to the heading, replaces plain text with `<StatusPill>`.
- One named action per transition (`Approve`, `Activate`, `Mark as matured`, `Cancel product`) — no more "Transition to X".
- `cancelled` transition uses Button `variant="danger"`.
- Each button now has a leading `<Icon>` (lucide).
- Success and error feedback move from inline `Text` to toast notifications.
- Buttons render in a flex-wrap row instead of a vertical stack — matches institutional density.
- `transitionState.reset()` clears `isSuccess`/`isError` after the toast fires, so a second click triggers a fresh toast.

- [ ] **Step 3: Update the test file**

Replace the contents of `web/apps/issuer-portal/src/routes/ProductDetailRoute.test.tsx` with:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { hydraxApi } from "@hydrax/api-client";
import { ToastProvider } from "@hydrax/ui";

import { ProductDetailRoute } from "./ProductDetailRoute";

const baseProduct = {
  id: "abc-123",
  tenant_id: "tenant-1",
  code: "PROD-001",
  name: "Prime Credit Note",
  product_type: "short_duration_credit",
  status: "pending",
  created_at: "2026-04-25T00:00:00Z",
  updated_at: "2026-04-25T00:00:00Z",
};

function makeStore() {
  return configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
  });
}

function Wrapper({
  children,
  initialPath,
}: {
  readonly children: ReactNode;
  readonly initialPath: string;
}) {
  const store = makeStore();
  return (
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/products/:id" element={children} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </Provider>
  );
}

function renderRoute(path = "/products/abc-123") {
  return render(
    <Wrapper initialPath={path}>
      <ProductDetailRoute />
    </Wrapper>,
  );
}

describe("<ProductDetailRoute>", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a Skeleton while the product query is loading", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => {}),
    );
    renderRoute();
    expect(screen.getByLabelText(/loading product/i)).toBeInTheDocument();
  });

  it("renders the product name and a StatusPill once the BFF returns data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ...baseProduct, status: "active", allowed_next: ["matured", "cancelled"] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    renderRoute();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /prime credit note/i }),
      ).toBeInTheDocument();
    });
    const pill = await screen.findByTestId("status-pill");
    expect(pill.getAttribute("data-state")).toBe("active");
    expect(pill).toHaveTextContent(/active/i);
    expect(screen.getByText(/PROD-001/)).toBeInTheDocument();
  });

  it("renders an error message when the BFF returns 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    renderRoute();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /could not load product/i,
      );
    });
  });

  it("renders status-specific buttons (Approve, Cancel product) for a pending product", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ...baseProduct, allowed_next: ["approved", "cancelled"] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    renderRoute();
    const approve = await screen.findByTestId("transition-approved");
    expect(approve).toHaveTextContent(/^Approve$/);
    expect(approve.getAttribute("data-variant")).toBe("primary");
    const cancel = screen.getByTestId("transition-cancelled");
    expect(cancel).toHaveTextContent(/Cancel product/);
    expect(cancel.getAttribute("data-variant")).toBe("danger");
  });

  it("renders the terminal-state message when allowed_next is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ...baseProduct, status: "matured", allowed_next: [] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    renderRoute();
    expect(
      await screen.findByTestId("terminal-state"),
    ).toHaveTextContent(/no further actions/i);
    expect(screen.queryByTestId("transition-approved")).toBeNull();
  });

  it("renders the terminal-state message when allowed_next is omitted (rolling deploy)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(baseProduct), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    renderRoute();
    expect(
      await screen.findByTestId("terminal-state"),
    ).toBeInTheDocument();
  });

  it("disables every transition button while a transition is in flight", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/v1/products/abc-123/transition")) {
        return new Promise<Response>(() => {});
      }
      return new Response(
        JSON.stringify({ ...baseProduct, allowed_next: ["approved", "cancelled"] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    renderRoute();
    const approveBtn = await screen.findByTestId<HTMLButtonElement>("transition-approved");
    const cancelBtn = screen.getByTestId<HTMLButtonElement>("transition-cancelled");
    expect(approveBtn).not.toBeDisabled();
    expect(cancelBtn).not.toBeDisabled();

    approveBtn.click();

    await waitFor(() => {
      expect(approveBtn).toBeDisabled();
      expect(cancelBtn).toBeDisabled();
    });
  });

  it("POSTs to /v1/products/{id}/transition when a button is clicked", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/v1/products/abc-123/transition")) {
        return new Response(
          JSON.stringify({ ...baseProduct, status: "approved", allowed_next: ["active", "cancelled"] }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ ...baseProduct, allowed_next: ["approved", "cancelled"] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    renderRoute();
    const approveBtn = await screen.findByTestId("transition-approved");
    approveBtn.click();
    await waitFor(async () => {
      const transitionCall = fetchSpy.mock.calls.find(([u]) => {
        const url = typeof u === "string" ? u : (u as Request).url;
        return url.endsWith("/v1/products/abc-123/transition");
      });
      expect(transitionCall).toBeDefined();
      const [input, init] = transitionCall!;
      const method =
        (init as RequestInit | undefined)?.method ??
        (input instanceof Request ? input.method : undefined);
      expect(method).toBe("POST");
      const bodyInit = (init as RequestInit | undefined)?.body;
      const bodyText =
        typeof bodyInit === "string"
          ? bodyInit
          : input instanceof Request
            ? await input.clone().text()
            : "";
      expect(bodyText).toBe(JSON.stringify({ to: "approved" }));
    });
  });

  it("dispatches a success toast after a transition completes", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/v1/products/abc-123/transition")) {
        return new Response(
          JSON.stringify({ ...baseProduct, status: "approved", allowed_next: ["active", "cancelled"] }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ ...baseProduct, allowed_next: ["approved", "cancelled"] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    renderRoute();
    const approveBtn = await screen.findByTestId("transition-approved");
    await user.click(approveBtn);
    const toast = await screen.findByTestId("toast-item");
    expect(toast.getAttribute("data-tone")).toBe("success");
    expect(toast).toHaveTextContent(/status updated to approved/i);
  });

  it("dispatches a danger toast when a transition fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/v1/products/abc-123/transition")) {
        return new Response(JSON.stringify({ error: "boom" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ ...baseProduct, allowed_next: ["approved", "cancelled"] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    renderRoute();
    const approveBtn = await screen.findByTestId("transition-approved");
    await user.click(approveBtn);
    const toast = await screen.findByTestId("toast-item");
    expect(toast.getAttribute("data-tone")).toBe("danger");
    expect(toast).toHaveTextContent(/transition failed/i);
  });
});
```

The two new tests exercise the toast paths. The existing 8 tests are updated where labels changed (`"Approve"` instead of `"Transition to approved"`, status pill instead of plain status text). 10 tests total in the polished file.

- [ ] **Step 4: Run the route tests**

Run: `cd web/apps/issuer-portal && pnpm exec vitest run src/routes/ProductDetailRoute.test.tsx`
Expected: 10 PASS.

If any test fails on a UI-primitive shape mismatch (e.g. `Heading` doesn't accept `level="h1"`), inspect the primitive and adjust the route to match. Do not modify `@hydrax/ui` primitives in this task — primitive changes belong in C1-C3.

- [ ] **Step 5: Run the full issuer-portal suite**

Run: `cd web/apps/issuer-portal && pnpm exec vitest run`
Expected: all pre-existing tests still pass, 10 ProductDetailRoute tests pass.

- [ ] **Step 6: Workspace-wide verification**

Run from repo root:

```bash
pnpm -r --if-present typecheck && pnpm -r --if-present test -- --run
```

Expected: 12-workspace typecheck clean; ~261 tests passing (existing 257 + 4 net new across StatusPill 5, Toast 6, Button +1, route file labels rebalanced ≈ -2 net change).

(Exact count may shift by ±2 depending on whether legacy `transition-error` Text-element assertions remain — they don't in the polished version.)

- [ ] **Step 7: Build the workspace**

Run from repo root:

```bash
pnpm -r --if-present build
```

Expected: 3 packages emit `dist/index.{js,d.ts}`, 5 apps emit `dist/index.html` + `dist/assets/*`, 3 services emit `dist/server.{js,d.ts}`. No errors.

- [ ] **Step 8: Commit C4**

```bash
git add web/apps/issuer-portal/src/routes/ProductDetailRoute.tsx web/apps/issuer-portal/src/routes/ProductDetailRoute.test.tsx web/apps/issuer-portal/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web/issuer-portal): polish /products/:id with icons, status pill, success toast

Status moves up next to the heading as a token-driven StatusPill
(breathing dot when active). Buttons get status-specific labels
(Approve / Activate / Mark as matured / Cancel product) and lucide
icons; Cancel uses the new "danger" Button variant. Inline error
text is gone — transition success and failure now surface as toast
notifications. Closes the lifecycle UI polish follow-up tracked in
STATE.yaml.
EOF
)"
```

---

## Final Verification

- [ ] **Step 1: workspace-wide gates**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
pnpm -r --if-present typecheck
pnpm -r --if-present test -- --run
pnpm -r --if-present build
```

Expected: three green commands. Three workspace gates per `CLAUDE.md` Web Monorepo Invariants.

- [ ] **Step 2: prototype baseline (must be untouched)**

```bash
wc -l index.html app.js styles.css
node --check app.js
```

Expected: `index.html=617 app.js=1961 styles.css=2036` and node check passes — same baseline as STATE.yaml `recently_verified`.

- [ ] **Step 3: visual smoke (manual, deferred to user)**

Cannot be driven by the CLI. Manual steps for the user:

1. `cd web/apps/issuer-portal && pnpm dev` — Vite serves on port 5173.
2. Hit `http://localhost:5173/products/<some-real-uuid>` against a running BFF + workflow-svc + Postgres stack.
3. Verify: status pill shows correct color/icon; the breathing dot appears only on `active`; clicking Approve fires a success toast that auto-dismisses; clicking Cancel product shows the outlined danger button; an upstream 5xx surfaces as a danger toast.

Out of scope for this slice — logged in STATE.yaml as user-driven follow-up.

- [ ] **Step 4: update STATE.yaml**

Append a `verification_log` entry and trim `next_actions[0]`:

```yaml
verification_log:
  - "2026-04-26 — product-lifecycle-ui-polish: 4 commits land StatusPill + Toast/ToastProvider/useToast + Button danger variant + polished issuer-portal /products/:id; pnpm -r typecheck/test/build green; ~261 tests across 12 workspaces"
next_actions:
  # remove the lifecycle UI polish bullet from line 1 (now closed)
  # remaining items unchanged
```

---

## Self-Review Notes

**Spec coverage** — every gap in the prior plan's deferred follow-up is mapped:

| Gap (next_actions line 1) | Task |
|---|---|
| lucide icons per state | StatusPill + ProductDetailRoute action icons (Tasks 1, 4) |
| status-specific button labels/colors | Task 4 + Task 3 (danger variant) |
| optimistic UI | Buttons disable while in flight (already in pre-polish version, preserved); toast on success completes the loop |
| success toasts | Task 2 (primitive) + Task 4 (wire-up) |

**Placeholder scan** — searched for "TBD", "etc", "similar to", "fill in"; none present. Each step shows the actual code or command.

**Type consistency** — `LifecycleState` exported from `@hydrax/ui` matches the cast in `ProductDetailRoute` (`data.status as LifecycleState`). `ToastTone` matches the `tone` field used by `useToast`-callers. `ButtonVariant` extension flows from C3 into C4 via the `TRANSITION_ACTIONS.cancelled.variant: "danger"` literal.

**Token usage** — all colors/spacing/motion reference existing `TenantThemeTokens`. No new tokens introduced. Per CLAUDE.md, that means no `applyTheme.ts` change required.

**Anti-scope honored** — server contracts unchanged (no workflow-svc/BFF/api-client edits). Other portals untouched. No tenant theming changes.

**Commit hygiene** — 4 commits, each ≤5 files, each one concern. No layer-bundling. Layer order: primitive → primitive → primitive extension → consumer wire-up.

**Verification cadence** — every task ends with the smallest correctness check (single test command), and the final block runs the project-wide gates per CLAUDE.md.
