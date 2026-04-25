import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { hydraxApi } from "@hydrax/api-client";

import { ProductDetailRoute } from "./ProductDetailRoute";

const baseProduct = {
  id: "abc-123",
  tenant_id: "tenant-1",
  code: "PROD-001",
  name: "Prime Credit Note",
  product_type: "short_duration_credit",
  status: "pending",
  created_at: "2026-04-25T00:00:00Z",
  updated_at: "2026-04-25T00:00:00Z",
};

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

  it("renders one button per allowed_next state for a pending product", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ...baseProduct, allowed_next: ["approved", "cancelled"] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    renderRoute();
    expect(
      await screen.findByTestId("transition-approved"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("transition-cancelled")).toBeInTheDocument();
    expect(screen.queryByTestId("transition-active")).toBeNull();
  });

  it("renders the terminal-state message when allowed_next is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ...baseProduct, status: "matured", allowed_next: [] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    renderRoute();
    expect(
      await screen.findByTestId("terminal-state"),
    ).toHaveTextContent(/no further actions/i);
    expect(screen.queryByTestId("transition-approved")).toBeNull();
  });

  it("renders the terminal-state message when allowed_next is omitted (rolling deploy)", async () => {
    // Older workflow-svc that does not return allowed_next yet.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(baseProduct), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    renderRoute();
    expect(
      await screen.findByTestId("terminal-state"),
    ).toBeInTheDocument();
  });

  it("POSTs to /v1/products/{id}/transition when a button is clicked", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/v1/products/abc-123/transition")) {
        return new Response(
          JSON.stringify({ ...baseProduct, status: "approved", allowed_next: ["active", "cancelled"] }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ ...baseProduct, allowed_next: ["approved", "cancelled"] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    renderRoute();
    const approveBtn = await screen.findByTestId("transition-approved");
    approveBtn.click();
    await waitFor(async () => {
      const transitionCall = fetchSpy.mock.calls.find(([u]) => {
        const url = typeof u === "string" ? u : (u as Request).url;
        return url.endsWith("/v1/products/abc-123/transition");
      });
      expect(transitionCall).toBeDefined();
      const [input, init] = transitionCall!;
      const method =
        (init as RequestInit | undefined)?.method ??
        (input instanceof Request ? input.method : undefined);
      expect(method).toBe("POST");
      const bodyInit = (init as RequestInit | undefined)?.body;
      const bodyText =
        typeof bodyInit === "string"
          ? bodyInit
          : input instanceof Request
            ? await input.clone().text()
            : "";
      expect(bodyText).toBe(JSON.stringify({ to: "approved" }));
    });
  });
});
