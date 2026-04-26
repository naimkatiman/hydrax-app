# Auth Foundation — Slice 1: Session Substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the session/middleware substrate that proves multi-tenant isolation works end-to-end (DB → integration-svc → bff → api-client) using a dev-only login. Both passkeys and OIDC will plug into this substrate via separate slice 2 plans. After this slice ships, every protected `/v1/*` BFF route knows which user (and which tenant) is making the request.

**Architecture:** Bearer-token sessions, no cookies (sidesteps CSRF + SameSite complexity). Tokens are random 32-byte base64url strings issued by `integration-svc`; only the sha256 `token_hash` is persisted (DB leak ≠ live sessions). The BFF carries no session state — every protected request triggers a fetch to `integration-svc /v1/auth/whoami` which validates token + returns the resolved `{user, tenant, role}`. Dev-login (`POST /v1/auth/dev/login`) is gated by `AUTH_DEV_LOGIN=1`; integration-svc returns 404 when unset, so a Railway prototype deploy without the flag is fail-closed.

**Tech Stack:** PostgreSQL 16 (existing), Node 20 + TypeScript (existing integration-svc + bff), `pg` (new dep on integration-svc), `node:crypto` for sha256 + token gen, native fetch for bff→integration-svc, vitest.

---

## Decision Log (read before changing scope)

- **Slice 1 = substrate, slice 2 = method.** The user's "passkeys vs OIDC" question is answered in slice 2. Slice 1 ships the session table, middleware, and bearer plumbing that BOTH would consume.
- **Recommended slice 2: passkeys.** Vendor-neutral, no IdP procurement, aligns with PRD §10 privacy-preserving design. Override with `auth: oidc` if first design partner (PRD §14 Q4 still open) mandates an IdP. **Slice 2 is multi-session work** (WebAuthn register/auth + magic-link enrollment + email + UI), not a one-sitting slice. Do not expand slice 1 to absorb it.
- **Bearer over cookies.** No CSRF surface. `api-client` already manages headers. Reach for cookies only if SSR forces it later.
- **Dev-login fail-closed in prod.** `AUTH_DEV_LOGIN=1` required; integration-svc returns 404 otherwise. Documented in [docs/env.md](../env.md). Non-negotiable.
- **token_hash, not raw.** sha256 + constant-time compare. The bearer string never sits at rest.
- **Login body shape: `{tenant_slug, email}`.** Schema has `UNIQUE (tenant_id, email)` — same email can exist in two tenants. Slug-then-email lookup disambiguates.
- **Slice 1 migration is sessions-only.** `user_passkeys` lands in slice 2's migration. The "all-up-front" comment in `0001_initial.sql` was about the original 5 MVP tables, not a forever-rule.
- **No request-level whoami caching.** Premature optimization for slice 1. If profile shows BFF→integration-svc latency hurting, add a 30s in-memory LRU in a follow-up.

---

## File Structure

**New files (12):**

- `db/postgres/migrations/0002_auth.sql` — `user_sessions` table + indexes
- `services/integration-svc/src/auth/token.ts` — token gen, sha256 hash, constant-time compare
- `services/integration-svc/src/auth/token.test.ts`
- `services/integration-svc/src/auth/repo.ts` — Postgres-backed Sessions repo
- `services/integration-svc/src/auth/repo.test.ts`
- `services/integration-svc/src/auth/handlers.ts` — `dev/login`, `whoami`, `logout` HTTP handlers
- `services/integration-svc/src/auth/handlers.test.ts`
- `services/integration-svc/src/db.ts` — pg.Pool factory (mirrors workflow-svc/internal/db pattern)
- `services/bff/src/auth/middleware.ts` — bearer extraction + whoami call + req.session attachment
- `services/bff/src/auth/middleware.test.ts`
- `services/bff/src/auth/proxy.ts` — proxy auth routes to integration-svc
- `services/bff/src/auth/proxy.test.ts`
- `web/packages/api-client/src/auth.ts` — login/logout/whoami helpers + bearer fetch wrapper
- `web/packages/api-client/src/auth.test.ts`

**Modified files (5):**

- `services/integration-svc/src/server.ts` — wire DB pool + auth routes + 405 handler
- `services/integration-svc/package.json` — add `pg` and `@types/pg` deps
- `services/bff/src/server.ts` — wire auth proxy routes (unprotected) + middleware on protected `/v1/*`
- `services/bff/src/bff/bff.ts` — add `integrationSvcUrl` to `UpstreamConfig`
- `services/bff/src/healthz/aggregate.ts` — add `integration-svc` to composite check
- `services/bff/src/server.test.ts` — update existing protected-route tests to send `Authorization: Bearer <token>`
- `docs/env.md` — document `AUTH_DEV_LOGIN`, `SESSION_TTL_SECONDS`, `INTEGRATION_SVC_URL`, `INTEGRATION_SVC_DATABASE_URL`
- `STATE.yaml` — verification log entry

**Anti-scope (do not touch in this slice):**

- ❌ WebAuthn / passkey enrollment or login
- ❌ OIDC, SAML, magic-link email
- ❌ Tenant onboarding UI, user CRUD UI, tenant switcher
- ❌ Role/permission authorization checks (this is *authentication* only — `req.session.role` is attached but no `requireRole(...)` middleware yet)
- ❌ Refresh tokens, sliding expiration, device tracking
- ❌ Web app login screens (api-client ships; UI lands in a portal-by-portal follow-up plan)
- ❌ Subscriptions lifecycle work (a separate plan, do not pull it in)

---

## Required Reading Before Implementing

- [services/audit-svc/internal/audit/repo.go](../../services/audit-svc/internal/audit/repo.go) — repo pattern reference (Tx isolation, error masking)
- [services/bff/src/products/proxy.ts](../../services/bff/src/products/proxy.ts) — BFF proxy pattern (UpstreamError, JSON response shape)
- [services/bff/src/server.ts](../../services/bff/src/server.ts) — current route mounting + 405 handling
- [services/workflow-svc/internal/db/db.go](../../services/workflow-svc/internal/db/db.go) — DSN handling, ping-on-startup pattern
- [db/postgres/migrations/0001_initial.sql](../../db/postgres/migrations/0001_initial.sql) — `users` and `tenants` schema this slice depends on
- [docs/env.md](../env.md) — env var documentation pattern

---

## Task 1: Migration 0002 — user_sessions table

**Files:**
- Create: `db/postgres/migrations/0002_auth.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0002_auth.sql
-- Session substrate for the auth foundation slice. Persists only
-- token_hash (sha256 of the bearer string); raw tokens never sit at
-- rest. Slice 2 will add user_passkeys in a separate migration.

CREATE TABLE user_sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token_hash    BYTEA NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ,
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_sessions_token_hash ON user_sessions (token_hash);
CREATE INDEX idx_user_sessions_user ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_active
    ON user_sessions (expires_at)
    WHERE revoked_at IS NULL;
```

- [ ] **Step 2: Apply against local Postgres**

Run: `db/postgres/apply.sh`
Expected: prints `applied 0001_initial.sql (already)` and `applied 0002_auth.sql`. Exit code 0.

- [ ] **Step 3: Verify schema with psql**

Run: `psql "$DATABASE_URL" -c "\d user_sessions"`
Expected output includes `token_hash | bytea | not null` and three indexes (`idx_user_sessions_token_hash UNIQUE`, `idx_user_sessions_user`, `idx_user_sessions_active`).

- [ ] **Step 4: Commit**

```bash
git add db/postgres/migrations/0002_auth.sql
git commit -m "$(cat <<'EOF'
feat(db): add user_sessions table for auth foundation

Bearer-token sessions for slice 1 of the auth foundation plan.
Stores sha256 token_hash only; raw tokens never sit at rest.
Passkey credentials land in slice 2's migration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: integration-svc — pg dependency + DB pool

**Files:**
- Modify: `services/integration-svc/package.json`
- Create: `services/integration-svc/src/db.ts`

- [ ] **Step 1: Add pg + types**

Run from `services/integration-svc/`:
```bash
pnpm add pg
pnpm add -D @types/pg
```

Expected: `package.json` gains `"pg": "^8.x.x"` under `dependencies` and `"@types/pg": "^8.x.x"` under `devDependencies`. Lockfile updates at repo root.

- [ ] **Step 2: Create the pool factory**

Create `services/integration-svc/src/db.ts`:

```typescript
import pg from "pg";

const { Pool } = pg;

export type Pool = pg.Pool;

export interface PoolOptions {
  connectionString: string;
  max?: number;
}

export function openPool(opts: PoolOptions): Pool {
  if (!opts.connectionString) {
    throw new Error("openPool: empty connectionString");
  }
  return new Pool({
    connectionString: opts.connectionString,
    max: opts.max ?? 10,
  });
}

export function redactDsn(dsn: string): string {
  try {
    const u = new URL(dsn);
    if (u.password) u.password = "***";
    if (u.username) u.username = "***";
    return u.toString();
  } catch {
    return "<unparseable>";
  }
}
```

- [ ] **Step 3: Typecheck**

Run from `services/integration-svc/`: `pnpm typecheck`
Expected: clean exit.

- [ ] **Step 4: Commit (deferred — bundle with Task 3 below)**

Hold this commit; Task 3 lands in the same commit.

---

## Task 3: integration-svc — token utilities (TDD)

**Files:**
- Create: `services/integration-svc/src/auth/token.ts`
- Create: `services/integration-svc/src/auth/token.test.ts`

- [ ] **Step 1: Write failing tests**

Create `services/integration-svc/src/auth/token.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { compareTokenHash, generateToken, hashToken } from "./token.js";

describe("token", () => {
  it("generateToken returns 43-char base64url string (32 bytes)", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("generateToken returns unique values across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateToken());
    expect(seen.size).toBe(1000);
  });

  it("hashToken is deterministic", () => {
    const t = generateToken();
    expect(hashToken(t).equals(hashToken(t))).toBe(true);
  });

  it("hashToken returns 32-byte Buffer", () => {
    expect(hashToken("anything").length).toBe(32);
  });

  it("compareTokenHash returns true for equal hashes", () => {
    const h = hashToken("abc");
    expect(compareTokenHash(h, hashToken("abc"))).toBe(true);
  });

  it("compareTokenHash returns false for different hashes", () => {
    expect(compareTokenHash(hashToken("a"), hashToken("b"))).toBe(false);
  });

  it("compareTokenHash returns false for different lengths", () => {
    expect(compareTokenHash(Buffer.from([1, 2]), Buffer.from([1, 2, 3]))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run from `services/integration-svc/`: `pnpm test -- --run src/auth/token.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement token.ts**

Create `services/integration-svc/src/auth/token.ts`:

```typescript
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export function compareTokenHash(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test -- --run src/auth/token.test.ts`
Expected: 7/7 pass.

---

## Task 4: integration-svc — Sessions repo (TDD)

**Files:**
- Create: `services/integration-svc/src/auth/repo.ts`
- Create: `services/integration-svc/src/auth/repo.test.ts`

- [ ] **Step 1: Write failing tests**

Create `services/integration-svc/src/auth/repo.test.ts`. Pattern mirrors `services/audit-svc/internal/audit/repo_test.go` — txn rollback isolation, real Postgres, fixture data created per-test.

```typescript
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
```

- [ ] **Step 2: Run to verify failure**

Run from `services/integration-svc/`:
```bash
INTEGRATION_SVC_DATABASE_URL="postgresql://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run src/auth/repo.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement repo.ts**

Create `services/integration-svc/src/auth/repo.ts`:

```typescript
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
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
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
    const r = res.rows[0];
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
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    // Best-effort touch; errors here do not invalidate the lookup.
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
```

- [ ] **Step 4: Run tests to verify pass**

Run:
```bash
INTEGRATION_SVC_DATABASE_URL="postgresql://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run src/auth/repo.test.ts
```
Expected: 7/7 pass.

- [ ] **Step 5: Commit (Tasks 2+3+4 together)**

```bash
git add services/integration-svc/package.json \
        services/integration-svc/src/db.ts \
        services/integration-svc/src/auth/token.ts \
        services/integration-svc/src/auth/token.test.ts \
        services/integration-svc/src/auth/repo.ts \
        services/integration-svc/src/auth/repo.test.ts \
        pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(integration-svc): add session repo + token utilities

Postgres-backed Sessions repo with sha256 token_hash storage and
constant-time compare. Lookup-by-tenant-slug-and-email disambiguates
the (tenant_id, email) UNIQUE constraint. 7/7 token tests + 7/7 repo
tests green against local Postgres.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: integration-svc — HTTP handlers (TDD)

**Files:**
- Create: `services/integration-svc/src/auth/handlers.ts`
- Create: `services/integration-svc/src/auth/handlers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `services/integration-svc/src/auth/handlers.test.ts`:

```typescript
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
    const body = await res.json();
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
    const { token } = await login.json();
    const me = await fetch(`${baseUrl}/v1/auth/whoami`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);
    const body = await me.json();
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
    const { token } = await login.json();
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
```

- [ ] **Step 2: Run to verify failure**

Run from `services/integration-svc/`:
```bash
INTEGRATION_SVC_DATABASE_URL="postgresql://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run src/auth/handlers.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement handlers.ts**

Create `services/integration-svc/src/auth/handlers.ts`:

```typescript
import type http from "node:http";

import { generateToken, hashToken } from "./token.js";
import type { Sessions } from "./repo.js";

export interface AuthHandlerOptions {
  repo: Sessions;
  ttlSeconds: number;
  devLoginEnabled: boolean;
}

const MAX_BODY_BYTES = 16 * 1024;

function respondJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function bearerFrom(req: http.IncomingMessage): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+([A-Za-z0-9_-]+)$/.exec(h);
  return m ? m[1] : null;
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > MAX_BODY_BYTES) throw new Error("payload_too_large");
    chunks.push(buf);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/**
 * Returns true if the request matched an auth route (and was handled).
 * Returns false if no match — caller should fall through to other routes / 404.
 */
export function mountAuthRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: AuthHandlerOptions,
): boolean {
  const url = req.url ?? "";
  const method = req.method ?? "GET";

  if (url === "/v1/auth/dev/login") {
    if (!opts.devLoginEnabled) {
      respondJson(res, 404, { error: "not_found" });
      return true;
    }
    if (method !== "POST") {
      respondJson(res, 405, { error: "method_not_allowed" });
      return true;
    }
    void handleDevLogin(req, res, opts);
    return true;
  }

  if (url === "/v1/auth/whoami") {
    if (method !== "GET") {
      respondJson(res, 405, { error: "method_not_allowed" });
      return true;
    }
    void handleWhoami(req, res, opts);
    return true;
  }

  if (url === "/v1/auth/logout") {
    if (method !== "POST") {
      respondJson(res, 405, { error: "method_not_allowed" });
      return true;
    }
    void handleLogout(req, res, opts);
    return true;
  }

  return false;
}

async function handleDevLogin(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: AuthHandlerOptions,
): Promise<void> {
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad_body";
    if (msg === "payload_too_large") {
      respondJson(res, 413, { error: "payload_too_large" });
    } else {
      respondJson(res, 400, { error: "bad_json" });
    }
    return;
  }
  if (!body || typeof body !== "object") {
    respondJson(res, 400, { error: "bad_body" });
    return;
  }
  const tenantSlug = (body as Record<string, unknown>).tenant_slug;
  const email = (body as Record<string, unknown>).email;
  if (typeof tenantSlug !== "string" || typeof email !== "string" || !tenantSlug || !email) {
    respondJson(res, 400, { error: "missing_fields", message: "tenant_slug and email required" });
    return;
  }

  try {
    const user = await opts.repo.findUserByTenantSlugAndEmail(tenantSlug, email);
    if (!user) {
      respondJson(res, 401, { error: "invalid_credentials" });
      return;
    }
    const token = generateToken();
    const created = await opts.repo.createSession({
      userId: user.userId,
      tenantId: user.tenantId,
      tokenHash: hashToken(token),
      ttlSeconds: opts.ttlSeconds,
    });
    respondJson(res, 200, {
      token,
      session: {
        id: created.id,
        user_id: user.userId,
        tenant_id: user.tenantId,
        role: user.role,
        expires_at: created.expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("integration-svc: dev/login handler:", err);
    respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
  }
}

async function handleWhoami(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: AuthHandlerOptions,
): Promise<void> {
  const token = bearerFrom(req);
  if (!token) {
    respondJson(res, 401, { error: "unauthenticated" });
    return;
  }
  try {
    const session = await opts.repo.findActiveByTokenHash(hashToken(token));
    if (!session) {
      respondJson(res, 401, { error: "unauthenticated" });
      return;
    }
    respondJson(res, 200, {
      session_id: session.sessionId,
      user_id: session.userId,
      tenant_id: session.tenantId,
      tenant_slug: session.tenantSlug,
      email: session.email,
      role: session.role,
      expires_at: session.expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("integration-svc: whoami handler:", err);
    respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
  }
}

async function handleLogout(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: AuthHandlerOptions,
): Promise<void> {
  const token = bearerFrom(req);
  if (!token) {
    res.writeHead(204).end();
    return;
  }
  try {
    await opts.repo.revokeByTokenHash(hashToken(token));
    res.writeHead(204).end();
  } catch (err) {
    console.error("integration-svc: logout handler:", err);
    respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:
```bash
INTEGRATION_SVC_DATABASE_URL="postgresql://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run src/auth/handlers.test.ts
```
Expected: 10/10 pass.

---

## Task 6: integration-svc — wire routes in server.ts

**Files:**
- Modify: `services/integration-svc/src/server.ts`

- [ ] **Step 1: Replace server.ts**

```typescript
import http from "node:http";
import type { AddressInfo } from "node:net";

import { openPool, redactDsn, type Pool } from "./db.js";
import { mountAuthRoutes, type AuthHandlerOptions } from "./auth/handlers.js";
import { Sessions } from "./auth/repo.js";

export interface StartOptions {
  port: number;
  service: string;
  pool?: Pool;
  devLoginEnabled?: boolean;
  ttlSeconds?: number;
}

export interface StartResult {
  server: http.Server;
  baseUrl: string;
}

export function startServer(opts: StartOptions): Promise<StartResult> {
  const authOpts: AuthHandlerOptions | null = opts.pool
    ? {
        repo: new Sessions(opts.pool),
        ttlSeconds: opts.ttlSeconds ?? 60 * 60 * 12,
        devLoginEnabled: opts.devLoginEnabled ?? false,
      }
    : null;

  const server = http.createServer((req, res) => {
    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ service: opts.service, status: "ok" }));
      return;
    }
    if (authOpts && mountAuthRoutes(req, res, authOpts)) return;

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  return new Promise((resolve) => {
    server.listen(opts.port, () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 7102);
  const dsn = process.env.INTEGRATION_SVC_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  const devLoginEnabled = process.env.AUTH_DEV_LOGIN === "1";
  const ttlSeconds = Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 12);

  const pool = dsn ? openPool({ connectionString: dsn }) : undefined;
  if (!dsn) {
    console.warn(
      "integration-svc: INTEGRATION_SVC_DATABASE_URL/DATABASE_URL unset — auth routes disabled, only /healthz served",
    );
  } else {
    console.log(`integration-svc: DB pool ready (${redactDsn(dsn)})`);
    if (!devLoginEnabled) {
      console.log("integration-svc: AUTH_DEV_LOGIN!=1 — dev/login disabled (returns 404)");
    }
  }

  startServer({ port, service: "integration-svc", pool, devLoginEnabled, ttlSeconds }).then(
    ({ baseUrl }) => {
      console.log(`integration-svc listening on ${baseUrl}`);
    },
  );
}
```

- [ ] **Step 2: Update existing server.test.ts to keep passing**

Read `services/integration-svc/src/server.test.ts` first to check what's asserted. Existing test calls `startServer` without a pool — should still work because `authOpts` is null and only `/healthz` + 404 is exercised. If a test depends on a specific 404 shape, ensure the new server.ts returns `{"error":"not_found"}` not `{"error":"not found"}` (note: the original returned `"not found"` with a space; preserve or update the test in the same step).

- [ ] **Step 3: Typecheck + run all integration-svc tests**

Run from `services/integration-svc/`:
```bash
pnpm typecheck && \
INTEGRATION_SVC_DATABASE_URL="postgresql://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run
```
Expected: typecheck clean; all tests pass (token + repo + handlers + existing server).

- [ ] **Step 4: Smoke test from the shell**

Start the service in one terminal:
```bash
DATABASE_URL="postgresql://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
AUTH_DEV_LOGIN=1 \
  pnpm --filter @hydrax/integration-svc dev
```

Seed a tenant + user via psql, then:
```bash
TOKEN=$(curl -s -X POST http://localhost:7102/v1/auth/dev/login \
  -H 'content-type: application/json' \
  -d '{"tenant_slug":"smoke","email":"smoke@example.test"}' | jq -r .token)

curl -s http://localhost:7102/v1/auth/whoami -H "authorization: Bearer $TOKEN" | jq .

curl -s -X POST http://localhost:7102/v1/auth/logout -H "authorization: Bearer $TOKEN" -i | head -1
# HTTP/1.1 204 No Content

curl -s http://localhost:7102/v1/auth/whoami -H "authorization: Bearer $TOKEN" -i | head -1
# HTTP/1.1 401 Unauthorized
```

- [ ] **Step 5: Commit**

```bash
git add services/integration-svc/src/auth/handlers.ts \
        services/integration-svc/src/auth/handlers.test.ts \
        services/integration-svc/src/server.ts \
        services/integration-svc/src/server.test.ts
git commit -m "$(cat <<'EOF'
feat(integration-svc): wire auth routes (dev/login, whoami, logout)

POST /v1/auth/dev/login is gated by AUTH_DEV_LOGIN=1 (404 when unset
or DATABASE_URL is unset — fail-closed by default for prod). Bearer
Authorization header on whoami/logout. 16 KiB body cap on dev/login.
10/10 handler tests + 7/7 repo tests + 7/7 token tests green.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: bff — UpstreamConfig adds integration-svc

**Files:**
- Modify: `services/bff/src/bff/bff.ts`

- [ ] **Step 1: Read current bff.ts and locate UpstreamConfig**

Run: `cat services/bff/src/bff/bff.ts`

- [ ] **Step 2: Extend UpstreamConfig with `integrationSvcUrl`**

Add `integrationSvcUrl: string` to the `UpstreamConfig` interface. In `loadUpstreamConfig`, default it to `process.env.INTEGRATION_SVC_URL ?? "http://localhost:7102"`.

- [ ] **Step 3: Typecheck**

Run from `services/bff/`: `pnpm typecheck`
Expected: clean.

(Commit deferred — bundles with Tasks 8+9.)

---

## Task 8: bff — auth proxy (TDD)

**Files:**
- Create: `services/bff/src/auth/proxy.ts`
- Create: `services/bff/src/auth/proxy.test.ts`

- [ ] **Step 1: Write failing tests**

Create `services/bff/src/auth/proxy.test.ts`. Pattern mirrors `services/bff/src/products/proxy.test.ts`: spin up a mock upstream HTTP server, point proxy at it, assert proxied behavior.

```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { proxyDevLogin, proxyWhoami, proxyLogout, AuthUpstreamError } from "./proxy.js";

let upstream: http.Server;
let upstreamUrl: string;
let lastReq: { method?: string; url?: string; auth?: string; body?: string } = {};
let respond: (req: http.IncomingMessage, res: http.ServerResponse) => void;

beforeEach(async () => {
  lastReq = {};
  upstream = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      lastReq = { method: req.method, url: req.url, auth: req.headers.authorization as string | undefined, body };
      respond(req, res);
    });
  });
  await new Promise<void>((r) => upstream.listen(0, r));
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

afterEach(() => new Promise((r) => upstream.close(r)));

describe("proxyDevLogin", () => {
  it("forwards body and returns 200 + payload", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ token: "T", session: { user_id: "U" } }));
    };
    const result = await proxyDevLogin({ tenant_slug: "t", email: "e@x.test" }, { integrationSvcUrl: upstreamUrl });
    expect(lastReq.method).toBe("POST");
    expect(lastReq.url).toBe("/v1/auth/dev/login");
    expect(JSON.parse(lastReq.body!)).toEqual({ tenant_slug: "t", email: "e@x.test" });
    expect(result.token).toBe("T");
  });

  it("throws AuthUpstreamError with httpStatus on 401", async () => {
    respond = (_req, res) => { res.writeHead(401).end(JSON.stringify({ error: "invalid_credentials" })); };
    await expect(proxyDevLogin({ tenant_slug: "t", email: "e@x.test" }, { integrationSvcUrl: upstreamUrl }))
      .rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 401 });
  });
});

describe("proxyWhoami", () => {
  it("forwards bearer header and returns session", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ user_id: "U", role: "admin" }));
    };
    const result = await proxyWhoami("T", { integrationSvcUrl: upstreamUrl });
    expect(lastReq.auth).toBe("Bearer T");
    expect(result.user_id).toBe("U");
  });

  it("throws AuthUpstreamError on 401", async () => {
    respond = (_req, res) => { res.writeHead(401).end(JSON.stringify({ error: "unauthenticated" })); };
    await expect(proxyWhoami("bad", { integrationSvcUrl: upstreamUrl }))
      .rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 401 });
  });
});

describe("proxyLogout", () => {
  it("forwards bearer and returns void on 204", async () => {
    respond = (_req, res) => { res.writeHead(204).end(); };
    await proxyLogout("T", { integrationSvcUrl: upstreamUrl });
    expect(lastReq.auth).toBe("Bearer T");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run from `services/bff/`: `pnpm test -- --run src/auth/proxy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement proxy.ts**

Create `services/bff/src/auth/proxy.ts`:

```typescript
export interface AuthUpstreamConfig {
  integrationSvcUrl: string;
}

export interface DevLoginInput {
  tenant_slug: string;
  email: string;
}

export interface DevLoginResult {
  token: string;
  session: {
    id: string;
    user_id: string;
    tenant_id: string;
    role: string;
    expires_at: string;
  };
}

export interface WhoamiResult {
  session_id: string;
  user_id: string;
  tenant_id: string;
  tenant_slug: string;
  email: string;
  role: string;
  expires_at: string;
}

export class AuthUpstreamError extends Error {
  readonly name = "AuthUpstreamError";
  constructor(message: string, readonly httpStatus?: number) {
    super(message);
  }
}

async function readJsonOrThrow(res: Response, errLabel: string): Promise<unknown> {
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new AuthUpstreamError(`${errLabel}: upstream ${res.status}: ${detail}`, res.status);
  }
  return res.json();
}

export async function proxyDevLogin(
  input: DevLoginInput,
  cfg: AuthUpstreamConfig,
): Promise<DevLoginResult> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/dev/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await readJsonOrThrow(res, "dev_login")) as DevLoginResult;
}

export async function proxyWhoami(
  token: string,
  cfg: AuthUpstreamConfig,
): Promise<WhoamiResult> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/whoami`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return (await readJsonOrThrow(res, "whoami")) as WhoamiResult;
}

export async function proxyLogout(
  token: string,
  cfg: AuthUpstreamConfig,
): Promise<void> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/logout`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new AuthUpstreamError(`logout: upstream ${res.status}`, res.status);
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test -- --run src/auth/proxy.test.ts`
Expected: 5/5 pass.

---

## Task 9: bff — middleware + wire routes (TDD)

**Files:**
- Create: `services/bff/src/auth/middleware.ts`
- Create: `services/bff/src/auth/middleware.test.ts`
- Modify: `services/bff/src/server.ts`
- Modify: `services/bff/src/server.test.ts` (add Authorization header to existing protected-route tests)
- Modify: `services/bff/src/healthz/aggregate.ts`

- [ ] **Step 1: Write failing middleware tests**

Create `services/bff/src/auth/middleware.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { extractBearer, requireSession } from "./middleware.js";
import type { WhoamiResult } from "./proxy.js";

describe("extractBearer", () => {
  it("returns token when Authorization: Bearer X is present", () => {
    expect(extractBearer({ headers: { authorization: "Bearer abc" } } as any)).toBe("abc");
  });
  it("returns null when header missing", () => {
    expect(extractBearer({ headers: {} } as any)).toBeNull();
  });
  it("returns null for non-bearer scheme", () => {
    expect(extractBearer({ headers: { authorization: "Basic xyz" } } as any)).toBeNull();
  });
  it("returns null for malformed bearer", () => {
    expect(extractBearer({ headers: { authorization: "Bearer" } } as any)).toBeNull();
  });
});

describe("requireSession", () => {
  let upstream: http.Server;
  let upstreamUrl: string;
  let upstreamRespond: (req: http.IncomingMessage, res: http.ServerResponse) => void;

  beforeEach(async () => {
    upstream = http.createServer((req, res) => upstreamRespond(req, res));
    await new Promise<void>((r) => upstream.listen(0, r));
    upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  });
  afterEach(() => new Promise((r) => upstream.close(r)));

  it("returns 401 when bearer missing", async () => {
    const res = mockRes();
    const session = await requireSession({ headers: {} } as any, res, { integrationSvcUrl: upstreamUrl });
    expect(session).toBeNull();
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when whoami upstream returns 401", async () => {
    upstreamRespond = (_req, r) => { r.writeHead(401).end(JSON.stringify({ error: "unauthenticated" })); };
    const res = mockRes();
    const session = await requireSession(
      { headers: { authorization: "Bearer bad" } } as any,
      res,
      { integrationSvcUrl: upstreamUrl },
    );
    expect(session).toBeNull();
    expect(res.statusCode).toBe(401);
  });

  it("returns session and does not write response on success", async () => {
    upstreamRespond = (_req, r) => {
      r.writeHead(200, { "content-type": "application/json" });
      r.end(JSON.stringify({
        session_id: "s", user_id: "U", tenant_id: "T", tenant_slug: "t", email: "e",
        role: "admin", expires_at: new Date(Date.now() + 60_000).toISOString(),
      } satisfies WhoamiResult));
    };
    const res = mockRes();
    const session = await requireSession(
      { headers: { authorization: "Bearer good" } } as any,
      res,
      { integrationSvcUrl: upstreamUrl },
    );
    expect(session).not.toBeNull();
    expect(session!.userId).toBe("U");
    expect(session!.role).toBe("admin");
    expect(res.statusCode).toBeUndefined();
  });
});

function mockRes() {
  let statusCode: number | undefined;
  let body = "";
  return {
    statusCode,
    writeHead(s: number) { (this as any).statusCode = s; return this; },
    end(b?: string) { body += b ?? ""; return this; },
    setHeader() {},
  } as unknown as http.ServerResponse & { statusCode?: number };
}
```

- [ ] **Step 2: Run to verify failure**

Run from `services/bff/`: `pnpm test -- --run src/auth/middleware.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement middleware.ts**

Create `services/bff/src/auth/middleware.ts`:

```typescript
import type http from "node:http";

import { AuthUpstreamError, proxyWhoami, type AuthUpstreamConfig, type WhoamiResult } from "./proxy.js";

export interface RequestSession {
  sessionId: string;
  userId: string;
  tenantId: string;
  tenantSlug: string;
  email: string;
  role: string;
  expiresAt: string;
}

export function extractBearer(req: http.IncomingMessage): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+([A-Za-z0-9_-]+)$/.exec(h);
  return m ? m[1] : null;
}

function respondJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * Validates bearer token via integration-svc whoami. On failure, writes 401
 * to the response and returns null. On success, returns the session — caller
 * must check for null and bail before writing a response.
 */
export async function requireSession(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  cfg: AuthUpstreamConfig,
): Promise<RequestSession | null> {
  const token = extractBearer(req);
  if (!token) {
    respondJson(res, 401, { error: "unauthenticated" });
    return null;
  }
  let result: WhoamiResult;
  try {
    result = await proxyWhoami(token, cfg);
  } catch (err) {
    if (err instanceof AuthUpstreamError && err.httpStatus === 401) {
      respondJson(res, 401, { error: "unauthenticated" });
      return null;
    }
    console.error("bff: requireSession upstream failure:", err);
    respondJson(res, 502, { error: "auth_upstream", message: "session check failed" });
    return null;
  }
  return {
    sessionId: result.session_id,
    userId: result.user_id,
    tenantId: result.tenant_id,
    tenantSlug: result.tenant_slug,
    email: result.email,
    role: result.role,
    expiresAt: result.expires_at,
  };
}
```

- [ ] **Step 4: Run middleware tests to verify pass**

Run: `pnpm test -- --run src/auth/middleware.test.ts`
Expected: 7/7 pass.

- [ ] **Step 5: Wire auth routes + protect existing routes in server.ts**

Modify `services/bff/src/server.ts`:

1. Import: `import { proxyDevLogin, proxyLogout, AuthUpstreamError } from "./auth/proxy.js";` and `import { requireSession } from "./auth/middleware.js";`
2. Above the existing route blocks (after upstreamConfig is loaded), add unprotected auth routes:

```typescript
if (req.url === "/v1/auth/dev/login" && req.method === "POST") {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks);
  if (raw.length > 16 * 1024) { respondJson(res, 413, { error: "payload_too_large" }); return; }
  let body: unknown;
  try { body = JSON.parse(raw.toString("utf8")); }
  catch { respondJson(res, 400, { error: "bad_json" }); return; }
  if (typeof body !== "object" || body === null) {
    respondJson(res, 400, { error: "bad_body" }); return;
  }
  try {
    const result = await proxyDevLogin(body as Parameters<typeof proxyDevLogin>[0], {
      integrationSvcUrl: upstreamConfig.integrationSvcUrl,
    });
    respondJson(res, 200, result);
  } catch (err) {
    if (err instanceof AuthUpstreamError) {
      const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
      respondJson(res, status, { error: "auth_upstream", message: err.message });
    } else {
      console.error("bff: /v1/auth/dev/login handler:", err);
      respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
    }
  }
  return;
}

if (req.url === "/v1/auth/whoami" && req.method === "GET") {
  const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
  if (!session) return;
  respondJson(res, 200, session);
  return;
}

if (req.url === "/v1/auth/logout" && req.method === "POST") {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, "") ?? "";
  try { await proxyLogout(token, { integrationSvcUrl: upstreamConfig.integrationSvcUrl }); }
  catch (err) { console.error("bff: logout:", err); }
  res.writeHead(204).end();
  return;
}
```

3. Wrap each protected route block (the four existing /v1/products and /v1/subscriptions handlers + /v1/market-data/quotes) with a `requireSession` call. Pattern at the top of each block:

```typescript
const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
if (!session) return;
```

For market-data + read-only product/subscription GETs, you may add `// TODO(slice-2): tenant-scope filtering` above the proxy call — but no actual scoping logic in this slice (it's the substrate, not authorization).

- [ ] **Step 6: Update existing server.test.ts to include Authorization header**

Read the current test file. Existing protected-route tests must now:
- Spin up a mock integration-svc (alongside the existing mock workflow-svc / market-data-hub) that returns `WhoamiResult` JSON for `/v1/auth/whoami`
- Add `headers: { authorization: "Bearer test-token" }` to every protected route fetch

Add at least one new test: `protected route returns 401 without bearer` — fetch `/v1/products/abc` without header and assert 401.

- [ ] **Step 7: Update healthz/aggregate.ts**

Add `integration-svc` to the composite health check next to workflow-svc / market-data-hub. Pull URL from `upstreamConfig.integrationSvcUrl`. Fetch `${url}/healthz` with 1s timeout, classify ok/degraded.

- [ ] **Step 8: Typecheck + run all bff tests**

Run from `services/bff/`: `pnpm typecheck && pnpm test -- --run`
Expected: typecheck clean; all bff tests pass.

- [ ] **Step 9: Commit**

```bash
git add services/bff/src/auth/middleware.ts \
        services/bff/src/auth/middleware.test.ts \
        services/bff/src/auth/proxy.ts \
        services/bff/src/auth/proxy.test.ts \
        services/bff/src/server.ts \
        services/bff/src/server.test.ts \
        services/bff/src/bff/bff.ts \
        services/bff/src/healthz/aggregate.ts
git commit -m "$(cat <<'EOF'
feat(bff): require session on protected /v1/* routes

Proxies POST /v1/auth/dev/login + GET /v1/auth/whoami + POST /v1/auth/logout
to integration-svc. requireSession middleware validates bearer via whoami
and returns 401 / 502 on failure. Existing /v1/products, /v1/subscriptions,
/v1/market-data/quotes routes now require Authorization: Bearer <token>.
Composite /healthz adds integration-svc.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: api-client — bearer token helpers (TDD)

**Files:**
- Create: `web/packages/api-client/src/auth.ts`
- Create: `web/packages/api-client/src/auth.test.ts`

- [ ] **Step 1: Write failing tests**

Create `web/packages/api-client/src/auth.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAuthClient, type TokenStorage } from "./auth.js";

function memoryStorage(): TokenStorage {
  let value: string | null = null;
  return {
    get: () => value,
    set: (v) => { value = v; },
    clear: () => { value = null; },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("createAuthClient", () => {
  it("login POSTs body and stores token on success", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      token: "T", session: { id: "s", user_id: "U", tenant_id: "X", role: "admin", expires_at: "2030-01-01T00:00:00Z" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const storage = memoryStorage();
    const client = createAuthClient({ bffUrl: "http://bff", storage, fetch: fetchMock });
    const result = await client.login({ tenantSlug: "t", email: "e@x.test" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://bff/v1/auth/dev/login",
      expect.objectContaining({ method: "POST" }),
    );
    expect(storage.get()).toBe("T");
    expect(result.session.user_id).toBe("U");
  });

  it("login throws on non-2xx and does NOT store token", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "x" }), { status: 401 }));
    const storage = memoryStorage();
    const client = createAuthClient({ bffUrl: "http://bff", storage, fetch: fetchMock });
    await expect(client.login({ tenantSlug: "t", email: "e@x.test" })).rejects.toThrow();
    expect(storage.get()).toBeNull();
  });

  it("whoami sends Authorization header from storage", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      session_id: "s", user_id: "U", tenant_id: "T", tenant_slug: "t", email: "e", role: "admin",
      expires_at: "2030-01-01T00:00:00Z",
    }), { status: 200 }));
    const storage = memoryStorage();
    storage.set("T");
    const client = createAuthClient({ bffUrl: "http://bff", storage, fetch: fetchMock });
    const me = await client.whoami();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://bff/v1/auth/whoami",
      expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer T" }) }),
    );
    expect(me.user_id).toBe("U");
  });

  it("whoami throws if no token in storage", async () => {
    const client = createAuthClient({ bffUrl: "http://bff", storage: memoryStorage(), fetch: vi.fn() });
    await expect(client.whoami()).rejects.toThrow();
  });

  it("logout calls bff and clears storage even on error", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    const storage = memoryStorage();
    storage.set("T");
    const client = createAuthClient({ bffUrl: "http://bff", storage, fetch: fetchMock });
    await client.logout();
    expect(storage.get()).toBeNull();
  });

  it("withAuth wraps fetch and adds Authorization header", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const storage = memoryStorage();
    storage.set("T");
    const client = createAuthClient({ bffUrl: "http://bff", storage, fetch: fetchMock });
    await client.fetch("/v1/products/abc");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://bff/v1/products/abc",
      expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer T" }) }),
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run from `web/packages/api-client/`: `pnpm test -- --run src/auth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement auth.ts**

Create `web/packages/api-client/src/auth.ts`:

```typescript
export interface TokenStorage {
  get(): string | null;
  set(token: string): void;
  clear(): void;
}

export interface AuthClientOptions {
  bffUrl: string;
  storage: TokenStorage;
  fetch?: typeof fetch;
}

export interface LoginInput {
  tenantSlug: string;
  email: string;
}

export interface LoginResult {
  token: string;
  session: {
    id: string;
    user_id: string;
    tenant_id: string;
    role: string;
    expires_at: string;
  };
}

export interface WhoamiResult {
  session_id: string;
  user_id: string;
  tenant_id: string;
  tenant_slug: string;
  email: string;
  role: string;
  expires_at: string;
}

export class AuthClientError extends Error {
  readonly name = "AuthClientError";
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export interface AuthClient {
  login(input: LoginInput): Promise<LoginResult>;
  whoami(): Promise<WhoamiResult>;
  logout(): Promise<void>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
  storage: TokenStorage;
}

export function createAuthClient(opts: AuthClientOptions): AuthClient {
  const f = opts.fetch ?? fetch;
  const url = (path: string) => `${opts.bffUrl}${path}`;

  return {
    storage: opts.storage,
    async login(input) {
      const res = await f(url("/v1/auth/dev/login"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_slug: input.tenantSlug, email: input.email }),
      });
      if (!res.ok) throw new AuthClientError(`login failed: ${res.status}`, res.status);
      const result = (await res.json()) as LoginResult;
      opts.storage.set(result.token);
      return result;
    },
    async whoami() {
      const token = opts.storage.get();
      if (!token) throw new AuthClientError("no token in storage");
      const res = await f(url("/v1/auth/whoami"), {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new AuthClientError(`whoami failed: ${res.status}`, res.status);
      return (await res.json()) as WhoamiResult;
    },
    async logout() {
      const token = opts.storage.get();
      try {
        if (token) {
          await f(url("/v1/auth/logout"), {
            method: "POST",
            headers: { authorization: `Bearer ${token}` },
          });
        }
      } finally {
        opts.storage.clear();
      }
    },
    async fetch(path, init) {
      const token = opts.storage.get();
      const headers = new Headers(init?.headers);
      if (token) headers.set("authorization", `Bearer ${token}`);
      return f(url(path), { ...init, headers });
    },
  };
}

export const localStorageTokenStorage: TokenStorage = {
  get() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("hydrax.session.token");
  },
  set(token) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("hydrax.session.token", token);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("hydrax.session.token");
  },
};
```

- [ ] **Step 4: Export from package index**

Read `web/packages/api-client/src/index.ts` (path may differ — check actual package layout). Add:
```typescript
export * from "./auth.js";
```

- [ ] **Step 5: Run tests + typecheck + build**

Run from `web/packages/api-client/`:
```bash
pnpm test -- --run && pnpm typecheck && pnpm build
```
Expected: 6/6 pass; typecheck clean; build emits dist/auth.js.

- [ ] **Step 6: Repo-wide gates (per CLAUDE.md "Three green or no commit")**

Run from repo root:
```bash
pnpm -r --if-present typecheck && pnpm -r --if-present test -- --run && pnpm -r --if-present build
```
Expected: all three green across all workspaces (web + node services). Bff and integration-svc tests need `INTEGRATION_SVC_DATABASE_URL` exported in shell.

- [ ] **Step 7: Commit**

```bash
git add web/packages/api-client/src/auth.ts \
        web/packages/api-client/src/auth.test.ts \
        web/packages/api-client/src/index.ts
git commit -m "$(cat <<'EOF'
feat(api-client): add bearer-token auth helpers

createAuthClient exposes login/whoami/logout + a fetch wrapper that
adds Authorization: Bearer from injectable TokenStorage. Default
localStorageTokenStorage uses key 'hydrax.session.token'. 6/6 tests
pass under vitest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: docs/env.md + STATE.yaml

**Files:**
- Modify: `docs/env.md`
- Modify: `STATE.yaml`

- [ ] **Step 1: Document new env vars in docs/env.md**

Add a new section:

```markdown
## Auth Foundation (Slice 1)

| Var | Service | Default | Purpose |
|---|---|---|---|
| `INTEGRATION_SVC_DATABASE_URL` | integration-svc | falls back to `DATABASE_URL` | Postgres DSN for the auth Sessions repo |
| `AUTH_DEV_LOGIN` | integration-svc | unset (off) | Set to `1` to enable `POST /v1/auth/dev/login`. Returns 404 when unset. **Never set in prod.** |
| `SESSION_TTL_SECONDS` | integration-svc | `43200` (12h) | TTL for sessions issued via dev/login |
| `INTEGRATION_SVC_URL` | bff | `http://localhost:7102` | Upstream URL for auth proxy + composite healthz |

Slice 2 (passkeys or OIDC) will add: `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, magic-link email creds (passkeys path) OR `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` (OIDC path).
```

- [ ] **Step 2: Update STATE.yaml**

Read STATE.yaml, then:
- Update `current_focus` to reflect: "auth substrate slice 1 closed; slice 2 (passkeys vs OIDC) is next"
- Append a `verification_log` entry:

```
2026-04-25 — auth-foundation slice 1: migration 0002 applied; integration-svc 24/24 tests (token 7 + repo 7 + handlers 10) green; bff 12+/12+ tests (auth proxy 5 + middleware 7 + existing routes updated for bearer) green; api-client 6/6 tests green; smoke: dev/login → token → whoami → logout → 401 round-trip via curl on localhost; AUTH_DEV_LOGIN gating verified (404 when unset); pnpm -r --if-present {typecheck,test,build} green workspace-wide
```

- [ ] **Step 3: Commit**

```bash
git add docs/env.md STATE.yaml
git commit -m "$(cat <<'EOF'
chore(state): record auth foundation slice 1 closure

Documents AUTH_DEV_LOGIN, SESSION_TTL_SECONDS, INTEGRATION_SVC_URL,
INTEGRATION_SVC_DATABASE_URL in docs/env.md. STATE.yaml verification
log entry covers integration-svc + bff + api-client gates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Acceptance Criteria — when slice 1 is "done"

- [ ] All 11 tasks above are checked off.
- [ ] `pnpm -r --if-present typecheck && pnpm -r --if-present test -- --run && pnpm -r --if-present build` is green at the repo root (with `INTEGRATION_SVC_DATABASE_URL` set).
- [ ] `db/postgres/apply.sh` from a fresh DB applies 0001 + 0002 cleanly.
- [ ] Smoke flow on localhost: seed tenant + user via psql → `curl POST /v1/auth/dev/login` returns token → `curl GET /v1/auth/whoami` returns the seeded user → `curl GET /v1/products` (without token) returns 401 → with token returns 200/empty list → `curl POST /v1/auth/logout` returns 204 → subsequent whoami returns 401.
- [ ] Setting `AUTH_DEV_LOGIN=` (unset) on integration-svc startup = `dev/login` returns 404 (verified via shell).
- [ ] STATE.yaml `verification_log` has the slice-1 entry.
- [ ] 5 commits on the branch (or main, per project convention): migration / integration-svc package / integration-svc handlers + server / bff / api-client + state.

## Slice 2 trigger — open before starting

After slice 1 lands, the user picks: `auth: passkeys` or `auth: oidc`. Slice 2 plan author should:
- Read PRD §10 (privacy-preserving design)
- Confirm whether design partner (PRD §14 Q4) has been picked — if so, slice 2 path is constrained by their identity stack
- Estimate as multi-session work: passkeys path = WebAuthn register/auth + magic-link enrollment + email service stub + portal UI (~3-4 sub-slices). OIDC path = vendor selection + IdP provisioning + callback flow + portal UI (~2-3 sub-slices, but with billable vendor lock-in).

---

## Self-Review Notes (already applied)

- ✓ Spec coverage: every plan goal (DB → integration-svc → bff → api-client → docs) has dedicated tasks.
- ✓ Placeholder scan: no TODOs, "TBD"s, or "implement later" — every step has actual code or actual commands.
- ✓ Type consistency: `WhoamiResult` shape is identical in integration-svc handlers, bff proxy, bff middleware, api-client. `LoginResult.session.{id,user_id,tenant_id,role,expires_at}` mirrored top-to-bottom.
- ✓ One known carryover: api-client `index.ts` path is unverified; Step 4 of Task 10 says "may differ — check actual package layout." That's the only "find the file" step in the plan.
