import { describe, it, expect } from "vitest";
import {
  fetchProduct,
  createProduct,
  transitionProduct,
  listProducts,
  ProductsUpstreamError,
  type TransitionProductInput,
} from "./proxy.js";

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

describe("transitionProduct", () => {
  it("POSTs to /v1/products/{id}/transition and returns the updated product", async () => {
    let captured: { url?: string; init?: RequestInit } = {};
    const fetchImpl = fakeFetch((url, init) => {
      captured = { url, init };
      return {
        ok: true,
        status: 200,
        body: {
          id: "p-1",
          tenant_id: "t-1",
          code: "C1",
          name: "N",
          product_type: "credit-note",
          status: "approved",
          allowed_next: ["active", "cancelled"],
          created_at: "2026-04-25T00:00:00.000000Z",
          updated_at: "2026-04-25T00:00:01.000000Z",
        },
      };
    });
    const input: TransitionProductInput = { to: "approved" };
    const got = await transitionProduct("p-1", input, {
      workflowSvcUrl: "http://wf",
      fetchImpl,
    });

    expect(got.status).toBe("approved");
    expect(got.allowed_next).toEqual(["active", "cancelled"]);
    expect(captured.url).toBe("http://wf/v1/products/p-1/transition");
    expect(captured.init?.method).toBe("POST");
    expect(captured.init?.body).toBe(JSON.stringify(input));
    const headers = captured.init?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("propagates upstream 422 as ProductsUpstreamError with httpStatus=422", async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 422, body: {} }));
    const err = await transitionProduct("p-1", { to: "matured" }, {
      workflowSvcUrl: "http://wf",
      fetchImpl,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProductsUpstreamError);
    expect((err as ProductsUpstreamError).httpStatus).toBe(422);
  });

  it("converts a transport error into ProductsUpstreamError without httpStatus", async () => {
    const fetchImpl = (async () => { throw new TypeError("network down"); }) as unknown as typeof fetch;
    const err = await transitionProduct("p-1", { to: "approved" }, {
      workflowSvcUrl: "http://wf",
      fetchImpl,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProductsUpstreamError);
    expect((err as ProductsUpstreamError).httpStatus).toBeUndefined();
  });
});

describe("listProducts", () => {
  it("returns the body and forwards tenant_id, limit, offset", async () => {
    let captured = "";
    const fetchImpl = ((async (input: string | URL | Request) => {
      captured = typeof input === "string" ? input : input.toString();
      return {
        ok: true,
        status: 200,
        json: async () => ({
          products: [
            {
              id: "p-1",
              tenant_id: "t-1",
              code: "C-1",
              name: "N",
              product_type: "credit-note",
              status: "pending",
              created_at: "2026-04-26T00:00:00.000000Z",
              updated_at: "2026-04-26T00:00:00.000000Z",
            },
          ],
          next_offset: null,
        }),
      } as Response;
    }) as unknown) as typeof fetch;

    const got = await listProducts(
      { tenantId: "t-1", limit: 25, offset: 10 },
      { workflowSvcUrl: "http://wf", fetchImpl },
    );
    expect(got.products).toHaveLength(1);
    expect(got.next_offset).toBeNull();
    expect(captured).toContain("tenant_id=t-1");
    expect(captured).toContain("limit=25");
    expect(captured).toContain("offset=10");
  });

  it("wraps upstream 5xx in ProductsUpstreamError preserving status", async () => {
    const fetchImpl = ((async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response)) as unknown) as typeof fetch;
    const err = await listProducts(
      { tenantId: "t-1" },
      { workflowSvcUrl: "http://wf", fetchImpl },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProductsUpstreamError);
    expect((err as ProductsUpstreamError).httpStatus).toBe(503);
  });

  it("converts a transport error into ProductsUpstreamError without httpStatus", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;
    const err = await listProducts(
      { tenantId: "t-1" },
      { workflowSvcUrl: "http://wf", fetchImpl },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProductsUpstreamError);
    expect((err as ProductsUpstreamError).httpStatus).toBeUndefined();
  });

  it("rejects malformed upstream body that lacks products array", async () => {
    const fetchImpl = ((async () => ({
      ok: true,
      status: 200,
      json: async () => ({ not_what_we_expected: true }),
    } as Response)) as unknown) as typeof fetch;
    const err = await listProducts(
      { tenantId: "t-1" },
      { workflowSvcUrl: "http://wf", fetchImpl },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProductsUpstreamError);
    expect((err as ProductsUpstreamError).message).toMatch(/malformed/i);
  });
});
