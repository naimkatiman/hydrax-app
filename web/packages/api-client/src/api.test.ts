import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { hydraxApi, type CompositeHealth } from "./api";

describe("hydraxApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes a reducer mounted at the configured reducerPath", () => {
    expect(hydraxApi.reducerPath).toBe("hydraxApi");
    expect(typeof hydraxApi.reducer).toBe("function");
  });

  it("getHealth resolves with { ok: true } when the BFF returns one", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const store = configureStore({
      reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
      middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
    });

    const result = await store.dispatch(hydraxApi.endpoints.getHealth.initiate());
    expect(result.data).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("getHealthzComposite issues a GET to /healthz/composite and returns the envelope", async () => {
    const payload: CompositeHealth = {
      service: "bff",
      status: "ok",
      upstreams: [
        {
          service: "workflow-svc",
          url: "http://localhost:7001",
          ok: true,
          status: "ok",
          httpStatus: 200,
          latencyMs: 4,
        },
      ],
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const store = configureStore({
      reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
      middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
    });

    const result = await store.dispatch(
      hydraxApi.endpoints.getHealthzComposite.initiate(),
    );
    expect(result.data).toEqual(payload);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const firstArg = fetchSpy.mock.calls[0]?.[0];
    const calledUrl = firstArg instanceof Request ? firstArg.url : String(firstArg ?? "");
    expect(calledUrl).toContain("/healthz/composite");
  });
});
