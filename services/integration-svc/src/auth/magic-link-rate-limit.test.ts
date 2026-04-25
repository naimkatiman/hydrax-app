import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimit, type RateLimit } from "./magic-link-rate-limit.js";

describe("createRateLimit", () => {
  let limiter: RateLimit;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = createRateLimit({ max: 3, windowSeconds: 60, maxBuckets: 5 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request", () => {
    expect(limiter.check("alice")).toBe(true);
  });

  it("allows exactly max requests in a window, then blocks", () => {
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(false);
    expect(limiter.check("alice")).toBe(false);
  });

  it("isolates buckets by key", () => {
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(false);
    expect(limiter.check("bob")).toBe(true);
  });

  it("resets after the window elapses", () => {
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(true);
    expect(limiter.check("alice")).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(limiter.check("alice")).toBe(true);
  });

  it("evicts oldest bucket when capacity exceeded", () => {
    limiter.check("a");
    limiter.check("b");
    limiter.check("c");
    limiter.check("d");
    limiter.check("e");
    limiter.check("f");
    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("f")).toBe(true);
    expect(limiter.check("f")).toBe(true);
    expect(limiter.check("f")).toBe(false);
  });
});
