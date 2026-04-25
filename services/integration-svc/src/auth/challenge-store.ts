export interface ChallengeStoreOptions {
  ttlSeconds: number;
  maxEntries: number;
}

export interface ChallengeStore {
  put(key: string, challenge: string): void;
  consume(key: string): string | null;
}

interface Entry {
  challenge: string;
  expiresAt: number;
}

export function createChallengeStore(opts: ChallengeStoreOptions): ChallengeStore {
  // Insertion-ordered Map preserves LRU semantics: oldest entries are first
  // in iteration order. We re-insert on overwrite to keep ordering correct.
  const entries = new Map<string, Entry>();
  const ttlMs = opts.ttlSeconds * 1000;

  function evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.expiresAt > now) break;  // Map iteration is insertion-ordered
      entries.delete(key);
    }
  }

  return {
    put(key, challenge) {
      evictExpired();
      if (entries.has(key)) entries.delete(key);  // re-insert to refresh ordering
      entries.set(key, { challenge, expiresAt: Date.now() + ttlMs });
      while (entries.size > opts.maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    consume(key) {
      evictExpired();
      const entry = entries.get(key);
      if (!entry) return null;
      entries.delete(key);
      return entry.challenge;
    },
  };
}
