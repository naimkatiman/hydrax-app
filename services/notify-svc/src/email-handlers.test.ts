import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { mountEmailRoutes, type EmailHandlerOptions } from "./email-handlers.js";
import { consoleSender, noopSender, type EmailSender, type EmailEnvelope } from "./email-sender.js";

let server: http.Server;
let baseUrl: string;
let logs: string[] = [];
let logSpy: { mockRestore: () => void } | undefined;
let errSpy: { mockRestore: () => void } | undefined;

function start(opts: EmailHandlerOptions): Promise<void> {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      if (!mountEmailRoutes(req, res, opts)) {
        res.writeHead(404).end();
      }
    });
    server.listen(0, () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

beforeEach(() => {
  logs = [];
  logSpy = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
    logs.push(String(msg));
  });
  errSpy = vi.spyOn(console, "error").mockImplementation(() => { /* swallow */ });
});

afterEach(async () => {
  logSpy?.mockRestore();
  errSpy?.mockRestore();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("POST /v1/notifications/email — console sender", () => {
  it("returns 202 and logs the email envelope to stdout", async () => {
    await start({ sender: consoleSender });
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "alice@example.test", subject: "Hi", text: "your link: https://x.test/abc" }),
    });
    expect(res.status).toBe(202);
    const log = logs.find((l) => l.includes("[notify-svc:email]"));
    expect(log).toBeDefined();
    expect(log!).toContain("To: alice@example.test");
    expect(log!).toContain("Subject: Hi");
    expect(log!).toContain("your link: https://x.test/abc");
  });
});

describe("POST /v1/notifications/email — noop sender", () => {
  it("returns 202 and does NOT log anything", async () => {
    await start({ sender: noopSender });
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "x@x.test", subject: "s", text: "t" }),
    });
    expect(res.status).toBe(202);
    const log = logs.find((l) => l.includes("[notify-svc:email]"));
    expect(log).toBeUndefined();
  });
});

describe("POST /v1/notifications/email — sender dispatches envelope", () => {
  it("forwards the parsed envelope to the injected sender (smtp parity)", async () => {
    const calls: EmailEnvelope[] = [];
    const recordingSender: EmailSender = {
      async send(env) { calls.push(env); },
    };
    await start({ sender: recordingSender });
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "ml@example.test", subject: "Sign in", text: "https://hydrax.test/auth?token=ABC" }),
    });
    expect(res.status).toBe(202);
    expect(calls).toEqual([
      { to: "ml@example.test", subject: "Sign in", text: "https://hydrax.test/auth?token=ABC" },
    ]);
  });

  it("returns 502 when the sender rejects (smtp transport failure)", async () => {
    const failingSender: EmailSender = {
      async send() { throw new Error("ECONNREFUSED 127.0.0.1:25"); },
    };
    await start({ sender: failingSender });
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "x@x.test", subject: "s", text: "t" }),
    });
    expect(res.status).toBe(502);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("transport_failed");
  });
});

describe("POST /v1/notifications/email — input validation", () => {
  it("returns 400 when body is not JSON", async () => {
    await start({ sender: consoleSender });
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    await start({ sender: consoleSender });
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "x@x.test" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 405 for non-POST methods", async () => {
    await start({ sender: consoleSender });
    const res = await fetch(`${baseUrl}/v1/notifications/email`);
    expect(res.status).toBe(405);
  });

  it("returns 413 when body exceeds 64 KiB", async () => {
    await start({ sender: consoleSender });
    const big = "x".repeat(70 * 1024);
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "x@x.test", subject: "s", text: big }),
    });
    expect(res.status).toBe(413);
  });
});
