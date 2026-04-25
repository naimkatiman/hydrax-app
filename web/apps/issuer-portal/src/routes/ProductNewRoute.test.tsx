import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { hydraxApi } from "@hydrax/api-client";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

import { ProductNewRoute } from "./ProductNewRoute";

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
      <MemoryRouter initialEntries={["/products/new"]}>{children}</MemoryRouter>
    </Provider>
  );
}

function renderRoute() {
  return render(
    <Wrapper>
      <ProductNewRoute />
    </Wrapper>,
  );
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/tenant id/i), {
    target: { value: "tenant-1" },
  });
  fireEvent.change(screen.getByLabelText(/code/i), {
    target: { value: "PROD-001" },
  });
  fireEvent.change(screen.getByLabelText(/^name$/i), {
    target: { value: "Prime Credit Note" },
  });
}

describe("<ProductNewRoute>", () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all four fields with their labels", () => {
    renderRoute();
    expect(screen.getByLabelText(/tenant id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    const select = screen.getByLabelText(/product type/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe("short_duration_credit");
    expect(
      screen.getByRole("button", { name: /create product/i }),
    ).toBeInTheDocument();
  });

  it("does not call the create-product mutation when submitted with empty required fields", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    renderRoute();
    const submit = screen.getByRole("button", { name: /create product/i });
    fireEvent.click(submit);
    // HTML5 required on the empty inputs blocks the form's submit handler in jsdom,
    // so the mutation never fires and navigate stays unused.
    await Promise.resolve();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("submits the form and navigates to the detail route on success", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
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
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    renderRoute();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith("/products/abc-123");
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("shows an error message and does not navigate when the BFF returns 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    renderRoute();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /failed to create product/i,
      );
    });
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
