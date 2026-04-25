import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { openPool, type Pool } from "../db.js";
import { MagicLinks } from "./magic-link-repo.js";

const dsn = process.env.INTEGRATION_SVC_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dsn) {
  throw new Error("INTEGRATION_SVC_DATABASE_URL or DATABASE_URL must be set for magic-link-repo tests");
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
  const tenantSlug = `ml-${suffix()}`;
  const email = `ml-${suffix()}@example.test`;
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
    await client.query(`DELETE FROM magic_link_tokens WHERE tenant_id IN
      (SELECT id FROM tenants WHERE slug = $1)`, [tenantSlug]);
    await client.query(`DELETE FROM users WHERE tenant_id IN
      (SELECT id FROM tenants WHERE slug = $1)`, [tenantSlug]);
    await client.query(`DELETE FROM tenants WHERE slug = $1`, [tenantSlug]);
    client.release();
  }
}

describe("MagicLinks repo", () => {
  it("create persists token and returns id + expiresAt", async () => {
    await withFixture(async ({ userId, tenantId }) => {
      const repo = new MagicLinks(pool);
      const tokenHash = randomBytes(32);
      const result = await repo.create({ userId, tenantId, tokenHash, ttlSeconds: 900 });
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  it("consume returns user_id + tenant_id and marks token used", async () => {
    await withFixture(async ({ userId, tenantId }) => {
      const repo = new MagicLinks(pool);
      const tokenHash = randomBytes(32);
      await repo.create({ userId, tenantId, tokenHash, ttlSeconds: 900 });
      const consumed = await repo.consume(tokenHash);
      expect(consumed).not.toBeNull();
      expect(consumed!.userId).toBe(userId);
      expect(consumed!.tenantId).toBe(tenantId);
      expect(consumed!.usedAt).toBeInstanceOf(Date);
    });
  });

  it("consume returns null on second call (single-use)", async () => {
    await withFixture(async ({ userId, tenantId }) => {
      const repo = new MagicLinks(pool);
      const tokenHash = randomBytes(32);
      await repo.create({ userId, tenantId, tokenHash, ttlSeconds: 900 });
      const first = await repo.consume(tokenHash);
      expect(first).not.toBeNull();
      const second = await repo.consume(tokenHash);
      expect(second).toBeNull();
    });
  });

  it("consume returns null for unknown token", async () => {
    const repo = new MagicLinks(pool);
    const unknown = randomBytes(32);
    expect(await repo.consume(unknown)).toBeNull();
  });

  it("consume returns null for expired token", async () => {
    await withFixture(async ({ userId, tenantId }) => {
      const repo = new MagicLinks(pool);
      const tokenHash = randomBytes(32);
      await repo.create({ userId, tenantId, tokenHash, ttlSeconds: 0 });
      const consumed = await repo.consume(tokenHash);
      expect(consumed).toBeNull();
    });
  });

  it("create rejects duplicate token_hash (UNIQUE constraint)", async () => {
    await withFixture(async ({ userId, tenantId }) => {
      const repo = new MagicLinks(pool);
      const tokenHash = randomBytes(32);
      await repo.create({ userId, tenantId, tokenHash, ttlSeconds: 900 });
      await expect(
        repo.create({ userId, tenantId, tokenHash, ttlSeconds: 900 }),
      ).rejects.toThrow();
    });
  });

  it("two concurrent consume() calls only succeed once (atomicity)", async () => {
    await withFixture(async ({ userId, tenantId }) => {
      const repo = new MagicLinks(pool);
      const tokenHash = randomBytes(32);
      await repo.create({ userId, tenantId, tokenHash, ttlSeconds: 900 });
      const [a, b] = await Promise.all([repo.consume(tokenHash), repo.consume(tokenHash)]);
      const successes = [a, b].filter((r) => r !== null);
      expect(successes).toHaveLength(1);
    });
  });
});
