import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { hydraxApi } from "@hydrax/api-client";

import { ProductDetailRoute } from "./ProductDetailRoute";

function makeStore() {
  return configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
  });
}

function Wrapper({
  children,
  initialPath,
}: {
  readonly children: ReactNode;
  readonly initialPath: string;
}) {
  const store = makeStore();
  return (
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/products/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

function renderRoute(path = "/products/abc-123") {
  return render(
    <Wrapper initialPath={path}>
      <ProductDetailRoute />
    </Wrapper>,
  );
}

describe("<ProductDetailRoute>", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a Skeleton while the product query is loading", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => {}),
    );
    renderRoute();
    expect(screen.getByLabelText(/loading product/i)).toBeInTheDocument();
  });

  it("renders the product fields once the BFF returns data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "abc-123",
          tenant_id: "tenant-1",
          code: "PROD-001",
          name: "Prime Credit Note",
          product_type: "short_duration_credit",
          status: "draft",
          created_at: "2026-04-25T00:00:00Z",
          updated_at: "2026-04-25T00:00:00Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    renderRoute();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /prime credit note/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/PROD-001/)).toBeInTheDocument();
    expect(screen.getByText(/short_duration_credit/)).toBeInTheDocument();
    expect(screen.getByText(/draft/)).toBeInTheDocument();
  });

  it("renders an error message when the BFF returns 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    renderRoute();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /could not load product/i,
      );
    });
  });
});
