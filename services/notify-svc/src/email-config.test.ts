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

  it("reads EMAIL_TRANSPORT=smtp (added in slice 2c)", () => {
    expect(loadEmailConfig({ EMAIL_TRANSPORT: "smtp" }).transport).toBe("smtp");
  });

  it("rejects unknown EMAIL_TRANSPORT (e.g. 'sendgrid')", () => {
    expect(() => loadEmailConfig({ EMAIL_TRANSPORT: "sendgrid" }))
      .toThrow(/unsupported.*sendgrid/i);
  });
});
