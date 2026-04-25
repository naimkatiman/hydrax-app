import { describe, it, expect } from "vitest";
import {
  listPendingApprovals,
  fetchApproval,
  createApproval,
  decideApproval,
  ApprovalsUpstreamError,
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

describe("listPendingApprovals", () => {
  it("returns array on 200", async () => {
    const fetchImpl = fakeFetch((url) => {
      expect(url).toBe("http://localhost:7002/v1/approvals");
      return {
        ok: true,
        status: 200,
        body: [{
          id: "a1", tenant_id: "t1", resource_type: "product", resource_id: "p1",
          status: "pending", created_at: "2026-04-25T00:00:00.000000Z",
        }],
      };
    });
    const got = await listPendingApprovals({ approvalSvcUrl: "http://localhost:7002", fetchImpl });
    expect(got).toHaveLength(1);
  });
});

describe("fetchApproval", () => {
  it("returns row on 200", async () => {
    const fetchImpl = fakeFetch((url) => {
      expect(url).toBe("http://localhost:7002/v1/approvals/a1");
      return {
        ok: true,
        status: 200,
        body: {
          id: "a1", tenant_id: "t1", resource_type: "product", resource_id: "p1",
          status: "pending", created_at: "2026-04-25T00:00:00.000000Z",
        },
      };
    });
    const got = await fetchApproval("a1", { approvalSvcUrl: "http://localhost:7002", fetchImpl });
    expect(got.id).toBe("a1");
  });

  it("wraps 404 in ApprovalsUpstreamError", async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 404, body: {} }));
    const err = await fetchApproval("nope", { approvalSvcUrl: "http://localhost:7002", fetchImpl }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApprovalsUpstreamError);
    expect((err as ApprovalsUpstreamError).httpStatus).toBe(404);
  });
});

describe("createApproval", () => {
  it("POSTs body and returns 201", async () => {
    const fetchImpl = fakeFetch((url, init) => {
      expect(url).toBe("http://localhost:7002/v1/approvals");
      expect(init?.method).toBe("POST");
      return {
        ok: true,
        status: 201,
        body: {
          id: "a2", tenant_id: "t1", resource_type: "product", resource_id: "p1",
          status: "pending", created_at: "2026-04-25T00:00:00.000000Z",
        },
      };
    });
    const got = await createApproval(
      { tenant_id: "t1", resource_type: "product", resource_id: "p1" },
      { approvalSvcUrl: "http://localhost:7002", fetchImpl },
    );
    expect(got.id).toBe("a2");
  });
});

describe("decideApproval", () => {
  it("POSTs to /decide and returns updated row", async () => {
    const fetchImpl = fakeFetch((url, init) => {
      expect(url).toBe("http://localhost:7002/v1/approvals/a1/decide");
      expect(init?.method).toBe("POST");
      return {
        ok: true,
        status: 200,
        body: {
          id: "a1", tenant_id: "t1", resource_type: "product", resource_id: "p1",
          status: "approved", decided_by_user_id: "u1",
          decided_at: "2026-04-25T01:00:00.000000Z", created_at: "2026-04-25T00:00:00.000000Z",
        },
      };
    });
    const got = await decideApproval(
      "a1",
      { status: "approved", decided_by_user_id: "u1" },
      { approvalSvcUrl: "http://localhost:7002", fetchImpl },
    );
    expect(got.status).toBe("approved");
  });
});
