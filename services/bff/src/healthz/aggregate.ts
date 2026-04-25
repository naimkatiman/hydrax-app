// Composite /healthz aggregator. Fans out to every upstream, collects each
// service's /healthz response (or failure), and returns one envelope the
// React portals can render in a single request.

import type { UpstreamConfig } from "../bff/bff.js";

export interface UpstreamHealth {
  service: string;
  url: string;
  ok: boolean;
  status: "ok" | "down" | "unreachable";
  httpStatus?: number;
  error?: string;
  latencyMs: number;
}

export interface CompositeHealth {
  service: "bff";
  status: "ok" | "degraded" | "down";
  upstreams: UpstreamHealth[];
}

interface UpstreamProbe {
  service: string;
  url: string;
}

export function buildProbeList(cfg: Readonly<UpstreamConfig>): UpstreamProbe[] {
  return [
    { service: "workflow-svc", url: cfg.workflowSvcUrl },
    { service: "approval-svc", url: cfg.approvalSvcUrl },
    { service: "audit-svc", url: cfg.auditSvcUrl },
    { service: "hydrax-adapter", url: cfg.hydraxAdapterUrl },
    { service: "canton-adapter", url: cfg.cantonAdapterUrl },
    { service: "market-data-svc", url: cfg.marketDataSvcUrl },
    { service: "notify-svc", url: cfg.notifySvcUrl },
    { service: "integration-svc", url: cfg.integrationSvcUrl },
  ];
}

export type FetchFn = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface AggregateOptions {
  fetchImpl?: FetchFn;
  timeoutMs?: number;
}

export async function aggregateHealth(
  cfg: Readonly<UpstreamConfig>,
  opts: Readonly<AggregateOptions> = {},
): Promise<CompositeHealth> {
  const fetchImpl: FetchFn =
    opts.fetchImpl ?? (globalThis.fetch as unknown as FetchFn);
  const timeoutMs = opts.timeoutMs ?? 1500;

  const probes = buildProbeList(cfg);
  const upstreams = await Promise.all(
    probes.map((p) => probeOne(p, fetchImpl, timeoutMs)),
  );

  const downCount = upstreams.filter((u) => !u.ok).length;
  const status: CompositeHealth["status"] =
    downCount === 0 ? "ok" : downCount === upstreams.length ? "down" : "degraded";

  return { service: "bff", status, upstreams };
}

async function probeOne(
  probe: UpstreamProbe,
  fetchImpl: FetchFn,
  timeoutMs: number,
): Promise<UpstreamHealth> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${probe.url}/healthz`, { signal: controller.signal });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return {
        service: probe.service,
        url: probe.url,
        ok: false,
        status: "down",
        httpStatus: res.status,
        latencyMs,
      };
    }
    // Best-effort decode; treat decode failure as still ok if HTTP was 200.
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    const reportedOk =
      body !== undefined &&
      typeof body === "object" &&
      body !== null &&
      "status" in (body as Record<string, unknown>) &&
      (body as Record<string, unknown>).status === "ok";

    return {
      service: probe.service,
      url: probe.url,
      ok: reportedOk || res.ok,
      status: "ok",
      httpStatus: res.status,
      latencyMs,
    };
  } catch (err: unknown) {
    return {
      service: probe.service,
      url: probe.url,
      ok: false,
      status: "unreachable",
      error: err instanceof Error ? err.message : "unknown",
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}
