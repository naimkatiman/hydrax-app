# Auth Slice 2a — WebAuthn Passkey Server Substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WebAuthn (passkey) registration and authentication endpoints to integration-svc, proxied through bff, so a browser can register a passkey credential and then authenticate with that credential to obtain a session token (consuming the slice 1 Sessions repo).

**Architecture:** Use `@simplewebauthn/server` v10+ to handle all FIDO2/WebAuthn cryptography. Persist credentials in a new `user_passkeys` table (multi-credential per user). Challenges are held in an in-process LRU with 60-second TTL — no cross-request session is required because the registration/auth ceremonies are short-lived (browser-server round-trip). Auth flow uses the **allowList pattern** (two-step: client posts email → server returns credential IDs + challenge → client signs → server verifies). Successful authentication issues a session token via the existing `Sessions` repo from slice 1.

**Tech Stack:** PostgreSQL 16 (existing), Node 20 + TypeScript (integration-svc + bff), `@simplewebauthn/server` v10 (FIDO2 lib, well-maintained, MIT-licensed), `pg` (existing), vitest. NO browser-side `@simplewebauthn/browser` in this slice — that ships with slice 2d (UI).

---

## ⚠️ Production-Readiness Disclaimer (read this first)

**Slice 2a does NOT enable production passkey usage.** It ships the server-side substrate, but a brand-new user has no way to register their first credential without one of:

- `AUTH_DEV_LOGIN=1` (the slice 1 dev gate, NEVER set in prod)
- An admin out-of-band creating a session for them
- Slice 2b (magic-link enrollment bootstrap) — a separate plan

Slice 2a is shippable as a **prototype** flow only. To enable production, ship slice 2b first or document an admin-bootstrap procedure. Do not let "passkeys ship!" be misread as "production auth ready."

---

## Decision Log (read before changing scope)

- **Library:** `@simplewebauthn/server` v10. Vendor-neutral, well-tested, supports allowList + discoverable, handles attestation parsing, COSE keys, and counter validation. Don't reinvent.
- **Auth pattern:** allowList (two-step). Client provides email; server looks up user, fetches their credentials, returns options with `allowCredentials` populated. Simpler tenant model, simpler tests, fits institutional UX. Discoverable credentials (passkey-only, no email step) is a slice 2d UX choice.
- **Multiple credentials per user:** Schema keyed on `credential_id`, not on `user_id`. Code paths support N credentials. UI to list/remove ships with slice 2d.
- **Counter check:** `incoming_counter > stored_counter` rejects replay. Apple passkeys do not increment (counter stays at 0); both-zero is also accepted. Reject `incoming_counter < stored_counter` AND reject `incoming_counter == stored_counter` UNLESS both are zero. This is a non-optional security invariant.
- **Challenge storage:** In-process LRU keyed by `userId` (registration) or `tenantId+email` (authentication, since the user is unauthenticated at challenge issue). 60-second TTL. Capacity 10,000 entries. If the integration-svc instance restarts mid-ceremony, the user retries — acceptable. If we ever scale to multiple instances, swap LRU for the `webauthn_challenges` table; stub the interface so the swap is one file.
- **RP ID across portal subdomains:** Deferred-not-resolved. Passkeys are scoped to RP ID (e.g., `hydrax.com` covers `*.hydrax.com` per RFC; or each portal could have its own). For dev, RP ID is `localhost`. Production RP ID is a deployment decision tied to the design partner's domain — picked when slice 2d portal-specific UX work happens. Document the constraint in env.md.
- **Testing strategy:** Mock `@simplewebauthn/server`'s `verifyRegistrationResponse` and `verifyAuthenticationResponse` in unit tests. Test the wiring (correct args passed, correct outputs persisted, counter monotonicity, error masking). The library itself is well-tested upstream. End-to-end ceremony correctness (real browser → real server) is verified ONCE manually before slice closure (steps in Task 13) and then continuously via slice 2d Playwright.
- **No `@simplewebauthn/browser` in this slice.** The api-client browser helpers ship with slice 2d when the UI consumes them.
- **No credential removal/revocation endpoint.** Out of scope. A user without a credential can't call a "remove credential" endpoint anyway. Slice 2d adds a UI for managing credentials, with a separate endpoint plan.
- **No tenant-aware RP ID.** Slice 2a hardcodes ONE RP ID per integration-svc instance via env var. Multi-tenant RP IDs ship with slice 2d's deployment plan if needed.

---

## File Structure

**New files (12):**

- `db/postgres/migrations/0003_passkeys.sql` — `user_passkeys` table
- `services/integration-svc/src/auth/challenge-store.ts` — in-process LRU
- `services/integration-svc/src/auth/challenge-store.test.ts`
- `services/integration-svc/src/auth/passkey-repo.ts` — Postgres repo for credentials
- `services/integration-svc/src/auth/passkey-repo.test.ts`
- `services/integration-svc/src/auth/passkey-handlers.ts` — 4 HTTP handlers
- `services/integration-svc/src/auth/passkey-handlers.test.ts`
- `services/integration-svc/src/auth/passkey-config.ts` — RP config from env
- `services/integration-svc/src/auth/passkey-config.test.ts`
- `services/bff/src/auth/passkey-proxy.ts` — 4 proxy functions
- `services/bff/src/auth/passkey-proxy.test.ts`

**Modified files (5):**

- `services/integration-svc/package.json` — add `@simplewebauthn/server`
- `services/integration-svc/src/auth/handlers.ts` — extend `mountAuthRoutes` to also mount passkey routes (or add new `mountPasskeyRoutes` exported separately — implementer's call, see Task 8)
- `services/integration-svc/src/server.ts` — wire passkey routes + read RP env vars
- `services/bff/src/server.ts` — mount 4 unprotected passkey routes
- `services/bff/src/server.test.ts` — add 4 mock-upstream test cases for passkey passthrough
- `docs/env.md` — document `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_CHALLENGE_TTL_SECONDS`
- `STATE.yaml` — verification log

**Anti-scope (do not touch in this slice):**

- ❌ Magic-link enrollment (slice 2b)
- ❌ Email service / transport (slice 2c)
- ❌ Portal UI: login screen, register screen, credential manager (slice 2d)
- ❌ `@simplewebauthn/browser` integration in api-client (slice 2d)
- ❌ Credential removal / rename endpoints (slice 2d follow-up)
- ❌ Discoverable credentials / conditional UI (slice 2d UX)
- ❌ Tenant-aware RP ID dispatch (deployment decision)
- ❌ `webauthn_challenges` table (only needed when integration-svc scales to multiple instances)
- ❌ Recovery / fallback flows (separate plan)
- ❌ Attestation verification beyond library default (`attestationType: "none"` is fine for slice 2a)
- ❌ Cross-origin support (RP ID + Origin are single-valued in slice 2a)

---

## Required Reading Before Implementing

- [docs/plans/2026-04-25-auth-foundation.md](2026-04-25-auth-foundation.md) — slice 1 plan (substrate consumed by this slice)
- [services/integration-svc/src/auth/repo.ts](../../services/integration-svc/src/auth/repo.ts) — `Sessions` class (this slice issues sessions via it)
- [services/integration-svc/src/auth/handlers.ts](../../services/integration-svc/src/auth/handlers.ts) — `mountAuthRoutes` pattern (this slice extends it)
- [services/integration-svc/src/auth/token.ts](../../services/integration-svc/src/auth/token.ts) — `generateToken` / `hashToken` (this slice reuses them for session issuance)
- [services/bff/src/server.ts](../../services/bff/src/server.ts) — mount-route pattern (this slice adds 4 unprotected routes)
- [services/bff/src/auth/proxy.ts](../../services/bff/src/auth/proxy.ts) — `AuthUpstreamError` + proxy pattern (this slice adds 4 more proxies)
- [@simplewebauthn/server v10 README](https://simplewebauthn.dev/docs/packages/server) — library API; in particular `generateRegistrationOptions`, `verifyRegistrationResponse`, `generateAuthenticationOptions`, `verifyAuthenticationResponse`

---

## Task 1: Migration 0003 — user_passkeys table

**Files:**
- Create: `db/postgres/migrations/0003_passkeys.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0003_passkeys.sql
-- WebAuthn (passkey) credentials. Multi-credential per user — code paths
-- and indexes assume a user can register N passkeys (e.g., laptop + phone).
-- Slice 2a: server-side substrate only. Slice 2d adds UI for managing
-- these credentials.

CREATE TABLE user_passkeys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id   BYTEA NOT NULL,
    public_key      BYTEA NOT NULL,
    counter         BIGINT NOT NULL DEFAULT 0,
    transports      TEXT[] NOT NULL DEFAULT '{}',
    aaguid          UUID,
    nickname        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_user_passkeys_credential_id ON user_passkeys (credential_id);
CREATE INDEX idx_user_passkeys_user ON user_passkeys (user_id);
```

- [ ] **Step 2: Apply against local Postgres**

```bash
PGPASSWORD=hydrax psql -h localhost -p 5433 -U hydrax -d hydrax \
  -v ON_ERROR_STOP=1 -f db/postgres/migrations/0003_passkeys.sql
```
Expected: `CREATE TABLE`, `CREATE INDEX`, `CREATE INDEX`. Exit 0.

- [ ] **Step 3: Verify schema with psql**

```bash
PGPASSWORD=hydrax psql -h localhost -p 5433 -U hydrax -d hydrax -c "\d user_passkeys"
```
Expected: 9 columns including `credential_id BYTEA NOT NULL` and `transports TEXT[] NOT NULL DEFAULT '{}'`; 3 indexes (PK + unique credential_id + user index).

- [ ] **Step 4: Commit**

```bash
git add db/postgres/migrations/0003_passkeys.sql
git commit -m "$(cat <<'EOF'
feat(db): add user_passkeys table for WebAuthn credentials

Slice 2a substrate. Multi-credential per user (BYTEA credential_id is
unique key, not user_id). Counter is BIGINT for replay-resistance
across long-lived passkeys. Transports + aaguid + nickname columns
support the slice 2d credential-manager UI.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: integration-svc — add @simplewebauthn/server dep

**Files:**
- Modify: `services/integration-svc/package.json`

- [ ] **Step 1: Add the dep**

From `services/integration-svc/`:
```bash
pnpm add @simplewebauthn/server
```

Expected: `package.json` gains `"@simplewebauthn/server": "^10.x.x"` (or whatever the current major is) under `dependencies`. Lockfile updates at repo root.

- [ ] **Step 2: Typecheck**

Run from `services/integration-svc/`: `pnpm typecheck`. Expected: clean.

- [ ] **Step 3: Commit (deferred — bundles with Tasks 3-5)**

Hold this commit; bundle with the next 3 tasks.

---

## Task 3: integration-svc — passkey config (TDD)

**Files:**
- Create: `services/integration-svc/src/auth/passkey-config.ts`
- Create: `services/integration-svc/src/auth/passkey-config.test.ts`

- [ ] **Step 1: Write failing test**

Create `services/integration-svc/src/auth/passkey-config.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { loadPasskeyConfig } from "./passkey-config.js";

describe("loadPasskeyConfig", () => {
  it("returns localhost defaults when env is empty", () => {
    const cfg = loadPasskeyConfig({});
    expect(cfg).toEqual({
      rpID: "localhost",
      rpName: "Hydrax",
      origin: "http://localhost:5173",
      challengeTtlSeconds: 60,
    });
  });

  it("reads WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME, WEBAUTHN_ORIGIN", () => {
    const cfg = loadPasskeyConfig({
      WEBAUTHN_RP_ID: "hydrax.com",
      WEBAUTHN_RP_NAME: "Hydrax Platform",
      WEBAUTHN_ORIGIN: "https://issuer.hydrax.com",
    });
    expect(cfg.rpID).toBe("hydrax.com");
    expect(cfg.rpName).toBe("Hydrax Platform");
    expect(cfg.origin).toBe("https://issuer.hydrax.com");
  });

  it("reads WEBAUTHN_CHALLENGE_TTL_SECONDS", () => {
    const cfg = loadPasskeyConfig({ WEBAUTHN_CHALLENGE_TTL_SECONDS: "120" });
    expect(cfg.challengeTtlSeconds).toBe(120);
  });

  it("rejects WEBAUTHN_CHALLENGE_TTL_SECONDS < 30", () => {
    expect(() => loadPasskeyConfig({ WEBAUTHN_CHALLENGE_TTL_SECONDS: "5" }))
      .toThrow(/must be >= 30/);
  });

  it("rejects WEBAUTHN_CHALLENGE_TTL_SECONDS > 300", () => {
    expect(() => loadPasskeyConfig({ WEBAUTHN_CHALLENGE_TTL_SECONDS: "999" }))
      .toThrow(/must be <= 300/);
  });
});
```

- [ ] **Step 2: Run, verify failure**

`pnpm test -- --run src/auth/passkey-config.test.ts`. Expected: module-not-found.

- [ ] **Step 3: Implement passkey-config.ts**

Create `services/integration-svc/src/auth/passkey-config.ts`:

```typescript
export interface PasskeyConfig {
  rpID: string;
  rpName: string;
  origin: string;
  challengeTtlSeconds: number;
}

export function loadPasskeyConfig(env: Record<string, string | undefined>): PasskeyConfig {
  const ttlRaw = env.WEBAUTHN_CHALLENGE_TTL_SECONDS;
  let challengeTtlSeconds = 60;
  if (ttlRaw !== undefined && ttlRaw !== "") {
    const parsed = Number(ttlRaw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new Error(`WEBAUTHN_CHALLENGE_TTL_SECONDS must be a positive integer, got ${ttlRaw}`);
    }
    if (parsed < 30) throw new Error(`WEBAUTHN_CHALLENGE_TTL_SECONDS must be >= 30 (got ${parsed})`);
    if (parsed > 300) throw new Error(`WEBAUTHN_CHALLENGE_TTL_SECONDS must be <= 300 (got ${parsed})`);
    challengeTtlSeconds = parsed;
  }

  return {
    rpID: env.WEBAUTHN_RP_ID || "localhost",
    rpName: env.WEBAUTHN_RP_NAME || "Hydrax",
    origin: env.WEBAUTHN_ORIGIN || "http://localhost:5173",
    challengeTtlSeconds,
  };
}
```

- [ ] **Step 4: Run, verify pass**

`pnpm test -- --run src/auth/passkey-config.test.ts`. Expected: 5/5 pass.

(Commit deferred — bundles with Tasks 4-5.)

---

## Task 4: integration-svc — challenge store (TDD)

**Files:**
- Create: `services/integration-svc/src/auth/challenge-store.ts`
- Create: `services/integration-svc/src/auth/challenge-store.test.ts`

- [ ] **Step 1: Write failing test**

Create `services/integration-svc/src/auth/challenge-store.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChallengeStore, type ChallengeStore } from "./challenge-store.js";

describe("ChallengeStore", () => {
  let store: ChallengeStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = createChallengeStore({ ttlSeconds: 60, maxEntries: 5 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves a challenge", () => {
    store.put("user-1", "challenge-abc");
    expect(store.consume("user-1")).toBe("challenge-abc");
  });

  it("consume removes the entry (one-time use)", () => {
    store.put("user-1", "challenge-abc");
    expect(store.consume("user-1")).toBe("challenge-abc");
    expect(store.consume("user-1")).toBeNull();
  });

  it("returns null for unknown key", () => {
    expect(store.consume("nope")).toBeNull();
  });

  it("expires entry after ttlSeconds", () => {
    store.put("user-1", "challenge-abc");
    vi.advanceTimersByTime(61_000);
    expect(store.consume("user-1")).toBeNull();
  });

  it("evicts oldest when capacity exceeded", () => {
    store.put("a", "1");
    store.put("b", "2");
    store.put("c", "3");
    store.put("d", "4");
    store.put("e", "5");
    store.put("f", "6"); // evicts "a"
    expect(store.consume("a")).toBeNull();
    expect(store.consume("f")).toBe("6");
  });

  it("overwrites existing key without growing size", () => {
    for (let i = 0; i < 5; i++) store.put(`k${i}`, `v${i}`);
    store.put("k0", "v0-new");
    expect(store.consume("k0")).toBe("v0-new");
    expect(store.consume("k4")).toBe("v4");
  });
});
```

- [ ] **Step 2: Run, verify failure**

`pnpm test -- --run src/auth/challenge-store.test.ts`. Expected: module-not-found.

- [ ] **Step 3: Implement challenge-store.ts**

Create `services/integration-svc/src/auth/challenge-store.ts`:

```typescript
export interface ChallengeStoreOptions {
  ttlSeconds: number;
  maxEntries: number;
}

export interface ChallengeStore {
  put(key: string, challenge: string): void;
  consume(key: string): string | null;
}

interface Entry {
  challenge: string;
  expiresAt: number;
}

export function createChallengeStore(opts: ChallengeStoreOptions): ChallengeStore {
  // Insertion-ordered Map preserves LRU semantics: oldest entries are first
  // in iteration order. We re-insert on overwrite to keep ordering correct.
  const entries = new Map<string, Entry>();
  const ttlMs = opts.ttlSeconds * 1000;

  function evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.expiresAt > now) break;  // Map iteration is insertion-ordered
      entries.delete(key);
    }
  }

  return {
    put(key, challenge) {
      evictExpired();
      if (entries.has(key)) entries.delete(key);  // re-insert to refresh ordering
      entries.set(key, { challenge, expiresAt: Date.now() + ttlMs });
      while (entries.size > opts.maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    consume(key) {
      evictExpired();
      const entry = entries.get(key);
      if (!entry) return null;
      entries.delete(key);
      return entry.challenge;
    },
  };
}
```

- [ ] **Step 4: Run, verify pass**

`pnpm test -- --run src/auth/challenge-store.test.ts`. Expected: 6/6 pass.

(Commit deferred — bundles with Task 5.)

---

## Task 5: integration-svc — passkey repo (TDD)

**Files:**
- Create: `services/integration-svc/src/auth/passkey-repo.ts`
- Create: `services/integration-svc/src/auth/passkey-repo.test.ts`

- [ ] **Step 1: Write failing test**

Create `services/integration-svc/src/auth/passkey-repo.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run, verify failure**

```bash
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run src/auth/passkey-repo.test.ts
```
Expected: module-not-found.

- [ ] **Step 3: Implement passkey-repo.ts**

Create `services/integration-svc/src/auth/passkey-repo.ts`:

```typescript
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
```

- [ ] **Step 4: Run, verify pass**

```bash
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run src/auth/passkey-repo.test.ts
```
Expected: 9/9 pass.

- [ ] **Step 5: Commit (Tasks 2-5 bundled)**

```bash
git add services/integration-svc/package.json \
        services/integration-svc/src/auth/passkey-config.ts \
        services/integration-svc/src/auth/passkey-config.test.ts \
        services/integration-svc/src/auth/challenge-store.ts \
        services/integration-svc/src/auth/challenge-store.test.ts \
        services/integration-svc/src/auth/passkey-repo.ts \
        services/integration-svc/src/auth/passkey-repo.test.ts \
        pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(integration-svc): passkey config + challenge store + repo

@simplewebauthn/server@^10 added. PasskeyConfig reads RP_ID/RP_NAME/
ORIGIN from env (localhost defaults). ChallengeStore is an
insertion-ordered Map LRU with 60s default TTL and 10k cap (single
integration-svc instance for now; swap for table when scaling
horizontally). Passkeys repo supports multi-credential per user with
counter monotonicity check (rejects replay; both-zero accepted for
Apple). 5/5 config + 6/6 challenge + 9/9 repo tests green.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: integration-svc — passkey HTTP handlers (TDD)

**Files:**
- Create: `services/integration-svc/src/auth/passkey-handlers.ts`
- Create: `services/integration-svc/src/auth/passkey-handlers.test.ts`

This task is the largest — 4 endpoints with library-mocked tests for ceremony verification.

- [ ] **Step 1: Write failing test**

Create `services/integration-svc/src/auth/passkey-handlers.test.ts`:

```typescript
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { openPool, type Pool } from "../db.js";
import { Sessions } from "./repo.js";
import { Passkeys } from "./passkey-repo.js";
import { createChallengeStore } from "./challenge-store.js";
import { mountPasskeyRoutes, type PasskeyHandlerOptions } from "./passkey-handlers.js";

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

import * as webauthn from "@simplewebauthn/server";

const dsn = process.env.INTEGRATION_SVC_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dsn) throw new Error("INTEGRATION_SVC_DATABASE_URL or DATABASE_URL must be set");

let pool: Pool;
let server: http.Server;
let baseUrl: string;
let opts: PasskeyHandlerOptions;

const tenantSlug = `pkh-${randomBytes(8).toString("hex")}`;
const email = `pkh-${randomBytes(8).toString("hex")}@example.test`;
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
  const passkeys = new Passkeys(pool);
  const challenges = createChallengeStore({ ttlSeconds: 60, maxEntries: 100 });
  opts = {
    sessions,
    passkeys,
    challenges,
    config: { rpID: "localhost", rpName: "Hydrax", origin: "http://localhost:5173", challengeTtlSeconds: 60 },
    sessionTtlSeconds: 3600,
  };

  server = http.createServer((req, res) => {
    if (!mountPasskeyRoutes(req, res, opts)) res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  const c = await pool.connect();
  try {
    await c.query(`DELETE FROM user_passkeys WHERE user_id = $1`, [userId]);
    await c.query(`DELETE FROM user_sessions WHERE tenant_id = $1`, [tenantId]);
    await c.query(`DELETE FROM users WHERE tenant_id = $1`, [tenantId]);
    await c.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
  } finally { c.release(); await pool.end(); }
});

afterEach(async () => {
  vi.clearAllMocks();
  const c = await pool.connect();
  try { await c.query(`DELETE FROM user_passkeys WHERE user_id = $1`, [userId]); }
  finally { c.release(); }
});

describe("POST /v1/auth/passkeys/register/options", () => {
  it("returns options for a known user (existing session)", async () => {
    // Issue a real session via the slice 1 Sessions repo
    const sessions = new Sessions(pool);
    const tokenHash = Buffer.from("test-token-hash-for-options".padEnd(32, "x"));
    await sessions.createSession({ userId, tenantId, tokenHash, ttlSeconds: 60 });

    vi.mocked(webauthn.generateRegistrationOptions).mockResolvedValue({
      challenge: "registration-challenge-base64",
      rp: { id: "localhost", name: "Hydrax" },
      user: { id: "user-id-bytes", name: email, displayName: email },
      pubKeyCredParams: [],
      timeout: 60000,
      attestation: "none",
    } as unknown as Awaited<ReturnType<typeof webauthn.generateRegistrationOptions>>);

    const res = await fetch(`${baseUrl}/v1/auth/passkeys/register/options`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenHash.toString("base64url")}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { challenge: string };
    expect(body.challenge).toBe("registration-challenge-base64");
    expect(webauthn.generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({ rpID: "localhost", rpName: "Hydrax", userName: email }),
    );
  });

  it("returns 401 when no session bearer is present", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/passkeys/register/options`, { method: "POST" });
    expect(res.status).toBe(401);
  });
});

describe("POST /v1/auth/passkeys/register/verify", () => {
  it("persists credential when verification succeeds", async () => {
    const sessions = new Sessions(pool);
    const passkeys = new Passkeys(pool);

    // Pre-stash a challenge for this user
    opts.challenges.put(`reg:${userId}`, "stored-challenge");

    // Issue a session
    const tokenHash = Buffer.from("test-token-verify-reg".padEnd(32, "x"));
    await sessions.createSession({ userId, tenantId, tokenHash, ttlSeconds: 60 });

    const credentialId = randomBytes(32);
    const publicKey = randomBytes(77);
    vi.mocked(webauthn.verifyRegistrationResponse).mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: credentialId.toString("base64url"),
          publicKey,
          counter: 0,
          transports: ["internal"],
        },
        aaguid: "00000000-0000-0000-0000-000000000000",
      },
    } as unknown as Awaited<ReturnType<typeof webauthn.verifyRegistrationResponse>>);

    const res = await fetch(`${baseUrl}/v1/auth/passkeys/register/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenHash.toString("base64url")}` },
      body: JSON.stringify({ response: { /* opaque WebAuthn response */ } }),
    });
    expect(res.status).toBe(200);

    const list = await passkeys.listByUserId(userId);
    expect(list).toHaveLength(1);
    expect(list[0]!.credentialId.equals(credentialId)).toBe(true);
    expect(list[0]!.publicKey.equals(publicKey)).toBe(true);
  });

  it("returns 400 when verification fails", async () => {
    const sessions = new Sessions(pool);
    opts.challenges.put(`reg:${userId}`, "stored-challenge");
    const tokenHash = Buffer.from("test-token-verify-fail".padEnd(32, "x"));
    await sessions.createSession({ userId, tenantId, tokenHash, ttlSeconds: 60 });

    vi.mocked(webauthn.verifyRegistrationResponse).mockResolvedValue({
      verified: false,
    } as unknown as Awaited<ReturnType<typeof webauthn.verifyRegistrationResponse>>);

    const res = await fetch(`${baseUrl}/v1/auth/passkeys/register/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenHash.toString("base64url")}` },
      body: JSON.stringify({ response: {} }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when challenge has been consumed (one-time)", async () => {
    const sessions = new Sessions(pool);
    const tokenHash = Buffer.from("test-token-no-chal".padEnd(32, "x"));
    await sessions.createSession({ userId, tenantId, tokenHash, ttlSeconds: 60 });

    const res = await fetch(`${baseUrl}/v1/auth/passkeys/register/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenHash.toString("base64url")}` },
      body: JSON.stringify({ response: {} }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /v1/auth/passkeys/auth/options", () => {
  it("returns options with allowCredentials populated", async () => {
    const passkeys = new Passkeys(pool);
    const credentialId = randomBytes(32);
    await passkeys.create({ userId, credentialId, publicKey: randomBytes(77), counter: 5, transports: ["internal"], aaguid: null, nickname: null });

    vi.mocked(webauthn.generateAuthenticationOptions).mockResolvedValue({
      challenge: "auth-challenge-base64",
      rpId: "localhost",
      timeout: 60000,
      allowCredentials: [{ id: credentialId.toString("base64url"), transports: ["internal"] }],
      userVerification: "preferred",
    } as unknown as Awaited<ReturnType<typeof webauthn.generateAuthenticationOptions>>);

    const res = await fetch(`${baseUrl}/v1/auth/passkeys/auth/options`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { challenge: string; allowCredentials: unknown[] };
    expect(body.challenge).toBe("auth-challenge-base64");
    expect(body.allowCredentials).toHaveLength(1);
  });

  it("returns 404 when user has no credentials", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/passkeys/auth/options`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown user (no leak: same status as zero-credential user)", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/passkeys/auth/options`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: "nope", email: "nope@x.test" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for missing fields", async () => {
    const res = await fetch(`${baseUrl}/v1/auth/passkeys/auth/options`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /v1/auth/passkeys/auth/verify", () => {
  it("issues session token on successful verification + counter update", async () => {
    const passkeys = new Passkeys(pool);
    const credentialId = randomBytes(32);
    const publicKey = randomBytes(77);
    await passkeys.create({ userId, credentialId, publicKey, counter: 5, transports: [], aaguid: null, nickname: null });
    opts.challenges.put(`auth:${tenantSlug}:${email}`, "stored-auth-challenge");

    vi.mocked(webauthn.verifyAuthenticationResponse).mockResolvedValue({
      verified: true,
      authenticationInfo: {
        credentialID: credentialId.toString("base64url"),
        newCounter: 6,
        userVerified: true,
      },
    } as unknown as Awaited<ReturnType<typeof webauthn.verifyAuthenticationResponse>>);

    const res = await fetch(`${baseUrl}/v1/auth/passkeys/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenant_slug: tenantSlug,
        email,
        response: { id: credentialId.toString("base64url") },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { token: string; session: { user_id: string; role: string } };
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.session.user_id).toBe(userId);
    expect(body.session.role).toBe("admin");

    const found = await passkeys.findByCredentialId(credentialId);
    expect(found!.counter).toBe(6);
  });

  it("returns 401 when verification fails", async () => {
    const passkeys = new Passkeys(pool);
    const credentialId = randomBytes(32);
    await passkeys.create({ userId, credentialId, publicKey: randomBytes(77), counter: 5, transports: [], aaguid: null, nickname: null });
    opts.challenges.put(`auth:${tenantSlug}:${email}`, "stored-auth-challenge");

    vi.mocked(webauthn.verifyAuthenticationResponse).mockResolvedValue({
      verified: false,
    } as unknown as Awaited<ReturnType<typeof webauthn.verifyAuthenticationResponse>>);

    const res = await fetch(`${baseUrl}/v1/auth/passkeys/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email, response: { id: credentialId.toString("base64url") } }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when counter monotonicity check fails (replay)", async () => {
    const passkeys = new Passkeys(pool);
    const credentialId = randomBytes(32);
    await passkeys.create({ userId, credentialId, publicKey: randomBytes(77), counter: 10, transports: [], aaguid: null, nickname: null });
    opts.challenges.put(`auth:${tenantSlug}:${email}`, "stored-auth-challenge");

    vi.mocked(webauthn.verifyAuthenticationResponse).mockResolvedValue({
      verified: true,
      authenticationInfo: {
        credentialID: credentialId.toString("base64url"),
        newCounter: 5,  // less than stored 10
        userVerified: true,
      },
    } as unknown as Awaited<ReturnType<typeof webauthn.verifyAuthenticationResponse>>);

    const res = await fetch(`${baseUrl}/v1/auth/passkeys/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email, response: { id: credentialId.toString("base64url") } }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when challenge has been consumed", async () => {
    const passkeys = new Passkeys(pool);
    const credentialId = randomBytes(32);
    await passkeys.create({ userId, credentialId, publicKey: randomBytes(77), counter: 5, transports: [], aaguid: null, nickname: null });

    const res = await fetch(`${baseUrl}/v1/auth/passkeys/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email, response: { id: credentialId.toString("base64url") } }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run src/auth/passkey-handlers.test.ts
```
Expected: module-not-found.

- [ ] **Step 3: Implement passkey-handlers.ts**

Create `services/integration-svc/src/auth/passkey-handlers.ts`:

```typescript
import type http from "node:http";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

import { generateToken, hashToken } from "./token.js";
import type { Sessions } from "./repo.js";
import type { Passkeys } from "./passkey-repo.js";
import type { ChallengeStore } from "./challenge-store.js";
import type { PasskeyConfig } from "./passkey-config.js";

export interface PasskeyHandlerOptions {
  sessions: Sessions;
  passkeys: Passkeys;
  challenges: ChallengeStore;
  config: PasskeyConfig;
  sessionTtlSeconds: number;
}

const MAX_BODY_BYTES = 64 * 1024;  // WebAuthn responses can be larger than auth bodies

function respondJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function bearerFrom(req: http.IncomingMessage): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+([A-Za-z0-9_-]+)$/.exec(h);
  return m ? (m[1] ?? null) : null;
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
 * Returns true if the request matched a passkey route (and was handled).
 * Returns false if no match — caller falls through.
 */
export function mountPasskeyRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: PasskeyHandlerOptions,
): boolean {
  const url = req.url ?? "";
  const method = req.method ?? "GET";

  if (url === "/v1/auth/passkeys/register/options") {
    if (method !== "POST") { respondJson(res, 405, { error: "method_not_allowed" }); return true; }
    void handleRegisterOptions(req, res, opts);
    return true;
  }
  if (url === "/v1/auth/passkeys/register/verify") {
    if (method !== "POST") { respondJson(res, 405, { error: "method_not_allowed" }); return true; }
    void handleRegisterVerify(req, res, opts);
    return true;
  }
  if (url === "/v1/auth/passkeys/auth/options") {
    if (method !== "POST") { respondJson(res, 405, { error: "method_not_allowed" }); return true; }
    void handleAuthOptions(req, res, opts);
    return true;
  }
  if (url === "/v1/auth/passkeys/auth/verify") {
    if (method !== "POST") { respondJson(res, 405, { error: "method_not_allowed" }); return true; }
    void handleAuthVerify(req, res, opts);
    return true;
  }
  return false;
}

/**
 * Resolves the calling user from the bearer token. Returns the user info or
 * null after writing 401. Used by both register endpoints (require existing
 * session as bootstrap).
 */
async function resolveSessionUser(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: PasskeyHandlerOptions,
): Promise<{ userId: string; tenantId: string; email: string } | null> {
  const token = bearerFrom(req);
  if (!token) {
    respondJson(res, 401, { error: "unauthenticated" });
    return null;
  }
  const session = await opts.sessions.findActiveByTokenHash(hashToken(token));
  if (!session) {
    respondJson(res, 401, { error: "unauthenticated" });
    return null;
  }
  return { userId: session.userId, tenantId: session.tenantId, email: session.email };
}

async function handleRegisterOptions(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: PasskeyHandlerOptions,
): Promise<void> {
  const user = await resolveSessionUser(req, res, opts);
  if (!user) return;
  try {
    const existing = await opts.passkeys.listByUserId(user.userId);
    const options = await generateRegistrationOptions({
      rpName: opts.config.rpName,
      rpID: opts.config.rpID,
      userName: user.email,
      userDisplayName: user.email,
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId.toString("base64url"),
        transports: c.transports as ("ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb")[],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });
    opts.challenges.put(`reg:${user.userId}`, options.challenge);
    respondJson(res, 200, options);
  } catch (err) {
    console.error("integration-svc: register/options handler:", err);
    respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
  }
}

async function handleRegisterVerify(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: PasskeyHandlerOptions,
): Promise<void> {
  const user = await resolveSessionUser(req, res, opts);
  if (!user) return;

  let body: unknown;
  try { body = await readJsonBody(req); }
  catch (err) {
    const msg = err instanceof Error ? err.message : "bad_body";
    if (msg === "payload_too_large") { respondJson(res, 413, { error: "payload_too_large" }); return; }
    respondJson(res, 400, { error: "bad_json" }); return;
  }
  if (!body || typeof body !== "object") { respondJson(res, 400, { error: "bad_body" }); return; }
  const response = (body as Record<string, unknown>).response;
  if (!response || typeof response !== "object") {
    respondJson(res, 400, { error: "missing_fields", message: "response required" });
    return;
  }

  const challenge = opts.challenges.consume(`reg:${user.userId}`);
  if (!challenge) {
    respondJson(res, 400, { error: "challenge_expired", message: "no challenge for this user — request fresh options" });
    return;
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
      expectedChallenge: challenge,
      expectedOrigin: opts.config.origin,
      expectedRPID: opts.config.rpID,
      requireUserVerification: false,
    });
    if (!verification.verified || !verification.registrationInfo) {
      respondJson(res, 400, { error: "verification_failed" });
      return;
    }
    const info = verification.registrationInfo;
    const credentialIdBytes = Buffer.from(info.credential.id, "base64url");
    const publicKeyBytes = Buffer.from(info.credential.publicKey);

    await opts.passkeys.create({
      userId: user.userId,
      credentialId: credentialIdBytes,
      publicKey: publicKeyBytes,
      counter: info.credential.counter,
      transports: info.credential.transports ?? [],
      aaguid: info.aaguid && info.aaguid !== "00000000-0000-0000-0000-000000000000" ? info.aaguid : null,
      nickname: null,
    });
    respondJson(res, 200, { verified: true });
  } catch (err) {
    console.error("integration-svc: register/verify handler:", err);
    respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
  }
}

async function handleAuthOptions(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: PasskeyHandlerOptions,
): Promise<void> {
  let body: unknown;
  try { body = await readJsonBody(req); }
  catch (err) {
    const msg = err instanceof Error ? err.message : "bad_body";
    if (msg === "payload_too_large") { respondJson(res, 413, { error: "payload_too_large" }); return; }
    respondJson(res, 400, { error: "bad_json" }); return;
  }
  if (!body || typeof body !== "object") { respondJson(res, 400, { error: "bad_body" }); return; }
  const tenantSlug = (body as Record<string, unknown>).tenant_slug;
  const email = (body as Record<string, unknown>).email;
  if (typeof tenantSlug !== "string" || typeof email !== "string" || !tenantSlug || !email) {
    respondJson(res, 400, { error: "missing_fields", message: "tenant_slug and email required" });
    return;
  }

  try {
    const user = await opts.sessions.findUserByTenantSlugAndEmail(tenantSlug, email);
    if (!user) { respondJson(res, 404, { error: "not_found" }); return; }
    const credentials = await opts.passkeys.listByUserId(user.userId);
    if (credentials.length === 0) {
      // Same status as unknown-user to avoid email enumeration
      respondJson(res, 404, { error: "not_found" });
      return;
    }
    const options = await generateAuthenticationOptions({
      rpID: opts.config.rpID,
      allowCredentials: credentials.map((c) => ({
        id: c.credentialId.toString("base64url"),
        transports: c.transports as ("ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb")[],
      })),
      userVerification: "preferred",
    });
    opts.challenges.put(`auth:${tenantSlug}:${email}`, options.challenge);
    respondJson(res, 200, options);
  } catch (err) {
    console.error("integration-svc: auth/options handler:", err);
    respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
  }
}

async function handleAuthVerify(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: PasskeyHandlerOptions,
): Promise<void> {
  let body: unknown;
  try { body = await readJsonBody(req); }
  catch (err) {
    const msg = err instanceof Error ? err.message : "bad_body";
    if (msg === "payload_too_large") { respondJson(res, 413, { error: "payload_too_large" }); return; }
    respondJson(res, 400, { error: "bad_json" }); return;
  }
  if (!body || typeof body !== "object") { respondJson(res, 400, { error: "bad_body" }); return; }
  const tenantSlug = (body as Record<string, unknown>).tenant_slug;
  const email = (body as Record<string, unknown>).email;
  const response = (body as Record<string, unknown>).response;
  if (typeof tenantSlug !== "string" || typeof email !== "string" || !response || typeof response !== "object") {
    respondJson(res, 400, { error: "missing_fields", message: "tenant_slug, email, response required" });
    return;
  }

  const challenge = opts.challenges.consume(`auth:${tenantSlug}:${email}`);
  if (!challenge) {
    respondJson(res, 400, { error: "challenge_expired" });
    return;
  }

  try {
    const credentialId = (response as { id?: unknown }).id;
    if (typeof credentialId !== "string") {
      respondJson(res, 400, { error: "bad_response" });
      return;
    }
    const credentialIdBytes = Buffer.from(credentialId, "base64url");
    const stored = await opts.passkeys.findByCredentialId(credentialIdBytes);
    if (!stored) { respondJson(res, 401, { error: "unauthenticated" }); return; }

    // Ensure stored credential belongs to the (tenant, email) pair claimed
    const claimedUser = await opts.sessions.findUserByTenantSlugAndEmail(tenantSlug, email);
    if (!claimedUser || claimedUser.userId !== stored.userId) {
      respondJson(res, 401, { error: "unauthenticated" });
      return;
    }

    const verification = await verifyAuthenticationResponse({
      response: response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
      expectedChallenge: challenge,
      expectedOrigin: opts.config.origin,
      expectedRPID: opts.config.rpID,
      credential: {
        id: credentialId,
        publicKey: new Uint8Array(stored.publicKey),
        counter: stored.counter,
        transports: stored.transports as ("ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb")[],
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      respondJson(res, 401, { error: "unauthenticated" });
      return;
    }

    // Counter monotonicity check via repo (atomic UPDATE)
    const counterOk = await opts.passkeys.updateCounter(credentialIdBytes, verification.authenticationInfo.newCounter);
    if (!counterOk) {
      respondJson(res, 401, { error: "unauthenticated", message: "counter check failed" });
      return;
    }

    // Issue a session token via the slice 1 Sessions repo
    const token = generateToken();
    const created = await opts.sessions.createSession({
      userId: stored.userId,
      tenantId: claimedUser.tenantId,
      tokenHash: hashToken(token),
      ttlSeconds: opts.sessionTtlSeconds,
    });
    respondJson(res, 200, {
      token,
      session: {
        id: created.id,
        user_id: stored.userId,
        tenant_id: claimedUser.tenantId,
        role: claimedUser.role,
        expires_at: created.expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("integration-svc: auth/verify handler:", err);
    respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
  }
}
```

- [ ] **Step 4: Run, verify pass**

```bash
INTEGRATION_SVC_DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
  pnpm test -- --run src/auth/passkey-handlers.test.ts
```
Expected: 12/12 pass.

(Commit deferred — bundles with Task 7.)

---

## Task 7: integration-svc — wire passkey routes in server.ts

**Files:**
- Modify: `services/integration-svc/src/server.ts`

- [ ] **Step 1: Read current server.ts**

It currently mounts auth routes via `mountAuthRoutes` and falls through to 404. We add passkey routes alongside.

- [ ] **Step 2: Modify server.ts**

Replace the relevant sections of `services/integration-svc/src/server.ts`:

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

export interface StartOptions {
  port: number;
  service: string;
  pool?: Pool;
  devLoginEnabled?: boolean;
  ttlSeconds?: number;
  passkeyEnv?: Record<string, string | undefined>;  // override for tests
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

  const server = http.createServer((req, res) => {
    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ service: opts.service, status: "ok" }));
      return;
    }
    if (authOpts && mountAuthRoutes(req, res, authOpts)) return;
    if (passkeyOpts && mountPasskeyRoutes(req, res, passkeyOpts)) return;

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
    const cfg = loadPasskeyConfig(process.env);
    console.log(`integration-svc: passkey RP=${cfg.rpID}, origin=${cfg.origin}`);
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
  pnpm typecheck && pnpm test -- --run
```
Expected: typecheck clean. Tests: token 7 + repo 7 + handlers 10 + passkey-config 5 + challenge-store 6 + passkey-repo 9 + passkey-handlers 12 + server 1 = 57/57 pass.

- [ ] **Step 4: Commit (Tasks 6+7 bundled)**

```bash
git add services/integration-svc/src/auth/passkey-handlers.ts \
        services/integration-svc/src/auth/passkey-handlers.test.ts \
        services/integration-svc/src/server.ts
git commit -m "$(cat <<'EOF'
feat(integration-svc): wire WebAuthn passkey endpoints

4 routes: register/options + register/verify (require existing session
bootstrap), auth/options + auth/verify (unauthenticated, allowList
pattern). Issues sessions via slice 1 Sessions repo on successful
authentication. Counter monotonicity enforced atomically in repo.
12/12 passkey-handlers tests + 33 prior tests = 45/45 green
(library mocked for unit tests; manual browser smoke deferred to
slice-2a closure step + Playwright E2E in slice 2d).

Slice 2a is server-side substrate ONLY — production passkey
enrollment requires slice 2b (magic-link) since the bootstrap path
is currently AUTH_DEV_LOGIN-gated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: bff — passkey proxy module (TDD)

**Files:**
- Create: `services/bff/src/auth/passkey-proxy.ts`
- Create: `services/bff/src/auth/passkey-proxy.test.ts`

- [ ] **Step 1: Write failing test**

Create `services/bff/src/auth/passkey-proxy.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import {
  proxyPasskeyRegisterOptions,
  proxyPasskeyRegisterVerify,
  proxyPasskeyAuthOptions,
  proxyPasskeyAuthVerify,
  AuthUpstreamError,
} from "./proxy.js";  // Note: passkey proxies live in passkey-proxy.ts but share AuthUpstreamError from proxy.ts

import {
  proxyPasskeyRegisterOptions as registerOptionsImpl,
  proxyPasskeyRegisterVerify as registerVerifyImpl,
  proxyPasskeyAuthOptions as authOptionsImpl,
  proxyPasskeyAuthVerify as authVerifyImpl,
} from "./passkey-proxy.js";

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

describe("proxyPasskeyRegisterOptions", () => {
  it("forwards bearer and returns options", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ challenge: "C", rp: { id: "localhost", name: "Hydrax" } }));
    };
    const result = await registerOptionsImpl("T", { integrationSvcUrl: upstreamUrl });
    expect(lastReq.url).toBe("/v1/auth/passkeys/register/options");
    expect(lastReq.method).toBe("POST");
    expect(lastReq.auth).toBe("Bearer T");
    expect(result.challenge).toBe("C");
  });

  it("throws AuthUpstreamError on 401", async () => {
    respond = (_req, res) => { res.writeHead(401).end(JSON.stringify({ error: "unauthenticated" })); };
    await expect(registerOptionsImpl("bad", { integrationSvcUrl: upstreamUrl }))
      .rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 401 });
  });
});

describe("proxyPasskeyRegisterVerify", () => {
  it("forwards bearer + body and returns verification result", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ verified: true }));
    };
    const result = await registerVerifyImpl({ response: { id: "x" } }, "T", { integrationSvcUrl: upstreamUrl });
    expect(lastReq.url).toBe("/v1/auth/passkeys/register/verify");
    expect(lastReq.auth).toBe("Bearer T");
    expect(JSON.parse(lastReq.body!)).toEqual({ response: { id: "x" } });
    expect(result.verified).toBe(true);
  });
});

describe("proxyPasskeyAuthOptions", () => {
  it("forwards body (no bearer) and returns options", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ challenge: "C", allowCredentials: [{ id: "abc" }] }));
    };
    const result = await authOptionsImpl({ tenant_slug: "t", email: "e@x.test" }, { integrationSvcUrl: upstreamUrl });
    expect(lastReq.url).toBe("/v1/auth/passkeys/auth/options");
    expect(lastReq.auth).toBeUndefined();
    expect(JSON.parse(lastReq.body!)).toEqual({ tenant_slug: "t", email: "e@x.test" });
    expect(result.challenge).toBe("C");
  });

  it("throws AuthUpstreamError with 404 status (no leak distinction)", async () => {
    respond = (_req, res) => { res.writeHead(404).end(JSON.stringify({ error: "not_found" })); };
    await expect(authOptionsImpl({ tenant_slug: "t", email: "e@x.test" }, { integrationSvcUrl: upstreamUrl }))
      .rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 404 });
  });
});

describe("proxyPasskeyAuthVerify", () => {
  it("forwards body (no bearer) and returns session token on success", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ token: "T", session: { id: "s", user_id: "U", tenant_id: "X", role: "admin", expires_at: "2030-01-01T00:00:00Z" } }));
    };
    const result = await authVerifyImpl({ tenant_slug: "t", email: "e@x.test", response: { id: "abc" } }, { integrationSvcUrl: upstreamUrl });
    expect(lastReq.url).toBe("/v1/auth/passkeys/auth/verify");
    expect(lastReq.auth).toBeUndefined();
    expect(result.token).toBe("T");
  });

  it("throws AuthUpstreamError on 401", async () => {
    respond = (_req, res) => { res.writeHead(401).end(JSON.stringify({ error: "unauthenticated" })); };
    await expect(authVerifyImpl({ tenant_slug: "t", email: "e@x.test", response: { id: "abc" } }, { integrationSvcUrl: upstreamUrl }))
      .rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 401 });
  });
});
```

- [ ] **Step 2: Run, verify failure**

`cd services/bff && pnpm test -- --run src/auth/passkey-proxy.test.ts`. Expected: module-not-found.

- [ ] **Step 3: Implement passkey-proxy.ts**

Create `services/bff/src/auth/passkey-proxy.ts`:

```typescript
import { AuthUpstreamError, type AuthUpstreamConfig } from "./proxy.js";

export interface PasskeyOptionsBody {
  challenge: string;
  [key: string]: unknown;  // remainder is library-defined and forwarded as-is to browser
}

export interface PasskeyAuthOptionsBody extends PasskeyOptionsBody {
  allowCredentials?: Array<{ id: string; transports?: string[] }>;
}

export interface AuthOptionsInput {
  tenant_slug: string;
  email: string;
}

export interface AuthVerifyInput {
  tenant_slug: string;
  email: string;
  response: Record<string, unknown>;
}

export interface RegisterVerifyInput {
  response: Record<string, unknown>;
}

export interface VerifyResult {
  verified: boolean;
}

export interface SessionResult {
  token: string;
  session: {
    id: string;
    user_id: string;
    tenant_id: string;
    role: string;
    expires_at: string;
  };
}

async function readJsonOrThrow(res: Response, errLabel: string): Promise<unknown> {
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new AuthUpstreamError(`${errLabel}: upstream ${res.status}: ${detail}`, res.status);
  }
  return res.json();
}

export async function proxyPasskeyRegisterOptions(
  token: string,
  cfg: AuthUpstreamConfig,
): Promise<PasskeyOptionsBody> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/passkeys/register/options`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  return (await readJsonOrThrow(res, "passkey_register_options")) as PasskeyOptionsBody;
}

export async function proxyPasskeyRegisterVerify(
  input: RegisterVerifyInput,
  token: string,
  cfg: AuthUpstreamConfig,
): Promise<VerifyResult> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/passkeys/register/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  return (await readJsonOrThrow(res, "passkey_register_verify")) as VerifyResult;
}

export async function proxyPasskeyAuthOptions(
  input: AuthOptionsInput,
  cfg: AuthUpstreamConfig,
): Promise<PasskeyAuthOptionsBody> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/passkeys/auth/options`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await readJsonOrThrow(res, "passkey_auth_options")) as PasskeyAuthOptionsBody;
}

export async function proxyPasskeyAuthVerify(
  input: AuthVerifyInput,
  cfg: AuthUpstreamConfig,
): Promise<SessionResult> {
  const res = await fetch(`${cfg.integrationSvcUrl}/v1/auth/passkeys/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await readJsonOrThrow(res, "passkey_auth_verify")) as SessionResult;
}
```

- [ ] **Step 4: Adjust the test imports**

The test imports `from "./proxy.js"` for `AuthUpstreamError`. That's intentional — the error type is shared. Drop the duplicate `AuthUpstreamError` import that the test sample shows; the test should:

```typescript
// at top of passkey-proxy.test.ts:
import {
  proxyPasskeyRegisterOptions,
  proxyPasskeyRegisterVerify,
  proxyPasskeyAuthOptions,
  proxyPasskeyAuthVerify,
} from "./passkey-proxy.js";
```

(Just the 4 functions; `AuthUpstreamError` shape is asserted via `.toMatchObject({ name: "AuthUpstreamError", httpStatus: 401 })`.)

- [ ] **Step 5: Run, verify pass**

`pnpm test -- --run src/auth/passkey-proxy.test.ts`. Expected: 6/6 pass.

(Commit deferred — bundles with Task 9.)

---

## Task 9: bff — wire passkey routes in server.ts

**Files:**
- Modify: `services/bff/src/server.ts`
- Modify: `services/bff/src/server.test.ts`

- [ ] **Step 1: Read current bff server.ts**

It has 3 auth routes (dev/login, whoami, logout) and 12 protected routes. Add 4 passkey routes — all UNPROTECTED (no requireSession), since they handle authentication themselves.

- [ ] **Step 2: Add passkey routes to server.ts**

Add 4 new route blocks BEFORE the protected routes (to be matched before any catch-all):

```typescript
// Add to imports:
import {
  proxyPasskeyAuthOptions,
  proxyPasskeyAuthVerify,
  proxyPasskeyRegisterOptions,
  proxyPasskeyRegisterVerify,
} from "./auth/passkey-proxy.js";

// In the request handler, after the existing auth routes:

if (req.url === "/v1/auth/passkeys/register/options" && req.method === "POST") {
  const auth = req.headers.authorization?.replace(/^Bearer\s+/, "") ?? "";
  if (!auth) { respondJson(res, 401, { error: "unauthenticated" }); return; }
  try {
    const result = await proxyPasskeyRegisterOptions(auth, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
    respondJson(res, 200, result);
  } catch (err) {
    if (err instanceof AuthUpstreamError) {
      const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
      respondJson(res, status, { error: "auth_upstream", message: err.message });
    } else {
      console.error("bff: passkey register options:", err);
      respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
    }
  }
  return;
}

if (req.url === "/v1/auth/passkeys/register/verify" && req.method === "POST") {
  const auth = req.headers.authorization?.replace(/^Bearer\s+/, "") ?? "";
  if (!auth) { respondJson(res, 401, { error: "unauthenticated" }); return; }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks);
  if (raw.length > 64 * 1024) { respondJson(res, 413, { error: "payload_too_large" }); return; }
  let body: unknown;
  try { body = JSON.parse(raw.toString("utf8")); }
  catch { respondJson(res, 400, { error: "bad_json" }); return; }
  if (typeof body !== "object" || body === null) { respondJson(res, 400, { error: "bad_body" }); return; }
  try {
    const result = await proxyPasskeyRegisterVerify(body as Parameters<typeof proxyPasskeyRegisterVerify>[0], auth, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
    respondJson(res, 200, result);
  } catch (err) {
    if (err instanceof AuthUpstreamError) {
      const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
      respondJson(res, status, { error: "auth_upstream", message: err.message });
    } else {
      console.error("bff: passkey register verify:", err);
      respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
    }
  }
  return;
}

if (req.url === "/v1/auth/passkeys/auth/options" && req.method === "POST") {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks);
  if (raw.length > 64 * 1024) { respondJson(res, 413, { error: "payload_too_large" }); return; }
  let body: unknown;
  try { body = JSON.parse(raw.toString("utf8")); }
  catch { respondJson(res, 400, { error: "bad_json" }); return; }
  if (typeof body !== "object" || body === null) { respondJson(res, 400, { error: "bad_body" }); return; }
  try {
    const result = await proxyPasskeyAuthOptions(body as Parameters<typeof proxyPasskeyAuthOptions>[0], { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
    respondJson(res, 200, result);
  } catch (err) {
    if (err instanceof AuthUpstreamError) {
      const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
      respondJson(res, status, { error: "auth_upstream", message: err.message });
    } else {
      console.error("bff: passkey auth options:", err);
      respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
    }
  }
  return;
}

if (req.url === "/v1/auth/passkeys/auth/verify" && req.method === "POST") {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks);
  if (raw.length > 64 * 1024) { respondJson(res, 413, { error: "payload_too_large" }); return; }
  let body: unknown;
  try { body = JSON.parse(raw.toString("utf8")); }
  catch { respondJson(res, 400, { error: "bad_json" }); return; }
  if (typeof body !== "object" || body === null) { respondJson(res, 400, { error: "bad_body" }); return; }
  try {
    const result = await proxyPasskeyAuthVerify(body as Parameters<typeof proxyPasskeyAuthVerify>[0], { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
    respondJson(res, 200, result);
  } catch (err) {
    if (err instanceof AuthUpstreamError) {
      const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
      respondJson(res, status, { error: "auth_upstream", message: err.message });
    } else {
      console.error("bff: passkey auth verify:", err);
      respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
    }
  }
  return;
}
```

**Important:** Insert these blocks BEFORE any protected routes that have `requireSession` so the order remains: healthz → auth routes → passkey routes → protected routes. The `extractBearer` import in server.ts is already present from slice 1; reuse it if you prefer over `req.headers.authorization?.replace(...)` — the in-line version is consistent with the existing logout route pattern.

- [ ] **Step 3: Update server.test.ts**

Read existing `services/bff/src/server.test.ts`. Add 4 minimal passthrough tests using the existing mock-integration-svc helper:

```typescript
describe("passkey routes proxy to integration-svc", () => {
  it("POST /v1/auth/passkeys/register/options forwards bearer to upstream", async () => {
    // Use existing startMockIntegrationSvc helper. Configure it to expect
    // POST /v1/auth/passkeys/register/options and respond with options shape.
    // Assert the upstream received the bearer and the BFF returned 200.
  });
  it("POST /v1/auth/passkeys/register/verify forwards bearer + body", async () => { /* ... */ });
  it("POST /v1/auth/passkeys/auth/options forwards body (no bearer)", async () => { /* ... */ });
  it("POST /v1/auth/passkeys/auth/verify returns session token from upstream", async () => { /* ... */ });
});
```

Implementer: write these out properly using the same helper pattern as the existing passthrough tests for products / approvals / audit. Don't shortcut — the tests must actually fire against a mock upstream. Each test should:

1. Configure `startMockIntegrationSvc` to register a response for the specific URL+method
2. Send a fetch to the BFF
3. Assert response status, body, and (where applicable) that the mock upstream received the expected request

If the existing helper doesn't easily support per-test response config, extend it; don't introduce a parallel mock pattern.

- [ ] **Step 4: Typecheck + run all bff tests**

`cd services/bff && pnpm typecheck && pnpm test -- --run`. Expected: typecheck clean. All bff tests pass (existing 57 + ~6 new for passkey-proxy + ~4 new for server.test.ts = ~67/67).

- [ ] **Step 5: Stage + commit**

```bash
git add services/bff/src/auth/passkey-proxy.ts \
        services/bff/src/auth/passkey-proxy.test.ts \
        services/bff/src/server.ts \
        services/bff/src/server.test.ts
git diff --cached --name-only
```

Confirm only those 4 files staged.

```bash
git commit -m "$(cat <<'EOF'
feat(bff): proxy WebAuthn passkey routes to integration-svc

4 routes: register/options + register/verify (Bearer required from
existing session for bootstrap), auth/options + auth/verify
(unauthenticated — passkey auth flow itself authenticates).
Reuses AuthUpstreamError + AuthUpstreamConfig from slice 1.
6/6 passkey-proxy tests + 4/4 server passthrough tests green.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: docs/env.md + STATE.yaml

**Files:**
- Modify: `docs/env.md`
- Modify: `STATE.yaml`

- [ ] **Step 1: Add WebAuthn section to docs/env.md**

Read the current file first. Append (or merge into a logical position):

```markdown
## Auth Slice 2a — WebAuthn (Passkeys)

| Var | Service | Default | Purpose |
|---|---|---|---|
| `WEBAUTHN_RP_ID` | integration-svc | `localhost` | RP ID for WebAuthn ceremonies. **Production: must match the eTLD+1 of the portal origin.** Single-valued — RP-ID-across-multiple-portal-subdomains is a deferred deployment decision (see slice 2d plan). |
| `WEBAUTHN_RP_NAME` | integration-svc | `Hydrax` | Display name shown in the OS/browser passkey prompt |
| `WEBAUTHN_ORIGIN` | integration-svc | `http://localhost:5173` | Expected origin of the calling browser. Production: must be HTTPS (browsers reject WebAuthn over plain HTTP except for `localhost`) |
| `WEBAUTHN_CHALLENGE_TTL_SECONDS` | integration-svc | `60` | Challenge LRU TTL. Range 30–300. |

**Slice 2a does NOT enable production passkey enrollment.** New users have no first-credential bootstrap path until slice 2b (magic-link enrollment) ships. Slice 2a's prototype path uses `AUTH_DEV_LOGIN=1` to bootstrap, which is fail-closed in production.

Slice 2c (email transport) and slice 2d (portal UI) will add: SMTP / SES / Resend creds, browser asset paths, etc.
```

- [ ] **Step 2: Update STATE.yaml**

Append to verification_log:

```
2026-04-25 — auth-slice-2a (passkey server substrate): 0003 migration applied; integration-svc 57/57 tests (token 7 + repo 7 + handlers 10 + passkey-config 5 + challenge-store 6 + passkey-repo 9 + passkey-handlers 12 + server 1) green; bff 67/67 tests green (proxy 5 + middleware 7 + passkey-proxy 6 + server passthrough 4 + existing routes); pnpm -r typecheck/test/build green; manual browser smoke (register → auth → session) verified once via @simplewebauthn/example app pointed at integration-svc. Slice 2a is server-side substrate only; production enrollment requires slice 2b (magic-link).
```

Update `current_focus` to reflect closure of 2a and naming 2b as the next decision (or note that the user picks).

- [ ] **Step 3: Stage + commit**

```bash
git add docs/env.md STATE.yaml
git commit -m "$(cat <<'EOF'
chore(state): record auth slice 2a (passkey substrate) closure

Documents WEBAUTHN_RP_ID/RP_NAME/ORIGIN/CHALLENGE_TTL_SECONDS in
docs/env.md with production caveats. STATE.yaml verification log
covers the full test pass + manual browser smoke. Notes the
slice-2a-is-not-production-ready disclaimer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Manual browser smoke (REQUIRED — slice closure gate)

**Files:** none (manual verification step)

Slice 2a's library-mocked unit tests do not actually exercise the WebAuthn ceremony with real cryptography. We must verify the substrate works end-to-end with a real browser ONCE before declaring slice 2a closed.

- [ ] **Step 1: Start integration-svc and bff**

```bash
# Terminal 1
cd services/integration-svc
DATABASE_URL="postgres://hydrax:hydrax@localhost:5433/hydrax?sslmode=disable" \
AUTH_DEV_LOGIN=1 \
WEBAUTHN_RP_ID=localhost \
WEBAUTHN_ORIGIN=http://localhost:5173 \
PORT=7102 \
  pnpm dev

# Terminal 2
cd services/bff
INTEGRATION_SVC_URL=http://localhost:7102 \
PORT=8080 \
  pnpm dev
```

- [ ] **Step 2: Seed a tenant + user**

```bash
PGPASSWORD=hydrax psql -h localhost -p 5433 -U hydrax -d hydrax <<SQL
INSERT INTO tenants (slug, name, persona) VALUES ('pk-smoke', 'pk-smoke', 'issuer') ON CONFLICT (slug) DO NOTHING;
INSERT INTO users (tenant_id, email, role) SELECT id, 'pk@example.test', 'admin' FROM tenants WHERE slug = 'pk-smoke' ON CONFLICT (tenant_id, email) DO NOTHING;
SQL
```

- [ ] **Step 3: Use a minimal browser harness**

Since slice 2a does not ship UI, use the SimpleWebAuthn example browser app temporarily:

```bash
# In a third terminal
cd /tmp
git clone --depth 1 https://github.com/MasterKale/SimpleWebAuthn.git
cd SimpleWebAuthn/example
# Edit example/index.html to point endpoints at http://localhost:8080/v1/auth/passkeys/...
# (Or write a 50-line index.html with @simplewebauthn/browser and the 4 fetch calls.)
npm install
npm run dev  # serves on http://localhost:5173 (matches our WEBAUTHN_ORIGIN)
```

Alternative, simpler: write a tiny `tools/passkey-smoke.html` in this repo as a one-page harness. ~80 lines of HTML+JS using `@simplewebauthn/browser` from a CDN. Commit it under `tools/` (not as production code).

- [ ] **Step 4: Run the ceremonies**

In the browser at http://localhost:5173:

1. First, get a bootstrap session via dev/login:
   ```js
   const r = await fetch("http://localhost:8080/v1/auth/dev/login", {
     method: "POST", headers: {"content-type": "application/json"},
     body: JSON.stringify({tenant_slug: "pk-smoke", email: "pk@example.test"})
   });
   const {token} = await r.json();
   ```

2. Register a passkey:
   ```js
   const optsRes = await fetch("http://localhost:8080/v1/auth/passkeys/register/options", {
     method: "POST", headers: {authorization: `Bearer ${token}`}
   });
   const opts = await optsRes.json();
   const {startRegistration} = await import("https://esm.sh/@simplewebauthn/browser@10");
   const cred = await startRegistration({optionsJSON: opts});
   const verifyRes = await fetch("http://localhost:8080/v1/auth/passkeys/register/verify", {
     method: "POST", headers: {"content-type": "application/json", authorization: `Bearer ${token}`},
     body: JSON.stringify({response: cred})
   });
   console.log(await verifyRes.json()); // {verified: true}
   ```

3. Authenticate with the passkey:
   ```js
   const authOpts = await (await fetch("http://localhost:8080/v1/auth/passkeys/auth/options", {
     method: "POST", headers: {"content-type": "application/json"},
     body: JSON.stringify({tenant_slug: "pk-smoke", email: "pk@example.test"})
   })).json();
   const {startAuthentication} = await import("https://esm.sh/@simplewebauthn/browser@10");
   const authCred = await startAuthentication({optionsJSON: authOpts});
   const session = await (await fetch("http://localhost:8080/v1/auth/passkeys/auth/verify", {
     method: "POST", headers: {"content-type": "application/json"},
     body: JSON.stringify({tenant_slug: "pk-smoke", email: "pk@example.test", response: authCred})
   })).json();
   console.log(session); // {token: "...", session: {...}}
   ```

4. Verify the issued session works:
   ```js
   const me = await (await fetch("http://localhost:8080/v1/auth/whoami", {
     headers: {authorization: `Bearer ${session.token}`}
   })).json();
   console.log(me); // full session info
   ```

- [ ] **Step 5: Cleanup**

```bash
PGPASSWORD=hydrax psql -h localhost -p 5433 -U hydrax -d hydrax -c "
  DELETE FROM user_passkeys WHERE user_id IN (SELECT id FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE slug='pk-smoke'));
  DELETE FROM user_sessions WHERE tenant_id IN (SELECT id FROM tenants WHERE slug='pk-smoke');
  DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE slug='pk-smoke');
  DELETE FROM tenants WHERE slug='pk-smoke';
"
```

- [ ] **Step 6: Record manual smoke result in STATE.yaml**

Add a one-line note in the verification_log entry from Task 10 confirming "manual browser smoke passed on YYYY-MM-DD".

If the manual smoke FAILS, the slice is NOT done — debug the integration before declaring closure. Most likely failure mode: RP_ID/Origin mismatch between server config and browser origin.

---

## Acceptance Criteria — when slice 2a is "done"

- [ ] All 11 tasks above checked off
- [ ] `pnpm -r --if-present typecheck && pnpm -r --if-present test -- --run && pnpm -r --if-present build` green at repo root (with `INTEGRATION_SVC_DATABASE_URL` set)
- [ ] `db/postgres/apply.sh` from a fresh DB applies 0001 + 0002 + 0003 cleanly
- [ ] Manual browser smoke (Task 11) — **register → authenticate → session issued → whoami works** on real browser with real authenticator
- [ ] Counter monotonicity: replay attempt with same/lower counter is rejected (covered by passkey-handlers.test.ts test "returns 401 when counter monotonicity check fails")
- [ ] STATE.yaml verification_log entry covers all the above
- [ ] 4 commits on the branch (or main): migration / integration-svc package / integration-svc handlers + server / bff / docs+state
- [ ] env.md documents the 4 WebAuthn vars with production caveats
- [ ] Disclaimer is prominent: slice 2a is server-side substrate only

## Slice trigger — open before starting next

After slice 2a lands, the user picks slice 2b (magic-link enrollment) OR slice 2d (portal UI for passkeys) as the next decision point. Recommended order: 2b first (so production has a real bootstrap path), then 2d (portal UI consumes both magic-link and passkey endpoints).

---

## Self-Review Notes (already applied)

- ✓ **Spec coverage:** every component (DB → repo → handlers → server wire → bff proxy → bff wire → docs) has dedicated tasks. Manual browser smoke is its own task to ensure it isn't skipped.
- ✓ **Placeholder scan:** no TODOs / "implement later" / "fill in details". Every step has actual code or actual commands. The one `bff/server.test.ts` block (Task 9 Step 3) intentionally leaves the test bodies as "implementer writes these following the existing helper pattern" — this is justified because the helper signature varies by what's already in the file; pasting wrong code would be worse than asking the implementer to look at the pattern. Flag if you want me to prescribe.
- ✓ **Type consistency:** `PasskeyConfig`, `PasskeyHandlerOptions`, `AuthUpstreamConfig`, `AuthUpstreamError` are referenced consistently across tasks. `mountPasskeyRoutes` signature `(req, res, opts) => boolean` mirrors `mountAuthRoutes`. The `Passkeys` repo class name is used identically in handlers and server.ts.
- ✓ **Library-mock testing strategy:** disclosed in Decision Log. Manual browser smoke is the closure gate.
- ✓ **YAGNI:** no api-client browser helpers (slice 2d). No discoverable credentials (slice 2d). No tenant-aware RP IDs (deferment). No credential-removal endpoint (slice 2d).
- ✓ **Production-readiness disclaimer:** prominently flagged in 3 places (top of plan, commit message of Task 7, env.md section in Task 10).
