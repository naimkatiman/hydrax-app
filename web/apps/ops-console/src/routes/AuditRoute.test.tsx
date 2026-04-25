import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AuditRoute } from "./AuditRoute";

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

describe("AuditRoute", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify([
            {
              id: "e1",
              tenant_id: "t1",
              actor_user_id: null,
              action: "product.created",
              resource_type: "product",
              resource_id: "p1",
              payload: {},
              created_at: "2026-04-25T00:00:00.000000Z",
            },
          ]),
        json: async () => [
          {
            id: "e1",
            tenant_id: "t1",
            actor_user_id: null,
            action: "product.created",
            resource_type: "product",
            resource_id: "p1",
            payload: {},
            created_at: "2026-04-25T00:00:00.000000Z",
          },
        ],
        clone() {
          return this;
        },
      } as unknown as Response),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the heading", () => {
    render(withProviders(<AuditRoute />));
    expect(screen.getByRole("heading", { name: /audit/i })).toBeTruthy();
  });

  it("renders form inputs", () => {
    render(withProviders(<AuditRoute />));
    expect(screen.getByLabelText(/tenant id/i)).toBeTruthy();
    expect(screen.getByLabelText(/resource type/i)).toBeTruthy();
    expect(screen.getByLabelText(/resource id/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /search/i })).toBeTruthy();
  });

  it("fetches and renders the result row after submit", async () => {
    render(withProviders(<AuditRoute />));
    fireEvent.change(screen.getByLabelText(/tenant id/i), { target: { value: "t1" } });
    fireEvent.change(screen.getByLabelText(/resource type/i), { target: { value: "product" } });
    fireEvent.change(screen.getByLabelText(/resource id/i), { target: { value: "p1" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    await screen.findByText(/product.created/i);
  });
});
