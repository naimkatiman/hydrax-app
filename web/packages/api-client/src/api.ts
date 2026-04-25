import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { TypedUseQuery } from "@reduxjs/toolkit/query/react";

export interface HealthResponse {
  readonly ok: boolean;
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
  }),
});

export const useGetHealthQuery: TypedUseQuery<HealthResponse, void, ReturnType<typeof fetchBaseQuery>> =
  hydraxApi.endpoints.getHealth.useQuery;
