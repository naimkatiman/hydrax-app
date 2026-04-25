import { describe, it, expect, afterEach } from "vitest";
import * as http from "node:http";
import { extractBearer, requireSession } from "./middleware.js";
import type { WhoamiResult } from "./proxy.js";

// ── extractBearer ─────────────────────────────────────────────────────────────

describe("extractBearer", () => {
  it("returns the token when Authorization header is present", () => {
    const req = { headers: { authorization: "Bearer abc123" } } as unknown as http.IncomingMessage;
    expect(extractBearer(req)).toBe("abc123");
  });

  it("returns null when Authorization header is missing", () => {
    const req = { headers: {} } as unknown as http.IncomingMessage;
    expect(extractBearer(req)).toBeNull();
  });

  it("returns null when Authorization is not Bearer scheme", () => {
    const req = { headers: { authorization: "Basic dXNlcjpwYXNz" } } as unknown as http.IncomingMessage;
    expect(extractBearer(req)).toBeNull();
  });

  it("returns null when Bearer value is missing", () => {
    const req = { headers: { authorization: "Bearer " } } as unknown as http.IncomingMessage;
    expect(extractBearer(req)).toBeNull();
  });
});

// ── requireSession ────────────────────────────────────────────────────────────

function startMockIntegrationSvc(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

const mockSession: WhoamiResult = {
  session_id: "sess-1",
  user_id: "usr-1",
  tenant_id: "ten-1",
  tenant_slug: "acme",
  email: "alice@acme.com",
  role: "issuer",
  expires_at: "2099-01-01T00:00:00Z",
};

describe("requireSession", () => {
  const mockServers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(mockServers.map(closeServer));
    mockServers.length = 0;
  });

  it("writes 401 and returns null when Authorization header is missing", async () => {
    const req = { headers: {} } as unknown as http.IncomingMessage;
    const chunks: Buffer[] = [];
    const res = {
      writeHead: () => {},
      end: (chunk: string) => chunks.push(Buffer.from(chunk)),
    } as unknown as http.ServerResponse;

    let writeHeadStatus = 0;
    (res as unknown as { writeHead: (s: number) => void }).writeHead = (s: number) => {
      writeHeadStatus = s;
    };

    const result = await requireSession(req, res, { integrationSvcUrl: "http://localhost:0" });
    expect(result).toBeNull();
    expect(writeHeadStatus).toBe(401);
  });

  it("writes 401 and returns null when integration-svc returns 401 for whoami", async () => {
    const { server, url } = await startMockIntegrationSvc((_req, res) => {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
    });
    mockServers.push(server);

    const req = { headers: { authorization: "Bearer bad-token" } } as unknown as http.IncomingMessage;
    const chunks: Buffer[] = [];
    let writeHeadStatus = 0;
    const res = {
      writeHead: (s: number) => { writeHeadStatus = s; },
      end: (chunk: string) => chunks.push(Buffer.from(chunk)),
    } as unknown as http.ServerResponse;

    const result = await requireSession(req, res, { integrationSvcUrl: url });
    expect(result).toBeNull();
    expect(writeHeadStatus).toBe(401);
  });

  it("returns session when integration-svc returns valid whoami response", async () => {
    const { server, url } = await startMockIntegrationSvc((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(mockSession));
    });
    mockServers.push(server);

    const req = { headers: { authorization: "Bearer valid-token" } } as unknown as http.IncomingMessage;
    const res = {
      writeHead: () => {},
      end: () => {},
    } as unknown as http.ServerResponse;

    const result = await requireSession(req, res, { integrationSvcUrl: url });
    expect(result).not.toBeNull();
    expect(result?.user_id).toBe("usr-1");
    expect(result?.tenant_slug).toBe("acme");
  });
});
