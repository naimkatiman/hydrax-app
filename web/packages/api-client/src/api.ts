import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { TypedUseQuery } from "@reduxjs/toolkit/query/react";

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

export const useGetHealthQuery: TypedUseQuery<HealthResponse, void, ReturnType<typeof fetchBaseQuery>> =
  hydraxApi.endpoints.getHealth.useQuery;
