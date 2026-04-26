import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { openPool, type Pool } from "../db.js";
import { mountAuthRoutes, type AuthHandlerOptions } from "./handlers.js";
import { Sessions } from "./repo.js";
import { generateToken, hashToken } from "./token.js";

const dsn = process.env.INTEGRATION_SVC_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dsn) {
  throw new Error("INTEGRATION_SVC_DATABASE_URL or DATABASE_URL must be set for handlers tests");
}

let pool: Pool;
let server: http.Server;
let baseUrl: string;
let opts: AuthHandlerOptions;
let repo: Sessions;

const tenantSlug = `t-${randomBytes(8).toString("hex")}`;
const email = `u-${randomBytes(8).toString("hex")}@example.test`;
let tenantId: string;
let userId: string;

async function mintSession(): Promise<string> {
  const token = generateToken();
  await repo.createSession({
    userId,
    tenantId,
    tokenHash: hashToken(token),
    ttlSeconds: opts.ttlSeconds,
  });
  return token;
}

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

  repo = new Sessions(pool);
  opts = { repo, ttlSeconds: 60 };
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
  it("GET /v1/auth/whoami returns 200 + session for valid bearer", async () => {
    const token = await mintSession();
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
    const token = await mintSession();
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
