import type {
  Approval,
  AuditEvent,
  CompositeHealth,
  HealthResponse,
  ListProductsResponse,
  Product,
  Subscription,
} from "./api.js";

const ISO_NOW = "2026-04-26T00:00:00.000000Z";
const TENANT_ID = "11111111-1111-1111-1111-111111111111";

export const DEMO_PRODUCTS: ReadonlyArray<Product> = [
  {
    id: "aaaaaaaa-1111-4aaa-8aaa-000000000001",
    tenant_id: TENANT_ID,
    code: "SDC-2026-Q2-A",
    name: "Short Duration Credit 2026 Q2 — Tranche A",
    product_type: "short_duration_credit",
    status: "active",
    rails_product_id: "rails-prod-001",
    allowed_next: ["matured", "cancelled"],
    created_at: ISO_NOW,
    updated_at: ISO_NOW,
  },
  {
    id: "aaaaaaaa-1111-4aaa-8aaa-000000000002",
    tenant_id: TENANT_ID,
    code: "MMF-2026-USD-1",
    name: "Money Market Fund — USD Series 1",
    product_type: "money_market_fund",
    status: "approved",
    allowed_next: ["active", "cancelled"],
    created_at: ISO_NOW,
    updated_at: ISO_NOW,
  },
  {
    id: "aaaaaaaa-1111-4aaa-8aaa-000000000003",
    tenant_id: TENANT_ID,
    code: "TBILL-2026-Q3",
    name: "Treasury Bill 2026 Q3",
    product_type: "treasury_equivalent",
    status: "pending",
    allowed_next: ["approved", "cancelled"],
    created_at: ISO_NOW,
    updated_at: ISO_NOW,
  },
];

export const DEMO_APPROVALS: ReadonlyArray<Approval> = [
  {
    id: "bbbbbbbb-1111-4bbb-8bbb-000000000001",
    tenant_id: TENANT_ID,
    resource_type: "product",
    resource_id: DEMO_PRODUCTS[1]!.id,
    status: "pending",
    created_at: ISO_NOW,
  },
  {
    id: "bbbbbbbb-1111-4bbb-8bbb-000000000002",
    tenant_id: TENANT_ID,
    resource_type: "subscription",
    resource_id: "cccccccc-1111-4ccc-8ccc-000000000001",
    status: "pending",
    created_at: ISO_NOW,
  },
];

const SUB_APPROVED_ID = "cccccccc-1111-4ccc-8ccc-000000000001";
const SUB_PENDING_ID = "cccccccc-1111-4ccc-8ccc-000000000002";
const SUB_ACTIVE_ID = "cccccccc-1111-4ccc-8ccc-000000000003";

export const DEMO_SUBSCRIPTION_APPROVED_ID = SUB_APPROVED_ID;
export const DEMO_SUBSCRIPTION_PENDING_ID = SUB_PENDING_ID;
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
    product_id: DEMO_PRODUCTS[2]!.id,
    investor_user_id: "dddddddd-1111-4ddd-8ddd-000000000002",
    amount_minor: 25_000_000_000,
    currency: "USD",
    status: "pending",
    created_at: "2026-04-26T09:00:00.000000Z",
    updated_at: "2026-04-26T09:02:00.000000Z",
  },
  [SUB_ACTIVE_ID]: {
    id: SUB_ACTIVE_ID,
    product_id: DEMO_PRODUCTS[1]!.id,
    investor_user_id: "dddddddd-1111-4ddd-8ddd-000000000003",
    amount_minor: 50_000_000_000,
    currency: "USD",
    status: "active",
    created_at: "2026-04-20T10:00:00.000000Z",
    updated_at: ISO_NOW,
  },
};

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

export const DEMO_HEALTH: HealthResponse = { ok: true };

export const DEMO_COMPOSITE_HEALTH: CompositeHealth = {
  service: "bff",
  status: "ok",
  upstreams: [
    { service: "workflow-svc", url: "demo://workflow", ok: true, status: "ok", latencyMs: 4 },
    { service: "approval-svc", url: "demo://approval", ok: true, status: "ok", latencyMs: 3 },
    { service: "audit-svc", url: "demo://audit", ok: true, status: "ok", latencyMs: 2 },
    { service: "hydrax-adapter", url: "demo://hydrax", ok: true, status: "ok", latencyMs: 5 },
    { service: "canton-adapter", url: "demo://canton", ok: true, status: "ok", latencyMs: 6 },
    { service: "notify-svc", url: "demo://notify", ok: true, status: "ok", latencyMs: 2 },
    { service: "integration-svc", url: "demo://integration", ok: true, status: "ok", latencyMs: 3 },
    { service: "market-data-svc", url: "demo://market-data", ok: true, status: "ok", latencyMs: 4 },
  ],
};

export const DEMO_LIST_PRODUCTS_RESPONSE: ListProductsResponse = {
  products: DEMO_PRODUCTS,
  next_offset: null,
};
