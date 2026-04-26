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
    if (!user) return;

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
