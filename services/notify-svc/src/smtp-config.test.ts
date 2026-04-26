import { describe, expect, it } from "vitest";
import { loadSmtpConfig } from "./smtp-config.js";

describe("loadSmtpConfig", () => {
  it("loads host + default port 587 + default FROM when only SMTP_HOST is set", () => {
    const cfg = loadSmtpConfig({ SMTP_HOST: "smtp.example.test" });
    expect(cfg.host).toBe("smtp.example.test");
    expect(cfg.port).toBe(587);
    expect(cfg.from).toBe("noreply@hydrax.local");
    expect(cfg.user).toBeUndefined();
    expect(cfg.pass).toBeUndefined();
    expect(cfg.secure).toBe(false);
  });

  it("requires SMTP_HOST", () => {
    expect(() => loadSmtpConfig({})).toThrow(/SMTP_HOST is required/);
  });

  it("reads SMTP_PORT and validates the range", () => {
    expect(loadSmtpConfig({ SMTP_HOST: "h", SMTP_PORT: "25" }).port).toBe(25);
    expect(() => loadSmtpConfig({ SMTP_HOST: "h", SMTP_PORT: "0" })).toThrow(/must be >= 1/);
    expect(() => loadSmtpConfig({ SMTP_HOST: "h", SMTP_PORT: "70000" })).toThrow(/must be <= 65535/);
    expect(() => loadSmtpConfig({ SMTP_HOST: "h", SMTP_PORT: "abc" })).toThrow(/positive integer/);
  });

  it("auto-enables secure on port 465", () => {
    expect(loadSmtpConfig({ SMTP_HOST: "h", SMTP_PORT: "465" }).secure).toBe(true);
    expect(loadSmtpConfig({ SMTP_HOST: "h", SMTP_PORT: "587" }).secure).toBe(false);
  });

  it("respects SMTP_SECURE explicit override", () => {
    expect(loadSmtpConfig({ SMTP_HOST: "h", SMTP_SECURE: "true" }).secure).toBe(true);
    expect(loadSmtpConfig({ SMTP_HOST: "h", SMTP_PORT: "465", SMTP_SECURE: "false" }).secure).toBe(false);
    expect(loadSmtpConfig({ SMTP_HOST: "h", SMTP_SECURE: "1" }).secure).toBe(true);
    expect(loadSmtpConfig({ SMTP_HOST: "h", SMTP_PORT: "465", SMTP_SECURE: "0" }).secure).toBe(false);
    expect(() => loadSmtpConfig({ SMTP_HOST: "h", SMTP_SECURE: "yes" })).toThrow(/must be 'true' or 'false'/);
  });

  it("requires SMTP_USER and SMTP_PASS to be set together", () => {
    expect(() => loadSmtpConfig({ SMTP_HOST: "h", SMTP_USER: "u" })).toThrow(/together/);
    expect(() => loadSmtpConfig({ SMTP_HOST: "h", SMTP_PASS: "p" })).toThrow(/together/);
    const both = loadSmtpConfig({ SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p" });
    expect(both.user).toBe("u");
    expect(both.pass).toBe("p");
  });

  it("reads SMTP_FROM", () => {
    const cfg = loadSmtpConfig({ SMTP_HOST: "h", SMTP_FROM: "alerts@hydrax.com" });
    expect(cfg.from).toBe("alerts@hydrax.com");
  });
});
