import { describe, it, expect } from "vitest";
import { loadWebhookConfig } from "./webhook-config.js";

describe("loadWebhookConfig", () => {
  it("defaults to http transport, 5000ms timeout, no hmac secret", () => {
    const cfg = loadWebhookConfig({});
    expect(cfg.transport).toBe("http");
    expect(cfg.timeoutMs).toBe(5000);
    expect(cfg.hmacSecret).toBeUndefined();
  });

  it("accepts http transport explicitly", () => {
    const cfg = loadWebhookConfig({ WEBHOOK_TRANSPORT: "http" });
    expect(cfg.transport).toBe("http");
  });

  it("accepts noop transport", () => {
    const cfg = loadWebhookConfig({ WEBHOOK_TRANSPORT: "noop" });
    expect(cfg.transport).toBe("noop");
  });

  it("treats empty WEBHOOK_TRANSPORT as default (http)", () => {
    const cfg = loadWebhookConfig({ WEBHOOK_TRANSPORT: "" });
    expect(cfg.transport).toBe("http");
  });

  it("rejects unsupported transport values", () => {
    expect(() => loadWebhookConfig({ WEBHOOK_TRANSPORT: "smtp" })).toThrow(
      /WEBHOOK_TRANSPORT unsupported/,
    );
  });

  it("parses WEBHOOK_TIMEOUT_MS when provided", () => {
    const cfg = loadWebhookConfig({ WEBHOOK_TIMEOUT_MS: "1500" });
    expect(cfg.timeoutMs).toBe(1500);
  });

  it("rejects non-positive WEBHOOK_TIMEOUT_MS", () => {
    expect(() => loadWebhookConfig({ WEBHOOK_TIMEOUT_MS: "0" })).toThrow(
      /WEBHOOK_TIMEOUT_MS invalid/,
    );
    expect(() => loadWebhookConfig({ WEBHOOK_TIMEOUT_MS: "-50" })).toThrow(
      /WEBHOOK_TIMEOUT_MS invalid/,
    );
    expect(() => loadWebhookConfig({ WEBHOOK_TIMEOUT_MS: "not-a-number" })).toThrow(
      /WEBHOOK_TIMEOUT_MS invalid/,
    );
  });

  it("attaches WEBHOOK_HMAC_SECRET when set, omits when empty", () => {
    const withSecret = loadWebhookConfig({ WEBHOOK_HMAC_SECRET: "shh" });
    expect(withSecret.hmacSecret).toBe("shh");
    const withoutSecret = loadWebhookConfig({ WEBHOOK_HMAC_SECRET: "" });
    expect(withoutSecret.hmacSecret).toBeUndefined();
  });
});
