import type http from "node:http";
import type { EmailSender } from "./email-sender.js";

export interface EmailHandlerOptions {
  sender: EmailSender;
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

/**
 * Returns true if the request matched an email route (and was handled).
 * Returns false if no match — caller falls through to its own 404.
 */
export function mountEmailRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: EmailHandlerOptions,
): boolean {
  const url = req.url ?? "";
  const method = req.method ?? "GET";

  if (url === "/v1/notifications/email") {
    if (method !== "POST") {
      respondJson(res, 405, { error: "method_not_allowed" });
      return true;
    }
    void handleSendEmail(req, res, opts);
    return true;
  }
  return false;
}

async function handleSendEmail(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: EmailHandlerOptions,
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
  const to = (body as Record<string, unknown>).to;
  const subject = (body as Record<string, unknown>).subject;
  const text = (body as Record<string, unknown>).text;
  if (typeof to !== "string" || typeof subject !== "string" || typeof text !== "string" || !to || !subject || !text) {
    respondJson(res, 400, { error: "missing_fields", message: "to, subject, text required" });
    return;
  }

  try {
    await opts.sender.send({ to, subject, text });
    respondJson(res, 202, { accepted: true });
  } catch (err) {
    console.error("notify-svc: email-sender failed:", err);
    respondJson(res, 502, { error: "transport_failed", message: "email transport rejected the message" });
  }
}
