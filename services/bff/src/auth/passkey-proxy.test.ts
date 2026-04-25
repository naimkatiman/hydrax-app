import { afterEach, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import {
  proxyPasskeyRegisterOptions,
  proxyPasskeyRegisterVerify,
  proxyPasskeyAuthOptions,
  proxyPasskeyAuthVerify,
} from "./passkey-proxy.js";

let upstream: http.Server;
let upstreamUrl: string;
let lastReq: { method?: string; url?: string; auth?: string; body?: string } = {};
let respond: (req: http.IncomingMessage, res: http.ServerResponse) => void;

beforeEach(async () => {
  lastReq = {};
  upstream = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      lastReq = { method: req.method, url: req.url, auth: req.headers.authorization as string | undefined, body };
      respond(req, res);
    });
  });
  await new Promise<void>((r) => upstream.listen(0, r));
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

afterEach(() => new Promise<void>((resolve) => upstream.close(() => resolve())));

describe("proxyPasskeyRegisterOptions", () => {
  it("forwards bearer and returns options", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ challenge: "C", rp: { id: "localhost", name: "Hydrax" } }));
    };
    const result = await proxyPasskeyRegisterOptions("T", { integrationSvcUrl: upstreamUrl });
    expect(lastReq.url).toBe("/v1/auth/passkeys/register/options");
    expect(lastReq.method).toBe("POST");
    expect(lastReq.auth).toBe("Bearer T");
    expect(result.challenge).toBe("C");
  });

  it("throws AuthUpstreamError on 401", async () => {
    respond = (_req, res) => { res.writeHead(401).end(JSON.stringify({ error: "unauthenticated" })); };
    await expect(proxyPasskeyRegisterOptions("bad", { integrationSvcUrl: upstreamUrl }))
      .rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 401 });
  });
});

describe("proxyPasskeyRegisterVerify", () => {
  it("forwards bearer + body and returns verification result", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ verified: true }));
    };
    const result = await proxyPasskeyRegisterVerify({ response: { id: "x" } }, "T", { integrationSvcUrl: upstreamUrl });
    expect(lastReq.url).toBe("/v1/auth/passkeys/register/verify");
    expect(lastReq.auth).toBe("Bearer T");
    expect(JSON.parse(lastReq.body!)).toEqual({ response: { id: "x" } });
    expect(result.verified).toBe(true);
  });
});

describe("proxyPasskeyAuthOptions", () => {
  it("forwards body (no bearer) and returns options", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ challenge: "C", allowCredentials: [{ id: "abc" }] }));
    };
    const result = await proxyPasskeyAuthOptions({ tenant_slug: "t", email: "e@x.test" }, { integrationSvcUrl: upstreamUrl });
    expect(lastReq.url).toBe("/v1/auth/passkeys/auth/options");
    expect(lastReq.auth).toBeUndefined();
    expect(JSON.parse(lastReq.body!)).toEqual({ tenant_slug: "t", email: "e@x.test" });
    expect(result.challenge).toBe("C");
  });

  it("throws AuthUpstreamError with 404 status (no leak distinction)", async () => {
    respond = (_req, res) => { res.writeHead(404).end(JSON.stringify({ error: "not_found" })); };
    await expect(proxyPasskeyAuthOptions({ tenant_slug: "t", email: "e@x.test" }, { integrationSvcUrl: upstreamUrl }))
      .rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 404 });
  });
});

describe("proxyPasskeyAuthVerify", () => {
  it("forwards body (no bearer) and returns session token on success", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ token: "T", session: { id: "s", user_id: "U", tenant_id: "X", role: "admin", expires_at: "2030-01-01T00:00:00Z" } }));
    };
    const result = await proxyPasskeyAuthVerify({ tenant_slug: "t", email: "e@x.test", response: { id: "abc" } }, { integrationSvcUrl: upstreamUrl });
    expect(lastReq.url).toBe("/v1/auth/passkeys/auth/verify");
    expect(lastReq.auth).toBeUndefined();
    expect(result.token).toBe("T");
  });

  it("throws AuthUpstreamError on 401", async () => {
    respond = (_req, res) => { res.writeHead(401).end(JSON.stringify({ error: "unauthenticated" })); };
    await expect(proxyPasskeyAuthVerify({ tenant_slug: "t", email: "e@x.test", response: { id: "abc" } }, { integrationSvcUrl: upstreamUrl }))
      .rejects.toMatchObject({ name: "AuthUpstreamError", httpStatus: 401 });
  });
});
