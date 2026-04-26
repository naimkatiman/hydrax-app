import { afterEach, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import {
  proxyMagicLinkRequest,
  proxyMagicLinkConsume,
} from "./magic-link-proxy.js";

let upstream: http.Server;
let upstreamUrl: string;
let lastReq: { method?: string; url?: string; body?: string } = {};
let respond: (req: http.IncomingMessage, res: http.ServerResponse) => void;

beforeEach(async () => {
  lastReq = {};
  upstream = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      lastReq = { method: req.method, url: req.url, body };
      respond(req, res);
    });
  });
  await new Promise<void>((r) => upstream.listen(0, () => r()));
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

afterEach(() => new Promise<void>((resolve) => upstream.close(() => resolve())));

describe("proxyMagicLinkRequest", () => {
  it("forwards body and resolves on 202", async () => {
    respond = (_req, res) => { res.writeHead(202).end(JSON.stringify({ accepted: true })); };
    await proxyMagicLinkRequest(
      { tenant_slug: "acme", email: "alice@acme.test" },
      { integrationSvcUrl: upstreamUrl },
    );
    expect(lastReq.method).toBe("POST");
    expect(lastReq.url).toBe("/v1/auth/magic-link/request");
    expect(JSON.parse(lastReq.body!)).toEqual({ tenant_slug: "acme", email: "alice@acme.test" });
  });

  it("throws AuthUpstreamError on 429 (rate-limited)", async () => {
    respond = (_req, res) => { res.writeHead(429).end(JSON.stringify({ error: "rate_limited" })); };
    await expect(
      proxyMagicLinkRequest({ tenant_slug: "x", email: "x@x.test" }, { integrationSvcUrl: upstreamUrl }),
    ).rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 429 });
  });
});

describe("proxyMagicLinkConsume", () => {
  it("forwards token query param and returns session result on 200", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        token: "T",
        session: { id: "s", user_id: "u", tenant_id: "t", tenant_slug: "acme", email: "a@a.test", role: "admin", expires_at: "2099-01-01T00:00:00Z" },
      }));
    };
    const result = await proxyMagicLinkConsume("the-token-bytes", { integrationSvcUrl: upstreamUrl });
    expect(lastReq.method).toBe("GET");
    expect(lastReq.url).toBe("/v1/auth/magic-link/consume?token=the-token-bytes");
    expect(result.token).toBe("T");
    expect(result.session.role).toBe("admin");
  });

  it("throws AuthUpstreamError on 401 (invalid/expired/used)", async () => {
    respond = (_req, res) => { res.writeHead(401).end(JSON.stringify({ error: "unauthenticated" })); };
    await expect(
      proxyMagicLinkConsume("bad", { integrationSvcUrl: upstreamUrl }),
    ).rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 401 });
  });

  it("throws AuthUpstreamError on 400 (missing token)", async () => {
    respond = (_req, res) => { res.writeHead(400).end(JSON.stringify({ error: "missing_token" })); };
    await expect(
      proxyMagicLinkConsume("", { integrationSvcUrl: upstreamUrl }),
    ).rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 400 });
  });

  it("URL-encodes the token query param", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        token: "x",
        session: { id: "s", user_id: "u", tenant_id: "t", tenant_slug: "a", email: "a@a.test", role: "admin", expires_at: "2099-01-01T00:00:00Z" },
      }));
    };
    await proxyMagicLinkConsume("a+b/c=d", { integrationSvcUrl: upstreamUrl });
    expect(lastReq.url).toBe("/v1/auth/magic-link/consume?token=a%2Bb%2Fc%3Dd");
  });
});
