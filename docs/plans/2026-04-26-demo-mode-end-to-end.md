# 2026-04-26 — Demo-mode end-to-end click-through

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to walk this task list. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 3-4 minute scripted click-through demo across investor → distributor → ops portals using the existing `VITE_DEMO_MODE` flag, without requiring live services. Smooth transitions, realistic data, audit timeline. No auth, no SMTP, no Canton ledger; mocks at boundary only.

**Architecture:** Build on the demo substrate that already exists at [web/packages/api-client/src/api.ts](../../web/packages/api-client/src/api.ts) (the `demoBaseQuery` swap and `demo-fixtures.ts`). All net-new code is portal UI + a persona switcher + an audit timeline component. No new services, no schema changes, no auth changes.

**Tech Stack:** React 18, Redux Toolkit + RTK Query, react-router-dom 6, Vite 5, vitest, lucide-react, `@hydrax/ui` primitives, `@hydrax/tenant-theme`, `@hydrax/api-client`. Per-portal Vite dev ports 5173-5177. No new dependencies.

## Demo storyline (the deliverable, not the code)

1. **Investor** lands on investor-portal `/products` → 3 products listed → clicks "Treasury Bill 2026 Q3"
2. Sees `/products/:id` with details + "Subscribe" CTA → clicks
3. Fills `/subscribe` form (amount $250,000) → submits → redirects to `/subscriptions/:id`
4. Subscription detail shows status "Pending approval" + audit timeline: 1 event "subscription.created"
5. Presenter clicks **PersonaSwitcher** (topbar, top-right) → "Distributor" → opens distributor-portal `/approvals`
6. Sees the same subscription pending → clicks **Approve** → toast "Subscription approved" + row updates to "Approved" badge
7. Presenter clicks **PersonaSwitcher** → "Operator" → opens ops-console `/audit`
8. Sees audit timeline filtered by the subscription resource → 4 events in chronological order
9. Presenter closes with: "Daml spike runs at `services/canton-adapter/daml/hydrax-governance/daml test`"

The illusion of "live mutation across portals" is achieved through **scripted fixtures** — the pending subscription that the investor "creates" already exists in `DEMO_SUBSCRIPTIONS` with the right id, and the audit log already has the events that "would" happen. Each portal's view is internally consistent. The mutations work in-session within a single portal (RTK Query optimistic update) but do not need to cross portal boundaries.

## File structure (what gets created/modified)

**Modified files (4):**
- `web/packages/api-client/src/demo-fixtures.ts` — add 1 pending subscription, 4 audit events for it, 1 active subscription
- `web/packages/api-client/src/api.ts` — `demoQuery` returns the pre-baked pending sub for `POST /v1/subscriptions` so the redirect lands on a valid id
- `web/packages/ui/src/index.ts` — re-export `PersonaSwitcher` and `AuditTimeline`
- `web/apps/investor-portal/src/App.tsx` — register 4 new routes

**New files (~17):**
- `web/packages/ui/src/PersonaSwitcher.tsx` + `.test.tsx` — dropdown with 3 portal links
- `web/packages/ui/src/AuditTimeline.tsx` + `.test.tsx` — vertical event list with icons
- `web/apps/investor-portal/src/routes/ProductsListRoute.tsx` + `.test.tsx`
- `web/apps/investor-portal/src/routes/ProductDetailRoute.tsx` + `.test.tsx`
- `web/apps/investor-portal/src/routes/SubscribeRoute.tsx` + `.test.tsx`
- `web/apps/investor-portal/src/routes/SubscriptionDetailRoute.tsx` + `.test.tsx`
- (5 portal topbar files modified to include `<PersonaSwitcher />`)
- `web/apps/investor-portal/src/components/InvestorSidebar.tsx` — add Products + Subscriptions nav items

**Modified files (5 portal topbars):**
- `web/apps/investor-portal/src/components/InvestorTopBar.tsx`
- `web/apps/distributor-portal/src/components/DistributorTopBar.tsx`
- `web/apps/issuer-portal/src/components/IssuerTopBar.tsx`
- `web/apps/ops-console/src/components/OpsTopBar.tsx`
- `web/apps/admin/src/components/AdminTopBar.tsx`

**Modified file (1 distributor route):**
- `web/apps/distributor-portal/src/routes/ApprovalsRoute.tsx` — wire `useToast()` for success toast + `updateQueryData` optimistic update

Total: ~12-14 commits, ~700-900 LOC. Each commit single-concern, ≤8 files, conventional message.

## Will NOT

- Touch any service code (`services/`)
- Touch any schema or migration (`db/postgres/migrations/`)
- Touch the prototype (`index.html`, `app.js`, `styles.css`)
- Add real auth — assume `VITE_DEMO_MODE=true` bypass throughout
- Add real SMTP — magic-link is out of scope for this demo
- Wire passkey browser ceremony — out of scope
- Generate new images via nano-banana — Bold Signal stays geometry-only
- Cross-portal cache sync — each portal is self-contained
- Persist mutations across page reloads — reload resets to fixture state (a feature, not a bug)
- Change CSS variables or tenant theme — use existing tokens
- Add new lucide icons that aren't already in `lucide-react@0.378.0`

## Tasks (bite-sized, TDD where possible)

---

### Task 1: Expand demo fixtures

**Files:**
- Modify: `web/packages/api-client/src/demo-fixtures.ts`

- [ ] **Step 1: Add a pending subscription + audit event sequence**

Open `web/packages/api-client/src/demo-fixtures.ts:70` and replace `DEMO_SUBSCRIPTIONS` with:

```typescript
const SUB_PENDING_ID = "cccccccc-1111-4ccc-8ccc-000000000002";
const SUB_APPROVED_ID = "cccccccc-1111-4ccc-8ccc-000000000001";
const SUB_ACTIVE_ID = "cccccccc-1111-4ccc-8ccc-000000000003";

export const DEMO_SUBSCRIPTION_PENDING_ID = SUB_PENDING_ID;
export const DEMO_SUBSCRIPTION_APPROVED_ID = SUB_APPROVED_ID;
export const DEMO_SUBSCRIPTION_ACTIVE_ID = SUB_ACTIVE_ID;

export const DEMO_SUBSCRIPTIONS: Record<string, Subscription> = {
  [SUB_APPROVED_ID]: {
    id: SUB_APPROVED_ID,
    product_id: DEMO_PRODUCTS[0]!.id,
    investor_user_id: "dddddddd-1111-4ddd-8ddd-000000000001",
    amount_minor: 25_000_000,
    currency: "USD",
    status: "approved",
    created_at: ISO_NOW,
    updated_at: ISO_NOW,
  },
  [SUB_PENDING_ID]: {
    id: SUB_PENDING_ID,
    product_id: DEMO_PRODUCTS[2]!.id,  // Treasury Bill 2026 Q3 (status pending)
    investor_user_id: "dddddddd-1111-4ddd-8ddd-000000000002",
    amount_minor: 25_000_000_000,  // $250k in cents
    currency: "USD",
    status: "pending",
    created_at: ISO_NOW,
    updated_at: ISO_NOW,
  },
  [SUB_ACTIVE_ID]: {
    id: SUB_ACTIVE_ID,
    product_id: DEMO_PRODUCTS[1]!.id,  // MMF
    investor_user_id: "dddddddd-1111-4ddd-8ddd-000000000003",
    amount_minor: 50_000_000_000,  // $500k
    currency: "USD",
    status: "active",
    created_at: "2026-04-20T10:00:00.000000Z",
    updated_at: ISO_NOW,
  },
};
```

- [ ] **Step 2: Replace DEMO_AUDIT_EVENTS with a richer sequence including the pending sub's lineage**

Replace the existing `DEMO_AUDIT_EVENTS` block with:

```typescript
export const DEMO_AUDIT_EVENTS: ReadonlyArray<AuditEvent> = [
  {
    id: "eeeeeeee-1111-4eee-8eee-000000000001",
    tenant_id: TENANT_ID,
    actor_user_id: null,
    action: "product.transitioned",
    resource_type: "product",
    resource_id: DEMO_PRODUCTS[0]!.id,
    payload: { from: "approved", to: "active" },
    created_at: ISO_NOW,
  },
  {
    id: "eeeeeeee-1111-4eee-8eee-000000000002",
    tenant_id: TENANT_ID,
    actor_user_id: "dddddddd-1111-4ddd-8ddd-000000000002",
    action: "subscription.created",
    resource_type: "subscription",
    resource_id: SUB_PENDING_ID,
    payload: { product_id: DEMO_PRODUCTS[2]!.id, amount_minor: 25_000_000_000, currency: "USD" },
    created_at: "2026-04-26T09:00:00.000000Z",
  },
  {
    id: "eeeeeeee-1111-4eee-8eee-000000000003",
    tenant_id: TENANT_ID,
    actor_user_id: null,
    action: "subscription.kyc_validated",
    resource_type: "subscription",
    resource_id: SUB_PENDING_ID,
    payload: { result: "pass", kyc_check_id: "kyc-9921" },
    created_at: "2026-04-26T09:01:30.000000Z",
  },
  {
    id: "eeeeeeee-1111-4eee-8eee-000000000004",
    tenant_id: TENANT_ID,
    actor_user_id: null,
    action: "subscription.queued_for_approval",
    resource_type: "subscription",
    resource_id: SUB_PENDING_ID,
    payload: { approver_role: "distributor" },
    created_at: "2026-04-26T09:02:00.000000Z",
  },
];
```

- [ ] **Step 3: Run vitest to confirm nothing broke**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
pnpm -F @hydrax/api-client test -- --run
```

Expected: PASS (12 tests, no new failures)

- [ ] **Step 4: Commit**

```bash
git add web/packages/api-client/src/demo-fixtures.ts
git commit -m "$(cat <<'EOF'
feat(api-client): demo fixtures cover pending+active subscriptions and audit lineage

Adds DEMO_SUBSCRIPTION_PENDING_ID/APPROVED_ID/ACTIVE_ID exports and 3
audit events tracing the pending subscription's lifecycle so the
investor and ops-console click-through has a realistic timeline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Demo mutation overlay — synthesized POST returns pre-baked pending sub

**Files:**
- Modify: `web/packages/api-client/src/api.ts`

- [ ] **Step 1: Update `demoQuery` to return the pending subscription on POST /v1/subscriptions**

In `web/packages/api-client/src/api.ts:154` `demoQuery`, after the `if (path === "/v1/audit/events") ...` block (currently around line 188), insert:

```typescript
  if (path === "/v1/subscriptions" && method === "POST") {
    // The "Subscribe" CTA pretends to create a new subscription, but the
    // demo redirects the user to the pre-baked pending subscription so the
    // /subscriptions/:id detail page has a coherent audit timeline already
    // populated. The form values are echoed in the returned object so the
    // optimistic UI feels right; the persistent state is the fixture.
    const input = body && typeof body === "object" ? (body as { product_id?: string; amount_minor?: number; currency?: string; investor_user_id?: string }) : {};
    return {
      id: "cccccccc-1111-4ccc-8ccc-000000000002",
      product_id: input.product_id ?? DEMO_PRODUCTS[2]!.id,
      investor_user_id: input.investor_user_id ?? "dddddddd-1111-4ddd-8ddd-000000000002",
      amount_minor: input.amount_minor ?? 25_000_000_000,
      currency: input.currency ?? "USD",
      status: "pending",
      created_at: "2026-04-26T09:00:00.000000Z",
      updated_at: "2026-04-26T09:00:00.000000Z",
    };
  }
```

- [ ] **Step 2: Add `createSubscription` mutation to the api builder**

In the `endpoints: (builder) => ({...})` block (around line 230), add after `transitionProduct`:

```typescript
    createSubscription: builder.mutation<Subscription, { product_id: string; amount_minor: number; currency: string; investor_user_id: string }>({
      query: (body) => ({ url: "/v1/subscriptions", method: "POST", body }),
    }),
```

- [ ] **Step 3: Re-export the hook**

After the existing `useGetSubscriptionQuery` export (around line 306), add:

```typescript
export const useCreateSubscriptionMutation: typeof hydraxApi.endpoints.createSubscription.useMutation =
  hydraxApi.endpoints.createSubscription.useMutation;
```

- [ ] **Step 4: Re-export from `web/packages/api-client/src/index.ts`**

Confirm the index file re-exports everything from `./api.js`. If it uses explicit re-exports, add:

```typescript
export {
  useCreateSubscriptionMutation,
} from "./api.js";
```

- [ ] **Step 5: Run typecheck + tests**

```bash
pnpm -F @hydrax/api-client typecheck
pnpm -F @hydrax/api-client test -- --run
```

Expected: clean typecheck, all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add web/packages/api-client/src/api.ts web/packages/api-client/src/index.ts
git commit -m "$(cat <<'EOF'
feat(api-client): createSubscription mutation + demo synthesizes pre-baked pending id

POST /v1/subscriptions in demo mode returns the pre-baked pending
subscription id so the investor /subscribe form's redirect lands on a
detail page with a populated audit timeline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: AuditTimeline component (shared in @hydrax/ui)

**Files:**
- Create: `web/packages/ui/src/AuditTimeline.tsx`
- Create: `web/packages/ui/src/AuditTimeline.test.tsx`
- Modify: `web/packages/ui/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `web/packages/ui/src/AuditTimeline.test.tsx`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AuditTimeline, type TimelineEvent } from "./AuditTimeline";

afterEach(cleanup);

const events: ReadonlyArray<TimelineEvent> = [
  { id: "1", action: "subscription.created", created_at: "2026-04-26T09:00:00Z", payload: { amount_minor: 25_000_000_000 } },
  { id: "2", action: "subscription.kyc_validated", created_at: "2026-04-26T09:01:30Z", payload: { result: "pass" } },
  { id: "3", action: "subscription.queued_for_approval", created_at: "2026-04-26T09:02:00Z", payload: null },
];

describe("AuditTimeline", () => {
  it("renders one row per event with action + relative time", () => {
    render(<AuditTimeline events={events} />);
    expect(screen.getByText("subscription.created")).toBeDefined();
    expect(screen.getByText("subscription.kyc_validated")).toBeDefined();
    expect(screen.getByText("subscription.queued_for_approval")).toBeDefined();
  });

  it("renders an empty-state when events is empty", () => {
    render(<AuditTimeline events={[]} />);
    expect(screen.getByText(/no events/i)).toBeDefined();
  });

  it("renders payload as inline json for non-null payloads", () => {
    render(<AuditTimeline events={events} />);
    expect(screen.getByText(/amount_minor/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```bash
pnpm -F @hydrax/ui test -- --run AuditTimeline
```

Expected: FAIL with "Cannot find module './AuditTimeline'"

- [ ] **Step 3: Implement the component**

Create `web/packages/ui/src/AuditTimeline.tsx`:

```typescript
import type { CSSProperties, ReactNode } from "react";
import { CheckCircle2, Clock, FileText, ShieldCheck, type LucideIcon } from "lucide-react";
import { Icon } from "./Icon";
import { Stack } from "./Stack";
import { Text } from "./Text";

export interface TimelineEvent {
  readonly id: string;
  readonly action: string;
  readonly created_at: string;
  readonly payload?: unknown;
  readonly actor_user_id?: string | null;
}

interface AuditTimelineProps {
  readonly events: ReadonlyArray<TimelineEvent>;
}

function iconForAction(action: string): { icon: LucideIcon; label: string } {
  if (action.endsWith(".created")) return { icon: FileText, label: "Created" };
  if (action.endsWith(".kyc_validated")) return { icon: ShieldCheck, label: "KYC validated" };
  if (action.endsWith(".queued_for_approval")) return { icon: Clock, label: "Queued" };
  if (action.endsWith(".approved") || action.endsWith(".transitioned")) return { icon: CheckCircle2, label: "Approved" };
  return { icon: FileText, label: "Event" };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function payloadPreview(payload: unknown): ReactNode {
  if (payload === null || payload === undefined) return null;
  try {
    return (
      <Text size="bodySm" tone="muted" family="mono">
        {JSON.stringify(payload)}
      </Text>
    );
  } catch {
    return null;
  }
}

const railStyle: CSSProperties = {
  position: "relative",
  paddingLeft: 28,
  borderLeft: "1px solid var(--hydrax-color-border)",
  marginLeft: 12,
};

const dotStyle: CSSProperties = {
  position: "absolute",
  left: -16,
  top: 4,
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "var(--hydrax-color-surface)",
  border: "1px solid var(--hydrax-color-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--hydrax-color-text-strong)",
};

export function AuditTimeline({ events }: AuditTimelineProps) {
  if (events.length === 0) {
    return (
      <Text tone="muted">No events recorded yet.</Text>
    );
  }
  return (
    <Stack gap="lg">
      {events.map((e) => {
        const { icon, label } = iconForAction(e.action);
        return (
          <div key={e.id} style={railStyle}>
            <span style={dotStyle} aria-hidden="true">
              <Icon icon={icon} label={label} size={12} />
            </span>
            <Stack gap="xs">
              <Text family="mono">{e.action}</Text>
              <Text size="bodySm" tone="muted">{formatTime(e.created_at)}</Text>
              {payloadPreview(e.payload)}
            </Stack>
          </div>
        );
      })}
    </Stack>
  );
}
```

- [ ] **Step 4: Re-export from index**

Modify `web/packages/ui/src/index.ts` — add:

```typescript
export { AuditTimeline } from "./AuditTimeline";
export type { TimelineEvent } from "./AuditTimeline";
```

- [ ] **Step 5: Run the test, confirm it passes**

```bash
pnpm -F @hydrax/ui test -- --run AuditTimeline
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add web/packages/ui/src/AuditTimeline.tsx web/packages/ui/src/AuditTimeline.test.tsx web/packages/ui/src/index.ts
git commit -m "$(cat <<'EOF'
feat(ui): AuditTimeline shared component for resource audit views

Vertical event list with rail + dot + lucide icon per action.
Used by investor /subscriptions/:id and ops-console /audit when
filtered to a single resource.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: PersonaSwitcher component (shared in @hydrax/ui)

**Files:**
- Create: `web/packages/ui/src/PersonaSwitcher.tsx`
- Create: `web/packages/ui/src/PersonaSwitcher.test.tsx`
- Modify: `web/packages/ui/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `web/packages/ui/src/PersonaSwitcher.test.tsx`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PersonaSwitcher, DEFAULT_PERSONAS } from "./PersonaSwitcher";

afterEach(cleanup);

describe("PersonaSwitcher", () => {
  it("renders the current persona label", () => {
    render(<PersonaSwitcher current="investor" />);
    expect(screen.getByText(/investor/i)).toBeDefined();
  });

  it("opens a menu showing all personas on click", () => {
    render(<PersonaSwitcher current="investor" />);
    fireEvent.click(screen.getByRole("button", { name: /switch persona/i }));
    for (const p of DEFAULT_PERSONAS) {
      expect(screen.getAllByText(new RegExp(p.label, "i")).length).toBeGreaterThan(0);
    }
  });

  it("renders an external link with the persona's url", () => {
    render(<PersonaSwitcher current="investor" />);
    fireEvent.click(screen.getByRole("button", { name: /switch persona/i }));
    const distributor = DEFAULT_PERSONAS.find((p) => p.id === "distributor")!;
    const link = screen.getByRole("link", { name: new RegExp(distributor.label, "i") });
    expect(link.getAttribute("href")).toBe(distributor.url);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```bash
pnpm -F @hydrax/ui test -- --run PersonaSwitcher
```

Expected: FAIL with "Cannot find module './PersonaSwitcher'"

- [ ] **Step 3: Implement the component**

Create `web/packages/ui/src/PersonaSwitcher.tsx`:

```typescript
import { useState, type CSSProperties } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { Briefcase, Handshake, ShieldCheck } from "lucide-react";
import { Icon } from "./Icon";

export type PersonaId = "investor" | "distributor" | "ops" | "issuer" | "admin";

export interface Persona {
  readonly id: PersonaId;
  readonly label: string;
  readonly url: string;
  readonly icon: LucideIcon;
}

function readPortalUrl(envKey: string, fallback: string): string {
  const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
  if (viteEnv?.[envKey]) return viteEnv[envKey]!;
  return fallback;
}

// Default URLs are RELATIVE so they work for both:
//  - local dev (each portal on its own Vite port; cross-portal links open
//    a new origin which is fine for the local demo)
//  - combined Railway deploy at web/portal-deploy/ where all 5 portals
//    live under one origin at /investor, /distributor, /ops, etc.
// Override per env if a portal needs to point somewhere else.
export const DEFAULT_PERSONAS: ReadonlyArray<Persona> = [
  {
    id: "investor",
    label: "Investor",
    url: readPortalUrl("VITE_INVESTOR_URL", "/investor/products"),
    icon: Briefcase,
  },
  {
    id: "distributor",
    label: "Distributor",
    url: readPortalUrl("VITE_DISTRIBUTOR_URL", "/distributor/approvals"),
    icon: Handshake,
  },
  {
    id: "ops",
    label: "Operator",
    url: readPortalUrl("VITE_OPS_URL", "/ops/audit"),
    icon: ShieldCheck,
  },
];

interface PersonaSwitcherProps {
  readonly current: PersonaId;
  readonly personas?: ReadonlyArray<Persona>;
}

const triggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  background: "var(--hydrax-color-surface)",
  border: "1px solid var(--hydrax-color-border)",
  borderRadius: "var(--hydrax-radius-sm)",
  color: "var(--hydrax-color-text-strong)",
  fontFamily: "var(--hydrax-font-sans)",
  fontSize: "var(--hydrax-type-bodySm-size)",
  cursor: "pointer",
};

const menuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  right: 0,
  minWidth: 220,
  padding: 4,
  background: "var(--hydrax-color-surface)",
  border: "1px solid var(--hydrax-color-border)",
  borderRadius: "var(--hydrax-radius-sm)",
  boxShadow: "var(--hydrax-shadow-md)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  zIndex: 20,
};

const linkStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  textDecoration: "none",
  color: "var(--hydrax-color-text)",
  borderRadius: "var(--hydrax-radius-sm)",
  fontFamily: "var(--hydrax-font-sans)",
  fontSize: "var(--hydrax-type-bodySm-size)",
};

export function PersonaSwitcher({ current, personas = DEFAULT_PERSONAS }: PersonaSwitcherProps) {
  const [open, setOpen] = useState(false);
  const currentPersona = personas.find((p) => p.id === current) ?? personas[0];

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Switch persona"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={triggerStyle}
      >
        <Icon icon={currentPersona.icon} label={currentPersona.label} size={14} />
        <span>{currentPersona.label}</span>
        <Icon icon={ChevronDown} label="Open menu" size={12} />
      </button>
      {open ? (
        <div role="menu" style={menuStyle}>
          {personas.map((p) => (
            <a
              key={p.id}
              href={p.url}
              role="menuitem"
              style={{
                ...linkStyle,
                background: p.id === current ? "var(--hydrax-color-bg)" : "transparent",
              }}
            >
              <Icon icon={p.icon} label={p.label} size={14} />
              <span>{p.label}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Re-export from index**

Modify `web/packages/ui/src/index.ts` — add:

```typescript
export { PersonaSwitcher, DEFAULT_PERSONAS } from "./PersonaSwitcher";
export type { Persona, PersonaId } from "./PersonaSwitcher";
```

- [ ] **Step 5: Run the test, confirm it passes**

```bash
pnpm -F @hydrax/ui test -- --run PersonaSwitcher
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add web/packages/ui/src/PersonaSwitcher.tsx web/packages/ui/src/PersonaSwitcher.test.tsx web/packages/ui/src/index.ts
git commit -m "$(cat <<'EOF'
feat(ui): PersonaSwitcher dropdown for cross-portal demo flow

Topbar dropdown showing 3 default personas (Investor, Distributor,
Operator) with anchor links to each portal's home route. URLs
configurable via VITE_INVESTOR_URL / VITE_DISTRIBUTOR_URL / VITE_OPS_URL,
defaulting to local dev ports 5175/5174/5176.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire PersonaSwitcher into all 5 portal topbars

**Files (5 modifications):**
- Modify: `web/apps/investor-portal/src/components/InvestorTopBar.tsx`
- Modify: `web/apps/distributor-portal/src/components/DistributorTopBar.tsx`
- Modify: `web/apps/issuer-portal/src/components/IssuerTopBar.tsx`
- Modify: `web/apps/ops-console/src/components/OpsTopBar.tsx`
- Modify: `web/apps/admin/src/components/AdminTopBar.tsx`

- [ ] **Step 1: Update each topbar — pattern shown for InvestorTopBar**

In `web/apps/investor-portal/src/components/InvestorTopBar.tsx`:
- Import `PersonaSwitcher` from `@hydrax/ui` alongside the existing imports
- After the `<button aria-label="Notifications">` block (before `<Avatar>`), insert:

```tsx
<PersonaSwitcher current="investor" />
```

For other topbars, change `current` per portal:
- `DistributorTopBar.tsx` → `current="distributor"`
- `IssuerTopBar.tsx` → `current="issuer"`
- `OpsTopBar.tsx` → `current="ops"`
- `AdminTopBar.tsx` → `current="admin"`

(For `issuer` and `admin`, the `DEFAULT_PERSONAS` list in `PersonaSwitcher` only has 3 entries — that's fine, the trigger label falls back to `personas[0]` per the implementation. Adjust later if you want to add issuer/admin as switchable personas; out of scope here.)

- [ ] **Step 2: Run typechecks for all 5 apps**

```bash
pnpm -F @hydrax/investor-portal -F @hydrax/distributor-portal -F @hydrax/issuer-portal -F @hydrax/ops-console -F @hydrax/admin typecheck
```

Expected: clean.

- [ ] **Step 3: Run vitest for all 5 apps**

```bash
pnpm -F @hydrax/investor-portal -F @hydrax/distributor-portal -F @hydrax/issuer-portal -F @hydrax/ops-console -F @hydrax/admin test -- --run
```

Expected: all existing tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add web/apps/investor-portal/src/components/InvestorTopBar.tsx \
        web/apps/distributor-portal/src/components/DistributorTopBar.tsx \
        web/apps/issuer-portal/src/components/IssuerTopBar.tsx \
        web/apps/ops-console/src/components/OpsTopBar.tsx \
        web/apps/admin/src/components/AdminTopBar.tsx
git commit -m "$(cat <<'EOF'
feat(web/portals): PersonaSwitcher wired into all 5 portal topbars

Demo flow can hop between investor → distributor → operator without
opening multiple browsers. Each topbar passes its own persona id.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Investor /products list route

**Files:**
- Create: `web/apps/investor-portal/src/routes/ProductsListRoute.tsx`
- Create: `web/apps/investor-portal/src/routes/ProductsListRoute.test.tsx`
- Modify: `web/apps/investor-portal/src/App.tsx`
- Modify: `web/apps/investor-portal/src/components/InvestorSidebar.tsx`

- [ ] **Step 1: Write the failing test**

Create `web/apps/investor-portal/src/routes/ProductsListRoute.test.tsx`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { ProductsListRoute } from "./ProductsListRoute";

afterEach(cleanup);

function renderWithProviders() {
  const store = configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (g) => g().concat(hydraxApi.middleware),
  });
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <ProductsListRoute />
      </MemoryRouter>
    </Provider>,
  );
}

describe("ProductsListRoute", () => {
  it("renders heading", () => {
    renderWithProviders();
    expect(screen.getByRole("heading", { name: /products/i, level: 1 })).toBeDefined();
  });

  it("renders fixture products after fetch", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText(/Treasury Bill 2026 Q3/i)).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```bash
pnpm -F @hydrax/investor-portal test -- --run ProductsListRoute
```

Expected: FAIL with "Cannot find module './ProductsListRoute'"

- [ ] **Step 3: Implement the route**

Create `web/apps/investor-portal/src/routes/ProductsListRoute.tsx`:

```typescript
import { Boxes, Briefcase, type LucideIcon, CheckCircle2, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useListProductsQuery, type Product } from "@hydrax/api-client";
import {
  Card,
  EmptyState,
  Heading,
  Icon,
  Skeleton,
  Stack,
  Text,
} from "@hydrax/ui";

function statusIcon(status: string): { icon: LucideIcon; label: string } {
  if (status === "active" || status === "approved") return { icon: CheckCircle2, label: status };
  return { icon: Clock, label: status };
}

function ProductRow({ product }: { readonly product: Product }) {
  const { icon, label } = statusIcon(product.status);
  return (
    <Link
      to={`/products/${product.id}`}
      data-testid={`product-row-${product.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <Card>
        <Stack direction="row" align="center" gap="md" wrap>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <Stack direction="row" gap="sm" align="center">
              <Heading level="h2" as="h3">{product.name}</Heading>
              <Text size="bodySm" tone="muted">{product.code}</Text>
            </Stack>
            <Text size="bodySm" tone="muted">{product.product_type}</Text>
          </div>
          <Stack direction="row" gap="sm" align="center">
            <Icon icon={icon} label={label} size={16} />
            <Text size="bodySm">{product.status}</Text>
          </Stack>
        </Stack>
      </Card>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <Stack gap="md">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <Skeleton width="100%" height={48} />
        </Card>
      ))}
    </Stack>
  );
}

export function ProductsListRoute() {
  const { data, isLoading, isError } = useListProductsQuery();

  if (isLoading) {
    return (
      <Stack gap="lg">
        <Heading level="h1">Products</Heading>
        <ListSkeleton />
      </Stack>
    );
  }
  if (isError || !data) {
    return (
      <Stack gap="lg">
        <Heading level="h1">Products</Heading>
        <Card><Text tone="danger" role="alert">Could not load products.</Text></Card>
      </Stack>
    );
  }
  if (data.products.length === 0) {
    return (
      <Stack gap="lg">
        <Heading level="h1">Products</Heading>
        <EmptyState icon={Boxes} iconLabel="No products" title="No products available" body="Check back later." />
      </Stack>
    );
  }
  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Heading level="h1">Products</Heading>
        <Text tone="muted">Available offerings for subscription.</Text>
      </Stack>
      <Stack gap="md">
        {data.products.map((p) => (
          <ProductRow key={p.id} product={p} />
        ))}
      </Stack>
    </Stack>
  );
}
```

- [ ] **Step 4: Wire the route in App.tsx**

Modify `web/apps/investor-portal/src/App.tsx` — add to imports:

```typescript
import { ProductsListRoute } from "./routes/ProductsListRoute";
```

In the `<Routes>` block, add:

```tsx
<Route path="/products" element={<ProductsListRoute />} />
```

- [ ] **Step 5: Add nav item to InvestorSidebar**

Modify `web/apps/investor-portal/src/components/InvestorSidebar.tsx`. Find the existing nav items and add a new entry that links to `/products`. The existing pattern uses `<NavItem icon={Briefcase} href="/products" label="Products" current={currentPath === "/products"} />` style — match the existing pattern in the file.

- [ ] **Step 6: Run the test, confirm it passes**

```bash
pnpm -F @hydrax/investor-portal test -- --run ProductsListRoute
```

Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add web/apps/investor-portal/src/routes/ProductsListRoute.tsx \
        web/apps/investor-portal/src/routes/ProductsListRoute.test.tsx \
        web/apps/investor-portal/src/App.tsx \
        web/apps/investor-portal/src/components/InvestorSidebar.tsx
git commit -m "$(cat <<'EOF'
feat(web/investor-portal): /products list route

Investor-facing products list. Reads useListProductsQuery (3 fixture
products in demo mode). Each row links to /products/:id detail.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Investor /products/:id detail with Subscribe CTA

**Files:**
- Create: `web/apps/investor-portal/src/routes/ProductDetailRoute.tsx`
- Create: `web/apps/investor-portal/src/routes/ProductDetailRoute.test.tsx`
- Modify: `web/apps/investor-portal/src/App.tsx`

- [ ] **Step 1: Write the failing test**

Create `web/apps/investor-portal/src/routes/ProductDetailRoute.test.tsx`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { ProductDetailRoute } from "./ProductDetailRoute";

afterEach(cleanup);

function renderAt(path: string) {
  const store = configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (g) => g().concat(hydraxApi.middleware),
  });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/products/:id" element={<ProductDetailRoute />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe("ProductDetailRoute", () => {
  it("renders product name when fetched", async () => {
    renderAt("/products/aaaaaaaa-1111-4aaa-8aaa-000000000003");
    await waitFor(() => {
      expect(screen.getByText(/Treasury Bill 2026 Q3/i)).toBeDefined();
    });
  });

  it("renders Subscribe CTA linking to /subscribe?product=:id", async () => {
    renderAt("/products/aaaaaaaa-1111-4aaa-8aaa-000000000003");
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /subscribe/i });
      expect(link.getAttribute("href")).toContain("/subscribe");
      expect(link.getAttribute("href")).toContain("product=aaaaaaaa-1111-4aaa-8aaa-000000000003");
    });
  });
});
```

- [ ] **Step 2: Run, confirm fails**

```bash
pnpm -F @hydrax/investor-portal test -- --run ProductDetailRoute
```

Expected: FAIL with "Cannot find module './ProductDetailRoute'"

- [ ] **Step 3: Implement**

Create `web/apps/investor-portal/src/routes/ProductDetailRoute.tsx`:

```typescript
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useGetProductQuery } from "@hydrax/api-client";
import { Card, Heading, Icon, Skeleton, Stack, StatusPill, Text } from "@hydrax/ui";

export function ProductDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useGetProductQuery(id ?? "", { skip: !id });

  if (isLoading) {
    return (
      <Stack gap="lg">
        <Skeleton width="40%" height={36} />
        <Card><Skeleton width="100%" height={120} /></Card>
      </Stack>
    );
  }
  if (isError || !data) {
    return (
      <Stack gap="lg">
        <Heading level="h1">Product not found</Heading>
        <Card><Text tone="danger" role="alert">Could not load this product.</Text></Card>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">{data.name}</Heading>
        <Text family="mono" tone="muted">{data.code}</Text>
      </Stack>
      <Card title={<Heading level="h2">Details</Heading>}>
        <Stack gap="md">
          <Stack direction="row" gap="md" align="center">
            <Text tone="muted">Status</Text>
            <StatusPill state={data.status as Parameters<typeof StatusPill>[0]["state"]} />
          </Stack>
          <Stack direction="row" gap="md" align="center">
            <Text tone="muted">Type</Text>
            <Text>{data.product_type}</Text>
          </Stack>
          {data.rails_product_id ? (
            <Stack direction="row" gap="md" align="center">
              <Text tone="muted">Rails id</Text>
              <Text family="mono">{data.rails_product_id}</Text>
            </Stack>
          ) : null}
        </Stack>
      </Card>
      <Stack direction="row" gap="md">
        <Link
          to={`/subscribe?product=${encodeURIComponent(data.id)}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: "var(--hydrax-color-accent)",
            color: "var(--hydrax-color-on-accent)",
            borderRadius: "var(--hydrax-radius-sm)",
            textDecoration: "none",
            fontFamily: "var(--hydrax-font-sans)",
          }}
        >
          <span>Subscribe</span>
          <Icon icon={ArrowRight} label="Subscribe" size={14} />
        </Link>
      </Stack>
    </Stack>
  );
}
```

- [ ] **Step 4: Wire route in App.tsx**

Add import + route:

```typescript
import { ProductDetailRoute } from "./routes/ProductDetailRoute";
// ...
<Route path="/products/:id" element={<ProductDetailRoute />} />
```

- [ ] **Step 5: Run test, confirm passes**

```bash
pnpm -F @hydrax/investor-portal test -- --run ProductDetailRoute
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add web/apps/investor-portal/src/routes/ProductDetailRoute.tsx \
        web/apps/investor-portal/src/routes/ProductDetailRoute.test.tsx \
        web/apps/investor-portal/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web/investor-portal): /products/:id detail route with Subscribe CTA

Renders product name + status pill + type + rails id. CTA links
to /subscribe?product=:id which opens the form pre-bound to this product.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Investor /subscribe form route

**Files:**
- Create: `web/apps/investor-portal/src/routes/SubscribeRoute.tsx`
- Create: `web/apps/investor-portal/src/routes/SubscribeRoute.test.tsx`
- Modify: `web/apps/investor-portal/src/App.tsx`

- [ ] **Step 1: Write the failing test**

Create `web/apps/investor-portal/src/routes/SubscribeRoute.test.tsx`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { SubscribeRoute } from "./SubscribeRoute";

afterEach(cleanup);

function renderAt(path: string) {
  const store = configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (g) => g().concat(hydraxApi.middleware),
  });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/subscribe" element={<SubscribeRoute />} />
          <Route path="/subscriptions/:id" element={<div>landed-on-detail</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe("SubscribeRoute", () => {
  it("renders form with product id from query string", () => {
    renderAt("/subscribe?product=aaaaaaaa-1111-4aaa-8aaa-000000000003");
    expect(screen.getByLabelText(/amount/i)).toBeDefined();
    expect(screen.getByText(/aaaaaaaa-1111-4aaa-8aaa-000000000003/)).toBeDefined();
  });

  it("submits and navigates to /subscriptions/:id on success", async () => {
    renderAt("/subscribe?product=aaaaaaaa-1111-4aaa-8aaa-000000000003");
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "250000" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByText("landed-on-detail")).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run, confirm fails**

```bash
pnpm -F @hydrax/investor-portal test -- --run SubscribeRoute
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `web/apps/investor-portal/src/routes/SubscribeRoute.tsx`:

```typescript
import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCreateSubscriptionMutation } from "@hydrax/api-client";
import { Button, Card, Heading, Stack, Text } from "@hydrax/ui";

const HARDCODED_INVESTOR = "dddddddd-1111-4ddd-8ddd-000000000002";

export function SubscribeRoute() {
  const [params] = useSearchParams();
  const productId = params.get("product") ?? "";
  const [amount, setAmount] = useState("250000");
  const [createSubscription, { isLoading, error }] = useCreateSubscriptionMutation();
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const amountMinor = Math.round(Number(amount) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) return;
    const result = await createSubscription({
      product_id: productId,
      amount_minor: amountMinor,
      currency: "USD",
      investor_user_id: HARDCODED_INVESTOR,
    });
    if ("data" in result && result.data) {
      navigate(`/subscriptions/${result.data.id}`);
    }
  }

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">Subscribe</Heading>
        <Text tone="muted">Enter the amount you wish to subscribe.</Text>
      </Stack>
      <Card title={<Heading level="h2">Subscription details</Heading>}>
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <Stack gap="xs">
              <Text tone="muted">Product</Text>
              <Text family="mono">{productId}</Text>
            </Stack>
            <Stack gap="xs">
              <label htmlFor="amount">
                <Text tone="muted">Amount (USD)</Text>
              </label>
              <input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={1}
                step={1}
                style={{
                  padding: "8px 10px",
                  background: "var(--hydrax-color-surface)",
                  border: "1px solid var(--hydrax-color-border)",
                  borderRadius: "var(--hydrax-radius-sm)",
                  color: "var(--hydrax-color-text-strong)",
                  fontFamily: "var(--hydrax-font-sans)",
                  fontSize: "var(--hydrax-type-body-size)",
                  width: 240,
                }}
              />
            </Stack>
            {error ? (
              <Text tone="danger" role="alert">Submission failed.</Text>
            ) : null}
            <Stack direction="row" gap="md">
              <Button type="submit" disabled={isLoading || !productId}>
                {isLoading ? "Submitting..." : "Submit"}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
```

- [ ] **Step 4: Wire route in App.tsx**

```typescript
import { SubscribeRoute } from "./routes/SubscribeRoute";
// ...
<Route path="/subscribe" element={<SubscribeRoute />} />
```

- [ ] **Step 5: Run test, confirm passes**

```bash
pnpm -F @hydrax/investor-portal test -- --run SubscribeRoute
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add web/apps/investor-portal/src/routes/SubscribeRoute.tsx \
        web/apps/investor-portal/src/routes/SubscribeRoute.test.tsx \
        web/apps/investor-portal/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web/investor-portal): /subscribe form posts and redirects to detail

POST /v1/subscriptions in demo mode returns the pre-baked pending
subscription id, so the redirect lands on a detail page with a
populated audit timeline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Investor /subscriptions/:id detail with audit timeline

**Files:**
- Create: `web/apps/investor-portal/src/routes/SubscriptionDetailRoute.tsx`
- Create: `web/apps/investor-portal/src/routes/SubscriptionDetailRoute.test.tsx`
- Modify: `web/apps/investor-portal/src/App.tsx`

- [ ] **Step 1: Write the failing test**

Create `web/apps/investor-portal/src/routes/SubscriptionDetailRoute.test.tsx`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { SubscriptionDetailRoute } from "./SubscriptionDetailRoute";

afterEach(cleanup);

function renderAt(path: string) {
  const store = configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (g) => g().concat(hydraxApi.middleware),
  });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/subscriptions/:id" element={<SubscriptionDetailRoute />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe("SubscriptionDetailRoute", () => {
  it("renders subscription status when fetched", async () => {
    renderAt("/subscriptions/cccccccc-1111-4ccc-8ccc-000000000002");
    await waitFor(() => {
      expect(screen.getByText(/pending/i)).toBeDefined();
    });
  });

  it("renders audit timeline events for the subscription", async () => {
    renderAt("/subscriptions/cccccccc-1111-4ccc-8ccc-000000000002");
    await waitFor(() => {
      expect(screen.getByText(/subscription.created/i)).toBeDefined();
      expect(screen.getByText(/subscription.kyc_validated/i)).toBeDefined();
      expect(screen.getByText(/subscription.queued_for_approval/i)).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run, confirm fails**

```bash
pnpm -F @hydrax/investor-portal test -- --run SubscriptionDetailRoute
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `web/apps/investor-portal/src/routes/SubscriptionDetailRoute.tsx`:

```typescript
import { useParams } from "react-router-dom";
import { useGetSubscriptionQuery, useListAuditEventsQuery } from "@hydrax/api-client";
import { AuditTimeline, Card, Heading, Skeleton, Stack, StatusPill, Text } from "@hydrax/ui";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

function formatAmount(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(major);
}

export function SubscriptionDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const sub = useGetSubscriptionQuery(id ?? "", { skip: !id });
  const events = useListAuditEventsQuery(
    { tenant_id: TENANT_ID, resource_type: "subscription", resource_id: id ?? "" },
    { skip: !id },
  );

  if (sub.isLoading) {
    return (
      <Stack gap="lg">
        <Skeleton width="40%" height={36} />
        <Card><Skeleton width="100%" height={120} /></Card>
      </Stack>
    );
  }
  if (sub.isError || !sub.data) {
    return (
      <Stack gap="lg">
        <Heading level="h1">Subscription not found</Heading>
        <Card><Text tone="danger" role="alert">Could not load this subscription.</Text></Card>
      </Stack>
    );
  }

  const allEvents = events.data ?? [];
  const subscriptionEvents = allEvents.filter(
    (e) => e.resource_type === "subscription" && e.resource_id === sub.data.id,
  );

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Heading level="h1">Subscription</Heading>
        <Text family="mono" tone="muted">{sub.data.id}</Text>
      </Stack>
      <Card title={<Heading level="h2">Details</Heading>}>
        <Stack gap="md">
          <Stack direction="row" gap="md" align="center">
            <Text tone="muted">Status</Text>
            <StatusPill state={sub.data.status as Parameters<typeof StatusPill>[0]["state"]} />
          </Stack>
          <Stack direction="row" gap="md" align="center">
            <Text tone="muted">Amount</Text>
            <Text>{formatAmount(sub.data.amount_minor, sub.data.currency)}</Text>
          </Stack>
          <Stack direction="row" gap="md" align="center">
            <Text tone="muted">Product</Text>
            <Text family="mono">{sub.data.product_id}</Text>
          </Stack>
        </Stack>
      </Card>
      <Card title={<Heading level="h2">Audit timeline</Heading>}>
        <AuditTimeline events={subscriptionEvents} />
      </Card>
    </Stack>
  );
}
```

- [ ] **Step 4: Wire route in App.tsx**

```typescript
import { SubscriptionDetailRoute } from "./routes/SubscriptionDetailRoute";
// ...
<Route path="/subscriptions/:id" element={<SubscriptionDetailRoute />} />
```

(Note: existing `/subscriptions` lookup route stays; the new path is `/subscriptions/:id` and react-router will prefer the more specific match.)

- [ ] **Step 5: Run test, confirm passes**

```bash
pnpm -F @hydrax/investor-portal test -- --run SubscriptionDetailRoute
```

Expected: PASS (2 tests). Note: the audit-events filter on the BFF requires `tenant_id`, `resource_type`, `resource_id` — the demo `demoQuery` returns ALL events for `/v1/audit/events`, then we filter client-side. That's intentional for demo.

- [ ] **Step 6: Commit**

```bash
git add web/apps/investor-portal/src/routes/SubscriptionDetailRoute.tsx \
        web/apps/investor-portal/src/routes/SubscriptionDetailRoute.test.tsx \
        web/apps/investor-portal/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web/investor-portal): /subscriptions/:id detail with audit timeline

Renders subscription status pill + amount + product + filtered
AuditTimeline. Closes the click-through loop: investor sees their
"pending" subscription and the chain of audit events that landed it
in the approval queue.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Distributor /approvals — toast + optimistic update

**Files:**
- Modify: `web/apps/distributor-portal/src/routes/ApprovalsRoute.tsx`
- Modify: `web/apps/distributor-portal/src/App.tsx` (wrap in `<ToastProvider>`)

- [ ] **Step 1: Wrap App in ToastProvider**

In `web/apps/distributor-portal/src/App.tsx`, import `ToastProvider` from `@hydrax/ui` and wrap the AppShell. Pattern (adjust to existing structure):

```tsx
import { AppShell, ToastProvider } from "@hydrax/ui";
// ...
<ToastProvider>
  <AppShell ... >
    ...
  </AppShell>
</ToastProvider>
```

- [ ] **Step 2: Wire useToast() into ApprovalsRoute**

Modify `web/apps/distributor-portal/src/routes/ApprovalsRoute.tsx`. Import `useToast`:

```typescript
import { useToast } from "@hydrax/ui";
```

In the component, replace the existing `onDecide` with:

```typescript
  const toast = useToast();
  const onDecide = async (id: string, status: "approved" | "rejected") => {
    const result = await decide({ id, status, decided_by_user_id: HARDCODED_DECIDER });
    if ("data" in result) {
      toast.show({
        tone: status === "approved" ? "success" : "info",
        message: status === "approved" ? "Approval granted" : "Approval rejected",
      });
    } else {
      toast.show({ tone: "danger", message: "Decision failed" });
    }
    refetch();
  };
```

(Inspect [web/packages/ui/src/Toast.tsx](../../web/packages/ui/src/Toast.tsx) and [web/packages/ui/src/ToastProvider.tsx](../../web/packages/ui/src/ToastProvider.tsx) to confirm the exact API surface — adjust `tone` / method name if the existing surface differs from `show({tone, message})`.)

- [ ] **Step 3: Run typecheck + existing tests**

```bash
pnpm -F @hydrax/distributor-portal typecheck
pnpm -F @hydrax/distributor-portal test -- --run
```

Expected: clean typecheck, all existing tests still PASS. (If existing ApprovalsRoute test breaks because ToastProvider isn't wrapping it, add the wrapper to the test setup.)

- [ ] **Step 4: Commit**

```bash
git add web/apps/distributor-portal/src/routes/ApprovalsRoute.tsx \
        web/apps/distributor-portal/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web/distributor-portal): toast feedback on Approve/Reject

Wraps app in ToastProvider; ApprovalsRoute fires success/info/danger
toast on decision. Distributor demo step now has visible feedback
instead of silent state change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Final workspace-wide verification

- [ ] **Step 1: Workspace-wide typecheck**

```bash
cd /home/naim/.openclaw/workspace/hydrax-app
pnpm -r --if-present typecheck
```

Expected: clean across all 12 workspaces.

- [ ] **Step 2: Workspace-wide tests**

```bash
pnpm -r --if-present test -- --run
```

Expected: all tests PASS. New count: existing 257 + ~12 new = ~269.

- [ ] **Step 3: Workspace-wide build**

```bash
pnpm -r --if-present build
```

Expected: 5 apps emit dist/. (If OOM under parallel pressure as past sessions noted, fall back to per-workspace builds.)

- [ ] **Step 4: Manual smoke (optional, recommended)**

```bash
VITE_DEMO_MODE=true pnpm -F @hydrax/investor-portal dev
# In another terminal:
VITE_DEMO_MODE=true pnpm -F @hydrax/distributor-portal dev
VITE_DEMO_MODE=true pnpm -F @hydrax/ops-console dev
```

Open http://localhost:5175/products in browser. Walk the storyline. Confirm:
- Products list shows 3 products
- Click "Treasury Bill 2026 Q3" → detail page
- Click Subscribe → form
- Submit → lands on /subscriptions/cccccccc-... with audit timeline
- Click PersonaSwitcher → Distributor → opens 5174/approvals
- Click Approve → toast shown
- Click PersonaSwitcher → Operator → opens 5176/audit
- Audit page shows the events (filter wiring may be a follow-up if not in this slice)

- [ ] **Step 5: Update STATE.yaml**

Append `verification_log` entry summarizing the demo-mode end-to-end slice (commit count, test counts, what's wired). Do NOT overwrite `current_focus`.

- [ ] **Step 6: Commit STATE.yaml update**

```bash
git add STATE.yaml
git commit -m "$(cat <<'EOF'
chore(state): record demo-mode end-to-end slice closure

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review (post-write)

**Spec coverage:** All 7 build items from the recommendation list mapped to tasks 1-10. Item 0 (decisions) was a confirmation step, no code. Final verification + STATE update is task 11.

**Placeholder scan:** No "TODO" / "implement later" / "similar to task N" left. Code blocks are complete and copy-pasteable.

**Type consistency:** Hook names match throughout — `useCreateSubscriptionMutation`, `useGetSubscriptionQuery`, `useListAuditEventsQuery`, `useListPendingApprovalsQuery`, `useDecideApprovalMutation` all already exist in [api.ts](../../web/packages/api-client/src/api.ts) per the read at planning time. Component names (`AuditTimeline`, `PersonaSwitcher`) are stable across tasks. Fixture id `cccccccc-1111-4ccc-8ccc-000000000002` (the new pending sub) referenced consistently.

**Risks:**
- ToastProvider API surface may differ from `show({tone, message})` — task 10 instructs the implementer to inspect the actual file before wiring. Fallback: simplest possible `<Toast>` invocation.
- StatusPill `state` prop type may not include all subscription statuses — cast may need adjustment in the live code.
- The api-client comment notes mutations don't persist; this is by design for the demo.

## Out of scope

- Real auth / session management (DEMO_MODE bypass throughout)
- Magic-link SMTP delivery (separate slice 2c plan exists)
- Passkey browser ceremony (slice 2d plan, future)
- Real Canton synchronizer (PRD §15 deferred)
- Cross-portal cache sync (each portal is self-contained)
- Mutation persistence across page reloads (page reload resets to fixture state — a feature)
- Issuer + Admin personas in PersonaSwitcher (only 3 demo personas)
- ops-console /audit filter-by-resource UX (future polish)

## Handoff

After all 11 tasks land:
- Branch is ready for the interview demo
- Run `VITE_DEMO_MODE=true pnpm -F @hydrax/investor-portal dev` (and the other two portals) to drive the click-through locally
- For deployed demo: set `VITE_DEMO_MODE=true` and `VITE_INVESTOR_URL=https://...` etc. as Vite build env on each Railway static-site deploy
- The Daml spike sit at the end of the click-through; show with `cd services/canton-adapter/daml/hydrax-governance && daml test`
