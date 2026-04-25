import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { openPool, type Pool } from "../db.js";
import { Sessions } from "./repo.js";
import { Passkeys } from "./passkey-repo.js";
import { createChallengeStore } from "./challenge-store.js";
import { hashToken } from "./token.js";
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
    const token = randomBytes(32).toString("base64url");
    await sessions.createSession({ userId, tenantId, tokenHash: hashToken(token), ttlSeconds: 60 });

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
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
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
    const token = randomBytes(32).toString("base64url");
    await sessions.createSession({ userId, tenantId, tokenHash: hashToken(token), ttlSeconds: 60 });

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
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
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
    const token = randomBytes(32).toString("base64url");
    await sessions.createSession({ userId, tenantId, tokenHash: hashToken(token), ttlSeconds: 60 });

    vi.mocked(webauthn.verifyRegistrationResponse).mockResolvedValue({
      verified: false,
    } as unknown as Awaited<ReturnType<typeof webauthn.verifyRegistrationResponse>>);

    const res = await fetch(`${baseUrl}/v1/auth/passkeys/register/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ response: {} }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when challenge has been consumed (one-time)", async () => {
    const sessions = new Sessions(pool);
    const token = randomBytes(32).toString("base64url");
    await sessions.createSession({ userId, tenantId, tokenHash: hashToken(token), ttlSeconds: 60 });

    const res = await fetch(`${baseUrl}/v1/auth/passkeys/register/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
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
