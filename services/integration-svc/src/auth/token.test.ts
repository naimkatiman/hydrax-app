import { describe, expect, it } from "vitest";
import { compareTokenHash, generateToken, hashToken } from "./token.js";

describe("token", () => {
  it("generateToken returns 43-char base64url string (32 bytes)", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("generateToken returns unique values across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateToken());
    expect(seen.size).toBe(1000);
  });

  it("hashToken is deterministic", () => {
    const t = generateToken();
    expect(hashToken(t).equals(hashToken(t))).toBe(true);
  });

  it("hashToken returns 32-byte Buffer", () => {
    expect(hashToken("anything").length).toBe(32);
  });

  it("compareTokenHash returns true for equal hashes", () => {
    const h = hashToken("abc");
    expect(compareTokenHash(h, hashToken("abc"))).toBe(true);
  });

  it("compareTokenHash returns false for different hashes", () => {
    expect(compareTokenHash(hashToken("a"), hashToken("b"))).toBe(false);
  });

  it("compareTokenHash returns false for different lengths", () => {
    expect(compareTokenHash(Buffer.from([1, 2]), Buffer.from([1, 2, 3]))).toBe(false);
  });
});
