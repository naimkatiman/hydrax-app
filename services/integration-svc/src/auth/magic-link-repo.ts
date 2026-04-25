import type { Pool } from "../db.js";

export interface MagicLinkTokenInput {
  userId: string;
  tenantId: string;
  tokenHash: Buffer;
  ttlSeconds: number;
}

export interface MagicLinkCreateResult {
  id: string;
  expiresAt: Date;
}

export interface MagicLinkConsumed {
  userId: string;
  tenantId: string;
  usedAt: Date;
}

export class MagicLinks {
  constructor(private readonly pool: Pool) {}

  async create(input: MagicLinkTokenInput): Promise<MagicLinkCreateResult> {
    const res = await this.pool.query<{ id: string; expires_at: Date }>(
      `INSERT INTO magic_link_tokens (user_id, tenant_id, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' seconds')::INTERVAL)
       RETURNING id, expires_at`,
      [input.userId, input.tenantId, input.tokenHash, input.ttlSeconds.toString()],
    );
    const r = res.rows[0];
    if (!r) throw new Error("magic-link-repo: create returned no row");
    return { id: r.id, expiresAt: r.expires_at };
  }

  /**
   * Atomically: select the row only if unused + unexpired, mark used_at = NOW(),
   * return user_id + tenant_id + the new used_at. Returns null if the token does
   * not exist, has already been used, or has expired. The single-statement form
   * is race-free at the DB layer.
   */
  async consume(tokenHash: Buffer): Promise<MagicLinkConsumed | null> {
    const res = await this.pool.query<{ user_id: string; tenant_id: string; used_at: Date }>(
      `UPDATE magic_link_tokens
       SET used_at = NOW()
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       RETURNING user_id, tenant_id, used_at`,
      [tokenHash],
    );
    const r = res.rows[0];
    if (!r) return null;
    return { userId: r.user_id, tenantId: r.tenant_id, usedAt: r.used_at };
  }
}
