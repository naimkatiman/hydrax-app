# Auth Slice 2b — Magic-Link Enrollment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship email-delivered magic-link enrollment so a brand-new user (or returning user without a passkey) can authenticate into a real session in production — replacing the dev-only `AUTH_DEV_LOGIN=1` bootstrap.

**Architecture:** New `magic_link_tokens` table + a single-use token issuer in `integration-svc` that emits an HTTP call to `notify-svc` (which hosts the email transport). On consume, integration-svc reuses slice 1's `Sessions.createSession()` to issue a real bearer token. BFF gets two new public routes (request + consume). No browser ceremony, no library mocking — fully CLI-smokeable.

**Tech Stack:** Node 22 + TypeScript + pg + vitest (integration-svc, notify-svc, bff). PostgreSQL 16 (`hydrax` DB on port 5433). No new npm dependencies.

---

## ⚠️ Production-Readiness Disclaimer (read this first)

**Slice 2b is server-side substrate + console transport. It does NOT enable production passwordless login on its own.**

What slice 2b ships: the issuance + consume + delivery wiring with `EMAIL_TRANSPORT=console`, which prints magic-link URLs to `notify-svc` stdout. This is the dev/staging path.

What slice 2b does NOT ship:
- **Real email transport (SMTP / SES / Resend).** That is **slice 2c**. Without it, `EMAIL_TRANSPORT=console` is the only working transport and nothing actually reaches a user's inbox.
- **Removal of `AUTH_DEV_LOGIN=1`.** That is **slice 2e** (after 2b + 2c land). Slice 2b ADDS magic-link as a parallel bootstrap; the dev-login flag stays untouched and remains fail-closed in prod.
- **Portal UI (request form, success/error pages).** That is **slice 2d**.
- **Admin-pre-creates-user bypass / self-signup.** v1 invariant: an admin must have already inserted the `users` row before `magic-link/request` will silently no-op or succeed. (Same email-enumeration-safe behavior either way.)

**Slice 2b is fully CLI-driveable.** The closure gate (Task 11) is one terminal session driving curl + tail + curl, no browser needed.

---

## Decision Log (read before changing scope)

| Decision | Why | Where to override |
|---|---|---|
| Token format = 32 random bytes → base64url (43 chars) | Same shape as slice 1 session tokens; `randomBytes(32).toString("base64url")` | `services/integration-svc/src/auth/magic-link-handlers.ts` |
| Storage = sha256 hash, never raw | Same as slice 1 sessions; reuses `hashToken()` helper from slice 1 `token.ts` | n/a |
| TTL default = 15 min (900s) | Long enough to round-trip an inbox without prompting reissue; short enough to limit replay window | `MAGIC_LINK_TTL_SECONDS` env (range 60-3600) |
| Single-use enforced atomically in SQL | Single `UPDATE ... WHERE token_hash=$1 AND used_at IS NULL AND expires_at > NOW() RETURNING ...` is race-free at the DB layer | `services/integration-svc/src/auth/magic-link-repo.ts:consume` |
| Rate limit = per (tenant_slug, email), max 3 / 15min | Throttle email-spam abuse without full DOS protection (real DOS is upstream concern) | `MAGIC_LINK_RATE_LIMIT_PER_WINDOW` + `MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS` env |
| Rate limit storage = in-process LRU bucket | Single integration-svc instance for now; cross-instance rate-limit is **slice 2e** concern | `services/integration-svc/src/auth/magic-link-rate-limit.ts` |
| /request always 202 (whether user exists or not) | Email-enumeration safety. Matches WebAuthn auth/options 404-no-leak pattern from slice 2a | `services/integration-svc/src/auth/magic-link-handlers.ts:handleRequest` |
| Send-failure swallowed by /request | The user-facing endpoint cannot leak whether the email was queued; failures logged via console.error and dropped | `services/integration-svc/src/auth/magic-link-handlers.ts:handleRequest` |
| Session issued on consume = same 12h TTL as dev/login | Reuses slice 1 `SESSION_TTL_SECONDS` config; one path, one knob | n/a |
| Email transport in slice 2b = `console` (default) or `noop` | Real SMTP/SES/Resend is slice 2c — substrate ships without an env-bound external account | `EMAIL_TRANSPORT` env on **notify-svc** (not integration-svc) |
| Email body = plain text only (no HTML) | YAGNI — branded HTML templates are slice 2d/2e concern | n/a |
| `MAGIC_LINK_BASE_URL` is the URL the email points at | Defaults to `http://localhost:5173/auth/magic-link`. Slice 2d portal serves that route; for slice 2b smoke, the user manually extracts `?token=...` and curls the BFF | `MAGIC_LINK_BASE_URL` env |
| BFF GET /v1/auth/magic-link/consume forwards the `token` query param to integration-svc | Mirrors slice 2a auth/verify forward shape (no auth, body forwarded). HTTP method = GET because clicking an email link is always a GET in browsers | `services/bff/src/server.ts` |

---

## File Structure

```
db/postgres/migrations/
  0004_magic_links.sql                                    # NEW

services/integration-svc/src/auth/
  magic-link-config.ts                                    # NEW (env loader)
  magic-link-config.test.ts                               # NEW
  magic-link-rate-limit.ts                                # NEW (in-process LRU bucket)
  magic-link-rate-limit.test.ts                           # NEW
  magic-link-repo.ts                                      # NEW (MagicLinks class)
  magic-link-repo.test.ts                                 # NEW (against real Postgres)
  notify-client.ts                                        # NEW (HTTP client → notify-svc)
  notify-client.test.ts                                   # NEW (against mock HTTP server)
  magic-link-handlers.ts                                  # NEW (request + consume routes)
  magic-link-handlers.test.ts                             # NEW (against real Postgres + mock notify)
services/integration-svc/src/server.ts                    # MODIFY (mount magic-link routes + load config + wire deps)

services/notify-svc/src/
  email-config.ts                                         # NEW (EMAIL_TRANSPORT loader)
  email-config.test.ts                                    # NEW
  email-handlers.ts                                       # NEW (POST /v1/notifications/email)
  email-handlers.test.ts                                  # NEW
services/notify-svc/src/server.ts                         # MODIFY (mount email routes + load config)

services/bff/src/auth/
  magic-link-proxy.ts                                     # NEW (proxyMagicLinkRequest + proxyMagicLinkConsume)
  magic-link-proxy.test.ts                                # NEW
services/bff/src/server.ts                                # MODIFY (2 new unprotected routes)

docs/env.md                                               # MODIFY (5 new env vars + slice-2b section)
STATE.yaml                                                # MODIFY (verification_log entry)
```

**Each file has one responsibility. Files that change together commit together.** Bundled commits:
- Tasks 2 + 3 + 4 (integration-svc supporting modules: config + rate-limit + repo) → 1 commit
- Task 5 + 6 (cross-service: integration-svc notify-client + notify-svc email surface) → split into 2 commits, one per service
- Tasks 7 + 8 (integration-svc handlers + server wiring) → 1 commit
- Task 9 (bff proxy + server wiring) → 1 commit
- Task 10 (docs + state) → 1 commit

Total target: 7 commits across 11 tasks (migration / integration-svc support modules / integration-svc notify-client / notify-svc bundle / integration-svc handlers + server / bff bundle / docs+state).

---

## Required Reading Before Implementing

Read these files BEFORE Task 1 — they define the interfaces this slice extends:

1. `docs/plans/2026-04-25-auth-foundation.md` — slice 1 architectural decisions (bearer-over-cookies, sha256 token_hash, AUTH_DEV_LOGIN gating)
2. `docs/plans/2026-04-25-auth-slice-2a-passkeys-server.md` — slice 2a Decision Log (sets precedent for in-process LRU, library-mocked vs real-DB testing, 4-route mount-pattern)
3. `services/integration-svc/src/auth/repo.ts` — `Sessions` class (will be reused; in particular `createSession` and `findUserByTenantSlugAndEmail`)
4. `services/integration-svc/src/auth/handlers.ts` — error envelope shapes (`{ error: "...", message?: "..." }`), 64 KiB body cap pattern, error masking via `console.error`
5. `services/integration-svc/src/auth/token.ts` — `generateToken()` + `hashToken()` helpers
6. `services/integration-svc/src/auth/challenge-store.ts` — LRU pattern this slice's rate-limiter mirrors
7. `services/notify-svc/src/server.ts` — current 1-route surface (just `/healthz`); slice 2b adds POST `/v1/notifications/email`
8. `services/bff/src/auth/proxy.ts` — `AuthUpstreamError` + `AuthUpstreamConfig` patterns (reused by `magic-link-proxy.ts`)
9. `services/bff/src/server.ts` — slice 1 + 2a route mount order (healthz → unauth auth routes → unauth passkey routes → protected routes); slice 2b inserts magic-link routes alongside the existing unauth auth routes

---

## Task 1: Migration 0004 — magic_link_tokens table

**Files:**
- Create: `db/postgres/migrations/0004_magic_links.sql`

- [ ] **Step 1: Write the migration**

Create `db/postgres/migrations/0004_magic_links.sql`:

```sql
-- 0004_magic_links.sql
-- Magic-link enrollment tokens. Single-use, short TTL (default 15 min).
-- Stored as sha256(token) — never the raw token. Slice 2b ships the
-- console-stdout transport for dev/staging; slice 2c adds real email.

CREATE TABLE magic_link_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token_hash  BYTEA NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_magic_link_tokens_token_hash ON magic_link_tokens (token_hash);
CREATE INDEX idx_magic_link_tokens_user ON magic_link_tokens (user_id);
CREATE INDEX idx_magic_link_tokens_active ON magic_link_tokens (expires_at) WHERE used_at IS NULL;
```

- [ ] **Step 2: Apply against local Postgres**

```bash
PGPASSWORD=hydrax psql -h localhost -p 5433 -U hydrax -d hydrax \
  -v ON_ERROR_STOP=1 -f db/postgres/migrations/0004_magic_links.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX`, `CREATE INDEX`, `CREATE INDEX`. Exit 0.

- [ ] **Step 3: Verify schema with psql**

```bash
PGPASSWORD=hydrax psql -h localhost -p 5433 -U hydrax -d hydrax -c "\d magic_link_tokens"
```

Expected: 7 columns including `token_hash BYTEA NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL`, `used_at TIMESTAMPTZ` (nullable); 4 indexes (PK + unique token_hash + user index + partial active index).

- [ ] **Step 4: Commit**

```bash
git add db/postgres/migrations/0004_magic_links.sql
git commit -m "$(cat <<'EOF'
feat(db): add magic_link_tokens table for slice 2b enrollment

Single-use, short-TTL tokens. token_hash is sha256 of the clear
token (same pattern as user_sessions). Partial index on expires_at
WHERE used_at IS NULL keeps the active-token lookup cheap as the
table grows. CASCADE on user_id + tenant_id matches user_sessions
behavior — deleting a tenant or user invalidates outstanding links.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: integration-svc — magic-link-config (TDD)

**Files:**
- Create: `services/integration-svc/src/auth/magic-link-config.ts`
- Create: `services/integration-svc/src/auth/magic-link-config.test.ts`

- [ ] **Step 1: Write failing test**

Create `services/integration-svc/src/auth/magic-link-config.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { loadMagicLinkConfig } from "./magic-link-config.js";

describe("loadMagicLinkConfig", () => {
  it("returns localhost defaults when env is empty", () => {
    const cfg = loadMagicLinkConfig({});
    expect(cfg).toEqual({
      ttlSeconds: 900,
      rateLimitMax: 3,
      rateLimitWindowSeconds: 900,
      baseUrl: "http://localhost:5173/auth/magic-link",
    });
  });

  it("reads MAGIC_LINK_TTL_SECONDS", () => {
    const cfg = loadMagicLinkConfig({ MAGIC_LINK_TTL_SECONDS: "300" });
    expect(cfg.ttlSeconds).toBe(300);
  });

  it("reads MAGIC_LINK_RATE_LIMIT_PER_WINDOW", () => {
    const cfg = loadMagicLinkConfig({ MAGIC_LINK_RATE_LIMIT_PER_WINDOW: "5" });
    expect(cfg.rateLimitMax).toBe(5);
  });

  it("reads MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS", () => {
    const cfg = loadMagicLinkConfig({ MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS: "60" });
    expect(cfg.rateLimitWindowSeconds).toBe(60);
  });

  it("reads MAGIC_LINK_BASE_URL and trims trailing slash", () => {
    const cfg = loadMagicLinkConfig({ MAGIC_LINK_BASE_URL: "https://hydrax.com/auth/m/" });
    expect(cfg.baseUrl).toBe("https://hydrax.com/auth/m");
  });

  it("rejects MAGIC_LINK_TTL_SECONDS < 60", () => {
    expect(() => loadMagicLinkConfig({ MAGIC_LINK_TTL_SECONDS: "30" }))
      .toThrow(/must be >= 60/);
  });

  it("rejects MAGIC_LINK_TTL_SECONDS > 3600", () => {
    expect(() => loadMagicLinkConfig({ MAGIC_LINK_TTL_SECONDS: "9999" }))
      .toThrow(/must be <= 3600/);
  });

  it("rejects MAGIC_LINK_RATE_LIMIT_PER_WINDOW < 1", () => {
    expect(() => loadMagicLinkConfig({ MAGIC_LINK_RATE_LIMIT_PER_WINDOW: "0" }))
      .toThrow(/must be >= 1/);
  });

  it("rejects MAGIC_LINK_RATE_LIMIT_PER_WINDOW > 10", () => {
    expect(() => loadMagicLinkConfig({ MAGIC_LINK_RATE_LIMIT_PER_WINDOW: "100" }))
      .toThrow(/must be <= 10/);
  });

  it("rejects non-integer TTL", () => {
    expect(() => loadMagicLinkConfig({ MAGIC_LINK_TTL_SECONDS: "abc" }))
      .toThrow(/positive integer/);
  });
});
```

- [ ] **Step 2: Run, verify failure**

From `services/integration-svc/`: `pnpm test -- --run src/auth/magic-link-config.test.ts`. Expected: module-not-found.

- [ ] **Step 3: Implement magic-link-config.ts**

Create `services/integration-svc/src/auth/magic-link-config.ts`:

```typescript
export interface MagicLinkConfig {
  ttlSeconds: number;
  rateLimitMax: number;
  rateLimitWindowSeconds: number;
  baseUrl: string;
}

function readBoundedInt(
  raw: string | undefined,
  name: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw === "") return defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${name} must be a positive integer, got ${raw}`);
  }
  if (parsed < min) throw new Error(`${name} must be >= ${min} (got ${parsed})`);
  if (parsed > max) throw new Error(`${name} must be <= ${max} (got ${parsed})`);
  return parsed;
}

export function loadMagicLinkConfig(env: Record<string, string | undefined>): MagicLinkConfig {
  const ttlSeconds = readBoundedInt(env.MAGIC_LINK_TTL_SECONDS, "MAGIC_LINK_TTL_SECONDS", 900, 60, 3600);
  const rateLimitMax = readBoundedInt(env.MAGIC_LINK_RATE_LIMIT_PER_WINDOW, "MAGIC_LINK_RATE_LIMIT_PER_WINDOW", 3, 1, 10);
  const rateLimitWindowSeconds = readBoundedInt(env.MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS, "MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS", 900, 60, 3600);

  const rawBase = env.MAGIC_LINK_BASE_URL ?? "http://localhost:5173/auth/magic-link";
  const baseUrl = rawBase.replace(/\/+$/, "");

  return { ttlSeconds, rateLimitMax, rateLimitWindowSeconds, baseUrl };
}
```

- [ ] **Step 4: Run, verify pass**

`pnpm test -- --run src/auth/magic-link-config.test.ts`. Expected: 10/10 pass.

(Commit deferred — bundles with Tasks 3 + 4.)

---

## Task 3: integration-svc — magic-link-rate-limit (TDD)

**Files:**
- Create: `services/integration-svc/src/auth/magic-link-rate-limit.ts`
- Create: `services/integration-svc/src/auth/magic-link-rate-limit.test.ts`

- [ ] **Step 1: Write failing test**

Create `services/integration-svc/src/auth/magic-link-rate-limit.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimit, type RateLimit } from "./magic-link-rate-limit.js";

describe("createRateLimit", () => {
  let limiter: RateLimit;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = createRateLimit({ max: 3, windowSeconds: 60, maxBuckets: 5 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request", () => {
    expect(limiter.check("alice")).toBe(true);
  });

  it("allows exactly max requests in a window, then blocks", () => {
    expect(limiter.check("alice")).toBe(true);  // 1
    expect(limiter.check("alice")).toBe(true);  // 2
    expect(limiter.check("alice")).toBe(true);  // 3
    expect(limiter.check("alice")).toBe(false); // 4 — blocked
    expect(limiter.check("alice")).toBe(false); // 5 — still blocked
  });

  it("isolates buckets by key", () => {
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(false);
    expect(limiter.check("bob")).toBe(true);  // bob has its own bucket
  });

  it("resets after the window elapses", () => {
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(false);
    vi.advanceTimersByTime(61_000);  // beyond windowSeconds
    expect(limiter.check("alice")).toBe(true);
  });

  it("evicts oldest bucket when capacity exceeded", () => {
    limiter.check("a");
    limiter.check("b");
    limiter.check("c");
    limiter.check("d");
    limiter.check("e");
    limiter.check("f");  // evicts "a"
    // After eviction, "a" gets a fresh bucket on next check
    expect(limiter.check("a")).toBe(true);
    // "f" still has 2 remaining
    expect(limiter.check("f")).toBe(true);
    expect(limiter.check("f")).toBe(true);
    expect(limiter.check("f")).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify failure**

`pnpm test -- --run src/auth/magic-link-rate-limit.test.ts`. Expected: module-not-found.

- [ ] **Step 3: Implement magic-link-rate-limit.ts**

Create `services/integration-svc/src/auth/magic-link-rate-limit.ts`:

```typescript
export interface RateLimitOptions {
  max: number;
  windowSeconds: number;
  maxBuckets: number;
}

export interface RateLimit {
  /** Returns true if the request is allowed (and increments the bucket counter); false if blocked. */
  check(key: string): boolean;
}

interface Bucket {
  count: number;
  windowStart: number;
}

export function createRateLimit(opts: RateLimitOptions): RateLimit {
  // Insertion-ordered Map = LRU iteration. Re-insert on access keeps recency.
  const buckets = new Map<string, Bucket>();
  const windowMs = opts.windowSeconds * 1000;

  function evictOldestIfFull(): void {
    while (buckets.size >= opts.maxBuckets) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }

  return {
    check(key) {
      const now = Date.now();
      let bucket = buckets.get(key);

      if (bucket && now - bucket.windowStart >= windowMs) {
        // Window expired — reset.
        bucket = undefined;
        buckets.delete(key);
      }

      if (!bucket) {
        evictOldestIfFull();
        bucket = { count: 0, windowStart: now };
        buckets.set(key, bucket);
      } else {
        // Re-insert to refresh LRU recency
        buckets.delete(key);
        buckets.set(key, bucket);
      }

      if (bucket.count >= opts.max) return false;
      bucket.count += 1;
      return true;
    },
  };
}
```

- [ ] **Step 4: Run, verify pass**

`pnpm test -- --run src/auth/magic-link-rate-limit.test.ts`. Expected: 5/5 pass.

(Commit deferred — bundles with Task 4.)

---

## Task 4: integration-svc — magic-link-repo (TDD against real Postgres)

**Files:**
- Create: `services/integration-svc/src/auth/magic-link-repo.ts`
- Create: `services/integration-svc/src/auth/magic-link-repo.test.ts`

- [ ] **Step 1: Write failing test**

Create `services/integration-svc/src/auth/magic-link-repo.test.ts`:

```typescript
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
      // ttlSeconds=0 means expires_at = NOW(); by the time consume runs, NOW() > expires_at is false
      // (NOW() == expires_at fails the "expires_at > NOW()" predicate)
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
```

- [ ] **Step 2: Run, verify failure**

```bash
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run src/auth/magic-link-repo.test.ts
```

Expected: module-not-found.

- [ ] **Step 3: Implement magic-link-repo.ts**

Create `services/integration-svc/src/auth/magic-link-repo.ts`:

```typescript
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
```

- [ ] **Step 4: Run, verify pass**

```bash
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run src/auth/magic-link-repo.test.ts
```

Expected: 7/7 pass.

- [ ] **Step 5: Commit (Tasks 2 + 3 + 4 bundled)**

```bash
git add services/integration-svc/src/auth/magic-link-config.ts \
        services/integration-svc/src/auth/magic-link-config.test.ts \
        services/integration-svc/src/auth/magic-link-rate-limit.ts \
        services/integration-svc/src/auth/magic-link-rate-limit.test.ts \
        services/integration-svc/src/auth/magic-link-repo.ts \
        services/integration-svc/src/auth/magic-link-repo.test.ts
git diff --cached --name-only
```

Confirm exactly those 6 files staged. Then:

```bash
git commit -m "$(cat <<'EOF'
feat(integration-svc): magic-link config + rate-limit + repo

MagicLinkConfig reads MAGIC_LINK_TTL_SECONDS / RATE_LIMIT_PER_WINDOW
/ RATE_LIMIT_WINDOW_SECONDS / BASE_URL with bounded validation
(TTL 60-3600s, rate-limit 1-10/window, window 60-3600s). RateLimit
is an insertion-ordered-Map LRU bucket with sliding window per key
(reset on first check after window elapses). MagicLinks repo wraps
INSERT (returning id + expires_at) and atomic UPDATE-RETURNING
consume that enforces single-use + unexpired in one statement.
10 config + 5 rate-limit + 7 repo tests green (repo against real
Postgres on localhost:5433).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: integration-svc — notify-client (TDD against mock HTTP)

**Files:**
- Create: `services/integration-svc/src/auth/notify-client.ts`
- Create: `services/integration-svc/src/auth/notify-client.test.ts`

- [ ] **Step 1: Write failing test**

Create `services/integration-svc/src/auth/notify-client.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { sendEmail, NotifyUpstreamError } from "./notify-client.js";

let upstream: http.Server;
let upstreamUrl: string;
let lastReq: { method?: string; url?: string; body?: string } = {};
let respond: (req: http.IncomingMessage, res: http.ServerResponse) => void;

beforeEach(async () => {
  lastReq = {};
  upstream = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      lastReq = { method: req.method, url: req.url, body };
      respond(req, res);
    });
  });
  await new Promise<void>((r) => upstream.listen(0, r));
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

afterEach(() => new Promise<void>((resolve) => upstream.close(() => resolve())));

describe("sendEmail", () => {
  it("POSTs to /v1/notifications/email with body and returns void on 202", async () => {
    respond = (_req, res) => { res.writeHead(202).end(); };
    await sendEmail(
      { to: "alice@example.test", subject: "Hi", text: "Click here: https://x.test/abc" },
      { notifySvcUrl: upstreamUrl },
    );
    expect(lastReq.method).toBe("POST");
    expect(lastReq.url).toBe("/v1/notifications/email");
    expect(JSON.parse(lastReq.body!)).toEqual({
      to: "alice@example.test",
      subject: "Hi",
      text: "Click here: https://x.test/abc",
    });
  });

  it("throws NotifyUpstreamError on non-2xx response", async () => {
    respond = (_req, res) => { res.writeHead(500).end(JSON.stringify({ error: "internal" })); };
    await expect(
      sendEmail({ to: "x@x.test", subject: "S", text: "T" }, { notifySvcUrl: upstreamUrl }),
    ).rejects.toMatchObject({ name: "NotifyUpstreamError", httpStatus: 500 });
  });

  it("throws NotifyUpstreamError on network failure", async () => {
    // Close the upstream so the next call fails to connect
    await new Promise<void>((r) => upstream.close(() => r()));
    await expect(
      sendEmail({ to: "x@x.test", subject: "S", text: "T" }, { notifySvcUrl: upstreamUrl }),
    ).rejects.toThrow();
  });

  it("trims trailing slash on notifySvcUrl", async () => {
    respond = (_req, res) => { res.writeHead(202).end(); };
    await sendEmail(
      { to: "a@a.test", subject: "s", text: "t" },
      { notifySvcUrl: `${upstreamUrl}/` },
    );
    expect(lastReq.url).toBe("/v1/notifications/email");
  });
});
```

- [ ] **Step 2: Run, verify failure**

`pnpm test -- --run src/auth/notify-client.test.ts`. Expected: module-not-found.

- [ ] **Step 3: Implement notify-client.ts**

Create `services/integration-svc/src/auth/notify-client.ts`:

```typescript
export interface NotifyClientConfig {
  notifySvcUrl: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

export class NotifyUpstreamError extends Error {
  override readonly name = "NotifyUpstreamError";
  constructor(message: string, public readonly httpStatus: number) {
    super(message);
  }
}

export async function sendEmail(input: SendEmailInput, cfg: NotifyClientConfig): Promise<void> {
  const base = cfg.notifySvcUrl.replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (err) {
    throw new NotifyUpstreamError(
      `notify-svc unreachable: ${err instanceof Error ? err.message : String(err)}`,
      0,
    );
  }
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new NotifyUpstreamError(`notify-svc upstream ${res.status}: ${detail}`, res.status);
  }
}
```

- [ ] **Step 4: Run, verify pass**

`pnpm test -- --run src/auth/notify-client.test.ts`. Expected: 4/4 pass.

- [ ] **Step 5: Commit (notify-client only — separate from notify-svc commit in Task 6)**

```bash
git add services/integration-svc/src/auth/notify-client.ts \
        services/integration-svc/src/auth/notify-client.test.ts
git diff --cached --name-only
```

Confirm exactly those 2 files staged. Then:

```bash
git commit -m "$(cat <<'EOF'
feat(integration-svc): notify-client for HTTP calls to notify-svc

Small wrapper around fetch — POST /v1/notifications/email with
{to, subject, text}, throws NotifyUpstreamError (with httpStatus)
on non-2xx or network failure. Used by magic-link-handlers in
slice 2b. 4/4 tests green against an in-process mock HTTP server.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: notify-svc — email-config + email-handlers + server wiring (TDD)

**Files:**
- Create: `services/notify-svc/src/email-config.ts`
- Create: `services/notify-svc/src/email-config.test.ts`
- Create: `services/notify-svc/src/email-handlers.ts`
- Create: `services/notify-svc/src/email-handlers.test.ts`
- Modify: `services/notify-svc/src/server.ts`

This task is medium-sized — 4 new files + 1 modify. Bundled into one notify-svc commit.

- [ ] **Step 1: Write failing config test**

Create `services/notify-svc/src/email-config.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { loadEmailConfig } from "./email-config.js";

describe("loadEmailConfig", () => {
  it("defaults to console transport", () => {
    expect(loadEmailConfig({}).transport).toBe("console");
  });

  it("reads EMAIL_TRANSPORT=console", () => {
    expect(loadEmailConfig({ EMAIL_TRANSPORT: "console" }).transport).toBe("console");
  });

  it("reads EMAIL_TRANSPORT=noop", () => {
    expect(loadEmailConfig({ EMAIL_TRANSPORT: "noop" }).transport).toBe("noop");
  });

  it("rejects unknown EMAIL_TRANSPORT (slice 2c will widen)", () => {
    expect(() => loadEmailConfig({ EMAIL_TRANSPORT: "smtp" }))
      .toThrow(/unsupported.*smtp/i);
  });
});
```

- [ ] **Step 2: Run, verify failure**

From `services/notify-svc/`: `pnpm test -- --run src/email-config.test.ts`. Expected: module-not-found.

- [ ] **Step 3: Implement email-config.ts**

Create `services/notify-svc/src/email-config.ts`:

```typescript
export type EmailTransport = "console" | "noop";

export interface EmailConfig {
  transport: EmailTransport;
}

const SUPPORTED: ReadonlyArray<EmailTransport> = ["console", "noop"];

export function loadEmailConfig(env: Record<string, string | undefined>): EmailConfig {
  const raw = env.EMAIL_TRANSPORT;
  if (raw === undefined || raw === "") return { transport: "console" };
  if (!SUPPORTED.includes(raw as EmailTransport)) {
    throw new Error(
      `EMAIL_TRANSPORT unsupported: '${raw}' (supported: ${SUPPORTED.join(", ")}; slice 2c will add smtp/ses/resend)`,
    );
  }
  return { transport: raw as EmailTransport };
}
```

- [ ] **Step 4: Run, verify pass**

`pnpm test -- --run src/email-config.test.ts`. Expected: 4/4 pass.

- [ ] **Step 5: Write failing handlers test**

Create `services/notify-svc/src/email-handlers.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { mountEmailRoutes, type EmailHandlerOptions } from "./email-handlers.js";

let server: http.Server;
let baseUrl: string;
let logs: string[] = [];
let logSpy: ReturnType<typeof vi.spyOn>;

function start(opts: EmailHandlerOptions): Promise<void> {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      if (!mountEmailRoutes(req, res, opts)) {
        res.writeHead(404).end();
      }
    });
    server.listen(0, () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

beforeEach(() => {
  logs = [];
  logSpy = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
    logs.push(String(msg));
  });
});

afterEach(async () => {
  logSpy.mockRestore();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("POST /v1/notifications/email — console transport", () => {
  it("returns 202 and logs the email envelope to stdout", async () => {
    await start({ transport: "console" });
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "alice@example.test", subject: "Hi", text: "your link: https://x.test/abc" }),
    });
    expect(res.status).toBe(202);
    const log = logs.find((l) => l.includes("[notify-svc:email]"));
    expect(log).toBeDefined();
    expect(log!).toContain("To: alice@example.test");
    expect(log!).toContain("Subject: Hi");
    expect(log!).toContain("your link: https://x.test/abc");
  });
});

describe("POST /v1/notifications/email — noop transport", () => {
  it("returns 202 and does NOT log anything", async () => {
    await start({ transport: "noop" });
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "x@x.test", subject: "s", text: "t" }),
    });
    expect(res.status).toBe(202);
    const log = logs.find((l) => l.includes("[notify-svc:email]"));
    expect(log).toBeUndefined();
  });
});

describe("POST /v1/notifications/email — input validation", () => {
  it("returns 400 when body is not JSON", async () => {
    await start({ transport: "console" });
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    await start({ transport: "console" });
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "x@x.test" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 405 for non-POST methods", async () => {
    await start({ transport: "console" });
    const res = await fetch(`${baseUrl}/v1/notifications/email`);
    expect(res.status).toBe(405);
  });

  it("returns 413 when body exceeds 64 KiB", async () => {
    await start({ transport: "console" });
    const big = "x".repeat(70 * 1024);
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "x@x.test", subject: "s", text: big }),
    });
    expect(res.status).toBe(413);
  });
});
```

- [ ] **Step 6: Run, verify failure**

`pnpm test -- --run src/email-handlers.test.ts`. Expected: module-not-found.

- [ ] **Step 7: Implement email-handlers.ts**

Create `services/notify-svc/src/email-handlers.ts`:

```typescript
import type http from "node:http";
import type { EmailTransport } from "./email-config.js";

export interface EmailHandlerOptions {
  transport: EmailTransport;
}

const MAX_BODY_BYTES = 64 * 1024;

function respondJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
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
 * Returns true if the request matched an email route (and was handled).
 * Returns false if no match — caller falls through to its own 404.
 */
export function mountEmailRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: EmailHandlerOptions,
): boolean {
  const url = req.url ?? "";
  const method = req.method ?? "GET";

  if (url === "/v1/notifications/email") {
    if (method !== "POST") {
      respondJson(res, 405, { error: "method_not_allowed" });
      return true;
    }
    void handleSendEmail(req, res, opts);
    return true;
  }
  return false;
}

async function handleSendEmail(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: EmailHandlerOptions,
): Promise<void> {
  let body: unknown;
  try { body = await readJsonBody(req); }
  catch (err) {
    const msg = err instanceof Error ? err.message : "bad_body";
    if (msg === "payload_too_large") { respondJson(res, 413, { error: "payload_too_large" }); return; }
    respondJson(res, 400, { error: "bad_json" });
    return;
  }
  if (!body || typeof body !== "object") {
    respondJson(res, 400, { error: "bad_body" });
    return;
  }
  const to = (body as Record<string, unknown>).to;
  const subject = (body as Record<string, unknown>).subject;
  const text = (body as Record<string, unknown>).text;
  if (typeof to !== "string" || typeof subject !== "string" || typeof text !== "string" || !to || !subject || !text) {
    respondJson(res, 400, { error: "missing_fields", message: "to, subject, text required" });
    return;
  }

  if (opts.transport === "console") {
    console.log(`[notify-svc:email] To: ${to} | Subject: ${subject} | Text: ${text}`);
  }
  // noop transport: silently drop

  respondJson(res, 202, { accepted: true });
}
```

- [ ] **Step 8: Run, verify pass**

`pnpm test -- --run src/email-handlers.test.ts`. Expected: 6/6 pass.

- [ ] **Step 9: Modify notify-svc/src/server.ts to mount the new routes**

Read current `services/notify-svc/src/server.ts` (~30 lines, just /healthz). Replace the file with:

```typescript
import http from "node:http";
import type { AddressInfo } from "node:net";

import { loadEmailConfig } from "./email-config.js";
import { mountEmailRoutes, type EmailHandlerOptions } from "./email-handlers.js";

export interface StartOptions {
  port: number;
  service: string;
  emailEnv?: Record<string, string | undefined>;  // override for tests
}

export interface StartResult {
  server: http.Server;
  baseUrl: string;
}

export function startServer(opts: StartOptions): Promise<StartResult> {
  const emailConfig = loadEmailConfig(opts.emailEnv ?? process.env);
  const emailOpts: EmailHandlerOptions = { transport: emailConfig.transport };

  const server = http.createServer((req, res) => {
    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ service: opts.service, status: "ok" }));
      return;
    }
    if (mountEmailRoutes(req, res, emailOpts)) return;

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
  const port = Number(process.env.PORT ?? 7101);
  const cfg = loadEmailConfig(process.env);
  console.log(`notify-svc: email transport = ${cfg.transport}`);
  startServer({ port, service: "notify-svc" }).then(({ baseUrl }) => {
    console.log(`notify-svc listening on ${baseUrl}`);
  });
}
```

- [ ] **Step 10: Typecheck + run all notify-svc tests**

```bash
cd services/notify-svc && pnpm typecheck && pnpm test -- --run
```

Expected: typecheck clean. Tests: 1 pre-existing /healthz + 4 email-config + 6 email-handlers = 11/11 pass.

- [ ] **Step 11: Commit (notify-svc bundle)**

```bash
git add services/notify-svc/src/email-config.ts \
        services/notify-svc/src/email-config.test.ts \
        services/notify-svc/src/email-handlers.ts \
        services/notify-svc/src/email-handlers.test.ts \
        services/notify-svc/src/server.ts
git diff --cached --name-only
```

Confirm exactly those 5 files staged. Then:

```bash
git commit -m "$(cat <<'EOF'
feat(notify-svc): POST /v1/notifications/email with console + noop

Slice 2b transport substrate. EMAIL_TRANSPORT env (console default,
noop alternative) gates whether requests print [notify-svc:email]
envelopes to stdout or silently drop. Real SMTP/SES/Resend lands
in slice 2c. Endpoint enforces 64 KiB body cap, returns 405 on
non-POST, 400 on missing/invalid fields, 202 on accepted. 4 config
+ 6 handler tests green; existing /healthz test still green.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: integration-svc — magic-link-handlers (TDD against real Postgres + mock notify)

**Files:**
- Create: `services/integration-svc/src/auth/magic-link-handlers.ts`
- Create: `services/integration-svc/src/auth/magic-link-handlers.test.ts`

This is the largest task — 2 endpoints with full integration coverage. Library-mocking is NOT used here (no @simplewebauthn equivalent for magic links); the test stubs only the notify-client function so we don't need a live notify-svc.

- [ ] **Step 1: Write failing test**

Create `services/integration-svc/src/auth/magic-link-handlers.test.ts`:

```typescript
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
  await new Promise<void>((r) => server.listen(0, r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
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
  const c = await pool.connect();
  try { await c.query(`DELETE FROM magic_link_tokens WHERE tenant_id = $1`, [tenantId]); }
  finally { c.release(); }
});

describe("POST /v1/auth/magic-link/request", () => {
  it("returns 202 and triggers an email for an existing user", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/magic-link/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email }),
    });
    expect(res.status).toBe(202);
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
    // Default config: max=3 per window. 4th request should 429.
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
  });

  it("swallows notify-client errors and still returns 202", async () => {
    vi.mocked(opts.notifyClient.sendEmail).mockRejectedValueOnce(new Error("smtp down"));
    const res = await fetch(`${baseUrl}/v1/auth/magic-link/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email }),
    });
    expect(res.status).toBe(202);
  });
});

describe("GET /v1/auth/magic-link/consume", () => {
  async function issueToken(): Promise<string> {
    // Drive request through the public endpoint to mint a real token
    const res = await fetch(`${baseUrl}/v1/auth/magic-link/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email }),
    });
    expect(res.status).toBe(202);
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

    // Sanity: the new session token actually resolves via Sessions repo
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
```

- [ ] **Step 2: Run, verify failure**

```bash
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run src/auth/magic-link-handlers.test.ts
```

Expected: module-not-found.

- [ ] **Step 3: Implement magic-link-handlers.ts**

Create `services/integration-svc/src/auth/magic-link-handlers.ts`:

```typescript
import type http from "node:http";

import { generateToken, hashToken } from "./token.js";
import type { Sessions } from "./repo.js";
import type { MagicLinks } from "./magic-link-repo.js";
import type { RateLimit } from "./magic-link-rate-limit.js";
import type { MagicLinkConfig } from "./magic-link-config.js";
import type { NotifyClientConfig, SendEmailInput } from "./notify-client.js";

export interface NotifyClientLike {
  sendEmail(input: SendEmailInput, cfg: NotifyClientConfig): Promise<void>;
}

export interface MagicLinkHandlerOptions {
  sessions: Sessions;
  magicLinks: MagicLinks;
  rateLimit: RateLimit;
  notifyClient: NotifyClientLike;
  notifyConfig: NotifyClientConfig;
  config: MagicLinkConfig;
  sessionTtlSeconds: number;
}

const MAX_BODY_BYTES = 16 * 1024;

function respondJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
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
 * Returns true if the request matched a magic-link route (and was handled).
 * Returns false if no match — caller falls through.
 */
export function mountMagicLinkRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: MagicLinkHandlerOptions,
): boolean {
  const url = req.url ?? "";
  const method = req.method ?? "GET";

  if (url === "/v1/auth/magic-link/request") {
    if (method !== "POST") { respondJson(res, 405, { error: "method_not_allowed" }); return true; }
    void handleRequest(req, res, opts);
    return true;
  }
  if (url.startsWith("/v1/auth/magic-link/consume")) {
    if (method !== "GET") { respondJson(res, 405, { error: "method_not_allowed" }); return true; }
    void handleConsume(req, res, opts);
    return true;
  }
  return false;
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: MagicLinkHandlerOptions,
): Promise<void> {
  let body: unknown;
  try { body = await readJsonBody(req); }
  catch (err) {
    const msg = err instanceof Error ? err.message : "bad_body";
    if (msg === "payload_too_large") { respondJson(res, 413, { error: "payload_too_large" }); return; }
    respondJson(res, 400, { error: "bad_json" });
    return;
  }
  if (!body || typeof body !== "object") {
    respondJson(res, 400, { error: "bad_body" });
    return;
  }
  const tenantSlug = (body as Record<string, unknown>).tenant_slug;
  const userEmail = (body as Record<string, unknown>).email;
  if (typeof tenantSlug !== "string" || typeof userEmail !== "string" || !tenantSlug || !userEmail) {
    respondJson(res, 400, { error: "missing_fields", message: "tenant_slug and email required" });
    return;
  }

  const rateKey = `${tenantSlug}:${userEmail}`;
  if (!opts.rateLimit.check(rateKey)) {
    respondJson(res, 429, { error: "rate_limited", message: "too many requests; try again later" });
    return;
  }

  // Always reply 202 — never leak whether the user exists or whether the email succeeded.
  // Side effects below are best-effort; failures are logged but never propagate.
  res.writeHead(202, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ accepted: true }));

  try {
    const user = await opts.sessions.findUserByTenantSlugAndEmail(tenantSlug, userEmail);
    if (!user) return;  // Silent no-op for unknown user

    const token = generateToken();
    await opts.magicLinks.create({
      userId: user.userId,
      tenantId: user.tenantId,
      tokenHash: hashToken(token),
      ttlSeconds: opts.config.ttlSeconds,
    });

    const url = `${opts.config.baseUrl}?token=${token}`;
    const subject = `Sign in to Hydrax`;
    const text = `Click this link to sign in to Hydrax. It expires in ${Math.round(opts.config.ttlSeconds / 60)} minutes and can only be used once.\n\n${url}\n\nIf you did not request this, you can ignore this email.`;

    try {
      await opts.notifyClient.sendEmail({ to: userEmail, subject, text }, opts.notifyConfig);
    } catch (err) {
      console.error("integration-svc: magic-link notify-client failed:", err);
    }
  } catch (err) {
    console.error("integration-svc: magic-link/request side-effect failed:", err);
  }
}

async function handleConsume(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: MagicLinkHandlerOptions,
): Promise<void> {
  const url = new URL(req.url ?? "", "http://_");
  const token = url.searchParams.get("token");
  if (!token) {
    respondJson(res, 400, { error: "missing_token" });
    return;
  }

  try {
    const consumed = await opts.magicLinks.consume(hashToken(token));
    if (!consumed) {
      respondJson(res, 401, { error: "unauthenticated", message: "invalid, expired, or already-used token" });
      return;
    }

    const sessionToken = generateToken();
    const created = await opts.sessions.createSession({
      userId: consumed.userId,
      tenantId: consumed.tenantId,
      tokenHash: hashToken(sessionToken),
      ttlSeconds: opts.sessionTtlSeconds,
    });

    // Look up role for the response envelope (matches slice 1 + 2a session shape)
    const lookup = await opts.sessions.findActiveByTokenHash(hashToken(sessionToken));
    if (!lookup) {
      console.error("integration-svc: magic-link/consume freshly-created session not findable");
      respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
      return;
    }

    respondJson(res, 200, {
      token: sessionToken,
      session: {
        id: created.id,
        user_id: lookup.userId,
        tenant_id: lookup.tenantId,
        tenant_slug: lookup.tenantSlug,
        email: lookup.email,
        role: lookup.role,
        expires_at: created.expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("integration-svc: magic-link/consume handler:", err);
    respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
  }
}
```

- [ ] **Step 4: Run, verify pass**

```bash
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run src/auth/magic-link-handlers.test.ts
```

Expected: 11/11 pass (6 request + 5 consume).

(Commit deferred — bundles with Task 8.)

---

## Task 8: integration-svc — wire magic-link routes in server.ts

**Files:**
- Modify: `services/integration-svc/src/server.ts`

- [ ] **Step 1: Read current server.ts**

It currently mounts `mountAuthRoutes` (slice 1) and `mountPasskeyRoutes` (slice 2a). We add `mountMagicLinkRoutes` alongside.

- [ ] **Step 2: Modify server.ts**

Replace `services/integration-svc/src/server.ts` with:

```typescript
import http from "node:http";
import type { AddressInfo } from "node:net";

import { openPool, redactDsn, type Pool } from "./db.js";
import { mountAuthRoutes, type AuthHandlerOptions } from "./auth/handlers.js";
import { Sessions } from "./auth/repo.js";
import { Passkeys } from "./auth/passkey-repo.js";
import { createChallengeStore } from "./auth/challenge-store.js";
import { loadPasskeyConfig } from "./auth/passkey-config.js";
import { mountPasskeyRoutes, type PasskeyHandlerOptions } from "./auth/passkey-handlers.js";
import { MagicLinks } from "./auth/magic-link-repo.js";
import { createRateLimit } from "./auth/magic-link-rate-limit.js";
import { loadMagicLinkConfig } from "./auth/magic-link-config.js";
import { sendEmail } from "./auth/notify-client.js";
import { mountMagicLinkRoutes, type MagicLinkHandlerOptions } from "./auth/magic-link-handlers.js";

export interface StartOptions {
  port: number;
  service: string;
  pool?: Pool;
  devLoginEnabled?: boolean;
  ttlSeconds?: number;
  passkeyEnv?: Record<string, string | undefined>;
  magicLinkEnv?: Record<string, string | undefined>;
  notifySvcUrl?: string;
}

export interface StartResult {
  server: http.Server;
  baseUrl: string;
}

export function startServer(opts: StartOptions): Promise<StartResult> {
  const ttlSeconds = opts.ttlSeconds ?? 60 * 60 * 12;

  const authOpts: AuthHandlerOptions | null = opts.pool
    ? { repo: new Sessions(opts.pool), ttlSeconds, devLoginEnabled: opts.devLoginEnabled ?? false }
    : null;

  const passkeyOpts: PasskeyHandlerOptions | null = opts.pool
    ? {
        sessions: new Sessions(opts.pool),
        passkeys: new Passkeys(opts.pool),
        challenges: createChallengeStore({ ttlSeconds: 60, maxEntries: 10_000 }),
        config: loadPasskeyConfig(opts.passkeyEnv ?? process.env),
        sessionTtlSeconds: ttlSeconds,
      }
    : null;

  const magicLinkOpts: MagicLinkHandlerOptions | null = opts.pool
    ? (() => {
        const cfg = loadMagicLinkConfig(opts.magicLinkEnv ?? process.env);
        return {
          sessions: new Sessions(opts.pool!),
          magicLinks: new MagicLinks(opts.pool!),
          rateLimit: createRateLimit({
            max: cfg.rateLimitMax,
            windowSeconds: cfg.rateLimitWindowSeconds,
            maxBuckets: 10_000,
          }),
          notifyClient: { sendEmail },
          notifyConfig: { notifySvcUrl: opts.notifySvcUrl ?? process.env.NOTIFY_SVC_URL ?? "http://localhost:7101" },
          config: cfg,
          sessionTtlSeconds: ttlSeconds,
        };
      })()
    : null;

  const server = http.createServer((req, res) => {
    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ service: opts.service, status: "ok" }));
      return;
    }
    if (authOpts && mountAuthRoutes(req, res, authOpts)) return;
    if (passkeyOpts && mountPasskeyRoutes(req, res, passkeyOpts)) return;
    if (magicLinkOpts && mountMagicLinkRoutes(req, res, magicLinkOpts)) return;

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
      "integration-svc: INTEGRATION_SVC_DATABASE_URL/DATABASE_URL unset — auth + magic-link routes disabled, only /healthz served",
    );
  } else {
    console.log(`integration-svc: DB pool ready (${redactDsn(dsn)})`);
    if (!devLoginEnabled) {
      console.log("integration-svc: AUTH_DEV_LOGIN!=1 — dev/login disabled (returns 404)");
    }
    const passkey = loadPasskeyConfig(process.env);
    console.log(`integration-svc: passkey RP=${passkey.rpID}, origin=${passkey.origin}`);
    const ml = loadMagicLinkConfig(process.env);
    console.log(`integration-svc: magic-link TTL=${ml.ttlSeconds}s, rate=${ml.rateLimitMax}/${ml.rateLimitWindowSeconds}s, baseUrl=${ml.baseUrl}`);
    console.log(`integration-svc: notify-svc URL = ${process.env.NOTIFY_SVC_URL ?? "http://localhost:7101"}`);
  }

  startServer({ port, service: "integration-svc", pool, devLoginEnabled, ttlSeconds }).then(
    ({ baseUrl }) => {
      console.log(`integration-svc listening on ${baseUrl}`);
    },
  );
}
```

- [ ] **Step 3: Typecheck + run all integration-svc tests**

```bash
cd services/integration-svc && \
  INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm typecheck && \
  INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run
```

Expected: typecheck clean. Tests: prior 58 (slice 1 + 2a) + 10 magic-link-config + 5 rate-limit + 7 magic-link-repo + 4 notify-client + 11 magic-link-handlers = 95/95 pass.

- [ ] **Step 4: Commit (Tasks 7 + 8 bundled)**

```bash
git add services/integration-svc/src/auth/magic-link-handlers.ts \
        services/integration-svc/src/auth/magic-link-handlers.test.ts \
        services/integration-svc/src/server.ts
git diff --cached --name-only
```

Confirm exactly those 3 files staged. Then:

```bash
git commit -m "$(cat <<'EOF'
feat(integration-svc): wire magic-link request + consume endpoints

POST /v1/auth/magic-link/request — always returns 202 (no enumeration
leak), best-effort token mint + notify-client send, rate-limited per
(tenant_slug, email) at 3/15min. GET /v1/auth/magic-link/consume —
single-use atomic UPDATE-RETURNING, issues a real session via slice
1 Sessions on success, 401 on invalid/expired/used. server.ts wires
config + repo + rate-limit + notifyClient and logs config at boot.
11/11 handler tests + 84 prior tests = 95/95 green.

Slice 2b is server-side substrate. Production-ready bootstrap
requires slice 2c (real email transport) before AUTH_DEV_LOGIN
can come down.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: bff — magic-link-proxy + 2 unprotected routes (TDD)

**Files:**
- Create: `services/bff/src/auth/magic-link-proxy.ts`
- Create: `services/bff/src/auth/magic-link-proxy.test.ts`
- Modify: `services/bff/src/server.ts`
- Modify: `services/bff/src/server.test.ts`

- [ ] **Step 1: Write failing proxy test**

Create `services/bff/src/auth/magic-link-proxy.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import {
  proxyMagicLinkRequest,
  proxyMagicLinkConsume,
} from "./magic-link-proxy.js";

let upstream: http.Server;
let upstreamUrl: string;
let lastReq: { method?: string; url?: string; body?: string } = {};
let respond: (req: http.IncomingMessage, res: http.ServerResponse) => void;

beforeEach(async () => {
  lastReq = {};
  upstream = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      lastReq = { method: req.method, url: req.url, body };
      respond(req, res);
    });
  });
  await new Promise<void>((r) => upstream.listen(0, r));
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

afterEach(() => new Promise<void>((resolve) => upstream.close(() => resolve())));

describe("proxyMagicLinkRequest", () => {
  it("forwards body and resolves on 202", async () => {
    respond = (_req, res) => { res.writeHead(202).end(JSON.stringify({ accepted: true })); };
    await proxyMagicLinkRequest(
      { tenant_slug: "acme", email: "alice@acme.test" },
      { integrationSvcUrl: upstreamUrl },
    );
    expect(lastReq.method).toBe("POST");
    expect(lastReq.url).toBe("/v1/auth/magic-link/request");
    expect(JSON.parse(lastReq.body!)).toEqual({ tenant_slug: "acme", email: "alice@acme.test" });
  });

  it("throws AuthUpstreamError on 429 (rate-limited)", async () => {
    respond = (_req, res) => { res.writeHead(429).end(JSON.stringify({ error: "rate_limited" })); };
    await expect(
      proxyMagicLinkRequest({ tenant_slug: "x", email: "x@x.test" }, { integrationSvcUrl: upstreamUrl }),
    ).rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 429 });
  });
});

describe("proxyMagicLinkConsume", () => {
  it("forwards token query param and returns session result on 200", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        token: "T",
        session: { id: "s", user_id: "u", tenant_id: "t", tenant_slug: "acme", email: "a@a.test", role: "admin", expires_at: "2099-01-01T00:00:00Z" },
      }));
    };
    const result = await proxyMagicLinkConsume("the-token-bytes", { integrationSvcUrl: upstreamUrl });
    expect(lastReq.method).toBe("GET");
    expect(lastReq.url).toBe("/v1/auth/magic-link/consume?token=the-token-bytes");
    expect(result.token).toBe("T");
    expect(result.session.role).toBe("admin");
  });

  it("throws AuthUpstreamError on 401 (invalid/expired/used)", async () => {
    respond = (_req, res) => { res.writeHead(401).end(JSON.stringify({ error: "unauthenticated" })); };
    await expect(
      proxyMagicLinkConsume("bad", { integrationSvcUrl: upstreamUrl }),
    ).rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 401 });
  });

  it("throws AuthUpstreamError on 400 (missing token)", async () => {
    respond = (_req, res) => { res.writeHead(400).end(JSON.stringify({ error: "missing_token" })); };
    await expect(
      proxyMagicLinkConsume("", { integrationSvcUrl: upstreamUrl }),
    ).rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 400 });
  });

  it("URL-encodes the token query param", async () => {
    respond = (_req, res) => { res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ token: "x", session: { id: "s", user_id: "u", tenant_id: "t", tenant_slug: "a", email: "a@a.test", role: "admin", expires_at: "2099-01-01T00:00:00Z" } })); };
    await proxyMagicLinkConsume("a+b/c=d", { integrationSvcUrl: upstreamUrl });
    expect(lastReq.url).toBe("/v1/auth/magic-link/consume?token=a%2Bb%2Fc%3Dd");
  });
});
```

- [ ] **Step 2: Run, verify failure**

From `services/bff/`: `pnpm test -- --run src/auth/magic-link-proxy.test.ts`. Expected: module-not-found.

- [ ] **Step 3: Implement magic-link-proxy.ts**

Create `services/bff/src/auth/magic-link-proxy.ts`:

```typescript
import { AuthUpstreamError, type AuthUpstreamConfig } from "./proxy.js";

export interface MagicLinkRequestInput {
  tenant_slug: string;
  email: string;
}

export interface MagicLinkSessionResult {
  token: string;
  session: {
    id: string;
    user_id: string;
    tenant_id: string;
    tenant_slug: string;
    email: string;
    role: string;
    expires_at: string;
  };
}

export async function proxyMagicLinkRequest(
  input: MagicLinkRequestInput,
  cfg: AuthUpstreamConfig,
): Promise<void> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/magic-link/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new AuthUpstreamError(`magic_link_request: upstream ${res.status}: ${detail}`, res.status);
  }
}

export async function proxyMagicLinkConsume(
  token: string,
  cfg: AuthUpstreamConfig,
): Promise<MagicLinkSessionResult> {
  const url = `${cfg.integrationSvcUrl}/v1/auth/magic-link/consume?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new AuthUpstreamError(`magic_link_consume: upstream ${res.status}: ${detail}`, res.status);
  }
  return (await res.json()) as MagicLinkSessionResult;
}
```

- [ ] **Step 4: Run, verify pass**

`pnpm test -- --run src/auth/magic-link-proxy.test.ts`. Expected: 5/5 pass.

- [ ] **Step 5: Modify bff/src/server.ts to mount magic-link routes**

In `services/bff/src/server.ts`, add the import block at the top:

```typescript
import {
  proxyMagicLinkRequest,
  proxyMagicLinkConsume,
} from "./auth/magic-link-proxy.js";
```

Insert these 2 route blocks immediately after the existing 4 passkey routes (which were added in slice 2a) and BEFORE any protected routes:

```typescript
if (req.url === "/v1/auth/magic-link/request" && req.method === "POST") {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks);
  if (raw.length > 16 * 1024) { respondJson(res, 413, { error: "payload_too_large" }); return; }
  let body: unknown;
  try { body = JSON.parse(raw.toString("utf8")); }
  catch { respondJson(res, 400, { error: "bad_json" }); return; }
  if (typeof body !== "object" || body === null) { respondJson(res, 400, { error: "bad_body" }); return; }
  try {
    await proxyMagicLinkRequest(
      body as Parameters<typeof proxyMagicLinkRequest>[0],
      { integrationSvcUrl: upstreamConfig.integrationSvcUrl },
    );
    respondJson(res, 202, { accepted: true });
  } catch (err) {
    if (err instanceof AuthUpstreamError) {
      const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
      respondJson(res, status, { error: "auth_upstream", message: err.message });
    } else {
      console.error("bff: magic-link request:", err);
      respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
    }
  }
  return;
}

if (req.url?.startsWith("/v1/auth/magic-link/consume") && req.method === "GET") {
  const url = new URL(req.url, "http://_");
  const token = url.searchParams.get("token") ?? "";
  try {
    const result = await proxyMagicLinkConsume(token, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
    respondJson(res, 200, result);
  } catch (err) {
    if (err instanceof AuthUpstreamError) {
      const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
      respondJson(res, status, { error: "auth_upstream", message: err.message });
    } else {
      console.error("bff: magic-link consume:", err);
      respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
    }
  }
  return;
}
```

- [ ] **Step 6: Add server passthrough tests**

In `services/bff/src/server.test.ts`, the helper `startMockIntegrationSvc` was extended in slice 2a to accept an optional `routes?: Record<string, MockHandlerSpec>` map. Reuse it. Add at the end of the file:

```typescript
describe("magic-link routes proxy to integration-svc", () => {
  it("POST /v1/auth/magic-link/request forwards body and returns 202", async () => {
    const integrationSvc = await startMockIntegrationSvc({
      "POST /v1/auth/magic-link/request": { status: 202, body: { accepted: true } },
    });
    const workflowSvc = await startMockWorkflowSvc({});
    const bff = await startBffWithUpstream(workflowSvc.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/auth/magic-link/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_slug: "acme", email: "a@a.test" }),
      });
      expect(res.status).toBe(202);
      expect(integrationSvc.received[0]?.method).toBe("POST");
      expect(integrationSvc.received[0]?.url).toBe("/v1/auth/magic-link/request");
      expect(JSON.parse(integrationSvc.received[0]!.body)).toEqual({ tenant_slug: "acme", email: "a@a.test" });
    } finally {
      await bff.close();
      await workflowSvc.close();
      await integrationSvc.close();
    }
  });

  it("POST /v1/auth/magic-link/request relays 429 from upstream", async () => {
    const integrationSvc = await startMockIntegrationSvc({
      "POST /v1/auth/magic-link/request": { status: 429, body: { error: "rate_limited" } },
    });
    const workflowSvc = await startMockWorkflowSvc({});
    const bff = await startBffWithUpstream(workflowSvc.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/auth/magic-link/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_slug: "acme", email: "a@a.test" }),
      });
      expect(res.status).toBe(429);
    } finally {
      await bff.close();
      await workflowSvc.close();
      await integrationSvc.close();
    }
  });

  it("GET /v1/auth/magic-link/consume forwards token query and returns session", async () => {
    const integrationSvc = await startMockIntegrationSvc({
      "GET /v1/auth/magic-link/consume": {
        status: 200,
        body: { token: "T", session: { id: "s", user_id: "u", tenant_id: "tn", tenant_slug: "acme", email: "a@a.test", role: "admin", expires_at: "2099-01-01T00:00:00Z" } },
      },
    });
    const workflowSvc = await startMockWorkflowSvc({});
    const bff = await startBffWithUpstream(workflowSvc.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/auth/magic-link/consume?token=abc123`);
      expect(res.status).toBe(200);
      const body = await res.json() as { token: string };
      expect(body.token).toBe("T");
      expect(integrationSvc.received[0]?.url).toBe("/v1/auth/magic-link/consume?token=abc123");
    } finally {
      await bff.close();
      await workflowSvc.close();
      await integrationSvc.close();
    }
  });

  it("GET /v1/auth/magic-link/consume relays 401 on invalid token", async () => {
    const integrationSvc = await startMockIntegrationSvc({
      "GET /v1/auth/magic-link/consume": { status: 401, body: { error: "unauthenticated" } },
    });
    const workflowSvc = await startMockWorkflowSvc({});
    const bff = await startBffWithUpstream(workflowSvc.url, integrationSvc.url);
    try {
      const res = await fetch(`${bff.baseUrl}/v1/auth/magic-link/consume?token=bad`);
      expect(res.status).toBe(401);
    } finally {
      await bff.close();
      await workflowSvc.close();
      await integrationSvc.close();
    }
  });
});
```

- [ ] **Step 7: Typecheck + run all bff tests**

```bash
cd services/bff && pnpm typecheck && pnpm test -- --run
```

Expected: typecheck clean. Total bff tests = prior 73 (slice 1+2a) + 5 magic-link-proxy + 4 server passthroughs = 82/82 pass.

- [ ] **Step 8: Stage + commit**

```bash
git add services/bff/src/auth/magic-link-proxy.ts \
        services/bff/src/auth/magic-link-proxy.test.ts \
        services/bff/src/server.ts \
        services/bff/src/server.test.ts
git diff --cached --name-only
```

Confirm only those 4 files staged. Then:

```bash
git commit -m "$(cat <<'EOF'
feat(bff): proxy magic-link request + consume to integration-svc

2 routes — POST /v1/auth/magic-link/request (body forwarded, 202
response) and GET /v1/auth/magic-link/consume?token=... (token
query forwarded, returns session JSON or relays 4xx). Both
unprotected — magic-link IS the authentication path, no bearer
required at BFF layer. Reuses AuthUpstreamError + AuthUpstreamConfig
from slice 1. 5/5 proxy tests + 4/4 server passthroughs green.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: docs/env.md + STATE.yaml

**Files:**
- Modify: `docs/env.md`
- Modify: `STATE.yaml`

- [ ] **Step 1: Add slice 2b section to docs/env.md**

Read the current file first. Insert AFTER the "Auth Slice 2a — WebAuthn (Passkeys, server substrate)" section and BEFORE the "Deferred" section:

```markdown
### Auth Slice 2b — Magic-Link Enrollment (server substrate + console transport)

| Var | Service | Default | Purpose |
|---|---|---|---|
| `MAGIC_LINK_TTL_SECONDS` | integration-svc | `900` (15 min) | TTL for magic-link tokens. Range 60-3600. |
| `MAGIC_LINK_RATE_LIMIT_PER_WINDOW` | integration-svc | `3` | Max magic-link requests per (tenant_slug, email) per window. Range 1-10. |
| `MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS` | integration-svc | `900` (15 min) | Rate-limit window. Range 60-3600. |
| `MAGIC_LINK_BASE_URL` | integration-svc | `http://localhost:5173/auth/magic-link` | URL the email points at. The `?token=...` query param is appended. Production: must match the slice 2d portal route. |
| `EMAIL_TRANSPORT` | notify-svc | `console` | Email transport. Slice 2b ships `console` (logs to stdout) and `noop` (silently drops). Slice 2c will add `smtp` / `ses` / `resend`. |
| `NOTIFY_SVC_URL` | integration-svc | `http://localhost:7101` | Where integration-svc POSTs `/v1/notifications/email`. Already documented in the bff upstream URLs table — added here as the integration-svc consumer. |

**Slice 2b is server-side substrate + console-transport only.** Magic-link URLs are printed to `notify-svc` stdout when `EMAIL_TRANSPORT=console`; nothing reaches a real inbox. Production-ready bootstrap requires slice 2c (real email transport via SMTP / SES / Resend) before `AUTH_DEV_LOGIN=1` can come down (slice 2e).

**Email enumeration safety:** `POST /v1/auth/magic-link/request` always returns 202 regardless of whether the user exists. Send failures are swallowed and logged via `console.error` — they never surface to the requester. Rate-limit responses (HTTP 429) are the only non-202 success-path response.
```

- [ ] **Step 2: Update STATE.yaml**

Append to the `verification_log` (preserve all existing entries):

```yaml
  - "2026-04-26 — auth slice 2b (magic-link enrollment) implementation: 6 commits land the production-bootstrap path. Migration 0004 (magic_link_tokens with sha256 token_hash + atomic single-use UPDATE-RETURNING). integration-svc gains magic-link-config + rate-limit + repo (10+5+7 tests), notify-client (4 tests), magic-link-handlers (11 tests covering 202-no-leak, rate-limit 429, single-use, 401-on-replay), wired into server.ts. notify-svc gains email-config + email-handlers (4+6 tests) with EMAIL_TRANSPORT=console (stdout) and noop. bff gains magic-link-proxy (5 tests) + 2 unprotected routes + 4 server passthroughs. Total — integration-svc 95/95, notify-svc 11/11, bff 82/82. End-to-end CLI smoke verified (Task 11): curl POST /v1/auth/magic-link/request returns 202; notify-svc stdout shows '[notify-svc:email]' envelope with full magic-link URL; copy ?token=... value; curl GET /v1/auth/magic-link/consume returns session token + session JSON; whoami with that token returns role=admin session info. Slice 2b is server-side substrate + console transport — production passwordless login still requires slice 2c (SMTP/SES/Resend transport adapter). AUTH_DEV_LOGIN=1 stays untouched (slice 2e removal). Plan: docs/plans/2026-04-26-auth-slice-2b-magic-link.md."
```

Update `current_focus` (replace any prior slice-2a focus):

```yaml
current_focus:
  - Auth slice 2b (magic-link enrollment) implementation complete (6 commits). All 11 plan tasks executed; integration-svc 95/95, notify-svc 11/11, bff 82/82 tests green; typecheck clean across all three services; CLI end-to-end smoke green (request → console envelope → consume → whoami). Slice 2b is server-side substrate + console transport only — production passwordless login requires slice 2c (real email transport). AUTH_DEV_LOGIN=1 remains as a parallel bootstrap until slice 2e. Next decision: slice 2c (SMTP/SES/Resend transport adapter, unlocks production), slice 2d (portal UI consumes both passkey + magic-link endpoints), or pivot to a different Tier 1 area.
```

- [ ] **Step 3: Verify YAML still parses**

```bash
python3 -c "import yaml; yaml.safe_load(open('STATE.yaml')); print('YAML OK')"
```

Expected: `YAML OK`.

- [ ] **Step 4: Stage + commit**

```bash
git add docs/env.md STATE.yaml
git diff --cached --name-only
```

Confirm only those 2 files staged (path-scoped `git add` does not unstage prior parallel-session staging — run `git restore --staged <path>` for any leakage). Then:

```bash
git commit -m "$(cat <<'EOF'
chore(state): record auth slice 2b (magic-link substrate) closure

Documents MAGIC_LINK_TTL_SECONDS / RATE_LIMIT_PER_WINDOW /
RATE_LIMIT_WINDOW_SECONDS / BASE_URL + EMAIL_TRANSPORT in
docs/env.md with the slice-2b-is-not-production-ready
disclaimer (real SMTP/SES/Resend lands in slice 2c). STATE.yaml
verification log captures the 6-commit implementation, actual
test counts (95 integration-svc, 11 notify-svc, 82 bff), and
the CLI end-to-end smoke result.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: CLI end-to-end smoke (REQUIRED — slice closure gate)

**Files:** none (verification step)

Unlike slice 2a, slice 2b's closure gate is fully CLI-driveable — no browser ceremony required. The `console` transport prints the magic-link URL to stdout, which we extract with `tail` + `grep` and feed back into `curl`.

- [ ] **Step 1: Apply migration if not already applied (idempotency check)**

```bash
PGPASSWORD=hydrax psql -h localhost -p 5433 -U hydrax -d hydrax \
  -c "SELECT to_regclass('public.magic_link_tokens');"
```

Expected: returns `magic_link_tokens` (table exists). If `null`, run Task 1 Step 2 first.

- [ ] **Step 2: Seed a tenant + user**

```bash
PGPASSWORD=hydrax psql -h localhost -p 5433 -U hydrax -d hydrax <<SQL
INSERT INTO tenants (slug, name, persona) VALUES ('ml-smoke', 'ml-smoke', 'issuer') ON CONFLICT (slug) DO NOTHING;
INSERT INTO users (tenant_id, email, role) SELECT id, 'ml@example.test', 'admin' FROM tenants WHERE slug = 'ml-smoke' ON CONFLICT (tenant_id, email) DO NOTHING;
SELECT t.slug, u.email, u.role FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE t.slug = 'ml-smoke';
SQL
```

Expected: 1 row showing `ml-smoke | ml@example.test | admin`.

- [ ] **Step 3: Start notify-svc (capture stdout to a tail-able file)**

```bash
# Terminal 1 — notify-svc
cd services/notify-svc
EMAIL_TRANSPORT=console PORT=7101 pnpm dev 2>&1 | tee /tmp/notify-svc.log
```

Wait for: `notify-svc: email transport = console` and `notify-svc listening on http://...`.

- [ ] **Step 4: Start integration-svc**

```bash
# Terminal 2 — integration-svc
cd services/integration-svc
DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
NOTIFY_SVC_URL=http://localhost:7101 \
PORT=7102 \
  pnpm dev
```

Wait for: `integration-svc: magic-link TTL=900s, rate=3/900s, baseUrl=http://localhost:5173/auth/magic-link` and `integration-svc listening on http://...`.

- [ ] **Step 5: Start bff**

```bash
# Terminal 3 — bff
cd services/bff
INTEGRATION_SVC_URL=http://localhost:7102 PORT=8080 pnpm dev
```

Wait for: `bff listening on http://...`.

- [ ] **Step 6: Request a magic link**

```bash
curl -i -X POST http://localhost:8080/v1/auth/magic-link/request \
  -H "content-type: application/json" \
  -d '{"tenant_slug":"ml-smoke","email":"ml@example.test"}'
```

Expected: `HTTP/1.1 202 Accepted` and body `{"accepted":true}`.

- [ ] **Step 7: Read the magic-link URL from notify-svc stdout**

```bash
grep -o 'http://localhost:5173/auth/magic-link?token=[A-Za-z0-9_-]*' /tmp/notify-svc.log | tail -1
```

Expected: one URL like `http://localhost:5173/auth/magic-link?token=AbCdEf...` (43-char token).

Capture the token query value:

```bash
TOKEN=$(grep -o 'token=[A-Za-z0-9_-]*' /tmp/notify-svc.log | tail -1 | cut -d= -f2)
echo "TOKEN length: ${#TOKEN}"
```

Expected: `TOKEN length: 43`.

- [ ] **Step 8: Consume the token**

```bash
curl -s "http://localhost:8080/v1/auth/magic-link/consume?token=$TOKEN" | python3 -m json.tool
```

Expected: 200 response with shape:
```json
{
  "token": "<43-char base64url>",
  "session": {
    "id": "<uuid>",
    "user_id": "<uuid>",
    "tenant_id": "<uuid>",
    "tenant_slug": "ml-smoke",
    "email": "ml@example.test",
    "role": "admin",
    "expires_at": "<ISO timestamp ~12h from now>"
  }
}
```

- [ ] **Step 9: Verify the issued session works via /whoami**

```bash
SESSION_TOKEN=$(curl -s "http://localhost:8080/v1/auth/magic-link/consume?token=$TOKEN" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")
# Note: the token from Step 8 is already used; this re-consume will 401 — that's expected.
# Use the token captured during Step 8 instead. Better:

# (Alternative) re-issue and consume in one pipeline:
curl -s -X POST http://localhost:8080/v1/auth/magic-link/request \
  -H "content-type: application/json" \
  -d '{"tenant_slug":"ml-smoke","email":"ml@example.test"}' >/dev/null
sleep 0.2
NEW_TOKEN=$(grep -o 'token=[A-Za-z0-9_-]*' /tmp/notify-svc.log | tail -1 | cut -d= -f2)
SESSION_TOKEN=$(curl -s "http://localhost:8080/v1/auth/magic-link/consume?token=$NEW_TOKEN" | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
curl -s -H "authorization: Bearer $SESSION_TOKEN" http://localhost:8080/v1/auth/whoami | python3 -m json.tool
```

Expected: 200 with full session info — `role: "admin"`, `tenant_slug: "ml-smoke"`, `email: "ml@example.test"`.

- [ ] **Step 10: Verify single-use rejection**

```bash
# Attempt to re-consume the already-used token from Step 9
curl -s -w "\nHTTP %{http_code}\n" "http://localhost:8080/v1/auth/magic-link/consume?token=$NEW_TOKEN"
```

Expected: `{"error":"auth_upstream","message":"magic_link_consume: upstream 401: ..."}` and `HTTP 401`.

- [ ] **Step 11: Verify rate-limit (after 3 requests, the 4th 429s)**

```bash
for i in 1 2 3 4; do
  echo "--- request $i ---"
  curl -s -w "HTTP %{http_code}\n" -X POST http://localhost:8080/v1/auth/magic-link/request \
    -H "content-type: application/json" \
    -d '{"tenant_slug":"ml-smoke","email":"ml@example.test"}'
done
```

Expected: requests 1-3 return `HTTP 202`, request 4 returns `HTTP 429`. (If you already exhausted the bucket during steps 6+9, restart integration-svc to reset the in-process rate-limit state.)

- [ ] **Step 12: Cleanup**

```bash
PGPASSWORD=hydrax psql -h localhost -p 5433 -U hydrax -d hydrax -c "
  DELETE FROM magic_link_tokens WHERE tenant_id IN (SELECT id FROM tenants WHERE slug='ml-smoke');
  DELETE FROM user_sessions WHERE tenant_id IN (SELECT id FROM tenants WHERE slug='ml-smoke');
  DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE slug='ml-smoke');
  DELETE FROM tenants WHERE slug='ml-smoke';
"
```

Stop the three dev processes (Ctrl+C in each terminal). Remove `/tmp/notify-svc.log` if you want a clean slate.

- [ ] **Step 13: Record smoke result in STATE.yaml**

If steps 6-11 all passed, the `verification_log` entry from Task 10 already states this. If anything failed, debug before declaring slice closure. Most likely failure modes:
- Port already in use → check `lsof -ti :7101 :7102 :8080` and kill stale processes
- Migration not applied → run Task 1 Step 2
- Notify-svc not actually printing → confirm `EMAIL_TRANSPORT=console` env in Terminal 1 startup log
- 401 on first consume → token mid-flight expired (TTL too short) or seed user/tenant missing

If the manual smoke FAILS, the slice is NOT done — debug the integration before declaring closure. Most likely failure mode beyond port collisions: integration-svc started before notify-svc was reachable, in which case `integration-svc: notify-svc URL = ...` line printed at boot might be wrong. Restart integration-svc.

---

## Acceptance Criteria — when slice 2b is "done"

- [ ] All 11 tasks above checked off
- [ ] `pnpm -r --if-present typecheck && pnpm -r --if-present test -- --run && pnpm -r --if-present build` green at repo root (with `INTEGRATION_SVC_DATABASE_URL` set)
- [ ] `db/postgres/apply.sh` from a fresh DB applies 0001 + 0002 + 0003 + 0004 cleanly
- [ ] CLI end-to-end smoke (Task 11): **request → console envelope → consume → session token → /whoami** all green
- [ ] Single-use enforced: second consume of same token returns 401 (covered by `magic-link-handlers.test.ts` test "returns 401 on second consume of the same token")
- [ ] Rate-limit enforced: 4th request in window returns 429 (covered by `magic-link-handlers.test.ts` test "rate-limits after the configured max requests")
- [ ] No-leak enforced: unknown user → 202 with no email side-effect (covered by `magic-link-handlers.test.ts` test "returns 202 for an unknown user but does NOT send an email")
- [ ] STATE.yaml verification_log entry covers all the above
- [ ] 6 commits on the branch (or main): migration / integration-svc supporting modules / integration-svc notify-client / notify-svc bundle / integration-svc handlers + server / bff bundle / docs+state
- [ ] env.md documents the 5 new vars with production caveats
- [ ] Disclaimer is prominent: slice 2b is server-side substrate + console transport only

## Slice trigger — open after slice 2b lands

After slice 2b lands, the user picks slice 2c (real email transport — SMTP / SES / Resend) OR slice 2d (portal UI consuming both passkey + magic-link endpoints) as the next decision point. Recommended order: 2c first (so production has a real email path) → 2d (portal UI to make all of this user-facing) → 2e (remove AUTH_DEV_LOGIN now that real bootstrap exists).

---

## Self-Review Notes (already applied)

- ✓ **Spec coverage:** every component in the user's spec (DB → repo → handlers → server wire → notify-svc transport → bff proxy → bff wire → docs + state + smoke) has dedicated tasks. CLI smoke is its own task to ensure it isn't skipped.
- ✓ **Placeholder scan:** no TODOs / "implement later" / "fill in details". Every step has actual code or actual commands. The Task 9 server.ts modify uses an "insert these blocks" pattern matching how slice 2a's plan handled the same file — verbatim code blocks, not "do similar to existing routes."
- ✓ **Type consistency:** `MagicLinkConfig` (4 fields) is referenced consistently across config / rate-limit / handlers / server. `MagicLinks` repo class name + `create` / `consume` method signatures match across repo / handlers / server. `RateLimit` interface + `check(key)` signature match across rate-limit / handlers / server. `NotifyClientLike` (handler-side) lines up with `sendEmail` (notify-client-side). `MagicLinkSessionResult` (BFF proxy) lines up with the JSON envelope `handleConsume` writes (`{token, session: {id, user_id, tenant_id, tenant_slug, email, role, expires_at}}`).
- ✓ **Cross-slice consistency:** session token shape / hashing / TTL match slice 1 exactly. Error envelope shape `{error: "...", message?: "..."}` matches slice 1 + 2a. Body cap (16 KiB on integration-svc, 64 KiB on notify-svc) matches slice 1 + 2a. Mount-route function shape `(req, res, opts) => boolean` mirrors `mountAuthRoutes` + `mountPasskeyRoutes`. The 2 BFF routes mount BEFORE protected routes for correct match precedence — same pattern slice 2a used.
- ✓ **No mocked libraries:** unlike slice 2a (which had to mock @simplewebauthn/server because real ceremonies need a browser), slice 2b uses no third-party crypto library. The notify-client is stubbed in handler tests via a thin interface (`NotifyClientLike`) — that's a test seam, not a library mock. CLI smoke is the closure gate AND covers what the unit tests cannot reach.
- ✓ **YAGNI honored:** no SMTP/SES/Resend (slice 2c). No portal UI (slice 2d). No AUTH_DEV_LOGIN removal (slice 2e). No HTML email templates. No magic-link enrollment for non-existing users. No cross-instance rate-limit. No per-IP rate-limit (per-key only). No api-client browser helpers.
