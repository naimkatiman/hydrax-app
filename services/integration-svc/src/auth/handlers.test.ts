import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { openPool, type Pool } from "../db.js";
import { mountAuthRoutes, type AuthHandlerOptions } from "./handlers.js";
import { Sessions } from "./repo.js";

const dsn = process.env.INTEGRATION_SVC_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dsn) {
  throw new Error("INTEGRATION_SVC_DATABASE_URL or DATABASE_URL must be set for handlers tests");
}

let pool: Pool;
let server: http.Server;
let baseUrl: string;
let opts: AuthHandlerOptions;

const tenantSlug = `t-${randomBytes(8).toString("hex")}`;
const email = `u-${randomBytes(8).toString("hex")}@example.test`;
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
  } finally {
    c.release();
  }

  const repo = new Sessions(pool);
  opts = { repo, ttlSeconds: 60, devLoginEnabled: true };
  server = http.createServer((req, res) => {
    if (!mountAuthRoutes(req, res, opts)) {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  const c = await pool.connect();
  try {
    await c.query(`DELETE FROM user_sessions WHERE tenant_id = $1`, [tenantId]);
    await c.query(`DELETE FROM users WHERE tenant_id = $1`, [tenantId]);
    await c.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
  } finally {
    c.release();
    await pool.end();
  }
});

afterEach(async () => {
  const c = await pool.connect();
  try { await c.query(`DELETE FROM user_sessions WHERE tenant_id = $1`, [tenantId]); }
  finally { c.release(); }
});

describe("auth handlers", () => {
  it("POST /v1/auth/dev/login returns 200 + token for known user", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/dev/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; session: { user_id: string; tenant_id: string; role: string; expires_at: string } };
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.session.user_id).toBe(userId);
    expect(body.session.tenant_id).toBe(tenantId);
    expect(body.session.role).toBe("admin");
    expect(typeof body.session.expires_at).toBe("string");
  });

  it("POST /v1/auth/dev/login returns 404 when devLoginEnabled=false", async () => {
    opts.devLoginEnabled = false;
    try {
      const res = await fetch(`${baseUrl}/v1/auth/dev/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_slug: tenantSlug, email }),
      });
      expect(res.status).toBe(404);
    } finally {
      opts.devLoginEnabled = true;
    }
  });

  it("POST /v1/auth/dev/login returns 401 for unknown tenant", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/dev/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: "nope", email }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /v1/auth/dev/login returns 400 for malformed body", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/dev/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });

  it("POST /v1/auth/dev/login returns 400 for missing fields", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/dev/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /v1/auth/dev/login returns 405 for GET", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/dev/login`, { method: "GET" });
    expect(res.status).toBe(405);
  });

  it("GET /v1/auth/whoami returns 200 + session for valid bearer", async () => {
    const login = await fetch(`${baseUrl}/v1/auth/dev/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email }),
    });
    const { token } = (await login.json()) as { token: string };
    const me = await fetch(`${baseUrl}/v1/auth/whoami`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);
    const body = (await me.json()) as { user_id: string; tenant_slug: string; email: string; role: string };
    expect(body.user_id).toBe(userId);
    expect(body.tenant_slug).toBe(tenantSlug);
    expect(body.email).toBe(email);
    expect(body.role).toBe("admin");
  });

  it("GET /v1/auth/whoami returns 401 without bearer", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/whoami`);
    expect(res.status).toBe(401);
  });

  it("GET /v1/auth/whoami returns 401 for unknown bearer", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/whoami`, {
      headers: { authorization: "Bearer nope" },
    });
    expect(res.status).toBe(401);
  });

  it("POST /v1/auth/logout revokes session and subsequent whoami returns 401", async () => {
    const login = await fetch(`${baseUrl}/v1/auth/dev/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email }),
    });
    const { token } = (await login.json()) as { token: string };
    const out = await fetch(`${baseUrl}/v1/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(out.status).toBe(204);
    const me = await fetch(`${baseUrl}/v1/auth/whoami`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(401);
  });
});
