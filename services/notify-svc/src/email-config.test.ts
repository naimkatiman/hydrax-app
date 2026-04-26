import { describe, expect, it } from "vitest";
import { loadEmailConfig } from "./email-config.js";

describe("loadEmailConfig", () => {
  it("defaults to console transport", () => {
    expect(loadEmailConfig({}).transport).toBe("console");
  });

  it("reads EMAIL_TRANSPORT=console", () => {
    expect(loadEmailConfig({ EMAIL_TRANSPORT: "console" }).transport).toBe("console");
  });

  it("reads EMAIL_TRANSPORT=noop", () => {
    expect(loadEmailConfig({ EMAIL_TRANSPORT: "noop" }).transport).toBe("noop");
  });

  it("rejects unknown EMAIL_TRANSPORT (slice 2c will widen)", () => {
    expect(() => loadEmailConfig({ EMAIL_TRANSPORT: "smtp" }))
      .toThrow(/unsupported.*smtp/i);
  });
});
