import type { Pool } from "../db.js";

export interface PasskeyCredential {
  id: string;
  userId: string;
  credentialId: Buffer;
  publicKey: Buffer;
  counter: number;
  transports: string[];
  aaguid: string | null;
  nickname: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface CreateInput {
  userId: string;
  credentialId: Buffer;
  publicKey: Buffer;
  counter: number;
  transports: string[];
  aaguid: string | null;
  nickname: string | null;
}

export interface CreateResult {
  id: string;
}

export class Passkeys {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateInput): Promise<CreateResult> {
    const res = await this.pool.query<{ id: string }>(
      `INSERT INTO user_passkeys
        (user_id, credential_id, public_key, counter, transports, aaguid, nickname)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.userId,
        input.credentialId,
        input.publicKey,
        input.counter,
        input.transports,
        input.aaguid,
        input.nickname,
      ],
    );
    const r = res.rows[0];
    if (!r) throw new Error("passkey-repo: create returned no row");
    return { id: r.id };
  }

  async findByCredentialId(credentialId: Buffer): Promise<PasskeyCredential | null> {
    const res = await this.pool.query<{
      id: string;
      user_id: string;
      credential_id: Buffer;
      public_key: Buffer;
      counter: string;  // pg returns BIGINT as string
      transports: string[];
      aaguid: string | null;
      nickname: string | null;
      created_at: Date;
      last_used_at: Date | null;
    }>(
      `SELECT id, user_id, credential_id, public_key, counter, transports, aaguid, nickname, created_at, last_used_at
       FROM user_passkeys
       WHERE credential_id = $1
       LIMIT 1`,
      [credentialId],
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      userId: r.user_id,
      credentialId: r.credential_id,
      publicKey: r.public_key,
      counter: Number(r.counter),
      transports: r.transports,
      aaguid: r.aaguid,
      nickname: r.nickname,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
    };
  }

  async listByUserId(userId: string): Promise<PasskeyCredential[]> {
    const res = await this.pool.query<{
      id: string;
      user_id: string;
      credential_id: Buffer;
      public_key: Buffer;
      counter: string;
      transports: string[];
      aaguid: string | null;
      nickname: string | null;
      created_at: Date;
      last_used_at: Date | null;
    }>(
      `SELECT id, user_id, credential_id, public_key, counter, transports, aaguid, nickname, created_at, last_used_at
       FROM user_passkeys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return res.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      credentialId: r.credential_id,
      publicKey: r.public_key,
      counter: Number(r.counter),
      transports: r.transports,
      aaguid: r.aaguid,
      nickname: r.nickname,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
    }));
  }

  /**
   * Updates the counter and last_used_at if the new counter is acceptable
   * (strictly greater, OR both are zero — Apple passkeys do not increment).
   * Returns false if the update was rejected as a potential replay attempt.
   */
  async updateCounter(credentialId: Buffer, newCounter: number): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE user_passkeys
       SET counter = $2, last_used_at = NOW()
       WHERE credential_id = $1
         AND ($2 > counter OR ($2 = 0 AND counter = 0))`,
      [credentialId, newCounter],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
