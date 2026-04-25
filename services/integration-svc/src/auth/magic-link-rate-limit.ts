export interface RateLimitOptions {
  max: number;
  windowSeconds: number;
  maxBuckets: number;
}

export interface RateLimit {
  /** Returns true if the request is allowed (and increments the bucket counter); false if blocked. */
  check(key: string): boolean;
}

interface Bucket {
  count: number;
  windowStart: number;
}

export function createRateLimit(opts: RateLimitOptions): RateLimit {
  // Insertion-ordered Map = LRU iteration. Re-insert on access keeps recency.
  const buckets = new Map<string, Bucket>();
  const windowMs = opts.windowSeconds * 1000;

  function evictOldestIfFull(): void {
    while (buckets.size >= opts.maxBuckets) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }

  return {
    check(key) {
      const now = Date.now();
      let bucket = buckets.get(key);

      if (bucket && now - bucket.windowStart >= windowMs) {
        bucket = undefined;
        buckets.delete(key);
      }

      if (!bucket) {
        evictOldestIfFull();
        bucket = { count: 0, windowStart: now };
        buckets.set(key, bucket);
      } else {
        buckets.delete(key);
        buckets.set(key, bucket);
      }

      if (bucket.count >= opts.max) return false;
      bucket.count += 1;
      return true;
    },
  };
}
