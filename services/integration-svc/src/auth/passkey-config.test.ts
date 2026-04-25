import { describe, expect, it } from "vitest";
import { loadPasskeyConfig } from "./passkey-config.js";

describe("loadPasskeyConfig", () => {
  it("returns localhost defaults when env is empty", () => {
    const cfg = loadPasskeyConfig({});
    expect(cfg).toEqual({
      rpID: "localhost",
      rpName: "Hydrax",
      origin: "http://localhost:5173",
      challengeTtlSeconds: 60,
    });
  });

  it("reads WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME, WEBAUTHN_ORIGIN", () => {
    const cfg = loadPasskeyConfig({
      WEBAUTHN_RP_ID: "hydrax.com",
      WEBAUTHN_RP_NAME: "Hydrax Platform",
      WEBAUTHN_ORIGIN: "https://issuer.hydrax.com",
    });
    expect(cfg.rpID).toBe("hydrax.com");
    expect(cfg.rpName).toBe("Hydrax Platform");
    expect(cfg.origin).toBe("https://issuer.hydrax.com");
  });

  it("reads WEBAUTHN_CHALLENGE_TTL_SECONDS", () => {
    const cfg = loadPasskeyConfig({ WEBAUTHN_CHALLENGE_TTL_SECONDS: "120" });
    expect(cfg.challengeTtlSeconds).toBe(120);
  });

  it("rejects WEBAUTHN_CHALLENGE_TTL_SECONDS < 30", () => {
    expect(() => loadPasskeyConfig({ WEBAUTHN_CHALLENGE_TTL_SECONDS: "5" }))
      .toThrow(/must be >= 30/);
  });

  it("rejects WEBAUTHN_CHALLENGE_TTL_SECONDS > 300", () => {
    expect(() => loadPasskeyConfig({ WEBAUTHN_CHALLENGE_TTL_SECONDS: "999" }))
      .toThrow(/must be <= 300/);
  });
});
