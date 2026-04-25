import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import {
  hydraxApi,
  type CompositeHealth,
  type CreateProductInput,
  type Product,
} from "./api";

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

  it("createProduct issues a POST to /v1/products with the input as JSON body", async () => {
    const input: CreateProductInput = {
      tenant_id: "tenant-1",
      code: "PROD-001",
      name: "Prime Credit Note",
      product_type: "credit_note",
    };
    const created: Product = {
      id: "prod-uuid-1",
      tenant_id: "tenant-1",
      code: "PROD-001",
      name: "Prime Credit Note",
      product_type: "credit_note",
      status: "draft",
      created_at: "2026-04-25T00:00:00Z",
      updated_at: "2026-04-25T00:00:00Z",
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(created), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    const store = configureStore({
      reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
      middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
    });

    const result = await store.dispatch(
      hydraxApi.endpoints.createProduct.initiate(input),
    );
    expect("data" in result ? result.data : undefined).toEqual(created);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const firstArg = fetchSpy.mock.calls[0]?.[0];
    const init = fetchSpy.mock.calls[0]?.[1];
    const request =
      firstArg instanceof Request
        ? firstArg
        : new Request(String(firstArg ?? ""), init);
    expect(request.method).toBe("POST");
    expect(request.url).toContain("/v1/products");
    const bodyText = await request.text();
    expect(JSON.parse(bodyText)).toEqual(input);
  });

  it("getProduct issues a GET to /v1/products/<id> with id URL-encoded", async () => {
    const product: Product = {
      id: "prod with space",
      tenant_id: "tenant-1",
      code: "PROD-002",
      name: "Edge Case",
      product_type: "fund",
      status: "draft",
      created_at: "2026-04-25T00:00:00Z",
      updated_at: "2026-04-25T00:00:00Z",
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(product), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const store = configureStore({
      reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
      middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
    });

    const result = await store.dispatch(
      hydraxApi.endpoints.getProduct.initiate("prod with space"),
    );
    expect(result.data).toEqual(product);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const firstArg = fetchSpy.mock.calls[0]?.[0];
    const calledUrl =
      firstArg instanceof Request ? firstArg.url : String(firstArg ?? "");
    expect(calledUrl).toContain("/v1/products/prod%20with%20space");
  });

  it("getProduct surfaces an error when the BFF returns 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "internal" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    const store = configureStore({
      reducer: { [hydraxApi.reducerPath]: hydraxApi.reducer },
      middleware: (getDefault) => getDefault().concat(hydraxApi.middleware),
    });

    const result = await store.dispatch(
      hydraxApi.endpoints.getProduct.initiate("prod-uuid-1"),
    );
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });
});
