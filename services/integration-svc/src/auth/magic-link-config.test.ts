import { describe, expect, it } from "vitest";
import { loadMagicLinkConfig } from "./magic-link-config.js";

describe("loadMagicLinkConfig", () => {
  it("returns localhost defaults when env is empty", () => {
    const cfg = loadMagicLinkConfig({});
    expect(cfg).toEqual({
      ttlSeconds: 900,
      rateLimitMax: 3,
      rateLimitWindowSeconds: 900,
      baseUrl: "http://localhost:5173/auth/magic-link",
    });
  });

  it("reads MAGIC_LINK_TTL_SECONDS", () => {
    const cfg = loadMagicLinkConfig({ MAGIC_LINK_TTL_SECONDS: "300" });
    expect(cfg.ttlSeconds).toBe(300);
  });

  it("reads MAGIC_LINK_RATE_LIMIT_PER_WINDOW", () => {
    const cfg = loadMagicLinkConfig({ MAGIC_LINK_RATE_LIMIT_PER_WINDOW: "5" });
    expect(cfg.rateLimitMax).toBe(5);
  });

  it("reads MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS", () => {
    const cfg = loadMagicLinkConfig({ MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS: "60" });
    expect(cfg.rateLimitWindowSeconds).toBe(60);
  });

  it("reads MAGIC_LINK_BASE_URL and trims trailing slash", () => {
    const cfg = loadMagicLinkConfig({ MAGIC_LINK_BASE_URL: "https://hydrax.com/auth/m/" });
    expect(cfg.baseUrl).toBe("https://hydrax.com/auth/m");
  });

  it("rejects MAGIC_LINK_TTL_SECONDS < 60", () => {
    expect(() => loadMagicLinkConfig({ MAGIC_LINK_TTL_SECONDS: "30" }))
      .toThrow(/must be >= 60/);
  });

  it("rejects MAGIC_LINK_TTL_SECONDS > 3600", () => {
    expect(() => loadMagicLinkConfig({ MAGIC_LINK_TTL_SECONDS: "9999" }))
      .toThrow(/must be <= 3600/);
  });

  it("rejects MAGIC_LINK_RATE_LIMIT_PER_WINDOW < 1", () => {
    expect(() => loadMagicLinkConfig({ MAGIC_LINK_RATE_LIMIT_PER_WINDOW: "0" }))
      .toThrow(/must be >= 1/);
  });

  it("rejects MAGIC_LINK_RATE_LIMIT_PER_WINDOW > 10", () => {
    expect(() => loadMagicLinkConfig({ MAGIC_LINK_RATE_LIMIT_PER_WINDOW: "100" }))
      .toThrow(/must be <= 10/);
  });

  it("rejects non-integer TTL", () => {
    expect(() => loadMagicLinkConfig({ MAGIC_LINK_TTL_SECONDS: "abc" }))
      .toThrow(/positive integer/);
  });
});
