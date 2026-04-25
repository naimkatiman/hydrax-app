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
  return m?.[1] ?? null;
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
