import { describe, it, expect } from "vitest";
import { fetchProduct, createProduct, ProductsUpstreamError } from "./proxy.js";

function fakeFetch(handler: (url: string, init?: RequestInit) => { ok: boolean; status: number; body: unknown }): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const result = handler(url, init);
    return {
      ok: result.ok,
      status: result.status,
      json: async () => result.body,
    } as Response;
  }) as typeof fetch;
}

describe("fetchProduct", () => {
  it("returns the row on 200", async () => {
    const fetchImpl = fakeFetch((url) => {
      expect(url).toBe("http://localhost:7001/v1/products/abc-123");
      return { ok: true, status: 200, body: { id: "abc-123", code: "X", name: "X", product_type: "x", status: "pending", tenant_id: "t", created_at: "2026-04-25T00:00:00.000000Z", updated_at: "2026-04-25T00:00:00.000000Z" } };
    });
    const got = await fetchProduct("abc-123", { workflowSvcUrl: "http://localhost:7001", fetchImpl });
    expect(got.id).toBe("abc-123");
  });

  it("wraps upstream 404 in ProductsUpstreamError", async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 404, body: {} }));
    const err = await fetchProduct("missing", { workflowSvcUrl: "http://localhost:7001", fetchImpl }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProductsUpstreamError);
    expect((err as ProductsUpstreamError).httpStatus).toBe(404);
  });
});

describe("createProduct", () => {
  it("POSTs body and returns the row on 201", async () => {
    const fetchImpl = fakeFetch((url, init) => {
      expect(url).toBe("http://localhost:7001/v1/products");
      expect(init?.method).toBe("POST");
      return { ok: true, status: 201, body: { id: "new-id", code: "C", name: "N", product_type: "p", status: "pending", tenant_id: "t", created_at: "2026-04-25T00:00:00.000000Z", updated_at: "2026-04-25T00:00:00.000000Z" } };
    });
    const got = await createProduct(
      { tenant_id: "t", code: "C", name: "N", product_type: "p" },
      { workflowSvcUrl: "http://localhost:7001", fetchImpl },
    );
    expect(got.id).toBe("new-id");
  });

  it("wraps upstream 409 in ProductsUpstreamError preserving status", async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 409, body: {} }));
    const err = await createProduct(
      { tenant_id: "t", code: "DUP", name: "N", product_type: "p" },
      { workflowSvcUrl: "http://localhost:7001", fetchImpl },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProductsUpstreamError);
    expect((err as ProductsUpstreamError).httpStatus).toBe(409);
  });
});
