import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { SubscriptionDetailRoute } from "./SubscriptionDetailRoute";

function makeStore() {
  return configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (g) => g().concat(hydraxApi.middleware),
  });
}

function renderAt(path: string) {
  const store = makeStore();
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

const SUBSCRIPTION_ID = "cccccccc-1111-4ccc-8ccc-000000000002";

const SUBSCRIPTION = {
  id: SUBSCRIPTION_ID,
  product_id: "p-tbill",
  investor_user_id: "inv-1",
  amount_minor: 25_000_000_000,
  currency: "USD",
  status: "pending",
  created_at: "2026-04-26T09:00:00Z",
  updated_at: "2026-04-26T09:00:00Z",
};

const EVENTS = [
  {
    id: "e1",
    tenant_id: "t-1",
    actor_user_id: null,
    action: "subscription.created",
    resource_type: "subscription",
    resource_id: SUBSCRIPTION_ID,
    payload: { amount_minor: 25_000_000_000 },
    created_at: "2026-04-26T09:00:00Z",
  },
  {
    id: "e2",
    tenant_id: "t-1",
    actor_user_id: null,
    action: "subscription.kyc_validated",
    resource_type: "subscription",
    resource_id: SUBSCRIPTION_ID,
    payload: { result: "pass" },
    created_at: "2026-04-26T09:01:30Z",
  },
];

describe("<SubscriptionDetailRoute>", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders subscription status when fetched", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes("/v1/subscriptions/")) {
        return new Response(JSON.stringify(SUBSCRIPTION), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/v1/audit/events")) {
        return new Response(JSON.stringify(EVENTS), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    });
    renderAt(`/subscriptions/${SUBSCRIPTION_ID}`);
    await waitFor(() => {
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });
  });

  it("renders audit timeline events for the subscription", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes("/v1/subscriptions/")) {
        return new Response(JSON.stringify(SUBSCRIPTION), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/v1/audit/events")) {
        return new Response(JSON.stringify(EVENTS), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    });
    renderAt(`/subscriptions/${SUBSCRIPTION_ID}`);
    await waitFor(() => {
      expect(screen.getByText(/subscription.created/)).toBeInTheDocument();
      expect(screen.getByText(/subscription.kyc_validated/)).toBeInTheDocument();
    });
  });
});
