import { createHmac } from "node:crypto";

export interface WebhookEnvelope {
  url: string;
  payload: unknown;
  headers?: Record<string, string>;
}

export interface WebhookSendResult {
  status: number;
}

export interface WebhookSender {
  send(envelope: WebhookEnvelope): Promise<WebhookSendResult>;
}

export interface HttpWebhookSenderOptions {
  timeoutMs: number;
  hmacSecret?: string;
  fetch?: typeof fetch;
}

export const SIGNATURE_HEADER = "X-Hydrax-Signature";

export function signPayload(secret: string, body: string): string {
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
}

export function createHttpWebhookSender(
  opts: HttpWebhookSenderOptions,
): WebhookSender {
  const fetchImpl = opts.fetch ?? fetch;
  return {
    async send(envelope) {
      const body = JSON.stringify(envelope.payload);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(envelope.headers ?? {}),
      };
      if (opts.hmacSecret) {
        headers[SIGNATURE_HEADER] = signPayload(opts.hmacSecret, body);
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
      try {
        const res = await fetchImpl(envelope.url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });
        return { status: res.status };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Drops envelopes on the floor — used when WEBHOOK_TRANSPORT=noop. */
export const noopWebhookSender: WebhookSender = {
  async send() {
    return { status: 200 };
  },
};
