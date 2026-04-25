import { describe, it, expect } from "vitest";
import { listEvents, appendEvent, AuditUpstreamError } from "./proxy.js";

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

describe("listEvents", () => {
  it("returns rows on 200 and forwards query params", async () => {
    const fetchImpl = fakeFetch((url) => {
      expect(url).toBe(
        "http://localhost:7003/v1/audit/events?tenant_id=t1&resource_type=product&resource_id=p1",
      );
      return {
        ok: true,
        status: 200,
        body: [
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
      };
    });
    const got = await listEvents(
      { tenant_id: "t1", resource_type: "product", resource_id: "p1" },
      { auditSvcUrl: "http://localhost:7003", fetchImpl },
    );
    expect(got).toHaveLength(1);
    expect(got[0]?.action).toBe("product.created");
  });

  it("wraps upstream 400 in AuditUpstreamError preserving status", async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 400, body: {} }));
    const err = await listEvents(
      { tenant_id: "t1", resource_type: "product", resource_id: "p1" },
      { auditSvcUrl: "http://localhost:7003", fetchImpl },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuditUpstreamError);
    expect((err as AuditUpstreamError).httpStatus).toBe(400);
  });
});

describe("appendEvent", () => {
  it("POSTs body and returns row on 201", async () => {
    const fetchImpl = fakeFetch((url, init) => {
      expect(url).toBe("http://localhost:7003/v1/audit/events");
      expect(init?.method).toBe("POST");
      return {
        ok: true,
        status: 201,
        body: {
          id: "e2",
          tenant_id: "t1",
          actor_user_id: null,
          action: "product.created",
          resource_type: "product",
          resource_id: "p1",
          payload: {},
          created_at: "2026-04-25T00:00:00.000000Z",
        },
      };
    });
    const got = await appendEvent(
      { tenant_id: "t1", action: "product.created", resource_type: "product", resource_id: "p1" },
      { auditSvcUrl: "http://localhost:7003", fetchImpl },
    );
    expect(got.id).toBe("e2");
  });

  it("wraps transport error in AuditUpstreamError", async () => {
    const fetchImpl = (async () => {
      throw new Error("connect ECONNREFUSED");
    }) as typeof fetch;
    const err = await appendEvent(
      { tenant_id: "t1", action: "x", resource_type: "product", resource_id: "p1" },
      { auditSvcUrl: "http://localhost:7003", fetchImpl },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuditUpstreamError);
    expect((err as AuditUpstreamError).httpStatus).toBeUndefined();
  });
});
