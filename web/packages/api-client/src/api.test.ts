import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { hydraxApi } from "./api";

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
});
