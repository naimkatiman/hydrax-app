import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

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

type ViteEnv = { readonly VITE_BFF_URL?: string };

function readBffUrl(): string {
  const viteEnv = (import.meta as { env?: ViteEnv }).env;
  if (viteEnv?.VITE_BFF_URL) return viteEnv.VITE_BFF_URL;
  if (typeof process !== "undefined" && process.env.VITE_BFF_URL) {
    return process.env.VITE_BFF_URL;
  }
  return "http://localhost:8080";
}

const BFF_URL = readBffUrl();

export const hydraxApi = createApi({
  reducerPath: "hydraxApi",
  baseQuery: fetchBaseQuery({ baseUrl: BFF_URL }),
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
