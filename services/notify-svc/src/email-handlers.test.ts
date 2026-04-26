import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { mountEmailRoutes, type EmailHandlerOptions } from "./email-handlers.js";

let server: http.Server;
let baseUrl: string;
let logs: string[] = [];
// vitest's MockInstance generic shape differs across minor versions; let inference handle it.
let logSpy: { mockRestore: () => void } | undefined;

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
});

afterEach(async () => {
  logSpy?.mockRestore();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("POST /v1/notifications/email — console transport", () => {
  it("returns 202 and logs the email envelope to stdout", async () => {
    await start({ transport: "console" });
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

describe("POST /v1/notifications/email — noop transport", () => {
  it("returns 202 and does NOT log anything", async () => {
    await start({ transport: "noop" });
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

describe("POST /v1/notifications/email — input validation", () => {
  it("returns 400 when body is not JSON", async () => {
    await start({ transport: "console" });
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    await start({ transport: "console" });
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "x@x.test" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 405 for non-POST methods", async () => {
    await start({ transport: "console" });
    const res = await fetch(`${baseUrl}/v1/notifications/email`);
    expect(res.status).toBe(405);
  });

  it("returns 413 when body exceeds 64 KiB", async () => {
    await start({ transport: "console" });
    const big = "x".repeat(70 * 1024);
    const res = await fetch(`${baseUrl}/v1/notifications/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "x@x.test", subject: "s", text: big }),
    });
    expect(res.status).toBe(413);
  });
});
