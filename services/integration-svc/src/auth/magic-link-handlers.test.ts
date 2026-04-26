import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { openPool, type Pool } from "../db.js";
import { Sessions } from "./repo.js";
import { MagicLinks } from "./magic-link-repo.js";
import { createRateLimit } from "./magic-link-rate-limit.js";
import { mountMagicLinkRoutes, type MagicLinkHandlerOptions } from "./magic-link-handlers.js";
import { hashToken } from "./token.js";

const dsn = process.env.INTEGRATION_SVC_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dsn) throw new Error("INTEGRATION_SVC_DATABASE_URL or DATABASE_URL must be set");

let pool: Pool;
let server: http.Server;
let baseUrl: string;
let opts: MagicLinkHandlerOptions;
let sentEmails: Array<{ to: string; subject: string; text: string }> = [];

const tenantSlug = `mlh-${randomBytes(8).toString("hex")}`;
const email = `mlh-${randomBytes(8).toString("hex")}@example.test`;
let tenantId: string;
let userId: string;

beforeAll(async () => {
  pool = openPool({ connectionString: dsn! });
  const c = await pool.connect();
  try {
    const t = await c.query(
      `INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
      [tenantSlug, tenantSlug],
    );
    tenantId = t.rows[0].id;
    const u = await c.query(
      `INSERT INTO users (tenant_id, email, role) VALUES ($1, $2, 'admin') RETURNING id`,
      [tenantId, email],
    );
    userId = u.rows[0].id;
  } finally { c.release(); }

  const sessions = new Sessions(pool);
  const magicLinks = new MagicLinks(pool);
  const rateLimit = createRateLimit({ max: 3, windowSeconds: 60, maxBuckets: 100 });

  opts = {
    sessions,
    magicLinks,
    rateLimit,
    notifyClient: { sendEmail: vi.fn(async (input) => { sentEmails.push(input); }) },
    notifyConfig: { notifySvcUrl: "http://stub" },
    config: { ttlSeconds: 900, rateLimitMax: 3, rateLimitWindowSeconds: 60, baseUrl: "http://localhost:5173/auth/magic-link" },
    sessionTtlSeconds: 3600,
  };

  server = http.createServer((req, res) => {
    if (!mountMagicLinkRoutes(req, res, opts)) res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, () => r()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  const c = await pool.connect();
  try {
    await c.query(`DELETE FROM magic_link_tokens WHERE tenant_id = $1`, [tenantId]);
    await c.query(`DELETE FROM user_sessions WHERE tenant_id = $1`, [tenantId]);
    await c.query(`DELETE FROM users WHERE tenant_id = $1`, [tenantId]);
    await c.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
  } finally { c.release(); await pool.end(); }
});

afterEach(async () => {
  sentEmails = [];
  vi.mocked(opts.notifyClient.sendEmail).mockClear();
  // Reset the rate limiter so the same (tenantSlug:email) key in each test
  // does not bleed budget across tests. Reassigning is safe — the createServer
  // callback re-reads opts on every request.
  opts.rateLimit = createRateLimit({ max: 3, windowSeconds: 60, maxBuckets: 100 });
  const c = await pool.connect();
  try { await c.query(`DELETE FROM magic_link_tokens WHERE tenant_id = $1`, [tenantId]); }
  finally { c.release(); }
});

// Some afterEach side effects (notify mock, magic-link cleanup) race with the
// async best-effort 202 path which writes to the DB after responding. Wait for
// the in-flight side effect to settle before moving on.
async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 50));
}

describe("POST /v1/auth/magic-link/request", () => {
  it("returns 202 and triggers an email for an existing user", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/magic-link/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email }),
    });
    expect(res.status).toBe(202);
    await settle();
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]!.to).toBe(email);
    expect(sentEmails[0]!.subject).toMatch(/sign in/i);
    expect(sentEmails[0]!.text).toMatch(/http:\/\/localhost:5173\/auth\/magic-link\?token=[A-Za-z0-9_-]{43}/);
  });

  it("returns 202 for an unknown user but does NOT send an email (no leak)", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/magic-link/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: "ghost-tenant", email: "ghost@example.test" }),
    });
    expect(res.status).toBe(202);
    await settle();
    expect(sentEmails).toHaveLength(0);
  });

  it("returns 400 for missing fields", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/magic-link/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 405 for non-POST", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/magic-link/request`);
    expect(res.status).toBe(405);
  });

  it("rate-limits after the configured max requests for the same key", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`${baseUrl}/v1/auth/magic-link/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_slug: tenantSlug, email }),
      });
      expect(r.status).toBe(202);
    }
    const blocked = await fetch(`${baseUrl}/v1/auth/magic-link/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email }),
    });
    expect(blocked.status).toBe(429);
    await settle();
  });

  it("swallows notify-client errors and still returns 202", async () => {
    vi.mocked(opts.notifyClient.sendEmail).mockRejectedValueOnce(new Error("smtp down"));
    const res = await fetch(`${baseUrl}/v1/auth/magic-link/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email }),
    });
    expect(res.status).toBe(202);
    await settle();
  });
});

describe("GET /v1/auth/magic-link/consume", () => {
  async function issueToken(): Promise<string> {
    const res = await fetch(`${baseUrl}/v1/auth/magic-link/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email }),
    });
    expect(res.status).toBe(202);
    await settle();
    const last = sentEmails[sentEmails.length - 1]!;
    const m = /token=([A-Za-z0-9_-]+)/.exec(last.text);
    expect(m).not.toBeNull();
    return m![1]!;
  }

  it("returns 200 with session token + session info on first consume", async () => {
    const token = await issueToken();
    const res = await fetch(`${baseUrl}/v1/auth/magic-link/consume?token=${token}`);
    expect(res.status).toBe(200);
    const body = await res.json() as { token: string; session: { user_id: string; tenant_id: string; role: string } };
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.session.user_id).toBe(userId);
    expect(body.session.tenant_id).toBe(tenantId);
    expect(body.session.role).toBe("admin");

    const sessions = new Sessions(pool);
    const found = await sessions.findActiveByTokenHash(hashToken(body.token));
    expect(found).not.toBeNull();
    expect(found!.userId).toBe(userId);
  });

  it("returns 401 on second consume of the same token (single-use)", async () => {
    const token = await issueToken();
    const first = await fetch(`${baseUrl}/v1/auth/magic-link/consume?token=${token}`);
    expect(first.status).toBe(200);
    const second = await fetch(`${baseUrl}/v1/auth/magic-link/consume?token=${token}`);
    expect(second.status).toBe(401);
  });

  it("returns 401 for an unknown token", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/magic-link/consume?token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`);
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing token query param", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/magic-link/consume`);
    expect(res.status).toBe(400);
  });

  it("returns 405 for non-GET", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/magic-link/consume?token=x`, { method: "POST" });
    expect(res.status).toBe(405);
  });
});
