import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { hydraxApi } from "@hydrax/api-client";
import { ToastProvider } from "@hydrax/ui";

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
      <ToastProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/products/:id" element={children} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
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

  it("renders the product name and a StatusPill once the BFF returns data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ...baseProduct,
          status: "active",
          allowed_next: ["matured", "cancelled"],
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
    const pill = await screen.findByTestId("status-pill");
    expect(pill.getAttribute("data-state")).toBe("active");
    expect(pill).toHaveTextContent(/active/i);
    expect(screen.getByText(/PROD-001/)).toBeInTheDocument();
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

  it("renders status-specific buttons (Approve, Cancel product) for a pending product", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ...baseProduct,
          allowed_next: ["approved", "cancelled"],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    renderRoute();
    const approve = await screen.findByTestId("transition-approved");
    expect(approve).toHaveTextContent(/^Approve$/);
    expect(approve.getAttribute("data-variant")).toBe("primary");
    const cancel = screen.getByTestId("transition-cancelled");
    expect(cancel).toHaveTextContent(/Cancel product/);
    expect(cancel.getAttribute("data-variant")).toBe("danger");
  });

  it("renders the terminal-state message when allowed_next is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ...baseProduct,
          status: "matured",
          allowed_next: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    renderRoute();
    expect(await screen.findByTestId("terminal-state")).toHaveTextContent(
      /no further actions/i,
    );
    expect(screen.queryByTestId("transition-approved")).toBeNull();
  });

  it("renders the terminal-state message when allowed_next is omitted (rolling deploy)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(baseProduct), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    renderRoute();
    expect(await screen.findByTestId("terminal-state")).toBeInTheDocument();
  });

  it("disables every transition button while a transition is in flight", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/v1/products/abc-123/transition")) {
        return new Promise<Response>(() => {});
      }
      return new Response(
        JSON.stringify({
          ...baseProduct,
          allowed_next: ["approved", "cancelled"],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    renderRoute();
    const approveBtn =
      await screen.findByTestId<HTMLButtonElement>("transition-approved");
    const cancelBtn =
      screen.getByTestId<HTMLButtonElement>("transition-cancelled");
    expect(approveBtn).not.toBeDisabled();
    expect(cancelBtn).not.toBeDisabled();

    approveBtn.click();

    await waitFor(() => {
      expect(approveBtn).toBeDisabled();
      expect(cancelBtn).toBeDisabled();
    });
  });

  it("POSTs to /v1/products/{id}/transition when a button is clicked", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/v1/products/abc-123/transition")) {
        return new Response(
          JSON.stringify({
            ...baseProduct,
            status: "approved",
            allowed_next: ["active", "cancelled"],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          ...baseProduct,
          allowed_next: ["approved", "cancelled"],
        }),
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

  it("dispatches a success toast after a transition completes", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/v1/products/abc-123/transition")) {
        return new Response(
          JSON.stringify({
            ...baseProduct,
            status: "approved",
            allowed_next: ["active", "cancelled"],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          ...baseProduct,
          allowed_next: ["approved", "cancelled"],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    renderRoute();
    const approveBtn = await screen.findByTestId("transition-approved");
    approveBtn.click();
    const toast = await screen.findByTestId("toast-item");
    expect(toast.getAttribute("data-tone")).toBe("success");
    expect(toast).toHaveTextContent(/status updated to approved/i);
  });

  it("dispatches a danger toast when a transition fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/v1/products/abc-123/transition")) {
        return new Response(JSON.stringify({ error: "boom" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          ...baseProduct,
          allowed_next: ["approved", "cancelled"],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    renderRoute();
    const approveBtn = await screen.findByTestId("transition-approved");
    approveBtn.click();
    const toast = await screen.findByTestId("toast-item");
    expect(toast.getAttribute("data-tone")).toBe("danger");
    expect(toast).toHaveTextContent(/transition failed/i);
  });
});
