import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { hydraxApi } from "@hydrax/api-client";
import { SubscribeRoute } from "./SubscribeRoute";

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
          <Route path="/subscribe" element={<SubscribeRoute />} />
          <Route path="/subscriptions/:id" element={<div>landed-on-detail</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe("<SubscribeRoute>", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders form with product id from query string", () => {
    renderAt("/subscribe?product=p-tbill");
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByText(/p-tbill/)).toBeInTheDocument();
  });

  it("submits and navigates to /subscriptions/:id on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "sub-new-1",
          product_id: "p-tbill",
          investor_user_id: "inv-1",
          amount_minor: 25_000_000,
          currency: "USD",
          status: "pending",
          created_at: "2026-04-26T09:00:00Z",
          updated_at: "2026-04-26T09:00:00Z",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    renderAt("/subscribe?product=p-tbill");
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "250000" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByText("landed-on-detail")).toBeInTheDocument();
    });
  });

  it("disables Submit when no product id in query", () => {
    renderAt("/subscribe");
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
  });
});
