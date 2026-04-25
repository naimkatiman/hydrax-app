import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import { openPool, type Pool } from "../db.js";
import { Passkeys } from "./passkey-repo.js";

const dsn = process.env.INTEGRATION_SVC_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dsn) {
  throw new Error("INTEGRATION_SVC_DATABASE_URL or DATABASE_URL must be set for passkey-repo tests");
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
  const tenantSlug = `pk-${suffix()}`;
  const email = `pk-${suffix()}@example.test`;
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
    await client.query(`DELETE FROM user_passkeys WHERE user_id IN
      (SELECT id FROM users WHERE tenant_id IN
        (SELECT id FROM tenants WHERE slug = $1))`, [tenantSlug]);
    await client.query(`DELETE FROM users WHERE tenant_id IN
      (SELECT id FROM tenants WHERE slug = $1)`, [tenantSlug]);
    await client.query(`DELETE FROM tenants WHERE slug = $1`, [tenantSlug]);
    client.release();
  }
}

describe("Passkeys repo", () => {
  it("create persists credential and returns id", async () => {
    await withFixture(async ({ userId }) => {
      const repo = new Passkeys(pool);
      const credentialId = randomBytes(32);
      const publicKey = randomBytes(77);  // typical COSE-encoded ES256 length
      const result = await repo.create({
        userId,
        credentialId,
        publicKey,
        counter: 0,
        transports: ["internal", "hybrid"],
        aaguid: null,
        nickname: null,
      });
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  it("findByCredentialId returns the credential", async () => {
    await withFixture(async ({ userId }) => {
      const repo = new Passkeys(pool);
      const credentialId = randomBytes(32);
      const publicKey = randomBytes(77);
      await repo.create({ userId, credentialId, publicKey, counter: 5, transports: [], aaguid: null, nickname: null });
      const found = await repo.findByCredentialId(credentialId);
      expect(found).not.toBeNull();
      expect(found!.userId).toBe(userId);
      expect(found!.publicKey.equals(publicKey)).toBe(true);
      expect(found!.counter).toBe(5);
    });
  });

  it("findByCredentialId returns null for unknown credential", async () => {
    const repo = new Passkeys(pool);
    expect(await repo.findByCredentialId(randomBytes(32))).toBeNull();
  });

  it("listByUserId returns all credentials for a user", async () => {
    await withFixture(async ({ userId }) => {
      const repo = new Passkeys(pool);
      const c1 = randomBytes(32);
      const c2 = randomBytes(32);
      await repo.create({ userId, credentialId: c1, publicKey: randomBytes(77), counter: 0, transports: [], aaguid: null, nickname: null });
      await repo.create({ userId, credentialId: c2, publicKey: randomBytes(77), counter: 0, transports: [], aaguid: null, nickname: null });
      const list = await repo.listByUserId(userId);
      expect(list).toHaveLength(2);
      const ids = list.map((c) => c.credentialId);
      expect(ids.some((b) => b.equals(c1))).toBe(true);
      expect(ids.some((b) => b.equals(c2))).toBe(true);
    });
  });

  it("listByUserId returns empty array when user has no credentials", async () => {
    await withFixture(async ({ userId }) => {
      const repo = new Passkeys(pool);
      expect(await repo.listByUserId(userId)).toEqual([]);
    });
  });

  it("updateCounter increments and sets last_used_at when new counter is greater", async () => {
    await withFixture(async ({ userId }) => {
      const repo = new Passkeys(pool);
      const credentialId = randomBytes(32);
      await repo.create({ userId, credentialId, publicKey: randomBytes(77), counter: 5, transports: [], aaguid: null, nickname: null });
      const ok = await repo.updateCounter(credentialId, 10);
      expect(ok).toBe(true);
      const found = await repo.findByCredentialId(credentialId);
      expect(found!.counter).toBe(10);
      expect(found!.lastUsedAt).not.toBeNull();
    });
  });

  it("updateCounter returns false when new counter is not greater (replay)", async () => {
    await withFixture(async ({ userId }) => {
      const repo = new Passkeys(pool);
      const credentialId = randomBytes(32);
      await repo.create({ userId, credentialId, publicKey: randomBytes(77), counter: 5, transports: [], aaguid: null, nickname: null });
      expect(await repo.updateCounter(credentialId, 5)).toBe(false);
      expect(await repo.updateCounter(credentialId, 4)).toBe(false);
    });
  });

  it("updateCounter accepts both-zero (Apple passkeys do not increment)", async () => {
    await withFixture(async ({ userId }) => {
      const repo = new Passkeys(pool);
      const credentialId = randomBytes(32);
      await repo.create({ userId, credentialId, publicKey: randomBytes(77), counter: 0, transports: [], aaguid: null, nickname: null });
      expect(await repo.updateCounter(credentialId, 0)).toBe(true);
      const found = await repo.findByCredentialId(credentialId);
      expect(found!.counter).toBe(0);
      expect(found!.lastUsedAt).not.toBeNull();
    });
  });

  it("create rejects duplicate credential_id (UNIQUE constraint)", async () => {
    await withFixture(async ({ userId }) => {
      const repo = new Passkeys(pool);
      const credentialId = randomBytes(32);
      await repo.create({ userId, credentialId, publicKey: randomBytes(77), counter: 0, transports: [], aaguid: null, nickname: null });
      await expect(repo.create({ userId, credentialId, publicKey: randomBytes(77), counter: 0, transports: [], aaguid: null, nickname: null })).rejects.toThrow();
    });
  });
});
