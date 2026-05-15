import type http from "node:http";

/** Origin allowlist driven by the BFF_CORS_ALLOWED_ORIGIN env var.
 *
 *  The env var is a comma-separated list of fully-qualified origins
 *  (e.g. "https://hydraxrail.com,https://hydraxrail.up.railway.app").
 *  Whitespace around each entry is trimmed and empty entries are
 *  discarded. A single value with no commas is supported and behaves
 *  identically to the original single-origin loader.
 *
 *  When the env var is unset (or yields zero usable entries), CORS is
 *  disabled — no Access-Control-Allow-* headers are emitted, and OPTIONS
 *  requests fall through to the regular routing layer. This keeps local
 *  development same-origin without any header noise.
 *
 *  Per-request origin selection echoes only the matched origin (never a
 *  wildcard) to preserve PRD §13 least-privilege. */
export interface CorsConfig {
  readonly allowedOrigins: readonly string[];
}

export function loadCorsConfig(env: NodeJS.ProcessEnv): CorsConfig {
  const raw = env.BFF_CORS_ALLOWED_ORIGIN;
  if (raw === undefined || raw === null) return { allowedOrigins: [] };
  const allowedOrigins = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return { allowedOrigins };
}

/** Returns the inbound request's Origin if it matches the allowlist,
 *  otherwise null. The header lookup is case-insensitive on the header
 *  name (Node lowercases it) but case-sensitive on the value, matching
 *  the spec — origins are compared as opaque strings. */
export function pickAllowedOrigin(
  req: Pick<http.IncomingMessage, "headers">,
  config: CorsConfig,
): string | null {
  if (config.allowedOrigins.length === 0) return null;
  const origin = req.headers.origin;
  if (typeof origin !== "string" || origin.length === 0) return null;
  return config.allowedOrigins.includes(origin) ? origin : null;
}

/** Sets Access-Control-Allow-Origin + Vary on every response when the
 *  inbound Origin is on the allowlist. No-op when CORS is disabled or
 *  the origin is unrecognised. Safe to call at the top of any request
 *  handler — it only sets headers; the body and status come later. */
export function applyCorsHeaders(
  req: Pick<http.IncomingMessage, "headers">,
  res: http.ServerResponse,
  config: CorsConfig,
): void {
  const matched = pickAllowedOrigin(req, config);
  if (!matched) return;
  res.setHeader("Access-Control-Allow-Origin", matched);
  res.setHeader("Vary", "Origin");
}

/** Handles OPTIONS preflight requests. Returns true when the response is
 *  fully written (caller must short-circuit), false otherwise. Preflight
 *  responses always emit 204 when CORS is enabled, even for unrecognised
 *  origins — but only attach Access-Control-Allow-Origin when the origin
 *  is on the allowlist, so the browser will reject the actual cross-
 *  origin request without further round-trips. */
export function handlePreflight(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: CorsConfig,
): boolean {
  if (req.method !== "OPTIONS") return false;
  if (config.allowedOrigins.length === 0) return false;
  const matched = pickAllowedOrigin(req, config);
  if (matched) {
    res.setHeader("Access-Control-Allow-Origin", matched);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
  res.setHeader("Vary", "Origin");
  res.writeHead(204);
  res.end();
  return true;
}
