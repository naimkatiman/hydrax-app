import { describe, it, expect } from "vitest";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { proxyWhoami, proxyLogout, AuthUpstreamError } from "./proxy.js";

interface SimpleMock {
  url: string;
  setNext(spec: { status: number; body: unknown }): void;
  lastReq: { method: string; url: string; headers: http.IncomingHttpHeaders; body: string } | null;
  close(): Promise<void>;
}

async function startMockIntegrationSvc(): Promise<SimpleMock> {
  let nextSpec: { status: number; body: unknown } = { status: 200, body: {} };
  let lastReq: SimpleMock["lastReq"] = null;

  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks).toString("utf8");
    lastReq = { method: req.method ?? "", url: req.url ?? "", headers: req.headers, body };
    const spec = nextSpec;
    res.writeHead(spec.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(spec.body));
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${addr.port}`,
    get lastReq() { return lastReq; },
    setNext(spec: { status: number; body: unknown }) { nextSpec = spec; },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

describe("proxyWhoami", () => {
  it("forwards bearer token and returns WhoamiResult on 200", async () => {
    const mock = await startMockIntegrationSvc();
    const expected = {
      session_id: "sess-1",
      user_id: "user-1",
      tenant_id: "tenant-1",
      tenant_slug: "acme",
      email: "alice@example.com",
      role: "investor",
      expires_at: "2026-05-01T00:00:00.000Z",
    };
    mock.setNext({ status: 200, body: expected });
    try {
      const result = await proxyWhoami("test-token-abc", { integrationSvcUrl: mock.url });
      expect(result.session_id).toBe("sess-1");
      expect(result.email).toBe("alice@example.com");
      expect(mock.lastReq?.headers.authorization).toBe("Bearer test-token-abc");
    } finally {
      await mock.close();
    }
  });

  it("throws AuthUpstreamError with httpStatus 401 when upstream returns 401", async () => {
    const mock = await startMockIntegrationSvc();
    mock.setNext({ status: 401, body: { error: "invalid_token" } });
    try {
      await expect(
        proxyWhoami("bad-token", { integrationSvcUrl: mock.url }),
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof AuthUpstreamError && err.httpStatus === 401,
      );
    } finally {
      await mock.close();
    }
  });
});

describe("proxyLogout", () => {
  it("POSTs to /v1/auth/logout with bearer and resolves void on 204", async () => {
    const mock = await startMockIntegrationSvc();
    mock.setNext({ status: 204, body: null });
    try {
      await expect(
        proxyLogout("test-token-abc", { integrationSvcUrl: mock.url }),
      ).resolves.toBeUndefined();
      expect(mock.lastReq?.method).toBe("POST");
      expect(mock.lastReq?.url).toBe("/v1/auth/logout");
      expect(mock.lastReq?.headers.authorization).toBe("Bearer test-token-abc");
    } finally {
      await mock.close();
    }
  });
});
