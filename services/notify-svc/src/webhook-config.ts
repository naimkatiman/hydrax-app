export type WebhookTransport = "http" | "noop";

export interface WebhookConfig {
  transport: WebhookTransport;
  timeoutMs: number;
  hmacSecret?: string;
}

const SUPPORTED: ReadonlyArray<WebhookTransport> = ["http", "noop"];
const DEFAULT_TIMEOUT_MS = 5000;

export function loadWebhookConfig(
  env: Record<string, string | undefined>,
): WebhookConfig {
  const rawTransport = env.WEBHOOK_TRANSPORT;
  let transport: WebhookTransport = "http";
  if (rawTransport !== undefined && rawTransport !== "") {
    if (!SUPPORTED.includes(rawTransport as WebhookTransport)) {
      throw new Error(
        `WEBHOOK_TRANSPORT unsupported: '${rawTransport}' (supported: ${SUPPORTED.join(", ")})`,
      );
    }
    transport = rawTransport as WebhookTransport;
  }

  const rawTimeout = env.WEBHOOK_TIMEOUT_MS;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (rawTimeout !== undefined && rawTimeout !== "") {
    const parsed = Number(rawTimeout);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(
        `WEBHOOK_TIMEOUT_MS invalid: '${rawTimeout}' (must be positive number)`,
      );
    }
    timeoutMs = parsed;
  }

  const hmacSecret = env.WEBHOOK_HMAC_SECRET;
  return hmacSecret
    ? { transport, timeoutMs, hmacSecret }
    : { transport, timeoutMs };
}
