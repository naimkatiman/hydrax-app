import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  mountWebhookRoutes,
  type WebhookHandlerOptions,
} from "./webhook-handlers.js";
import type { WebhookEnvelope, WebhookSender } from "./webhook-sender.js";

interface RecordedCall {
  url: string;
  payload: unknown;
  headers?: Record<string, string>;
}

function makeRecorder(status = 202) {
  const calls: RecordedCall[] = [];
  const sender: WebhookSender = {
    async send(envelope: WebhookEnvelope) {
      calls.push({
        url: envelope.url,
        payload: envelope.payload,
        headers: envelope.headers,
      });
      return { status };
    },
  };
  return { sender, calls };
}

function makeFailingSender(error: Error): WebhookSender {
  return {
    async send() {
      throw error;
    },
  };
}

function makeNon2xxSender(status: number): WebhookSender {
  return {
    async send() {
      return { status };
    },
  };
}

let server: http.Server;
let baseUrl: string;
let currentOpts: WebhookHandlerOptions;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (mountWebhookRoutes(req, res, currentOpts)) return;
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe("mountWebhookRoutes — POST /v1/notifications/webhook", () => {
  it("returns 202 when sender succeeds and forwards url + payload + headers", async () => {
    const { sender, calls } = makeRecorder(200);
    currentOpts = { sender };
    const res = await fetch(`${baseUrl}/v1/notifications/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: "http://upstream.test/hook",
        payload: { event: "product.transitioned", id: "p1" },
        headers: { "x-trace": "abc" },
      }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { accepted: boolean; upstream_status: number };
    expect(body.accepted).toBe(true);
    expect(body.upstream_status).toBe(200);
    expect(calls).toHaveLength(1);
    const [first] = calls;
    expect(first?.url).toBe("http://upstream.test/hook");
    expect(first?.payload).toEqual({ event: "product.transitioned", id: "p1" });
    expect(first?.headers).toEqual({ "x-trace": "abc" });
  });

  it("returns 502 when sender returns non-2xx upstream status", async () => {
    currentOpts = { sender: makeNon2xxSender(503) };
    const res = await fetch(`${baseUrl}/v1/notifications/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: "http://upstream.test/dead",
        payload: { x: 1 },
      }),
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; upstream_status: number };
    expect(body.error).toBe("transport_failed");
    expect(body.upstream_status).toBe(503);
  });

  it("returns 502 when sender throws (transport error)", async () => {
    currentOpts = { sender: makeFailingSender(new Error("dns_fail")) };
    const res = await fetch(`${baseUrl}/v1/notifications/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: "http://upstream.test/x",
        payload: { x: 1 },
      }),
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("transport_failed");
  });

  it("returns 405 on non-POST methods", async () => {
    const { sender } = makeRecorder();
    currentOpts = { sender };
    const res = await fetch(`${baseUrl}/v1/notifications/webhook`, { method: "GET" });
    expect(res.status).toBe(405);
  });

  it("returns 400 when url is missing or not http(s)", async () => {
    const { sender } = makeRecorder();
    currentOpts = { sender };
    const missing = await fetch(`${baseUrl}/v1/notifications/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: { x: 1 } }),
    });
    expect(missing.status).toBe(400);
    const ftp = await fetch(`${baseUrl}/v1/notifications/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "ftp://nope.test/x", payload: { x: 1 } }),
    });
    expect(ftp.status).toBe(400);
  });

  it("returns 400 when payload is missing", async () => {
    const { sender } = makeRecorder();
    currentOpts = { sender };
    const res = await fetch(`${baseUrl}/v1/notifications/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://upstream.test/x" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when headers is not an object of strings", async () => {
    const { sender } = makeRecorder();
    currentOpts = { sender };
    const res = await fetch(`${baseUrl}/v1/notifications/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: "http://upstream.test/x",
        payload: { x: 1 },
        headers: { "x-num": 42 },
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON body", async () => {
    const { sender } = makeRecorder();
    currentOpts = { sender };
    const res = await fetch(`${baseUrl}/v1/notifications/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json",
    });
    expect(res.status).toBe(400);
  });

  it("returns 413 on payload exceeding 64 KiB body cap", async () => {
    const { sender } = makeRecorder();
    currentOpts = { sender };
    const huge = "x".repeat(80 * 1024);
    const res = await fetch(`${baseUrl}/v1/notifications/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://upstream.test/x", payload: { huge } }),
    });
    expect(res.status).toBe(413);
  });
});
