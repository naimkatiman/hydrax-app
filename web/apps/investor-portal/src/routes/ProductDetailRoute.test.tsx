import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { ProductDetailRoute } from "./ProductDetailRoute";

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
          <Route path="/products/:id" element={<ProductDetailRoute />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

const PRODUCT = {
  id: "p-tbill",
  tenant_id: "t-1",
  code: "TBILL-Q3",
  name: "Treasury Bill 2026 Q3",
  product_type: "treasury_equivalent",
  status: "pending",
  rails_product_id: "rails-tbill-1",
  created_at: "2026-04-26T00:00:00Z",
  updated_at: "2026-04-26T00:00:00Z",
};

describe("<ProductDetailRoute>", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders product name when fetched", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(PRODUCT), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    renderAt("/products/p-tbill");
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /Treasury Bill 2026 Q3/i })).toBeInTheDocument();
    });
  });

  it("renders Subscribe CTA linking to /subscribe?product=:id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(PRODUCT), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    renderAt("/products/p-tbill");
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /subscribe/i });
      expect(link.getAttribute("href")).toBe("/subscribe?product=p-tbill");
    });
  });

  it("renders error card when BFF returns 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    renderAt("/products/p-tbill");
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/could not load this product/i);
    });
  });
});
