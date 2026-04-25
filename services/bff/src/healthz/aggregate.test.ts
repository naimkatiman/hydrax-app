import { describe, it, expect } from "vitest";
import {
  aggregateHealth,
  buildProbeList,
  type FetchFn,
} from "./aggregate.js";
import { loadUpstreamConfig } from "../bff/bff.js";

const cfg = loadUpstreamConfig({} as NodeJS.ProcessEnv);

function fakeFetch(byService: Record<string, "ok" | "down" | "throw">): FetchFn {
  return async (url: string) => {
    const probes = buildProbeList(cfg);
    const probe = probes.find((p) => url.startsWith(p.url));
    const verdict = probe ? byService[probe.service] : undefined;
    if (verdict === "throw") {
      throw new Error("connection refused");
    }
    if (verdict === "down") {
      return {
        ok: false,
        status: 503,
        json: async () => ({ status: "down" }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ service: probe?.service ?? "?", status: "ok" }),
    };
  };
}

describe("aggregateHealth", () => {
  it("reports ok when every upstream returns 200", async () => {
    const fetchImpl = fakeFetch({
      "workflow-svc": "ok",
      "approval-svc": "ok",
      "audit-svc": "ok",
      "hydrax-adapter": "ok",
      "canton-adapter": "ok",
      "market-data-svc": "ok",
      "notify-svc": "ok",
      "integration-svc": "ok",
    });
    const result = await aggregateHealth(cfg, { fetchImpl });
    expect(result.service).toBe("bff");
    expect(result.status).toBe("ok");
    expect(result.upstreams).toHaveLength(8);
    expect(result.upstreams.every((u) => u.ok)).toBe(true);
  });

  it("reports degraded when some upstreams are down", async () => {
    const fetchImpl = fakeFetch({
      "workflow-svc": "ok",
      "approval-svc": "ok",
      "audit-svc": "ok",
      "hydrax-adapter": "down",
      "canton-adapter": "ok",
      "market-data-svc": "ok",
      "notify-svc": "ok",
      "integration-svc": "ok",
    });
    const result = await aggregateHealth(cfg, { fetchImpl });
    expect(result.status).toBe("degraded");
    const hydrax = result.upstreams.find((u) => u.service === "hydrax-adapter");
    expect(hydrax?.ok).toBe(false);
    expect(hydrax?.httpStatus).toBe(503);
  });

  it("reports down when every upstream is down or unreachable", async () => {
    const fetchImpl = fakeFetch({
      "workflow-svc": "throw",
      "approval-svc": "throw",
      "audit-svc": "throw",
      "hydrax-adapter": "throw",
      "canton-adapter": "throw",
      "market-data-svc": "throw",
      "notify-svc": "down",
      "integration-svc": "down",
    });
    const result = await aggregateHealth(cfg, { fetchImpl });
    expect(result.status).toBe("down");
    expect(result.upstreams.filter((u) => u.status === "unreachable")).toHaveLength(6);
    expect(result.upstreams.filter((u) => u.status === "down")).toHaveLength(2);
  });

  it("captures unreachable error messages without throwing", async () => {
    const fetchImpl: FetchFn = async () => {
      throw new Error("ENOTFOUND");
    };
    const result = await aggregateHealth(cfg, { fetchImpl });
    expect(result.status).toBe("down");
    for (const u of result.upstreams) {
      expect(u.status).toBe("unreachable");
      expect(u.error).toContain("ENOTFOUND");
    }
  });
});
