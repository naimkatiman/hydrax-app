import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChallengeStore, type ChallengeStore } from "./challenge-store.js";

describe("ChallengeStore", () => {
  let store: ChallengeStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = createChallengeStore({ ttlSeconds: 60, maxEntries: 5 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves a challenge", () => {
    store.put("user-1", "challenge-abc");
    expect(store.consume("user-1")).toBe("challenge-abc");
  });

  it("consume removes the entry (one-time use)", () => {
    store.put("user-1", "challenge-abc");
    expect(store.consume("user-1")).toBe("challenge-abc");
    expect(store.consume("user-1")).toBeNull();
  });

  it("returns null for unknown key", () => {
    expect(store.consume("nope")).toBeNull();
  });

  it("expires entry after ttlSeconds", () => {
    store.put("user-1", "challenge-abc");
    vi.advanceTimersByTime(61_000);
    expect(store.consume("user-1")).toBeNull();
  });

  it("evicts oldest when capacity exceeded", () => {
    store.put("a", "1");
    store.put("b", "2");
    store.put("c", "3");
    store.put("d", "4");
    store.put("e", "5");
    store.put("f", "6"); // evicts "a"
    expect(store.consume("a")).toBeNull();
    expect(store.consume("f")).toBe("6");
  });

  it("overwrites existing key without growing size", () => {
    for (let i = 0; i < 5; i++) store.put(`k${i}`, `v${i}`);
    store.put("k0", "v0-new");
    expect(store.consume("k0")).toBe("v0-new");
    expect(store.consume("k4")).toBe("v4");
  });
});
