import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";

import {
  DEMO_AUDIT_EVENTS,
  DEMO_APPROVALS,
  DEMO_COMPOSITE_HEALTH,
  DEMO_HEALTH,
  DEMO_LIST_PRODUCTS_RESPONSE,
  DEMO_PRODUCTS,
  DEMO_SUBSCRIPTIONS,
} from "./demo-fixtures.js";

export interface HealthResponse {
  readonly ok: boolean;
}

export type UpstreamHealthStatus = "ok" | "down" | "unreachable";
export type CompositeHealthStatus = "ok" | "degraded" | "down";

export interface UpstreamHealth {
  readonly service: string;
  readonly url: string;
  readonly ok: boolean;
  readonly status: UpstreamHealthStatus;
  readonly httpStatus?: number;
  readonly error?: string;
  readonly latencyMs: number;
}

export interface CompositeHealth {
  readonly service: "bff";
  readonly status: CompositeHealthStatus;
  readonly upstreams: ReadonlyArray<UpstreamHealth>;
}

export interface Product {
  readonly id: string;
  readonly tenant_id: string;
  readonly code: string;
  readonly name: string;
  readonly product_type: string;
  readonly status: string;
  readonly rails_product_id?: string;
  readonly allowed_next?: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CreateProductInput {
  readonly tenant_id: string;
  readonly code: string;
  readonly name: string;
  readonly product_type: string;
}

export interface ListProductsArgs {
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListProductsResponse {
  readonly products: ReadonlyArray<Product>;
  readonly next_offset: number | null;
}

export interface TransitionProductArgs {
  readonly id: string;
  readonly to: string;
}

export interface AuditEvent {
  readonly id: string;
  readonly tenant_id: string;
  readonly actor_user_id: string | null;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly payload: unknown;
  readonly created_at: string;
}

export interface ListEventsArgs {
  readonly tenant_id: string;
  readonly resource_type: string;
  readonly resource_id: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Approval {
  readonly id: string;
  readonly tenant_id: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly status: ApprovalStatus;
  readonly decided_by_user_id?: string;
  readonly decided_at?: string;
  readonly created_at: string;
}

export interface DecideApprovalArgs {
  readonly id: string;
  readonly status: "approved" | "rejected";
  readonly decided_by_user_id: string;
}

export interface Subscription {
  readonly id: string;
  readonly product_id: string;
  readonly investor_user_id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

type ViteEnv = { readonly VITE_BFF_URL?: string; readonly VITE_DEMO_MODE?: string };

function readBffUrl(): string {
  const viteEnv = (import.meta as { env?: ViteEnv }).env;
  if (viteEnv?.VITE_BFF_URL) return viteEnv.VITE_BFF_URL;
  if (typeof process !== "undefined" && process.env.VITE_BFF_URL) {
    return process.env.VITE_BFF_URL;
  }
  return "http://localhost:8080";
}

function readDemoMode(): boolean {
  const viteEnv = (import.meta as { env?: ViteEnv }).env;
  if (viteEnv?.VITE_DEMO_MODE === "true" || viteEnv?.VITE_DEMO_MODE === "1") return true;
  if (typeof process !== "undefined" && (process.env.VITE_DEMO_MODE === "true" || process.env.VITE_DEMO_MODE === "1")) {
    return true;
  }
  return false;
}

const BFF_URL = readBffUrl();
const DEMO_MODE = readDemoMode();

/**
 * demoBaseQuery returns canned fixtures for every endpoint the portals
 * consume. Toggle via VITE_DEMO_MODE=true at build time. Lets the 5
 * static-site portals run in production without a live BFF — useful for
 * marketing demos, design reviews, and smoke-checking deploys before
 * the real backend ships per-portal.
 *
 * Mutation endpoints (createProduct, transitionProduct, decideApproval)
 * return a synthesized response shape but do NOT mutate the fixtures —
 * the next query call returns the original list. This is intentional:
 * demo mode is read-mostly; round-tripping mutations would require a
 * client-side store and feels misleading for a demo deployment.
 */
function demoQuery(url: string, method: string, body?: unknown): unknown {
  const path = url.split("?")[0] ?? url;

  if (path === "/health") return DEMO_HEALTH;
  if (path === "/healthz/composite") return DEMO_COMPOSITE_HEALTH;

  if (path === "/v1/products") {
    if (method === "POST" && body && typeof body === "object") {
      const input = body as { tenant_id?: string; code?: string; name?: string; product_type?: string };
      return {
        ...DEMO_PRODUCTS[0]!,
        id: "demo-new-product",
        code: input.code ?? "DEMO-CODE",
        name: input.name ?? "Demo Product",
        product_type: input.product_type ?? "short_duration_credit",
        status: "pending",
        allowed_next: ["approved", "cancelled"],
      };
    }
    return DEMO_LIST_PRODUCTS_RESPONSE;
  }

  const productMatch = /^\/v1\/products\/([^/]+)(\/transition)?$/.exec(path);
  if (productMatch) {
    const id = decodeURIComponent(productMatch[1]!);
    const isTransition = Boolean(productMatch[2]);
    const product = DEMO_PRODUCTS.find((p) => p.id === id) ?? DEMO_PRODUCTS[0]!;
    if (isTransition && method === "POST" && body && typeof body === "object") {
      const to = (body as { to?: string }).to ?? product.status;
      return { ...product, status: to };
    }
    return product;
  }

  if (path === "/v1/audit/events") return DEMO_AUDIT_EVENTS;

  if (path === "/v1/approvals") return DEMO_APPROVALS;

  const approvalDecide = /^\/v1\/approvals\/([^/]+)\/decide$/.exec(path);
  if (approvalDecide) {
    const id = decodeURIComponent(approvalDecide[1]!);
    const decision = body && typeof body === "object" ? (body as { status?: "approved" | "rejected" }).status ?? "approved" : "approved";
    const approval = DEMO_APPROVALS.find((a) => a.id === id) ?? DEMO_APPROVALS[0]!;
    return { ...approval, status: decision, decided_at: "2026-04-26T00:00:00.000000Z" };
  }

  const subMatch = /^\/v1\/subscriptions\/([^/]+)$/.exec(path);
  if (subMatch) {
    const id = decodeURIComponent(subMatch[1]!);
    return DEMO_SUBSCRIPTIONS[id] ?? Object.values(DEMO_SUBSCRIPTIONS)[0];
  }

  // Unknown path — return empty object so RTK Query's onSuccess fires.
  return {};
}

const realBaseQuery = fetchBaseQuery({ baseUrl: BFF_URL });

const demoBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
) => {
  const url = typeof args === "string" ? args : args.url;
  const method = typeof args === "string" ? "GET" : (args.method ?? "GET");
  const body = typeof args === "string" ? undefined : args.body;
  await new Promise((r) => setTimeout(r, 60)); // simulate network for skeleton states
  const data = demoQuery(url, method, body);
  return { data };
};

const baseQuery = DEMO_MODE ? demoBaseQuery : realBaseQuery;

export const isDemoMode = (): boolean => DEMO_MODE;

export const hydraxApi = createApi({
  reducerPath: "hydraxApi",
  baseQuery,
  endpoints: (builder) => ({
    getHealth: builder.query<HealthResponse, void>({
      query: () => "/health",
    }),
    getHealthzComposite: builder.query<CompositeHealth, void>({
      query: () => "/healthz/composite",
    }),
    createProduct: builder.mutation<Product, CreateProductInput>({
      query: (body) => ({ url: "/v1/products", method: "POST", body }),
    }),
    listProducts: builder.query<ListProductsResponse, ListProductsArgs | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args && args.limit !== undefined) params.set("limit", String(args.limit));
        if (args && args.offset !== undefined) params.set("offset", String(args.offset));
        const qs = params.toString();
        return qs ? `/v1/products?${qs}` : "/v1/products";
      },
    }),
    getProduct: builder.query<Product, string>({
      query: (id) => ({ url: `/v1/products/${encodeURIComponent(id)}` }),
    }),
    transitionProduct: builder.mutation<Product, TransitionProductArgs>({
      query: ({ id, to }) => ({
        url: `/v1/products/${encodeURIComponent(id)}/transition`,
        method: "POST",
        body: { to },
      }),
    }),
    listAuditEvents: builder.query<ReadonlyArray<AuditEvent>, ListEventsArgs>({
      query: ({ tenant_id, resource_type, resource_id }) =>
        `/v1/audit/events?tenant_id=${encodeURIComponent(tenant_id)}&resource_type=${encodeURIComponent(resource_type)}&resource_id=${encodeURIComponent(resource_id)}`,
    }),
    listPendingApprovals: builder.query<ReadonlyArray<Approval>, void>({
      query: () => "/v1/approvals",
    }),
    decideApproval: builder.mutation<Approval, DecideApprovalArgs>({
      query: ({ id, status, decided_by_user_id }) => ({
        url: `/v1/approvals/${encodeURIComponent(id)}/decide`,
        method: "POST",
        body: { status, decided_by_user_id },
      }),
    }),
    getSubscription: builder.query<Subscription, string>({
      query: (id) => ({ url: `/v1/subscriptions/${encodeURIComponent(id)}` }),
    }),
  }),
});

export const useGetHealthQuery: typeof hydraxApi.endpoints.getHealth.useQuery =
  hydraxApi.endpoints.getHealth.useQuery;

export const useGetHealthzCompositeQuery: typeof hydraxApi.endpoints.getHealthzComposite.useQuery =
  hydraxApi.endpoints.getHealthzComposite.useQuery;

export const useCreateProductMutation: typeof hydraxApi.endpoints.createProduct.useMutation =
  hydraxApi.endpoints.createProduct.useMutation;

export const useGetProductQuery: typeof hydraxApi.endpoints.getProduct.useQuery =
  hydraxApi.endpoints.getProduct.useQuery;

export const useListProductsQuery: typeof hydraxApi.endpoints.listProducts.useQuery =
  hydraxApi.endpoints.listProducts.useQuery;

export const useTransitionProductMutation: typeof hydraxApi.endpoints.transitionProduct.useMutation =
  hydraxApi.endpoints.transitionProduct.useMutation;

export const useListAuditEventsQuery: typeof hydraxApi.endpoints.listAuditEvents.useQuery =
  hydraxApi.endpoints.listAuditEvents.useQuery;

export const useListPendingApprovalsQuery: typeof hydraxApi.endpoints.listPendingApprovals.useQuery =
  hydraxApi.endpoints.listPendingApprovals.useQuery;

export const useDecideApprovalMutation: typeof hydraxApi.endpoints.decideApproval.useMutation =
  hydraxApi.endpoints.decideApproval.useMutation;

export const useGetSubscriptionQuery: typeof hydraxApi.endpoints.getSubscription.useQuery =
  hydraxApi.endpoints.getSubscription.useQuery;
