import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { hydraxApi } from "@hydrax/api-client";

import { ProductsListRoute } from "./ProductsListRoute";

function makeStore() {
  return configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
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

  afterEach(() => {
    cleanup();
  });

  it("renders skeleton rows while loading", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => {}),
    );
    renderRoute();
    // Four skeleton cards each render multiple aria-label="Loading ..." spans;
    // assert at least one is present and the heading is shown.
    expect(
      screen.getByRole("heading", { level: 1, name: /products/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText(/loading/i).length).toBeGreaterThan(0);
  });

  it("renders one row per product when the BFF returns data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          products: [
            {
              id: "p-1",
              tenant_id: "ten-1",
              code: "C-1",
              name: "Prime Credit Note",
              product_type: "short_duration_credit",
              status: "pending",
              created_at: "2026-04-26T00:00:00Z",
              updated_at: "2026-04-26T00:00:00Z",
            },
            {
              id: "p-2",
              tenant_id: "ten-1",
              code: "C-2",
              name: "Sovereign Bond",
              product_type: "treasury",
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
    expect(
      await screen.findByTestId("product-row-p-1"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("product-row-p-2")).toBeInTheDocument();
    // Each row is a Link; the href points to the detail route.
    expect(screen.getByTestId("product-row-p-1")).toHaveAttribute(
      "href",
      "/products/p-1",
    );
    expect(screen.getByTestId("product-row-p-2")).toHaveAttribute(
      "href",
      "/products/p-2",
    );
  });

  it("renders an EmptyState with a CTA link when the list is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ products: [], next_offset: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    renderRoute();
    expect(
      await screen.findByRole("heading", { name: /no products yet/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("empty-state-cta")).toHaveAttribute(
      "href",
      "/products/new",
    );
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
      expect(screen.getByRole("alert")).toHaveTextContent(
        /could not load products/i,
      );
    });
  });

  it("requests the first page with limit=50 and offset=0", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          products: [
            {
              id: "p-1",
              tenant_id: "ten-1",
              code: "C-1",
              name: "Prime Credit Note",
              product_type: "short_duration_credit",
              status: "pending",
              created_at: "2026-04-26T00:00:00Z",
              updated_at: "2026-04-26T00:00:00Z",
            },
          ],
          next_offset: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    renderRoute();
    await screen.findByTestId("product-row-p-1");
    const firstInput = fetchSpy.mock.calls[0]?.[0];
    const calledUrl =
      firstInput instanceof Request ? firstInput.url : String(firstInput ?? "");
    expect(calledUrl).toContain("limit=50");
    expect(calledUrl).toContain("offset=0");
  });

  it("disables Previous on the first page and Next when next_offset is null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          products: [
            {
              id: "p-1",
              tenant_id: "ten-1",
              code: "C-1",
              name: "Prime Credit Note",
              product_type: "short_duration_credit",
              status: "pending",
              created_at: "2026-04-26T00:00:00Z",
              updated_at: "2026-04-26T00:00:00Z",
            },
          ],
          next_offset: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    renderRoute();
    await screen.findByTestId("product-row-p-1");
    expect(screen.getByTestId("pagination-prev")).toBeDisabled();
    expect(screen.getByTestId("pagination-next")).toBeDisabled();
  });

  it("advances to next page on Next click and re-enables Previous", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = input instanceof Request ? input.url : String(input);
        const offset = Number(new URL(url, "http://localhost").searchParams.get("offset") ?? "0");
        const body =
          offset === 0
            ? {
                products: [
                  {
                    id: "p-1",
                    tenant_id: "ten-1",
                    code: "C-1",
                    name: "Page One Item",
                    product_type: "short_duration_credit",
                    status: "pending",
                    created_at: "2026-04-26T00:00:00Z",
                    updated_at: "2026-04-26T00:00:00Z",
                  },
                ],
                next_offset: 50,
              }
            : {
                products: [
                  {
                    id: "p-2",
                    tenant_id: "ten-1",
                    code: "C-2",
                    name: "Page Two Item",
                    product_type: "short_duration_credit",
                    status: "pending",
                    created_at: "2026-04-26T00:00:00Z",
                    updated_at: "2026-04-26T00:00:00Z",
                  },
                ],
                next_offset: null,
              };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );

    renderRoute();
    await screen.findByTestId("product-row-p-1");
    expect(screen.getByTestId("pagination-prev")).toBeDisabled();
    expect(screen.getByTestId("pagination-next")).not.toBeDisabled();

    fireEvent.click(screen.getByTestId("pagination-next"));

    await screen.findByTestId("product-row-p-2");
    expect(screen.getByTestId("pagination-prev")).not.toBeDisabled();
    expect(screen.getByTestId("pagination-next")).toBeDisabled();

    const callOffsets = fetchSpy.mock.calls
      .map((c) => {
        const inp = c[0];
        return inp instanceof Request ? inp.url : String(inp ?? "");
      })
      .map((u) => new URL(u, "http://localhost").searchParams.get("offset"));
    expect(callOffsets).toContain("0");
    expect(callOffsets).toContain("50");
  });
});
