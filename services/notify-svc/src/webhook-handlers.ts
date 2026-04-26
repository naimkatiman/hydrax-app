import type http from "node:http";
import type { WebhookSender } from "./webhook-sender.js";

export interface WebhookHandlerOptions {
  sender: WebhookSender;
}

const MAX_BODY_BYTES = 64 * 1024;

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

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Returns true if the request matched a webhook route (and was handled).
 * Returns false if no match — caller falls through to its own 404.
 */
export function mountWebhookRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: WebhookHandlerOptions,
): boolean {
  const url = req.url ?? "";
  const method = req.method ?? "GET";
  if (url === "/v1/notifications/webhook") {
    if (method !== "POST") {
      respondJson(res, 405, { error: "method_not_allowed" });
      return true;
    }
    void handleSendWebhook(req, res, opts);
    return true;
  }
  return false;
}

async function handleSendWebhook(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: WebhookHandlerOptions,
): Promise<void> {
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad_body";
    if (msg === "payload_too_large") {
      respondJson(res, 413, { error: "payload_too_large" });
      return;
    }
    respondJson(res, 400, { error: "bad_json" });
    return;
  }
  if (!body || typeof body !== "object") {
    respondJson(res, 400, { error: "bad_body" });
    return;
  }
  const url = (body as Record<string, unknown>).url;
  const payload = (body as Record<string, unknown>).payload;
  const customHeaders = (body as Record<string, unknown>).headers;

  if (!isHttpUrl(url)) {
    respondJson(res, 400, {
      error: "missing_fields",
      message: "url must be an http(s) URL",
    });
    return;
  }
  if (payload === undefined) {
    respondJson(res, 400, {
      error: "missing_fields",
      message: "payload is required",
    });
    return;
  }

  let headers: Record<string, string> | undefined;
  if (customHeaders !== undefined) {
    if (
      typeof customHeaders !== "object" ||
      customHeaders === null ||
      Array.isArray(customHeaders)
    ) {
      respondJson(res, 400, {
        error: "bad_body",
        message: "headers must be an object of strings",
      });
      return;
    }
    const entries = Object.entries(customHeaders as Record<string, unknown>);
    if (!entries.every(([, v]) => typeof v === "string")) {
      respondJson(res, 400, {
        error: "bad_body",
        message: "headers values must be strings",
      });
      return;
    }
    headers = Object.fromEntries(entries) as Record<string, string>;
  }

  try {
    const result = await opts.sender.send({
      url,
      payload,
      ...(headers ? { headers } : {}),
    });
    if (result.status >= 200 && result.status < 300) {
      respondJson(res, 202, {
        accepted: true,
        upstream_status: result.status,
      });
    } else {
      respondJson(res, 502, {
        error: "transport_failed",
        upstream_status: result.status,
      });
    }
  } catch (err) {
    console.error("notify-svc: webhook-sender failed:", err);
    respondJson(res, 502, {
      error: "transport_failed",
      message: "webhook transport rejected the message",
    });
  }
}
