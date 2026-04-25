import { describe, it, expect, afterAll, beforeAll } from "vitest";
import http, { type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { startServer } from "./server.js";
import { loadUpstreamConfig } from "./bff/bff.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  ({ server, baseUrl } = await startServer({ port: 0, service: "bff" }));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe("bff /healthz", () => {
  it("returns 200 with service identity", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string; status: string };
    expect(body.service).toBe("bff");
    expect(body.status).toBe("ok");
  });
});

describe("bff /v1/products/{id} method guard", () => {
  it("returns 405 for non-GET methods on /v1/products/{id}", async () => {
    const { server: s, baseUrl: u } = await startServer({ port: 0, service: "bff" });
    try {
      const res = await fetch(`${u}/v1/products/abc-123`, { method: "DELETE" });
      expect(res.status).toBe(405);
    } finally {
      await new Promise<void>((resolve, reject) =>
        s.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});

interface MockHandlerSpec {
  readonly status: number;
  readonly body: unknown;
  readonly transportError?: boolean;
}

interface MockUpstream {
  readonly url: string;
  close(): Promise<void>;
  readonly received: Array<{ method: string; url: string; body: string }>;
}

async function startMockWorkflowSvc(routes: Record<string, MockHandlerSpec>): Promise<MockUpstream> {
  const received: Array<{ method: string; url: string; body: string }> = [];
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks).toString("utf8");
    received.push({ method: req.method ?? "", url: req.url ?? "", body });
    const key = `${req.method} ${req.url}`;
    const matchKey =
      Object.keys(routes).find((k) => k === key) ??
      Object.keys(routes).find((k) => {
        const [m, u] = k.split(" ");
        return m === req.method && u && req.url?.startsWith(u);
      });
    if (!matchKey) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "mock_not_found" }));
      return;
    }
    const spec = routes[matchKey];
    if (!spec) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "mock_misconfigured" }));
      return;
    }
    if (spec.transportError) {
      // Forcibly close the socket to provoke a transport error in the bff.
      req.socket.destroy();
      return;
    }
    res.writeHead(spec.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(spec.body));
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${addr.port}`,
    received,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

async function startBffWithUpstream(workflowSvcUrl: string): Promise<{ baseUrl: string; close(): Promise<void> }> {
  const upstreamConfig = { ...loadUpstreamConfig(process.env), workflowSvcUrl };
  const { server: s, baseUrl: u } = await startServer({ port: 0, service: "bff", upstreamConfig });
  return {
    baseUrl: u,
    close: () =>
      new Promise<void>((resolve, reject) =>
        s.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

describe("bff /v1/subscriptions POST", () => {
  it("returns 201 with the subscription on upstream success", async () => {
    const upstream = await startMockWorkflowSvc({
      "POST /v1/subscriptions": {
        status: 201,
        body: {
          id: "sub-1",
          product_id: "prod-1",
          investor_user_id: "user-1",
          amount_minor: 50000,
          currency: "USD",
          status: "pending",
          created_at: "2026-04-25T00:00:00.000000Z",
          updated_at: "2026-04-25T00:00:00.000000Z",
        },
      },
    });
    const bff = await startBffWithUpstream(upstream.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: "prod-1",
          investor_user_id: "user-1",
          amount_minor: 50000,
          currency: "USD",
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { id: string; status: string };
      expect(body.id).toBe("sub-1");
      expect(body.status).toBe("pending");
      expect(upstream.received[0]?.method).toBe("POST");
      expect(upstream.received[0]?.url).toBe("/v1/subscriptions");
    } finally {
      await bff.close();
      await upstream.close();
    }
  });

  it("passes through upstream 400 when workflow-svc rejects body", async () => {
    const upstream = await startMockWorkflowSvc({
      "POST /v1/subscriptions": {
        status: 400,
        body: { error: "missing_fields", message: "product_id required" },
      },
    });
    const bff = await startBffWithUpstream(upstream.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: "USD" }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("subscriptions_upstream");
    } finally {
      await bff.close();
      await upstream.close();
    }
  });

  it("returns 502 on upstream transport error", async () => {
    const upstream = await startMockWorkflowSvc({
      "POST /v1/subscriptions": { status: 0, body: null, transportError: true },
    });
    const bff = await startBffWithUpstream(upstream.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: "prod-1",
          investor_user_id: "user-1",
          amount_minor: 50000,
          currency: "USD",
        }),
      });
      expect(res.status).toBe(502);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("subscriptions_upstream");
    } finally {
      await bff.close();
      await upstream.close();
    }
  });

  it("returns 405 for PUT /v1/subscriptions", async () => {
    const { server: s, baseUrl: u } = await startServer({ port: 0, service: "bff" });
    try {
      const res = await fetch(`${u}/v1/subscriptions`, { method: "PUT" });
      expect(res.status).toBe(405);
    } finally {
      await new Promise<void>((resolve, reject) =>
        s.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});

describe("bff /v1/subscriptions/{id} GET", () => {
  it("returns 200 with the subscription body", async () => {
    const upstream = await startMockWorkflowSvc({
      "GET /v1/subscriptions/": {
        status: 200,
        body: {
          id: "sub-2",
          product_id: "prod-1",
          investor_user_id: "user-1",
          amount_minor: 75000,
          currency: "USD",
          status: "pending",
          created_at: "2026-04-25T00:00:00.000000Z",
          updated_at: "2026-04-25T00:00:00.000000Z",
        },
      },
    });
    const bff = await startBffWithUpstream(upstream.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/subscriptions/sub-2`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string };
      expect(body.id).toBe("sub-2");
      expect(upstream.received[0]?.url).toBe("/v1/subscriptions/sub-2");
    } finally {
      await bff.close();
      await upstream.close();
    }
  });

  it("passes through upstream 404 when subscription does not exist", async () => {
    const upstream = await startMockWorkflowSvc({
      "GET /v1/subscriptions/": {
        status: 404,
        body: { error: "not_found", message: "no subscription with that id" },
      },
    });
    const bff = await startBffWithUpstream(upstream.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/subscriptions/missing`);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("subscriptions_upstream");
    } finally {
      await bff.close();
      await upstream.close();
    }
  });
});
