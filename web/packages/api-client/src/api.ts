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
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CreateProductInput {
  readonly tenant_id: string;
  readonly code: string;
  readonly name: string;
  readonly product_type: string;
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
