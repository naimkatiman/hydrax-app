import type { Pool } from "../db.js";

export type Role = "admin" | "member" | "viewer" | "approver";

export interface SessionLookup {
  sessionId: string;
  userId: string;
  tenantId: string;
  tenantSlug: string;
  email: string;
  role: Role;
  expiresAt: Date;
}

export interface UserLookup {
  userId: string;
  tenantId: string;
  role: Role;
}

export interface CreateSessionInput {
  userId: string;
  tenantId: string;
  tokenHash: Buffer;
  ttlSeconds: number;
}

export interface CreateSessionResult {
  id: string;
  expiresAt: Date;
}

export class Sessions {
  constructor(private readonly pool: Pool) {}

  async findUserByTenantSlugAndEmail(
    tenantSlug: string,
    email: string,
  ): Promise<UserLookup | null> {
    const res = await this.pool.query<{
      user_id: string;
      tenant_id: string;
      role: Role;
    }>(
      `SELECT u.id AS user_id, u.tenant_id, u.role
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE t.slug = $1 AND u.email = $2
       LIMIT 1`,
      [tenantSlug, email],
    );
    if (!res.rowCount) return null;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const r = res.rows[0]!;
    return { userId: r.user_id, tenantId: r.tenant_id, role: r.role };
  }

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const res = await this.pool.query<{ id: string; expires_at: Date }>(
      `INSERT INTO user_sessions
         (user_id, tenant_id, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' seconds')::INTERVAL)
       RETURNING id, expires_at`,
      [input.userId, input.tenantId, input.tokenHash, input.ttlSeconds.toString()],
    );
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const r = res.rows[0]!;
    return { id: r.id, expiresAt: r.expires_at };
  }

  async findActiveByTokenHash(tokenHash: Buffer): Promise<SessionLookup | null> {
    const res = await this.pool.query<{
      session_id: string;
      user_id: string;
      tenant_id: string;
      tenant_slug: string;
      email: string;
      role: Role;
      expires_at: Date;
    }>(
      `SELECT s.id AS session_id, s.user_id, s.tenant_id,
              t.slug AS tenant_slug, u.email, u.role, s.expires_at
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN tenants t ON t.id = s.tenant_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    if (!res.rowCount) return null;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const r = res.rows[0]!;
    void this.pool
      .query(`UPDATE user_sessions SET last_seen_at = NOW() WHERE id = $1`, [r.session_id])
      .catch(() => {});
    return {
      sessionId: r.session_id,
      userId: r.user_id,
      tenantId: r.tenant_id,
      tenantSlug: r.tenant_slug,
      email: r.email,
      role: r.role,
      expiresAt: r.expires_at,
    };
  }

  async revokeByTokenHash(tokenHash: Buffer): Promise<void> {
    await this.pool.query(
      `UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }
}
