import { describe, it, expect } from "vitest";
import { fetchSubscription, createSubscription, SubscriptionsUpstreamError } from "./proxy.js";

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

describe("fetchSubscription", () => {
  it("returns the row on 200", async () => {
    const fetchImpl = fakeFetch((url) => {
      expect(url).toBe("http://localhost:7001/v1/subscriptions/sub-123");
      return {
        ok: true,
        status: 200,
        body: {
          id: "sub-123",
          product_id: "prod-1",
          investor_user_id: "user-1",
          amount_minor: 50000,
          currency: "USD",
          status: "pending",
          created_at: "2026-04-25T00:00:00.000000Z",
          updated_at: "2026-04-25T00:00:00.000000Z",
        },
      };
    });
    const got = await fetchSubscription("sub-123", { workflowSvcUrl: "http://localhost:7001", fetchImpl });
    expect(got.id).toBe("sub-123");
    expect(got.amount_minor).toBe(50000);
  });

  it("wraps upstream 404 in SubscriptionsUpstreamError", async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 404, body: {} }));
    const err = await fetchSubscription("missing", { workflowSvcUrl: "http://localhost:7001", fetchImpl }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SubscriptionsUpstreamError);
    expect((err as SubscriptionsUpstreamError).httpStatus).toBe(404);
  });
});

describe("createSubscription", () => {
  it("POSTs body and returns the row on 201", async () => {
    const fetchImpl = fakeFetch((url, init) => {
      expect(url).toBe("http://localhost:7001/v1/subscriptions");
      expect(init?.method).toBe("POST");
      return {
        ok: true,
        status: 201,
        body: {
          id: "new-sub",
          product_id: "prod-1",
          investor_user_id: "user-1",
          amount_minor: 100000,
          currency: "USD",
          status: "pending",
          created_at: "2026-04-25T00:00:00.000000Z",
          updated_at: "2026-04-25T00:00:00.000000Z",
        },
      };
    });
    const got = await createSubscription(
      { product_id: "prod-1", investor_user_id: "user-1", amount_minor: 100000, currency: "USD" },
      { workflowSvcUrl: "http://localhost:7001", fetchImpl },
    );
    expect(got.id).toBe("new-sub");
  });

  it("wraps upstream 409 in SubscriptionsUpstreamError preserving status", async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 409, body: {} }));
    const err = await createSubscription(
      { product_id: "prod-1", investor_user_id: "user-1", amount_minor: 100000, currency: "USD" },
      { workflowSvcUrl: "http://localhost:7001", fetchImpl },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SubscriptionsUpstreamError);
    expect((err as SubscriptionsUpstreamError).httpStatus).toBe(409);
  });

  it("wraps transport error in SubscriptionsUpstreamError without httpStatus", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const err = await createSubscription(
      { product_id: "prod-1", investor_user_id: "user-1", amount_minor: 100000, currency: "USD" },
      { workflowSvcUrl: "http://localhost:7001", fetchImpl },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SubscriptionsUpstreamError);
    expect((err as SubscriptionsUpstreamError).httpStatus).toBeUndefined();
    expect((err as SubscriptionsUpstreamError).message).toContain("ECONNREFUSED");
  });

  it("aborts when fetch never resolves and timeoutMs elapses", async () => {
    const fetchImpl = ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }
      })) as unknown as typeof fetch;

    const start = Date.now();
    const err = await createSubscription(
      { product_id: "prod-1", investor_user_id: "user-1", amount_minor: 100000, currency: "USD" },
      { workflowSvcUrl: "http://localhost:7001", fetchImpl, timeoutMs: 50 },
    ).catch((e: unknown) => e);
    const elapsed = Date.now() - start;

    expect(err).toBeInstanceOf(SubscriptionsUpstreamError);
    expect(elapsed).toBeLessThan(500);
  });
});
