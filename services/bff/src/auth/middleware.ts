import type * as http from "node:http";
import { proxyWhoami, AuthUpstreamError } from "./proxy.js";
import type { AuthUpstreamConfig, WhoamiResult } from "./proxy.js";

export type RequestSession = WhoamiResult;

/** Extract a Bearer token from the Authorization header. Returns null if absent or malformed. */
export function extractBearer(req: http.IncomingMessage): string | null {
  const header = req.headers["authorization"];
  if (!header) return null;
  const match = /^Bearer\s+([A-Za-z0-9_\-]+)$/.exec(header);
  return match ? (match[1] ?? null) : null;
}

/**
 * Validate the incoming request's Bearer token against integration-svc.
 * On success returns the session. On failure writes 401/502 and returns null.
 */
export async function requireSession(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  cfg: AuthUpstreamConfig,
): Promise<RequestSession | null> {
  const token = extractBearer(req);
  if (!token) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: "missing_bearer" }));
    return null;
  }

  try {
    const session = await proxyWhoami(token, cfg);
    return session;
  } catch (err) {
    if (err instanceof AuthUpstreamError && err.httpStatus === 401) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "unauthorized" }));
    } else {
      res.writeHead(502);
      res.end(JSON.stringify({ error: "auth_upstream_error" }));
    }
    return null;
  }
}
