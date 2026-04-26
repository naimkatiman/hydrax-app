import type http from "node:http";

/** Single-origin allowlist driven by the BFF_CORS_ALLOWED_ORIGIN env var.
 *
 *  When the env var is unset (or empty), CORS is disabled — no
 *  Access-Control-Allow-* headers are emitted, and OPTIONS requests fall
 *  through to the regular routing layer. This keeps local development
 *  same-origin without any header noise.
 */
export interface CorsConfig {
  readonly allowedOrigin: string | null;
}

export function loadCorsConfig(env: NodeJS.ProcessEnv): CorsConfig {
  const raw = env.BFF_CORS_ALLOWED_ORIGIN?.trim();
  return { allowedOrigin: raw && raw.length > 0 ? raw : null };
}

/** Sets Access-Control-Allow-Origin + Vary on every response. No-op when
 *  CORS is disabled. Safe to call at the top of any request handler — it
 *  only sets headers; the body and status come later. */
export function applyCorsHeaders(
  res: http.ServerResponse,
  config: CorsConfig,
): void {
  if (!config.allowedOrigin) return;
  res.setHeader("Access-Control-Allow-Origin", config.allowedOrigin);
  res.setHeader("Vary", "Origin");
}

/** Handles OPTIONS preflight requests. Returns true when the response is
 *  fully written (caller must short-circuit), false otherwise. */
export function handlePreflight(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: CorsConfig,
): boolean {
  if (req.method !== "OPTIONS") return false;
  if (!config.allowedOrigin) return false;
  res.setHeader("Access-Control-Allow-Origin", config.allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
  res.setHeader("Vary", "Origin");
  res.writeHead(204);
  res.end();
  return true;
}
