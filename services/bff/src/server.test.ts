import { describe, it, expect, afterAll, beforeAll } from "vitest";
import http, { type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { startServer } from "./server.js";
import { loadUpstreamConfig } from "./bff/bff.js";
import type { WhoamiResult } from "./auth/proxy.js";

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

// ── Mock helpers ──────────────────────────────────────────────────────────────

const TEST_TOKEN = "test-token";

const mockSession: WhoamiResult = {
  session_id: "sess-1",
  user_id: "usr-1",
  tenant_id: "ten-1",
  tenant_slug: "acme",
  email: "alice@acme.com",
  role: "issuer",
  expires_at: "2099-01-01T00:00:00Z",
};

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

async function startMockIntegrationSvc(
  routes?: Record<string, MockHandlerSpec>,
): Promise<MockUpstream> {
  const received: Array<{ method: string; url: string; body: string }> = [];
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks).toString("utf8");
    received.push({ method: req.method ?? "", url: req.url ?? "", body });

    if (routes) {
      const key = `${req.method} ${req.url}`;
      const matchKey =
        Object.keys(routes).find((k) => k === key) ??
        Object.keys(routes).find((k) => {
          const [m, u] = k.split(" ");
          return m === req.method && u && req.url?.startsWith(u);
        });
      if (matchKey) {
        const spec = routes[matchKey];
        if (!spec) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "mock_misconfigured" }));
          return;
        }
        if (spec.transportError) {
          req.socket.destroy();
          return;
        }
        res.writeHead(spec.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(spec.body));
        return;
      }
    }

    if (req.url === "/v1/auth/whoami" && req.method === "GET") {
      const auth = req.headers["authorization"];
      if (!auth || !auth.startsWith("Bearer ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockSession));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "mock_not_found" }));
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

async function startBffWithUpstream(
  workflowSvcUrl: string,
  integrationSvcUrl: string,
): Promise<{ baseUrl: string; close(): Promise<void> }> {
  const upstreamConfig = { ...loadUpstreamConfig(process.env), workflowSvcUrl, integrationSvcUrl };
  const { server: s, baseUrl: u } = await startServer({ port: 0, service: "bff", upstreamConfig });
  return {
    baseUrl: u,
    close: () =>
      new Promise<void>((resolve, reject) =>
        s.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

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

  it("returns 405 on DELETE /v1/audit/events", async () => {
    const { server: s, baseUrl: u } = await startServer({ port: 0, service: "bff" });
    try {
      const res = await fetch(`${u}/v1/audit/events`, { method: "DELETE" });
      expect(res.status).toBe(405);
    } finally {
      await new Promise<void>((resolve, reject) =>
        s.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  it("returns 405 on DELETE /v1/approvals", async () => {
    const { baseUrl, server } = await startServer({ port: 0, service: "bff" });
    try {
      const res = await fetch(`${baseUrl}/v1/approvals`, { method: "DELETE" });
      expect(res.status).toBe(405);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});

describe("bff auth: requireSession enforcement", () => {
  it("returns 401 when Authorization header is missing on a protected route", async () => {
    const integrationSvc = await startMockIntegrationSvc();
    const workflowSvc = await startMockWorkflowSvc({});
    const bff = await startBffWithUpstream(workflowSvc.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/products/abc`, { method: "GET" });
      expect(res.status).toBe(401);
    } finally {
      await bff.close();
      await workflowSvc.close();
      await integrationSvc.close();
    }
  });
});

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
    const integrationSvc = await startMockIntegrationSvc();
    const bff = await startBffWithUpstream(upstream.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TEST_TOKEN}` },
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
      await integrationSvc.close();
    }
  });

  it("passes through upstream 400 when workflow-svc rejects body", async () => {
    const upstream = await startMockWorkflowSvc({
      "POST /v1/subscriptions": {
        status: 400,
        body: { error: "missing_fields", message: "product_id required" },
      },
    });
    const integrationSvc = await startMockIntegrationSvc();
    const bff = await startBffWithUpstream(upstream.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TEST_TOKEN}` },
        body: JSON.stringify({ currency: "USD" }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("subscriptions_upstream");
    } finally {
      await bff.close();
      await upstream.close();
      await integrationSvc.close();
    }
  });

  it("returns 502 on upstream transport error", async () => {
    const upstream = await startMockWorkflowSvc({
      "POST /v1/subscriptions": { status: 0, body: null, transportError: true },
    });
    const integrationSvc = await startMockIntegrationSvc();
    const bff = await startBffWithUpstream(upstream.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TEST_TOKEN}` },
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
      await integrationSvc.close();
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
    const integrationSvc = await startMockIntegrationSvc();
    const bff = await startBffWithUpstream(upstream.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/subscriptions/sub-2`, {
        headers: { "Authorization": `Bearer ${TEST_TOKEN}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string };
      expect(body.id).toBe("sub-2");
      expect(upstream.received[0]?.url).toBe("/v1/subscriptions/sub-2");
    } finally {
      await bff.close();
      await upstream.close();
      await integrationSvc.close();
    }
  });

  it("passes through upstream 404 when subscription does not exist", async () => {
    const upstream = await startMockWorkflowSvc({
      "GET /v1/subscriptions/": {
        status: 404,
        body: { error: "not_found", message: "no subscription with that id" },
      },
    });
    const integrationSvc = await startMockIntegrationSvc();
    const bff = await startBffWithUpstream(upstream.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/subscriptions/missing`, {
        headers: { "Authorization": `Bearer ${TEST_TOKEN}` },
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("subscriptions_upstream");
    } finally {
      await bff.close();
      await upstream.close();
      await integrationSvc.close();
    }
  });
});

describe("bff /v1/products/{id}/transition POST", () => {
  it("forwards body to workflow-svc and returns 200 with the updated product", async () => {
    const upstream = await startMockWorkflowSvc({
      "POST /v1/products/abc/transition": {
        status: 200,
        body: {
          id: "abc",
          tenant_id: "t-1",
          code: "C",
          name: "N",
          product_type: "credit-note",
          status: "approved",
          allowed_next: ["active", "cancelled"],
          created_at: "2026-04-25T00:00:00.000000Z",
          updated_at: "2026-04-25T00:00:01.000000Z",
        },
      },
    });
    const integrationSvc = await startMockIntegrationSvc();
    const bff = await startBffWithUpstream(upstream.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/products/abc/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TEST_TOKEN}` },
        body: JSON.stringify({ to: "approved" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string; status: string; allowed_next: string[] };
      expect(body.id).toBe("abc");
      expect(body.status).toBe("approved");
      expect(body.allowed_next).toEqual(["active", "cancelled"]);
      expect(upstream.received[0]?.method).toBe("POST");
      expect(upstream.received[0]?.url).toBe("/v1/products/abc/transition");
      expect(upstream.received[0]?.body).toBe(JSON.stringify({ to: "approved" }));
    } finally {
      await bff.close();
      await upstream.close();
      await integrationSvc.close();
    }
  });

  it("passes through upstream 422 with products_upstream envelope", async () => {
    const upstream = await startMockWorkflowSvc({
      "POST /v1/products/abc/transition": {
        status: 422,
        body: { error: "invalid_transition", message: "pending->matured not allowed" },
      },
    });
    const integrationSvc = await startMockIntegrationSvc();
    const bff = await startBffWithUpstream(upstream.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/products/abc/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TEST_TOKEN}` },
        body: JSON.stringify({ to: "matured" }),
      });
      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("products_upstream");
    } finally {
      await bff.close();
      await upstream.close();
      await integrationSvc.close();
    }
  });

  it("returns 502 on upstream transport error", async () => {
    const upstream = await startMockWorkflowSvc({
      "POST /v1/products/abc/transition": { status: 0, body: null, transportError: true },
    });
    const integrationSvc = await startMockIntegrationSvc();
    const bff = await startBffWithUpstream(upstream.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/products/abc/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TEST_TOKEN}` },
        body: JSON.stringify({ to: "approved" }),
      });
      expect(res.status).toBe(502);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("products_upstream");
    } finally {
      await bff.close();
      await upstream.close();
      await integrationSvc.close();
    }
  });
});

describe("bff /v1/products GET (list)", () => {
  it("returns 200 with the list and forwards session.tenant_id to workflow-svc", async () => {
    const upstream = await startMockWorkflowSvc({
      "GET /v1/products": {
        status: 200,
        body: {
          products: [
            {
              id: "p-1",
              tenant_id: "ten-1",
              code: "C-1",
              name: "Prime",
              product_type: "credit-note",
              status: "pending",
              created_at: "2026-04-26T00:00:00.000000Z",
              updated_at: "2026-04-26T00:00:00.000000Z",
            },
          ],
          next_offset: null,
        },
      },
    });
    const integrationSvc = await startMockIntegrationSvc();
    const bff = await startBffWithUpstream(upstream.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/products`, {
        headers: { "Authorization": `Bearer ${TEST_TOKEN}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { products: Array<{ id: string }>; next_offset: number | null };
      expect(body.products).toHaveLength(1);
      expect(body.products[0]?.id).toBe("p-1");
      expect(body.next_offset).toBeNull();
      // BFF forwards session.tenant_id (ten-1) as ?tenant_id= even though
      // the original GET had no query string — single source of truth.
      const upstreamCall = upstream.received[0]?.url ?? "";
      expect(upstreamCall).toContain("tenant_id=ten-1");
    } finally {
      await bff.close();
      await upstream.close();
      await integrationSvc.close();
    }
  });
});

describe("passkey routes proxy to integration-svc", () => {
  it("POST /v1/auth/passkeys/register/options forwards bearer to upstream", async () => {
    const integrationSvc = await startMockIntegrationSvc({
      "POST /v1/auth/passkeys/register/options": {
        status: 200,
        body: { challenge: "C", rp: { id: "localhost", name: "Hydrax" } },
      },
    });
    const workflowSvc = await startMockWorkflowSvc({});
    const bff = await startBffWithUpstream(workflowSvc.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/auth/passkeys/register/options`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${TEST_TOKEN}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { challenge: string };
      expect(body.challenge).toBe("C");
      expect(integrationSvc.received[0]?.method).toBe("POST");
      expect(integrationSvc.received[0]?.url).toBe("/v1/auth/passkeys/register/options");
    } finally {
      await bff.close();
      await workflowSvc.close();
      await integrationSvc.close();
    }
  });

  it("POST /v1/auth/passkeys/register/verify forwards bearer + body", async () => {
    const integrationSvc = await startMockIntegrationSvc({
      "POST /v1/auth/passkeys/register/verify": {
        status: 200,
        body: { verified: true },
      },
    });
    const workflowSvc = await startMockWorkflowSvc({});
    const bff = await startBffWithUpstream(workflowSvc.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/auth/passkeys/register/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TEST_TOKEN}` },
        body: JSON.stringify({ response: { id: "cred-1" } }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { verified: boolean };
      expect(body.verified).toBe(true);
      expect(integrationSvc.received[0]?.method).toBe("POST");
      expect(integrationSvc.received[0]?.url).toBe("/v1/auth/passkeys/register/verify");
      expect(integrationSvc.received[0]?.body).toBe(JSON.stringify({ response: { id: "cred-1" } }));
    } finally {
      await bff.close();
      await workflowSvc.close();
      await integrationSvc.close();
    }
  });

  it("POST /v1/auth/passkeys/auth/options forwards body (no bearer)", async () => {
    const integrationSvc = await startMockIntegrationSvc({
      "POST /v1/auth/passkeys/auth/options": {
        status: 200,
        body: { challenge: "C2", allowCredentials: [{ id: "abc" }] },
      },
    });
    const workflowSvc = await startMockWorkflowSvc({});
    const bff = await startBffWithUpstream(workflowSvc.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/auth/passkeys/auth/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_slug: "acme", email: "alice@acme.com" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { challenge: string; allowCredentials: Array<{ id: string }> };
      expect(body.challenge).toBe("C2");
      expect(body.allowCredentials[0]?.id).toBe("abc");
      expect(integrationSvc.received[0]?.method).toBe("POST");
      expect(integrationSvc.received[0]?.url).toBe("/v1/auth/passkeys/auth/options");
      expect(integrationSvc.received[0]?.body).toBe(
        JSON.stringify({ tenant_slug: "acme", email: "alice@acme.com" }),
      );
    } finally {
      await bff.close();
      await workflowSvc.close();
      await integrationSvc.close();
    }
  });

  it("POST /v1/auth/passkeys/auth/verify returns session token from upstream", async () => {
    const integrationSvc = await startMockIntegrationSvc({
      "POST /v1/auth/passkeys/auth/verify": {
        status: 200,
        body: {
          token: "tok-xyz",
          session: {
            id: "s-1",
            user_id: "u-1",
            tenant_id: "ten-1",
            role: "admin",
            expires_at: "2030-01-01T00:00:00Z",
          },
        },
      },
    });
    const workflowSvc = await startMockWorkflowSvc({});
    const bff = await startBffWithUpstream(workflowSvc.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/auth/passkeys/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_slug: "acme",
          email: "alice@acme.com",
          response: { id: "cred-1" },
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { token: string; session: { id: string } };
      expect(body.token).toBe("tok-xyz");
      expect(body.session.id).toBe("s-1");
      expect(integrationSvc.received[0]?.method).toBe("POST");
      expect(integrationSvc.received[0]?.url).toBe("/v1/auth/passkeys/auth/verify");
    } finally {
      await bff.close();
      await workflowSvc.close();
      await integrationSvc.close();
    }
  });
});
