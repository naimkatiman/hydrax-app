import http from "node:http";
import type { AddressInfo } from "node:net";

import { loadUpstreamConfig, type UpstreamConfig } from "./bff/bff.js";
import { loadCorsConfig, applyCorsHeaders, handlePreflight } from "./cors.js";
import { aggregateHealth } from "./healthz/aggregate.js";
import { fetchQuote, MarketDataUpstreamError } from "./marketdata/proxy.js";
import {
  fetchProduct,
  createProduct,
  transitionProduct,
  listProducts,
  ProductsUpstreamError,
} from "./products/proxy.js";
import { fetchSubscription, createSubscription, SubscriptionsUpstreamError } from "./subscriptions/proxy.js";
import { listEvents, appendEvent, AuditUpstreamError, type ListEventsQuery } from "./audit/proxy.js";
import {
  listPendingApprovals,
  fetchApproval,
  createApproval,
  decideApproval,
  ApprovalsUpstreamError,
} from "./approvals/proxy.js";
import { proxyLogout, AuthUpstreamError } from "./auth/proxy.js";
import {
  proxyPasskeyAuthOptions,
  proxyPasskeyAuthVerify,
  proxyPasskeyRegisterOptions,
  proxyPasskeyRegisterVerify,
} from "./auth/passkey-proxy.js";
import {
  proxyMagicLinkRequest,
  proxyMagicLinkConsume,
} from "./auth/magic-link-proxy.js";
import { extractBearer, requireSession } from "./auth/middleware.js";

export interface StartOptions {
  port: number;
  service: string;
  upstreamConfig?: UpstreamConfig;
}

export interface StartResult {
  server: http.Server;
  baseUrl: string;
}

export function startServer(opts: StartOptions): Promise<StartResult> {
  const upstreamConfig = opts.upstreamConfig ?? loadUpstreamConfig(process.env);
  const corsConfig = loadCorsConfig(process.env);

  const server = http.createServer(async (req, res) => {
    applyCorsHeaders(req, res, corsConfig);
    if (handlePreflight(req, res, corsConfig)) return;

    // ── Auth routes (unprotected) ───────────────────────────────────────────
    if (req.url === "/v1/auth/whoami" && req.method === "GET") {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      respondJson(res, 200, session);
      return;
    }

    if (req.url === "/v1/auth/logout" && req.method === "POST") {
      const token = extractBearer(req) ?? "";
      try {
        await proxyLogout(token, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
        respondJson(res, 204, {});
      } catch (err: unknown) {
        if (err instanceof AuthUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "auth_upstream", message: err.message });
        } else {
          console.error("bff: /v1/auth/logout handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.url === "/v1/auth/passkeys/register/options" && req.method === "POST") {
      const auth = extractBearer(req) ?? "";
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
      const auth = extractBearer(req) ?? "";
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

    // ── Magic-link routes (unprotected — magic link IS the authentication) ──
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

    if (req.url === "/v1/products" && req.method === "POST") {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks);
      if (raw.length > 64 * 1024) {
        respondJson(res, 413, { error: "payload_too_large" });
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        respondJson(res, 400, { error: "bad_json" });
        return;
      }
      if (typeof body !== "object" || body === null) {
        respondJson(res, 400, { error: "bad_body" });
        return;
      }
      try {
        const product = await createProduct(body as Parameters<typeof createProduct>[0], {
          workflowSvcUrl: upstreamConfig.workflowSvcUrl,
        });
        respondJson(res, 201, product);
      } catch (err: unknown) {
        if (err instanceof ProductsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "products_upstream", message: err.message });
        } else {
          console.error("bff: /v1/products handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    // /v1/products/{id}/transition POST — must be matched BEFORE the bare
    // /v1/products/{id} GET below.
    if (req.url?.match(/^\/v1\/products\/[^/]+\/transition$/) && req.method === "POST") {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      const segments = req.url.split("/");
      const id = decodeURIComponent(segments[3] ?? "");
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks);
      if (raw.length > 64 * 1024) {
        respondJson(res, 413, { error: "payload_too_large" });
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        respondJson(res, 400, { error: "bad_json" });
        return;
      }
      if (typeof body !== "object" || body === null) {
        respondJson(res, 400, { error: "bad_body" });
        return;
      }
      try {
        const product = await transitionProduct(
          id,
          body as Parameters<typeof transitionProduct>[1],
          { workflowSvcUrl: upstreamConfig.workflowSvcUrl },
        );
        respondJson(res, 200, product);
      } catch (err: unknown) {
        if (err instanceof ProductsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600
            ? err.httpStatus
            : 502;
          respondJson(res, status, { error: "products_upstream", message: err.message });
        } else {
          console.error("bff: /v1/products/{id}/transition handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    // Bare GET /v1/products (with optional ?tenant_id=&limit=&offset=) —
    // matched BEFORE the /v1/products/{id} prefix branch below. The
    // prefix branch only matches paths with a trailing slash so this
    // does not collide, but keeping it adjacent makes the routing
    // intent obvious.
    if (req.url?.match(/^\/v1\/products(\?.*)?$/) && req.method === "GET") {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      const url = new URL(req.url, "http://_");
      // BFF derives tenant from session; the query param (if present
      // from a caller that knows what they're doing) is ignored to
      // keep tenant scoping single-source.
      const tenantId = session.tenant_id;
      if (!tenantId) {
        respondJson(res, 400, { error: "missing_tenant", message: "session has no tenant_id" });
        return;
      }
      const limitRaw = url.searchParams.get("limit");
      const offsetRaw = url.searchParams.get("offset");
      let limit: number | undefined;
      let offset: number | undefined;
      if (limitRaw !== null) {
        const n = Number(limitRaw);
        if (!Number.isFinite(n) || n <= 0) {
          respondJson(res, 400, { error: "bad_query", message: "limit must be a positive integer" });
          return;
        }
        limit = n;
      }
      if (offsetRaw !== null) {
        const n = Number(offsetRaw);
        if (!Number.isFinite(n) || n < 0) {
          respondJson(res, 400, { error: "bad_query", message: "offset must be a non-negative integer" });
          return;
        }
        offset = n;
      }
      try {
        const list = await listProducts(
          { tenantId, limit, offset },
          { workflowSvcUrl: upstreamConfig.workflowSvcUrl },
        );
        respondJson(res, 200, list);
      } catch (err: unknown) {
        if (err instanceof ProductsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "products_upstream", message: err.message });
        } else {
          console.error("bff: /v1/products GET handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.url?.startsWith("/v1/products/") && req.method === "GET") {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      const id = decodeURIComponent(req.url.slice("/v1/products/".length));
      try {
        const product = await fetchProduct(id, { workflowSvcUrl: upstreamConfig.workflowSvcUrl });
        respondJson(res, 200, product);
      } catch (err: unknown) {
        if (err instanceof ProductsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "products_upstream", message: err.message });
        } else {
          console.error("bff: /v1/products/{id} handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.url === "/v1/subscriptions" && req.method === "POST") {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks);
      if (raw.length > 64 * 1024) {
        respondJson(res, 413, { error: "payload_too_large" });
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        respondJson(res, 400, { error: "bad_json" });
        return;
      }
      if (typeof body !== "object" || body === null) {
        respondJson(res, 400, { error: "bad_body" });
        return;
      }
      try {
        const subscription = await createSubscription(body as Parameters<typeof createSubscription>[0], {
          workflowSvcUrl: upstreamConfig.workflowSvcUrl,
        });
        respondJson(res, 201, subscription);
      } catch (err: unknown) {
        if (err instanceof SubscriptionsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "subscriptions_upstream", message: err.message });
        } else {
          console.error("bff: /v1/subscriptions handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.url?.startsWith("/v1/subscriptions/") && req.method === "GET") {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      const id = decodeURIComponent(req.url.slice("/v1/subscriptions/".length));
      try {
        const subscription = await fetchSubscription(id, { workflowSvcUrl: upstreamConfig.workflowSvcUrl });
        respondJson(res, 200, subscription);
      } catch (err: unknown) {
        if (err instanceof SubscriptionsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "subscriptions_upstream", message: err.message });
        } else {
          console.error("bff: /v1/subscriptions/{id} handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.url === "/v1/audit/events" && req.method === "POST") {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks);
      if (raw.length > 64 * 1024) {
        respondJson(res, 413, { error: "payload_too_large" });
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        respondJson(res, 400, { error: "bad_json" });
        return;
      }
      if (typeof body !== "object" || body === null) {
        respondJson(res, 400, { error: "bad_body" });
        return;
      }
      try {
        const event = await appendEvent(body as Parameters<typeof appendEvent>[0], {
          auditSvcUrl: upstreamConfig.auditSvcUrl,
        });
        respondJson(res, 201, event);
      } catch (err: unknown) {
        if (err instanceof AuditUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "audit_upstream", message: err.message });
        } else {
          console.error("bff: /v1/audit/events POST handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.url === "/v1/approvals" && req.method === "POST") {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks);
      if (raw.length > 64 * 1024) {
        respondJson(res, 413, { error: "payload_too_large" });
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        respondJson(res, 400, { error: "bad_json" });
        return;
      }
      if (typeof body !== "object" || body === null) {
        respondJson(res, 400, { error: "bad_body" });
        return;
      }
      try {
        const approval = await createApproval(body as Parameters<typeof createApproval>[0], {
          approvalSvcUrl: upstreamConfig.approvalSvcUrl,
        });
        respondJson(res, 201, approval);
      } catch (err: unknown) {
        if (err instanceof ApprovalsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "approvals_upstream", message: err.message });
        } else {
          console.error("bff: /v1/approvals POST handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    // /v1/approvals/{id}/decide POST — must be matched BEFORE the bare /{id} GET below
    if (req.url?.match(/^\/v1\/approvals\/[^/]+\/decide$/) && req.method === "POST") {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      const segments = req.url.split("/");
      const id = decodeURIComponent(segments[3] ?? "");
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks);
      if (raw.length > 64 * 1024) {
        respondJson(res, 413, { error: "payload_too_large" });
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        respondJson(res, 400, { error: "bad_json" });
        return;
      }
      if (typeof body !== "object" || body === null) {
        respondJson(res, 400, { error: "bad_body" });
        return;
      }
      try {
        const approval = await decideApproval(id, body as Parameters<typeof decideApproval>[1], {
          approvalSvcUrl: upstreamConfig.approvalSvcUrl,
        });
        respondJson(res, 200, approval);
      } catch (err: unknown) {
        if (err instanceof ApprovalsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "approvals_upstream", message: err.message });
        } else {
          console.error("bff: /v1/approvals/{id}/decide handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.method !== "GET") {
      respondJson(res, 405, { error: "method_not_allowed" });
      return;
    }

    if (req.url?.startsWith("/v1/audit/events") && req.method === "GET") {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      const url = new URL(req.url, "http://_");
      const q: ListEventsQuery = {
        tenant_id: url.searchParams.get("tenant_id") ?? "",
        resource_type: url.searchParams.get("resource_type") ?? "",
        resource_id: url.searchParams.get("resource_id") ?? "",
      };
      if (!q.tenant_id || !q.resource_type || !q.resource_id) {
        respondJson(res, 400, {
          error: "missing_query_params",
          message: "tenant_id, resource_type, and resource_id are required",
        });
        return;
      }
      try {
        const events = await listEvents(q, { auditSvcUrl: upstreamConfig.auditSvcUrl });
        respondJson(res, 200, events);
      } catch (err: unknown) {
        if (err instanceof AuditUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "audit_upstream", message: err.message });
        } else {
          console.error("bff: /v1/audit/events GET handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.url === "/v1/approvals" && req.method === "GET") {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      try {
        const list = await listPendingApprovals({ approvalSvcUrl: upstreamConfig.approvalSvcUrl });
        respondJson(res, 200, list);
      } catch (err: unknown) {
        if (err instanceof ApprovalsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "approvals_upstream", message: err.message });
        } else {
          console.error("bff: /v1/approvals GET handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.url?.startsWith("/v1/approvals/") && req.method === "GET") {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      const id = decodeURIComponent(req.url.slice("/v1/approvals/".length));
      try {
        const approval = await fetchApproval(id, { approvalSvcUrl: upstreamConfig.approvalSvcUrl });
        respondJson(res, 200, approval);
      } catch (err: unknown) {
        if (err instanceof ApprovalsUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502;
          respondJson(res, status, { error: "approvals_upstream", message: err.message });
        } else {
          console.error("bff: /v1/approvals/{id} GET handler:", err);
          respondJson(res, 500, { error: "internal", message: "an internal error occurred" });
        }
      }
      return;
    }

    if (req.url === "/" || req.url === "/healthz") {
      respondJson(res, 200, { service: opts.service, status: "ok" });
      return;
    }

    if (req.url === "/healthz/composite") {
      try {
        const composite = await aggregateHealth(upstreamConfig);
        const httpStatus =
          composite.status === "ok" ? 200 : composite.status === "degraded" ? 207 : 503;
        respondJson(res, httpStatus, composite);
      } catch (err: unknown) {
        respondJson(res, 500, {
          error: "aggregate_failed",
          message: err instanceof Error ? err.message : "unknown",
        });
      }
      return;
    }

    if (req.url?.startsWith("/v1/market-data/quotes/")) {
      const session = await requireSession(req, res, { integrationSvcUrl: upstreamConfig.integrationSvcUrl });
      if (!session) return;
      const symbol = decodeURIComponent(req.url.slice("/v1/market-data/quotes/".length));
      try {
        const quote = await fetchQuote(symbol, {
          marketDataSvcUrl: upstreamConfig.marketDataSvcUrl,
        });
        respondJson(res, 200, quote);
      } catch (err: unknown) {
        if (err instanceof MarketDataUpstreamError) {
          const status = err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 600
            ? err.httpStatus
            : 502;
          respondJson(res, status, { error: "market_data_upstream", message: err.message });
        } else {
          console.error("bff: /v1/market-data/quotes/ handler:", err);
          respondJson(res, 500, {
            error: "internal",
            message: "an internal error occurred",
          });
        }
      }
      return;
    }

    respondJson(res, 404, { error: "not_found" });
  });

  return new Promise((resolve) => {
    server.listen(opts.port, () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function respondJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 7103);
  startServer({ port, service: "bff" }).then(({ baseUrl }) => {
    process.stdout.write(`bff listening on ${baseUrl}\n`);
  });
}
