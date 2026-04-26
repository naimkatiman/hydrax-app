import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { hydraxApi } from "@hydrax/api-client";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { ToastProvider } from "@hydrax/ui";
import { ApprovalsRoute } from "./ApprovalsRoute";

function withProviders(node: React.ReactNode) {
  const store = configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
  });
  return (
    <Provider store={store}>
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <ToastProvider>{node}</ToastProvider>
      </ThemeProvider>
    </Provider>
  );
}

// Build a Response shape that fetchBaseQuery can fully process (it calls
// .clone(), .text(), and reads .headers).
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

describe("ApprovalsRoute", () => {
  beforeEach(() => {
    let postCount = 0;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method =
        init?.method ?? (input instanceof Request ? input.method : "GET");
      if (method === "POST") {
        postCount += 1;
        return jsonResponse(200, {
          id: "a1", tenant_id: "t1", resource_type: "product", resource_id: "p1",
          status: "approved", decided_by_user_id: "u1",
          decided_at: "2026-04-25T01:00:00.000000Z",
          created_at: "2026-04-25T00:00:00.000000Z",
        });
      }
      // GET /v1/approvals — return the list, empty on the second call after a decide
      return jsonResponse(200, postCount === 0
        ? [{ id: "a1", tenant_id: "t1", resource_type: "product", resource_id: "p1",
              status: "pending", created_at: "2026-04-25T00:00:00.000000Z" }]
        : [],
      );
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders heading + queue", async () => {
    render(withProviders(<ApprovalsRoute />));
    expect(screen.getByRole("heading", { name: /approvals/i })).toBeTruthy();
    await screen.findByText(/p1/);
  });

  it("decides approval on Approve click", async () => {
    render(withProviders(<ApprovalsRoute />));
    await screen.findByText(/p1/);
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => {
      const fetchMock = global.fetch as unknown as { mock: { calls: ReadonlyArray<ReadonlyArray<unknown>> } };
      const sawDecide = fetchMock.mock.calls.some(([input, init]) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input instanceof Request
                ? input.url
                : "";
        const method =
          (init as RequestInit | undefined)?.method ??
          (input instanceof Request ? input.method : undefined);
        return url.includes("/v1/approvals/a1/decide") && method === "POST";
      });
      expect(sawDecide).toBe(true);
    });
  });
});
