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
