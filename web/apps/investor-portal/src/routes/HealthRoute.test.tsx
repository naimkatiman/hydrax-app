import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { hydraxApi, type CompositeHealth } from "@hydrax/api-client";
import { HealthRoute } from "./HealthRoute";

function makeStore() {
  return configureStore({
    reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
    middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
  });
}

const SAMPLE: CompositeHealth = {
  service: "bff",
  status: "degraded",
  upstreams: [
    {
      service: "workflow-svc",
      url: "http://localhost:7001",
      ok: true,
      status: "ok",
      httpStatus: 200,
      latencyMs: 4,
    },
    {
      service: "approval-svc",
      url: "http://localhost:7002",
      ok: true,
      status: "ok",
      httpStatus: 200,
      latencyMs: 6,
    },
    {
      service: "audit-svc",
      url: "http://localhost:7003",
      ok: true,
      status: "ok",
      httpStatus: 200,
      latencyMs: 5,
    },
    {
      service: "hydrax-adapter",
      url: "http://localhost:7004",
      ok: true,
      status: "ok",
      httpStatus: 200,
      latencyMs: 7,
    },
    {
      service: "canton-adapter",
      url: "http://localhost:7005",
      ok: true,
      status: "ok",
      httpStatus: 200,
      latencyMs: 9,
    },
    {
      service: "market-data-svc",
      url: "http://localhost:7006",
      ok: false,
      status: "down",
      httpStatus: 503,
      latencyMs: 12,
    },
    {
      service: "notify-svc",
      url: "http://localhost:7101",
      ok: false,
      status: "unreachable",
      error: "fetch failed: ECONNREFUSED 127.0.0.1:7101",
      latencyMs: 1502,
    },
    {
      service: "integration-svc",
      url: "http://localhost:7102",
      ok: true,
      status: "ok",
      httpStatus: 200,
      latencyMs: 3,
    },
  ],
};

describe("<HealthRoute>", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders 9 tiles (bff + 8 upstreams) once the composite query resolves", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(SAMPLE), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const store = makeStore();
    render(
      <Provider store={store}>
        <HealthRoute />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("health-grid")).toBeInTheDocument();
    });

    expect(screen.getByTestId("health-tile-bff")).toBeInTheDocument();
    for (const u of SAMPLE.upstreams) {
      expect(screen.getByTestId(`health-tile-${u.service}`)).toBeInTheDocument();
    }
  });

  it("marks the down upstream red and the unreachable upstream amber", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(SAMPLE), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const store = makeStore();
    render(
      <Provider store={store}>
        <HealthRoute />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("health-tile-market-data-svc")).toHaveAttribute(
        "data-status",
        "down",
      );
    });

    expect(screen.getByTestId("health-tile-notify-svc")).toHaveAttribute(
      "data-status",
      "unreachable",
    );
    expect(screen.getByText(/ECONNREFUSED/)).toBeInTheDocument();
  });

  it("shows an error envelope when the composite query rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("upstream timeout", { status: 502 }),
    );

    const store = makeStore();
    render(
      <Provider store={store}>
        <HealthRoute />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
