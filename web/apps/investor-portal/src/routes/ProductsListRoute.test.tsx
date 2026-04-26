import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { hydraxApi } from "@hydrax/api-client";
import { ProductsListRoute } from "./ProductsListRoute";

function makeStore() {
  return configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (g) => g().concat(hydraxApi.middleware),
  });
}

function Wrapper({ children }: { readonly children: ReactNode }) {
  const store = makeStore();
  return (
    <Provider store={store}>
      <MemoryRouter initialEntries={["/products"]}>{children}</MemoryRouter>
    </Provider>
  );
}

function renderRoute() {
  return render(
    <Wrapper>
      <ProductsListRoute />
    </Wrapper>,
  );
}

describe("<ProductsListRoute>", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders heading", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    renderRoute();
    expect(screen.getByRole("heading", { level: 1, name: /products/i })).toBeInTheDocument();
  });

  it("renders one row per product when the BFF returns data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          products: [
            {
              id: "p-tbill",
              tenant_id: "t-1",
              code: "TBILL-Q3",
              name: "Treasury Bill 2026 Q3",
              product_type: "treasury_equivalent",
              status: "pending",
              created_at: "2026-04-26T00:00:00Z",
              updated_at: "2026-04-26T00:00:00Z",
            },
            {
              id: "p-mmf",
              tenant_id: "t-1",
              code: "MMF-1",
              name: "Money Market Fund USD",
              product_type: "money_market_fund",
              status: "approved",
              created_at: "2026-04-25T00:00:00Z",
              updated_at: "2026-04-25T00:00:00Z",
            },
          ],
          next_offset: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    renderRoute();
    expect(await screen.findByTestId("product-row-p-tbill")).toHaveAttribute("href", "/products/p-tbill");
    expect(screen.getByTestId("product-row-p-mmf")).toHaveAttribute("href", "/products/p-mmf");
    expect(screen.getByText(/Treasury Bill 2026 Q3/i)).toBeInTheDocument();
  });

  it("renders empty state when there are no products", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ products: [], next_offset: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    renderRoute();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /no products available/i })).toBeInTheDocument();
    });
  });

  it("renders an error card when the BFF returns 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    renderRoute();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/could not load products/i);
    });
  });
});
