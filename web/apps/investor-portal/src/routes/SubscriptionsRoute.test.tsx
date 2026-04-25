import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { SubscriptionsRoute } from "./SubscriptionsRoute";

function withProviders(node: React.ReactNode) {
  const store = configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
  });
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>{node}</ThemeProvider>
    </Provider>
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() { return jsonResponse(status, body); },
  } as unknown as Response;
}

describe("SubscriptionsRoute", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () =>
      jsonResponse(200, {
        id: "s1",
        product_id: "p1",
        investor_user_id: "u1",
        amount_minor: 5000000,
        currency: "USD",
        status: "pending",
        created_at: "2026-04-25T00:00:00.000000Z",
        updated_at: "2026-04-25T00:00:00.000000Z",
      }),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders heading", () => {
    render(withProviders(<SubscriptionsRoute />));
    expect(screen.getByRole("heading", { name: /subscriptions/i })).toBeTruthy();
  });

  it("fetches and renders detail on lookup", async () => {
    render(withProviders(<SubscriptionsRoute />));
    fireEvent.change(screen.getByLabelText(/subscription id/i), { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: /lookup/i }));
    await screen.findByText(/p1/);
    await screen.findByText(/USD/);
  });
});
