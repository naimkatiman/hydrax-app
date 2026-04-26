import type http from "node:http";

import { hashToken } from "./token.js";
import type { Sessions } from "./repo.js";

export interface AuthHandlerOptions {
  repo: Sessions;
  ttlSeconds: number;
}

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
