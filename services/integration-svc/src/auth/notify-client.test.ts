import { afterEach, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { sendEmail, NotifyUpstreamError } from "./notify-client.js";

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

describe("sendEmail", () => {
  it("POSTs to /v1/notifications/email with body and returns void on 202", async () => {
    respond = (_req, res) => { res.writeHead(202).end(); };
    await sendEmail(
      { to: "alice@example.test", subject: "Hi", text: "Click here: https://x.test/abc" },
      { notifySvcUrl: upstreamUrl },
    );
    expect(lastReq.method).toBe("POST");
    expect(lastReq.url).toBe("/v1/notifications/email");
    expect(JSON.parse(lastReq.body!)).toEqual({
      to: "alice@example.test",
      subject: "Hi",
      text: "Click here: https://x.test/abc",
    });
  });

  it("throws NotifyUpstreamError on non-2xx response", async () => {
    respond = (_req, res) => { res.writeHead(500).end(JSON.stringify({ error: "internal" })); };
    await expect(
      sendEmail({ to: "x@x.test", subject: "S", text: "T" }, { notifySvcUrl: upstreamUrl }),
    ).rejects.toMatchObject({ name: "NotifyUpstreamError", httpStatus: 500 });
  });

  it("throws NotifyUpstreamError on network failure", async () => {
    await new Promise<void>((r) => upstream.close(() => r()));
    await expect(
      sendEmail({ to: "x@x.test", subject: "S", text: "T" }, { notifySvcUrl: upstreamUrl }),
    ).rejects.toThrow();
  });

  it("trims trailing slash on notifySvcUrl", async () => {
    respond = (_req, res) => { res.writeHead(202).end(); };
    await sendEmail(
      { to: "a@a.test", subject: "s", text: "t" },
      { notifySvcUrl: `${upstreamUrl}/` },
    );
    expect(lastReq.url).toBe("/v1/notifications/email");
  });
});
