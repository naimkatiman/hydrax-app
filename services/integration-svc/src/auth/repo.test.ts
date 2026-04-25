import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { openPool, type Pool } from "../db.js";
import { Sessions } from "./repo.js";
import { hashToken, generateToken } from "./token.js";

const dsn = process.env.INTEGRATION_SVC_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dsn) {
  throw new Error("INTEGRATION_SVC_DATABASE_URL or DATABASE_URL must be set for repo tests");
}

let pool: Pool;
beforeAll(() => { pool = openPool({ connectionString: dsn! }); });
afterAll(async () => { await pool.end(); });

function suffix(): string {
  return randomBytes(8).toString("hex");
}

async function withFixture(
  fn: (ctx: { tenantId: string; userId: string; tenantSlug: string; email: string }) => Promise<void>,
): Promise<void> {
  const tenantSlug = `t-${suffix()}`;
  const email = `u-${suffix()}@example.test`;
  const client = await pool.connect();
  try {
    const t = await client.query(
      `INSERT INTO tenants (slug, name, persona) VALUES ($1, $2, 'issuer') RETURNING id`,
      [tenantSlug, tenantSlug],
    );
    const tenantId = t.rows[0].id as string;
    const u = await client.query(
      `INSERT INTO users (tenant_id, email, role) VALUES ($1, $2, 'admin') RETURNING id`,
      [tenantId, email],
    );
    const userId = u.rows[0].id as string;
    await fn({ tenantId, userId, tenantSlug, email });
  } finally {
    await client.query(`DELETE FROM user_sessions WHERE tenant_id IN
      (SELECT id FROM tenants WHERE slug = $1)`, [tenantSlug]);
    await client.query(`DELETE FROM users WHERE tenant_id IN
      (SELECT id FROM tenants WHERE slug = $1)`, [tenantSlug]);
    await client.query(`DELETE FROM tenants WHERE slug = $1`, [tenantSlug]);
    client.release();
  }
}

describe("Sessions repo", () => {
  it("findUserByTenantSlugAndEmail returns user for known tenant+email", async () => {
    await withFixture(async ({ tenantId, userId, tenantSlug, email }) => {
      const repo = new Sessions(pool);
      const found = await repo.findUserByTenantSlugAndEmail(tenantSlug, email);
      expect(found).toEqual({ userId, tenantId, role: "admin" });
    });
  });

  it("findUserByTenantSlugAndEmail returns null for unknown tenant", async () => {
    const repo = new Sessions(pool);
    const found = await repo.findUserByTenantSlugAndEmail(`nope-${suffix()}`, "x@y.z");
    expect(found).toBeNull();
  });

  it("findUserByTenantSlugAndEmail returns null for unknown email in known tenant", async () => {
    await withFixture(async ({ tenantSlug }) => {
      const repo = new Sessions(pool);
      const found = await repo.findUserByTenantSlugAndEmail(tenantSlug, `x-${suffix()}@y.z`);
      expect(found).toBeNull();
    });
  });

  it("createSession persists row with token_hash and returns id+expiresAt", async () => {
    await withFixture(async ({ tenantId, userId }) => {
      const repo = new Sessions(pool);
      const token = generateToken();
      const result = await repo.createSession({
        userId,
        tenantId,
        tokenHash: hashToken(token),
        ttlSeconds: 60,
      });
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
      const found = await repo.findActiveByTokenHash(hashToken(token));
      expect(found).not.toBeNull();
      expect(found!.userId).toBe(userId);
      expect(found!.tenantId).toBe(tenantId);
      expect(found!.role).toBe("admin");
    });
  });

  it("findActiveByTokenHash returns null for unknown hash", async () => {
    const repo = new Sessions(pool);
    expect(await repo.findActiveByTokenHash(hashToken("nope"))).toBeNull();
  });

  it("findActiveByTokenHash returns null for expired session", async () => {
    await withFixture(async ({ tenantId, userId }) => {
      const repo = new Sessions(pool);
      const token = generateToken();
      await repo.createSession({
        userId,
        tenantId,
        tokenHash: hashToken(token),
        ttlSeconds: -1,
      });
      expect(await repo.findActiveByTokenHash(hashToken(token))).toBeNull();
    });
  });

  it("revokeByTokenHash makes session non-findable", async () => {
    await withFixture(async ({ tenantId, userId }) => {
      const repo = new Sessions(pool);
      const token = generateToken();
      await repo.createSession({
        userId,
        tenantId,
        tokenHash: hashToken(token),
        ttlSeconds: 60,
      });
      await repo.revokeByTokenHash(hashToken(token));
      expect(await repo.findActiveByTokenHash(hashToken(token))).toBeNull();
    });
  });
});
